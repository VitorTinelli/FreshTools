// Synthetic local WAV fixture; no customer data.
module.exports = async ({ voice, seconds, noise }) => {
      const bytes = Uint8Array.from(atob(voice), (c) => c.charCodeAt(0));
      const context = new AudioContext({ sampleRate: 16000 });
      const source = await context.decodeAudioData(bytes.buffer);
      const count = Math.floor(seconds * 16000);
      const pcm = source.getChannelData(0);
      const wav = new ArrayBuffer(44 + count * 2), view = new DataView(wav);
      const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, count * 2, true);
      for (let i = 0; i < count; i++) {
        const sample = seconds === 1 ? 0 : (seconds === 30 && i >= pcm.length ? 0 : pcm[i % pcm.length]) + (noise ? Math.sin(i * 1.41421) * 0.003 : 0);
        view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
      }
      await context.close();
      document.querySelector('#fixture').innerHTML = '<div class="sample"><audio controls></audio></div>';
      document.querySelector('audio').src = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    };
