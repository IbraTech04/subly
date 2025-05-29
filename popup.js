class PopupController {
  constructor() {
    this.fileInput = document.getElementById('fileInput');
    this.loadBtn = document.getElementById('loadBtn');
    this.status = document.getElementById('status');
    this.dropArea = document.getElementById('dropArea');
    this.urlInput = document.getElementById('urlInput');
    this.fetchBtn = document.getElementById('fetchBtn');
    this.selectedFile = null;
    this.srtContent = null;
    this.settingsPanel = document.getElementById('settingsPanel');
    this.toggleSettings = document.getElementById('toggleSettings');
    this.fontSize = document.getElementById('fontSize');
    this.position = document.getElementById('position');    this.opacity = document.getElementById('opacity');
    this.textColor = document.getElementById('textColor');
    this.subtitleStatus = document.getElementById('subtitleStatus');
    this.statusText = document.getElementById('statusText');
    this.toggleSubtitlesBtn = document.getElementById('toggleSubtitlesBtn');
    this.updateTimeout = null;
    
    this.init();
    this.loadSettings();
  }
  
  init() {
    this.setupEventListeners();
  }
  
  debounce(func, wait) {
    return (...args) => {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  async loadSettings() {
    const result = await chrome.storage.sync.get(['subtitleSettings', 'subtitlesEnabled']);
    const settings = result.subtitleSettings || {
      fontSize: 18,
      position: 'bottom',
      opacity: 80,
      textColor: '#ffffff'
    };

    // Update UI with initial values
    this.fontSize.textContent = settings.fontSize;
    this.position.value = settings.position;
    this.opacity.textContent = settings.opacity;
    this.textColor.value = settings.textColor;
    
    // Update subtitle status
    this.updateSubtitleStatus(result.subtitlesEnabled !== false);
  }

  setupEventListeners() {
    // File input change
    this.fileInput.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files[0]);
    });
    
    // Drop area click
    this.dropArea.addEventListener('click', () => {
      this.fileInput.click();
    });
    
    // Drag and drop
    this.dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropArea.classList.add('dragover');
    });
    
    this.dropArea.addEventListener('dragleave', () => {
      this.dropArea.classList.remove('dragover');
    });
    
    this.dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropArea.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    // URL paste handling
    this.urlInput.addEventListener('input', () => {
      const url = this.urlInput.value.trim();
      this.fetchBtn.disabled = !url;
    });

    // Fetch button click
    this.fetchBtn.addEventListener('click', () => {
      this.handleUrlFetch(this.urlInput.value.trim());
    });
    
    // Load button click
    this.loadBtn.addEventListener('click', () => {
      this.loadSubtitles();
    });

    // Settings toggle
    this.toggleSettings.addEventListener('click', () => {
      this.settingsPanel.classList.toggle('visible');
    });    // Font size controls with real-time updates
    document.querySelectorAll('[data-action="increaseSize"], [data-action="decreaseSize"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentSize = parseInt(this.fontSize.textContent);
        const newSize = btn.dataset.action === 'increaseSize' ? 
          Math.min(32, currentSize + 2) : 
          Math.max(12, currentSize - 2);
        this.fontSize.textContent = newSize;
        this.debouncedUpdateSetting('fontSize', newSize);
      });
    });

    // Opacity controls with real-time updates
    document.querySelectorAll('[data-action="increaseOpacity"], [data-action="decreaseOpacity"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentOpacity = parseInt(this.opacity.textContent);
        const newOpacity = btn.dataset.action === 'increaseOpacity' ? 
          Math.min(100, currentOpacity + 10) : 
          Math.max(0, currentOpacity - 10);
        this.opacity.textContent = newOpacity;
        this.debouncedUpdateSetting('opacity', newOpacity);
      });
    });

    // Position select with immediate update
    this.position.addEventListener('change', (e) => {
      this.updateSetting('position', e.target.value);
    });    // Text color with real-time updates
    this.textColor.addEventListener('input', (e) => {
      this.debouncedUpdateSetting('textColor', e.target.value);
    });

    // Toggle subtitles button
    this.toggleSubtitlesBtn.addEventListener('click', () => {
      this.toggleSubtitles();
    });

    // Initialize debounced update function
    this.debouncedUpdateSetting = this.debounce(this.updateSetting.bind(this), 100);
  }
  
  handleFileSelect(file) {
    if (!file) return;
    
    if (file.type !== 'application/x-subrip' && !file.name.endsWith('.srt')) {
      this.showStatus('Please select a valid SRT file', 'error');
      return;
    }
    
    this.selectedFile = file;
    this.srtContent = null;
    this.loadBtn.disabled = false;
    this.dropArea.querySelector('.file-label').textContent = `Selected: ${file.name}`;
    this.urlInput.value = '';
    this.clearStatus();
  }

  async handleUrlFetch(url) {
    if (!url) return;

    try {
      this.fetchBtn.disabled = true;
      this.showStatus('Fetching SRT file...', 'info');

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();
      if (!content.includes('-->')) {
        throw new Error('Invalid SRT format');
      }

      this.srtContent = content;
      this.selectedFile = null;
      this.loadBtn.disabled = false;
      this.dropArea.querySelector('.file-label').textContent = 'SRT file fetched from URL';
      this.showStatus('SRT file fetched successfully!', 'success');
    } catch (error) {
      console.error('Error fetching SRT:', error);
      this.showStatus('Error fetching SRT file. Please check the URL.', 'error');
    } finally {
      this.fetchBtn.disabled = false;
    }
  }
  
  async loadSubtitles() {
    if (!this.selectedFile && !this.srtContent) return;
    
    try {
      this.loadBtn.disabled = true;
      this.showStatus('Loading subtitles...', 'info');
      
      let srtContent = this.srtContent;
      if (this.selectedFile) {
        srtContent = await this.readFile(this.selectedFile);
      }
      
      // Get active tab and send message to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('youtube.com')) {
        this.showStatus('Please navigate to a YouTube video first', 'error');
        this.loadBtn.disabled = false;
        return;
      }
        await chrome.tabs.sendMessage(tab.id, {
        action: 'loadSubtitles',
        srtContent: srtContent
      });
      
      this.showStatus('Subtitles loaded successfully!', 'success');
      this.updateSubtitleStatus(true); // Show subtitle status as enabled
      
      // Auto-close popup after 2 seconds
      setTimeout(() => {
        window.close();
      }, 2000);
      
    } catch (error) {
      console.error('Error loading subtitles:', error);
      this.showStatus('Error loading subtitles. Please try again.', 'error');
      this.loadBtn.disabled = false;
    }
  }
  
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }
  
  showStatus(message, type) {
    this.status.textContent = message;
    this.status.className = `status ${type}`;
    this.status.style.display = 'block';
  }
  
  clearStatus() {
    this.status.style.display = 'none';
  }

  async updateSetting(key, value) {
    const result = await chrome.storage.sync.get(['subtitleSettings']);
    const settings = result.subtitleSettings || {
      fontSize: 18,
      position: 'bottom',
      opacity: 80,
      textColor: '#ffffff'
    };

    settings[key] = value;
    await chrome.storage.sync.set({ subtitleSettings: settings });

    // Update UI
    switch (key) {
      case 'fontSize':
        this.fontSize.textContent = value;
        break;
      case 'opacity':
        this.opacity.textContent = value;
        break;
      case 'position':
        this.position.value = value;
        break;
      case 'textColor':
        this.textColor.value = value;
        break;
    }    // Update active tab if on YouTube
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('youtube.com')) {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'updateSettings',
        settings: settings
      });
    }
  }

  async toggleSubtitles() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('youtube.com')) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleSubtitles'
        });
        
        if (response && response.success) {
          this.updateSubtitleStatus(response.enabled);
        }
      }
    } catch (error) {
      console.error('Error toggling subtitles:', error);
      this.showStatus('Error: Please ensure you\'re on a YouTube page', 'error');
    }
  }

  updateSubtitleStatus(enabled) {
    if (!this.subtitleStatus) return;
    
    this.subtitleStatus.style.display = 'block';
    this.subtitleStatus.className = `subtitle-status ${enabled ? 'enabled' : 'disabled'}`;
    
    this.statusText.textContent = enabled ? 'Subtitles enabled' : 'Subtitles disabled';
    
    this.toggleSubtitlesBtn.textContent = enabled ? 'Disable (Alt+T)' : 'Enable (Alt+T)';
    this.toggleSubtitlesBtn.className = `toggle-subtitles-btn ${enabled ? '' : 'disabled'}`;
    this.toggleSubtitlesBtn.style.background = enabled ? '#4CAF50' : '#ff5722';
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});