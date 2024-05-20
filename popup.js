document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('toggleCaption');
    const urlInput = document.getElementById('urlInput');
    const fileInput = document.getElementById('fileInput');
  
    // Load saved state
    chrome.storage.sync.get(['toggleState', 'savedURL'], (result) => {
      toggle.checked = result.toggleState || false;
      urlInput.value = result.savedURL || '';
    });
  
    toggle.addEventListener('change', async (event) => {
      const url = urlInput.value;
      const isChecked = event.target.checked;
  
      // Save the current state
      chrome.storage.sync.set({ toggleState: isChecked, savedURL: url });
  
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['contentScript.js']
      }, () => {
        chrome.tabs.sendMessage(tab.id, { action: isChecked ? "injectCaption" : "clearCaption", url: url });
      });
    });
  
    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      const reader = new FileReader();
  
      reader.onload = function(e) {
        const contents = e.target.result;
        // Do something with the file contents, like send it to the content script
        console.log('File contents:', contents);
      };
  
      reader.readAsText(file);
    });
  });
  