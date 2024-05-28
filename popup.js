document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleCaption');
  const urlInput = document.getElementById('urlInput');
  const fileInput = document.getElementById('fileInput');
  const colorPicker = document.getElementById('colorPicker');
  const fontSize = document.getElementById('fontSize');
  const position = document.getElementById('position');

  // Load saved state
  chrome.storage.sync.get(['toggleState', 'savedURL', 'color', 'fontSize', 'position'], (result) => {
      toggle.checked = result.toggleState || false;
      urlInput.value = result.savedURL || '';
      colorPicker.value = result.color || '#ffffff';
      fontSize.value = result.fontSize || '32px';
      position.value = result.position || 'bottom';
  });

  toggle.addEventListener('change', async (event) => {
      const url = urlInput.value;
      const isChecked = event.target.checked;
      const color = colorPicker.value;
      const size = fontSize.value;
      const pos = position.value;

      // Save the current state
      chrome.storage.sync.set({ toggleState: isChecked, savedURL: url, color: color, fontSize: size, position: pos });

      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js']
      }, () => {
          chrome.tabs.sendMessage(tab.id, {
              action: isChecked ? "injectCaption" : "clearCaption",
              url: url,
              color: color,
              fontSize: size,
              position: pos
          });
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
