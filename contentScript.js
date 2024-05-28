subtitles = [];

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    const captionContainer = document.querySelector('.ytp-caption-window-container');

    if (request.action === "injectCaption" && captionContainer) {
        const url = request.url;
        const color = request.color;
        const fontSize = request.fontSize;
        const position = request.position;
        console.log('Received URL:', url);
        console.log('Color:', color, 'Font Size:', fontSize, 'Position:', position);

        try {
            const srtContent = await fetchSrtFromUrl(url);
            if (srtContent) {
                subtitles = parseSrt(srtContent);

                const video = document.querySelector('video.html5-main-video');
                const currentTime = video.currentTime;

                const existingCaption = document.getElementById('caption-window-1');
                if (!existingCaption) {
                    const newDiv = document.createElement('div');
                    newDiv.className = `caption-window ytp-caption-window-${position} ytp-caption-window-rollup`;
                    newDiv.id = 'caption-window-1';
                    newDiv.dir = 'ltr';
                    newDiv.tabIndex = 0;
                    newDiv.lang = 'es';
                    newDiv.draggable = true;
                    newDiv.style.cssText = `touch-action: none; background-color: rgba(8, 8, 8, 0.5); text-align: center; overflow: hidden; left: 0; right: 0; margin: auto; width: 840px; height: auto; ${position}: 2%;`;

                    const span = document.createElement('span');
                    span.className = 'captions-text';
                    span.style.cssText = 'overflow-wrap: normal; display: block; text-align: center;';

                    const innerSpan = document.createElement('span');
                    innerSpan.className = 'caption-visual-line';
                    innerSpan.style.cssText = 'display: block; text-align: center;';

                    const innerInnerSpan = document.createElement('span');
                    innerInnerSpan.className = 'ytp-caption-segment';
                    innerInnerSpan.style.cssText = `display: inline-block; white-space: pre-wrap; background: rgba(8, 8, 8, 0.75); font-size: ${fontSize}; color: ${color}; fill: ${color}; font-family: "YouTube Noto", Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif; text-align: center;`;

                    // Find the caption that should be displayed at the current time
                    const caption = subtitles.find(({ startTime, endTime }) => currentTime >= startTime && currentTime <= endTime);
                    innerInnerSpan.textContent = caption ? caption.text : '';

                    innerSpan.appendChild(innerInnerSpan);
                    span.appendChild(innerSpan);
                    newDiv.appendChild(span);
                    captionContainer.appendChild(newDiv);
                    video.addEventListener('timeupdate', handleCaptionUpdate);
                }
            }
        } catch (error) {
            console.error('Error fetching or parsing SRT:', error);
        }
    } else if (request.action === "clearCaption" && captionContainer) {
        // Clear everything from the caption container
        captionContainer.innerHTML = '';
    }
});

function getCurrentCaption(currentTime) {
    return subtitles.find(({ startTime, endTime }) => currentTime >= startTime && currentTime <= endTime);
}

// Event Listener for timeupdate event on the video element
// This function will be called every time the video's current time is updated, and will update the caption displayed on the video
function handleCaptionUpdate(event) {
    if (subtitles.length === 0) return; // Return if no subtitles are available
    const video = event.target;
    const currentTime = video.currentTime;

    const captionContainer = document.getElementById('caption-window-1');
    if (!captionContainer) return; // Return if caption container not found

    const currentCaption = getCurrentCaption(currentTime);

    if (!currentCaption) {
        // clear the caption container if no caption is found
        captionContainer.innerHTML = '';
        return;
    }

    // Check if current caption is already displayed
    if (captionContainer.innerText !== currentCaption.text) {
        // Clear existing caption
        captionContainer.innerHTML = '';
        // Load all the saved settings from the storage
        // Load saved state
        chrome.storage.sync.get(['color', 'fontSize', 'position'], (result) => {
            color = result.color || '#ffffff';
            fontSize = result.fontSize || '32px';
            position = result.position || 'bottom';
        });
        // Create new span element for the current caption
        const span = document.createElement('span');
        span.className = 'captions-text';
        span.style.cssText = 'overflow-wrap: normal; display: block; text-align: center;';

        const innerSpan = document.createElement('span');
        innerSpan.className = 'caption-visual-line';
        innerSpan.style.cssText = 'display: block; text-align: center;';

        const innerInnerSpan = document.createElement('span');
        innerInnerSpan.className = 'ytp-caption-segment';
        innerInnerSpan.style.cssText = `display: inline-block; white-space: pre-wrap; background: rgba(8, 8, 8, 0.75); font-size: ${fontSize}; color: ${color}; fill: ${color}; font-family: "YouTube Noto", Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif; text-align: center;`;
        innerInnerSpan.textContent = currentCaption.text;

        innerSpan.appendChild(innerInnerSpan);
        span.appendChild(innerSpan);
        captionContainer.appendChild(span);
    }
}

async function fetchSrtFromUrl(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch SRT file');
        }
        return await response.text();
    } catch (error) {
        console.error('Error fetching SRT:', error);
        return null;
    }
}

function parseSrt(srtContent) {
    const subtitleRegex = /(\d+)\n(\d+:\d+:\d+,\d+) --> (\d+:\d+:\d+,\d+)\n([\s\S]*?)(?=\n\d+\n\d+:\d+:\d+,\d+|\n$)/g;
    let match;
    const subtitles = [];

    while ((match = subtitleRegex.exec(srtContent)) !== null) {
        const startTime = convertSrtTimeToSeconds(match[2]);
        const endTime = convertSrtTimeToSeconds(match[3]);
        const text = match[4].trim().replace(/\n/g, ' ');
        subtitles.push({ startTime, endTime, text });
    }
    return subtitles;
}

function convertSrtTimeToSeconds(timeString) {
    const [hours, minutes, secondsAndMilliseconds] = timeString.split(':');
    const [seconds, milliseconds] = secondsAndMilliseconds.split(',');
    return parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10) + parseInt(milliseconds, 10) / 1000;
}
