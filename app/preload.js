const { contextBridge, ipcRenderer } = require('electron');

// ── Exposed to setup.html ─────────────────────────────────────────────────
contextBridge.exposeInMainWorld('tscoSetup', {
  save: (payload) => ipcRenderer.invoke('setup:save', payload),
  done: () => ipcRenderer.invoke('setup:done')
});

// ── Exposed to settings.html ──────────────────────────────────────────────
contextBridge.exposeInMainWorld('tscoSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  reloadOverlay: () => ipcRenderer.invoke('settings:reload-overlay'),
  testSound: (file, volume) => ipcRenderer.invoke('settings:test-sound', file, volume)
});

// ── Exposed to popout pages (Twitch / Kick / YouTube / Custom) ────────────
contextBridge.exposeInMainWorld('tsco', {
  playSound: (name, volume) => {
    try {
      const safe = String(name || 'alert1.wav').replace(/[^A-Za-z0-9_.\-]/g, '');
      const audio = new Audio(`tsco://sound/${safe}`);
      const v = Number(volume);
      audio.volume = Math.max(0, Math.min(1, isFinite(v) ? v : 0.5));
      audio.play().catch((e) => console.warn('[tsco] audio play failed', e));
    } catch (e) {
      console.warn('[tsco] playSound error', e);
    }
  }
});
