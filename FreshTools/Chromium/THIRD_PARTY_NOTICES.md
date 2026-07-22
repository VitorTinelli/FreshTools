# Third-party software

The Chromium edition includes the OGG/Opus WebAssembly encoder and worker from `opus-media-recorder` 0.8.0. Microphone capture is implemented locally with the browser `AudioWorklet` API.

- Project: https://github.com/kbumsik/opus-media-recorder
- Package: https://www.npmjs.com/package/opus-media-recorder/v/0.8.0
- License: MIT and bundled component licenses
- Full license text: `vendor/LICENSE.md`

No code or WebAssembly is downloaded at runtime. All encoder resources are packaged with the extension.
