class YouTubeSubtitleInjector {
  constructor() {
    this.video = null;
    this.subtitles = [];
    this.currentSubtitle = null;
    this.subtitleElement = null;
    this.updateInterval = null;
    this.toggleButton = null;
    this.subtitlesEnabled = true;
    this.subtitlesLoaded = false;
    this.init();
  }
  init() {
    this.waitForVideo();
    this.listenForMessages();
    this.setupKeyboardShortcuts();
    this.setupPlayerButton();
  }

  waitForVideo() {
    const checkVideo = () => {
      this.video = document.querySelector("video");
      if (this.video) {
        this.setupSubtitleDisplay();
        this.autoLoadSubtitles();
      } else {
        setTimeout(checkVideo, 1000);
      }
    };
    checkVideo();
  }

  setupSubtitleDisplay() {
    // Create subtitle container
    this.subtitleElement = document.createElement("div");
    this.subtitleElement.id = "custom-subtitles"; // Default settings
    this.settings = {
      fontSize: 18,
      position: "bottom",
      opacity: 80,
      textColor: "#ffffff",
    }; // Load saved settings
    chrome.storage.sync.get(
      ["subtitleSettings", "subtitlesEnabled"],
      (result) => {
        if (result.subtitleSettings) {
          this.settings = { ...this.settings, ...result.subtitleSettings };
        }
        if (result.subtitlesEnabled !== undefined) {
          this.subtitlesEnabled = result.subtitlesEnabled;
        }
        this.applySettings();
        this.updateButtonState();
      }
    );
    // Find YouTube player container
    const playerContainer = document.querySelector(
      "#movie_player, .html5-video-player"
    );
    if (playerContainer) {
      playerContainer.style.position = "relative";
      playerContainer.appendChild(this.subtitleElement);
    }
  }

  setupPlayerButton() {
    // Wait for YouTube controls to load
    const waitForControls = () => {
      const rightControls = document.querySelector(".ytp-right-controls");
      if (rightControls) {
        this.injectToggleButton(rightControls);
      } else {
        setTimeout(waitForControls, 500);
      }
    };
    waitForControls();
  }

