# YouTube SRT Injector 
Simple Chromme(ium) extension to inject SRT subtitles into YouTube videos.

Ever wanted to use your own subtitles on YouTube Videos? Frustated by the lack of subtitles on a video? This extension is for you!

While still in development, this extension allows you to inject your own SRT subtitles (both from a file or from a URL) into YouTube videos. The Subtitles use the Native YouTube Subtitle UI, so they'll look and feel like original subtitles.

## Installation
1. Clone this repository
2. Open Chrome/Edge/Whatever and go to `<browser>://extensions/`. For instance, in Edge it's `edge://extensions/`
3. Enable Developer Mode
4. Click on "Load Unpacked" and select the folder where you cloned this repository
5. You're done!

At some point I intend on publishing this extension to the Chrome Web Store, but for now this is the only way to install it.

## Usage

This extension works regardless of whether you enable the native YouTube subtitles or not, but works best if you keep them disabled. To use it, simply navigate to a YouTube Video, open the extension popup, and either paste the URL of the SRT file or upload it. Then toggle the switch to enable the subtitles. The subtitles will be injected into the video and will be displayed as if they were native subtitles! 

## Known Issues
Several. This is still in development, and the posted version is a very early PoC. Here are some known issues:

- This extension may hijack the native YouTube subtitles. This is not consistent and I'm trying to figure out why
- The Subttiles don't always mimic the native YouTube Subtitles. This is also under investigation, and very inconsistent
- Massive lack of error checking. If you do something wrong, the extension will likely crash
- The extension is not very user friendly. I'm working on that
- The extension currently only supports SRT Files. In the future, I'd like to support other formats
- I havent finalized the icons and UI. I'm working on that
- Probably lots of other stuff that I'm not aware of. If you find something wrong, please open an issue!\

At some point, I intend on rewriting this PoC into something actually usable. But this is *good enough* for now.
