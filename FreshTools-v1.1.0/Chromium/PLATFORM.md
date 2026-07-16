# Chromium edition

This edition uses the open-source `opus-media-recorder` 0.8.0 WebAssembly encoder when Chromium does not expose native OGG recording. The output is always an OGG/Opus file before it is attached to Freshchat.

The encoder runs entirely inside the browser. It does not contact a CDN or upload audio to an external conversion service.