  injectToggleButton(rightControls) {
    // Remove existing button if it exists
    if (this.toggleButton && this.toggleButton.parentNode) {
      this.toggleButton.parentNode.removeChild(this.toggleButton);
    }

    // Create the toggle button
    this.toggleButton = document.createElement("button");
    this.toggleButton.id = "subly-toggle-button";
    this.toggleButton.className = "ytp-button";
    this.toggleButton.setAttribute("data-priority", "4");
    this.toggleButton.setAttribute("aria-label", "Toggle Subly subtitles");
    this.toggleButton.setAttribute("title", "Toggle Subly subtitles");
    this.toggleButton.style.cssText = `
      position: relative;
      width: 48px;
      height: 48px;
      border: none;
      background: transparent;
      cursor: default;
      opacity: 0.3;
      transition: opacity 0.2s ease;
    `; // Create SVG icon for the button
    this.toggleButton.innerHTML = `
      <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
        <path d="M8,8 C6.89,8 6,8.9 6,10 L6,26 C6,27.1 6.89,28 8,28 L28,28 C29.1,28 30,27.1 30,26 L30,10 C30,8.9 29.1,8 28,8 L8,8 Z M10,12 L26,12 L26,14 L10,14 L10,12 z M10,16 L20,16 L20,18 L10,18 L10,16 z M10,20 L24,20 L24,22 L10,22 L10,20 z M26,18 L28,18 L28,20 L26,20 L26,18 z" fill="#666" stroke="none"/>
      </svg>
    `;

    // Add click event listener
    this.toggleButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSubtitles();
    });

    // Insert the button before the subtitles button or at the beginning
    const subtitlesButton = rightControls.querySelector(
      ".ytp-subtitles-button"
    );
    if (subtitlesButton) {
      rightControls.insertBefore(this.toggleButton, subtitlesButton);
    } else {
      rightControls.insertBefore(this.toggleButton, rightControls.firstChild);
    }
  }
  toggleSubtitles() {
    if (!this.subtitlesLoaded) return;

    this.subtitlesEnabled = !this.subtitlesEnabled;
    this.updateButtonState();

    if (!this.subtitlesEnabled) {
      this.hideSubtitle();
      this.currentSubtitle = null;
    }

    // Save state
    chrome.storage.sync.set({ subtitlesEnabled: this.subtitlesEnabled });
  }
  updateButtonState() {
    if (!this.toggleButton) return;

    const isActive = this.subtitlesLoaded && this.subtitlesEnabled;
    const isLoaded = this.subtitlesLoaded;

    // Update button opacity and cursor
    // I'm not gonna pretend like I know why this works, but it does
    this.toggleButton.style.opacity = isLoaded
      ? isActive
        ? "1"
        : "0.7"
      : "0.3";
    this.toggleButton.style.cursor = isLoaded ? "pointer" : "default";

    // Update aria labels and titles
    let label, title;
    if (!isLoaded) {
      label = title = "No Subly subtitles loaded";
    } else if (isActive) {
      label = title = "Disable Subly subtitles (Alt+T)";
    } else {
      label = title = "Enable Subly subtitles (Alt+T)";
    }

    this.toggleButton.setAttribute("aria-label", label);
    this.toggleButton.setAttribute("title", title);

    // Update the SVG icon
    const path = this.toggleButton.querySelector("path");
    const line = this.toggleButton.querySelector("line");

    if (path) {
      if (!isLoaded) {
        path.setAttribute("fill", "#666");
      } else {
        path.setAttribute("fill", "#fff");
      }
    }

    // Handle the disabled line
    if (isLoaded && !this.subtitlesEnabled) {
      if (!line) {
        const svg = this.toggleButton.querySelector("svg");
        const newLine = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        newLine.setAttribute("x1", "6");
        newLine.setAttribute("y1", "6");
        newLine.setAttribute("x2", "30");
        newLine.setAttribute("y2", "30");
        newLine.setAttribute("stroke", "#ff4444");
        newLine.setAttribute("stroke-width", "2.5");
        newLine.setAttribute("opacity", "0.9");
        svg.appendChild(newLine);
      }
    } else {
      if (line) line.remove();
    }
  }
  listenForMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "loadSubtitles") {
        this.loadSubtitles(message.srtContent);
        sendResponse({ success: true });
      } else if (message.action === "updateSettings") {
        this.updateSettings(message.settings);
        sendResponse({ success: true });
      } else if (message.action === "toggleSubtitles") {
        this.toggleSubtitles();
        sendResponse({ success: true, enabled: this.subtitlesEnabled });
      }
    });
  }
  loadSubtitles(srtContent) {
    try {
      this.subtitles = SRTParser.parse(srtContent);
      this.subtitlesLoaded = this.subtitles.length > 0;
      this.startSubtitleTracking();
      this.updateButtonState();
      console.log(`Loaded ${this.subtitles.length} subtitles`);
    } catch (error) {
      console.error("Error parsing SRT:", error);
      this.subtitlesLoaded = false;
      this.updateButtonState();
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
    if (!this.subtitlesEnabled) return;

    const currentTime = this.video.currentTime;

    // Find current subtitle
    const subtitle = this.subtitles.find(
      (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
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
      this.subtitleElement.innerHTML = this.sanitizeHTML(text);
      this.subtitleElement.style.display = "block";
    }
  }

  sanitizeHTML(text) {
    // Allow only safe subtitle HTML tags
    const allowedTags = ['i', 'b', 'u', 'strong', 'em', 'br', 'font'];
    const allowedAttributes = ['color', 'size', 'face'];
    
    // Create a temporary element to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = text;
    
    // Remove any script tags or other dangerous elements
    const scripts = temp.querySelectorAll('script, object, embed, iframe, link, meta, style');
    scripts.forEach(script => script.remove());
    
    // Remove attributes from allowed tags except for font tag
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(element => {
      if (!allowedTags.includes(element.tagName.toLowerCase())) {
        // Replace disallowed tags with their text content
        element.replaceWith(document.createTextNode(element.textContent));
      } else if (element.tagName.toLowerCase() === 'font') {
        // For font tags, only keep allowed attributes
        const attrs = Array.from(element.attributes);
        attrs.forEach(attr => {
          if (!allowedAttributes.includes(attr.name.toLowerCase())) {
            element.removeAttribute(attr.name);
          }
        });
      } else {
        // For other allowed tags, remove all attributes
        const attrs = Array.from(element.attributes);
        attrs.forEach(attr => element.removeAttribute(attr.name));
      }
    });
    
    return temp.innerHTML;
  }

  hideSubtitle() {
    if (this.subtitleElement) {
      this.subtitleElement.style.display = "none";
    }
  }

  applySettings() {
    if (!this.subtitleElement) return;

    const position =
      this.settings.position === "top"
        ? "60px"
        : this.settings.position === "middle"
        ? "50%"
        : "auto";
    const bottom = this.settings.position === "bottom" ? "60px" : "auto";
    const transform =
      this.settings.position === "middle"
        ? "translate(-50%, -50%)"
        : "translateX(-50%)";    this.subtitleElement.style.cssText = `
      position: absolute;
      top: ${position};
      bottom: ${bottom};
      left: 50%;
      transform: ${transform};      background: rgba(0, 0, 0, ${
      this.settings.opacity / 100
    });
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
    
    // Add styles for HTML elements within subtitles
    if (!document.getElementById('subtitle-html-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'subtitle-html-styles';
      styleSheet.textContent = `
        #custom-subtitles i, #custom-subtitles em {
          font-style: italic;
        }
        #custom-subtitles b, #custom-subtitles strong {
          font-weight: bold;
        }
        #custom-subtitles u {
          text-decoration: underline;
        }
        #custom-subtitles br {
          line-height: 1.2;
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }

  updateSettings(newSettings) {
    // Calculate position before applying new settings
    const wasVisible =
      this.subtitleElement && this.subtitleElement.style.display === "block";
    const previousSettings = { ...this.settings };

    // Update settings
    this.settings = { ...this.settings, ...newSettings };

    // If position is changing, we need special handling for smooth transition
    if (previousSettings.position !== this.settings.position) {
      // First move to the new position while invisible
      this.subtitleElement.style.display = "none";
      this.applySettings();

      // Force a reflow to ensure the transition will work
      this.subtitleElement.offsetHeight;

      // Make visible again if it was visible before
      if (wasVisible) {
        this.subtitleElement.style.display = "block";
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
    document.addEventListener("keydown", (e) => {
      if (!e.altKey) return;

      switch (e.key) {
        case "ArrowUp":
          this.updateSettings({ fontSize: this.settings.fontSize + 1 });
          break;
        case "ArrowDown":
          this.updateSettings({
            fontSize: Math.max(8, this.settings.fontSize - 1),
          });
          break;
        case "ArrowLeft":
          this.updateSettings({
            opacity: Math.max(0, this.settings.opacity - 5),
          });
          break;
        case "ArrowRight":
          this.updateSettings({
            opacity: Math.min(100, this.settings.opacity + 5),
          });
          break;
        case "w":
        case "W":
          this.updateSettings({ position: "top" });
          break;
        case "m":
        case "M":
          this.updateSettings({ position: "middle" });
          break;
        case "s":
        case "S":
          this.updateSettings({ position: "bottom" });
          break;
        case "t":
        case "T":
          e.preventDefault();
          this.toggleSubtitles();
          break;
      }
    });
  }

  async fetchConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL('config.json'));
      if (!response.ok) {
        throw new Error('Failed to load config.json');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching config:', error);
      return null;
    }
  }

  async autoLoadSubtitles() {
    try {
      const config = await this.fetchConfig();
      if (!config || !config.videoMappings) return;

      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');

      if (videoId && config.videoMappings[videoId]) {
        const srtUrl = config.videoMappings[videoId];
        const response = await fetch(srtUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch SRT from ${srtUrl}`);
        }

        const content = await response.text();
        if (!content.includes('-->')) {
          throw new Error('Invalid SRT format');
        }

        this.loadSubtitles(content);
        console.log('Subtitles auto-loaded successfully');
      }
    } catch (error) {
      console.error('Error auto-loading subtitles:', error);
    }
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
    }    if (injector.toggleButton && injector.toggleButton.parentNode) {
      injector.toggleButton.parentNode.removeChild(injector.toggleButton);
    }
    injector = null;
  }
  
  // Clean up subtitle HTML styles
  const subtitleStyles = document.getElementById('subtitle-html-styles');
  if (subtitleStyles) {
    subtitleStyles.remove();
  }
  
  if (navigationObserver) {
    navigationObserver.disconnect();
    navigationObserver = null;
  }
}

// Initialize when page loads
function initialize() {
  cleanup(); 
  try {
    injector = new YouTubeSubtitleInjector();
  } catch (e) {
    console.error("Failed to initialize subtitle injector:", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Handle YouTube's dynamic navigation
let currentURL = location.href;
navigationObserver = new MutationObserver(() => {
  if (location.href !== currentURL) {
    currentURL = location.href;
    setTimeout(() => {
      initialize();
      // Re-setup the button after navigation
      if (injector) {
        setTimeout(() => injector.setupPlayerButton(), 1000);
      }
    }, 1000);
  }
});
navigationObserver.observe(document, { subtree: true, childList: true });

// Handle errors that might occur when the extension context is invalidated
window.addEventListener("unload", cleanup);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (!chrome.runtime.id) {
      cleanup();
      return false;
    }
    if (injector) {
      if (message.action === "loadSubtitles") {
        injector.loadSubtitles(message.srtContent);
        sendResponse({ success: true });
      } else if (message.action === "updateSettings") {
        injector.updateSettings(message.settings);
        sendResponse({ success: true });
      } else if (message.action === "toggleSubtitles") {
        injector.toggleSubtitles();
        sendResponse({ success: true, enabled: injector.subtitlesEnabled });
      }
    }
  } catch (e) {
    console.error("Extension context error:", e);
    cleanup();
    return false;
  }
  return true; // Keep the message channel open for async response
});
