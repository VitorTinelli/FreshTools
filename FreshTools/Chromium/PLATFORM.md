# Chromium edition

This edition captures microphone samples with an `AudioWorklet` and encodes them in a dedicated Web Worker using the bundled OGG/Opus WebAssembly encoder. The output is always an OGG/Opus file before it is attached to Freshchat. Capture blocks are sequenced and the final container duration is validated before an attachment can be created.

The encoder runs entirely inside the browser. It does not contact a CDN or upload audio to an external conversion service. If a capture gap, encoder failure, or duration mismatch is detected, the recording is discarded instead of being attached.
