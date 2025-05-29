class YouTubeSubtitleInjector {
  constructor() {
    this.video = null;
    this.subtitles = [];
    this.currentSubtitle = null;
    this.subtitleElement = null;
    this.updateInterval = null;
    this.init();
  }
  
  init() {
    this.waitForVideo();
    this.listenForMessages();
    this.setupKeyboardShortcuts();
  }
  
  waitForVideo() {
    const checkVideo = () => {
      this.video = document.querySelector('video');
      if (this.video) {
        this.setupSubtitleDisplay();
      } else {
        setTimeout(checkVideo, 1000);
      }
    };
    checkVideo();
  }
  
  setupSubtitleDisplay() {
    // Create subtitle container
    this.subtitleElement = document.createElement('div');
    this.subtitleElement.id = 'custom-subtitles';    // Default settings
    this.settings = {
      fontSize: 18,
      position: 'bottom',
      opacity: 80,
      textColor: '#ffffff'
    };

    // Load saved settings
    chrome.storage.sync.get(['subtitleSettings'], (result) => {
      if (result.subtitleSettings) {
        this.settings = { ...this.settings, ...result.subtitleSettings };
      }
      this.applySettings();
    });
    
    // Find YouTube player container
    const playerContainer = document.querySelector('#movie_player, .html5-video-player');
    if (playerContainer) {
      playerContainer.style.position = 'relative';
      playerContainer.appendChild(this.subtitleElement);
    }
  }
    listenForMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'loadSubtitles') {
        this.loadSubtitles(message.srtContent);
        sendResponse({success: true});
      } else if (message.action === 'updateSettings') {
        this.updateSettings(message.settings);
        sendResponse({success: true});
      }
    });
  }
  
  loadSubtitles(srtContent) {
    try {
      this.subtitles = SRTParser.parse(srtContent);
      this.startSubtitleTracking();
      console.log(`Loaded ${this.subtitles.length} subtitles`);
    } catch (error) {
      console.error('Error parsing SRT:', error);
    }
  }
  
  startSubtitleTracking() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      if (this.video && !this.video.paused) {
        this.updateSubtitles();
      }
    }, 100); // Update every 100ms for smooth display
  }
  
  updateSubtitles() {
    const currentTime = this.video.currentTime;
    
    // Find current subtitle
    const subtitle = this.subtitles.find(sub => 
      currentTime >= sub.startTime && currentTime <= sub.endTime
    );
    
    if (subtitle && subtitle !== this.currentSubtitle) {
      this.showSubtitle(subtitle.text);
      this.currentSubtitle = subtitle;
    } else if (!subtitle && this.currentSubtitle) {
      this.hideSubtitle();
      this.currentSubtitle = null;
    }
  }
  
  showSubtitle(text) {
    if (this.subtitleElement) {
      this.subtitleElement.textContent = text;
      this.subtitleElement.style.display = 'block';
    }
  }
  
  hideSubtitle() {
    if (this.subtitleElement) {
      this.subtitleElement.style.display = 'none';
    }
  }

  applySettings() {
    if (!this.subtitleElement) return;

    const position = this.settings.position === 'top' ? '60px' : 
                    this.settings.position === 'middle' ? '50%' : 
                    'auto';
    const bottom = this.settings.position === 'bottom' ? '60px' : 'auto';
    const transform = this.settings.position === 'middle' ? 
                     'translate(-50%, -50%)' : 
                     'translateX(-50%)';

    this.subtitleElement.style.cssText = `
      position: absolute;
      top: ${position};
      bottom: ${bottom};
      left: 50%;
      transform: ${transform};      background: rgba(0, 0, 0, ${this.settings.opacity / 100});
      color: ${this.settings.textColor};
      padding: 8px 16px;
      border-radius: 4px;
      font-size: ${this.settings.fontSize}px;
      font-family: Arial, sans-serif;
      text-align: center;
      z-index: 9999;
      max-width: 80%;
      display: none;
      pointer-events: none;
      transition: all 0.3s ease-out;
      transition-property: font-size, color, background-color, top, bottom, transform;
    `;
  }

  updateSettings(newSettings) {
    // Calculate position before applying new settings
    const wasVisible = this.subtitleElement && this.subtitleElement.style.display === 'block';
    const previousSettings = { ...this.settings };
    
    // Update settings
    this.settings = { ...this.settings, ...newSettings };
    
    // If position is changing, we need special handling for smooth transition
    if (previousSettings.position !== this.settings.position) {
      // First move to the new position while invisible
      this.subtitleElement.style.display = 'none';
      this.applySettings();
      
      // Force a reflow to ensure the transition will work
      this.subtitleElement.offsetHeight;
      
      // Make visible again if it was visible before
      if (wasVisible) {
        this.subtitleElement.style.display = 'block';
      }
    } else {
      // For other properties, just apply normally
      this.applySettings();
    }
    
    // Save settings
    chrome.storage.sync.set({ subtitleSettings: this.settings });
  }

  // Update keyboard shortcuts to use smoother increments
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!e.altKey) return;

      switch (e.key) {
        case 'ArrowUp':
          this.updateSettings({ fontSize: this.settings.fontSize + 1 });
          break;
        case 'ArrowDown':
          this.updateSettings({ fontSize: Math.max(8, this.settings.fontSize - 1) });
          break;
        case 'ArrowLeft':
          this.updateSettings({ opacity: Math.max(0, this.settings.opacity - 5) });
          break;
        case 'ArrowRight':
          this.updateSettings({ opacity: Math.min(100, this.settings.opacity + 5) });
          break;
        case 'w':
        case 'W':
          this.updateSettings({ position: 'top' });
          break;
        case 'm':
        case 'M':
          this.updateSettings({ position: 'middle' });
          break;
        case 's':
        case 'S':
          this.updateSettings({ position: 'bottom' });
          break;
      }
    });
  }
}

// Global instance
let injector = null;
let navigationObserver = null;

// Cleanup function
function cleanup() {
    if (injector) {
        if (injector.updateInterval) {
            clearInterval(injector.updateInterval);
        }
        if (injector.subtitleElement && injector.subtitleElement.parentNode) {
            injector.subtitleElement.parentNode.removeChild(injector.subtitleElement);
        }
        injector = null;
    }
    if (navigationObserver) {
        navigationObserver.disconnect();
        navigationObserver = null;
    }
}

// Initialize when page loads
function initialize() {
    cleanup(); // Clean up any existing instance
    try {
        injector = new YouTubeSubtitleInjector();
    } catch (e) {
        console.error('Failed to initialize subtitle injector:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Handle YouTube's dynamic navigation
let currentURL = location.href;
navigationObserver = new MutationObserver(() => {
    if (location.href !== currentURL) {
        currentURL = location.href;
        setTimeout(initialize, 1000);
    }
});
navigationObserver.observe(document, { subtree: true, childList: true });

// Handle extension context invalidation
chrome.runtime.onSuspend.addListener(cleanup);

// Handle errors that might occur when the extension context is invalidated
window.addEventListener('unload', cleanup);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (!chrome.runtime.id) {
            cleanup();
            return false;
        }
        // Your existing message handling code will be called through the injector instance
        if (injector) {
            if (message.action === 'loadSubtitles') {
                injector.loadSubtitles(message.srtContent);
                sendResponse({success: true});
            } else if (message.action === 'updateSettings') {
                injector.updateSettings(message.settings);
                sendResponse({success: true});
            }
        }
    } catch (e) {
        console.error('Extension context error:', e);
        cleanup();
        return false;
    }
    return true; // Keep the message channel open for async response
});