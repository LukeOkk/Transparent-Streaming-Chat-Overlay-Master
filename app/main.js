const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell, protocol, net } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');

const SOUNDS_DIR = path.join(__dirname, 'sounds');
const APP_ICON = path.join(__dirname, 'icon.png');

const DEFAULT_CONFIG = {
  platform: null,
  channel: null,
  opacity: 0,                // 0..100 — bg opacity for overlay
  soundEnabled: false,
  soundFile: 'alert1.wav',
  soundVolume: 0.5,
  soundCooldownMs: 4000,
  bttv: true,
  ffz: true,
  seven: true
};

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8'));
    return Object.assign({}, DEFAULT_CONFIG, raw);
  } catch {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2));
}

function extractYouTubeId(raw) {
  const t = String(raw).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  let m = t.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  m = t.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  m = t.match(/youtube\.com\/live\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

function popoutUrl(platform, channel) {
  const raw = String(channel || '').trim();
  if (platform === 'custom') return raw;
  if (platform === 'kick')   return `https://kick.com/popout/${encodeURIComponent(raw.toLowerCase())}/chat`;
  if (platform === 'youtube') {
    const id = extractYouTubeId(raw);
    if (!id) throw new Error('Could not parse YouTube video ID.');
    return `https://www.youtube.com/live_chat?v=${id}&is_popout=1`;
  }
  return `https://www.twitch.tv/popout/${encodeURIComponent(raw.toLowerCase())}/chat?popout=`;
}

function injectFileFor(platform) {
  const known = ['twitch', 'kick', 'youtube', 'custom'];
  const p = known.includes(platform) ? platform : 'twitch';
  return path.join(__dirname, 'renderer', 'inject', `${p}.css`);
}

// ── Custom tsco:// protocol so popout JS can fetch local sounds ────────────
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tsco',
    privileges: {
      supportFetchAPI: true,
      secure: true,
      standard: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
]);

function registerProtocol() {
  protocol.handle('tsco', (req) => {
    try {
      const u = new URL(req.url);
      if (u.hostname === 'sound') {
        const safeName = path.basename(u.pathname.replace(/^\/+/, ''));
        const file = path.join(SOUNDS_DIR, safeName);
        if (!file.startsWith(SOUNDS_DIR)) return new Response('forbidden', { status: 403 });
        if (!fs.existsSync(file))         return new Response('not found', { status: 404 });
        return net.fetch(url.pathToFileURL(file).href);
      }
      return new Response('not found', { status: 404 });
    } catch (e) {
      return new Response('error: ' + e.message, { status: 500 });
    }
  });
}

let overlayWindow  = null;
let settingsWindow = null;
let opacityCssKey  = null;
let tray           = null;

function buildOpacityCss(percent) {
  const alpha = Math.max(0, Math.min(100, percent)) / 100;
  // The tint lives on <html>. Every wrapper that might paint its own opaque
  // bg on top of <html> gets forced transparent so the tint actually shows.
  // Includes wildcard matches for Tailwind/utility bg-* classes used by
  // modern Kick (Nuxt) and YouTube renderers.
  return `
    html {
      background: rgba(18, 18, 22, ${alpha}) !important;
      background-color: rgba(18, 18, 22, ${alpha}) !important;
    }
    body,
    #__nuxt, #__nuxt > *,
    #__layout, #__layout > *,
    #app, #app > *,
    #chat, #contents, #root, main,
    .h-screen,
    .chat-room, .chat-container, .chatroom, .chat-list,
    .chat-shell, .stream-chat, .chat-messages-container,
    .scrollable-area, .simplebar-content,
    yt-live-chat-app, yt-live-chat-renderer, yt-live-chat-item-list-renderer,
    [class*="chatroom"],
    [class*="chat-wrapper"],
    [class*="chat-container"],
    [class*="chat-messages"],
    [class*="bg-surface"],
    [class*="bg-zinc"],
    [class*="bg-neutral"],
    [class*="bg-gray"],
    [class*="bg-slate"],
    [class*="bg-dark"] {
      background: transparent !important;
      background-color: transparent !important;
    }
  `;
}

async function applyOpacity(percent) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const wc = overlayWindow.webContents;
  if (opacityCssKey) {
    try { await wc.removeInsertedCSS(opacityCssKey); } catch {}
    opacityCssKey = null;
  }
  if (percent > 0) {
    opacityCssKey = await wc.insertCSS(buildOpacityCss(percent));
  }
}

function bootstrapInjects(win, cfg) {
  const wc = win.webContents;
  const inject = async () => {
    try {
      // 1. Platform-specific CSS
      const css = fs.readFileSync(injectFileFor(cfg.platform), 'utf8');
      await wc.insertCSS(css);
      // 2. Live opacity
      opacityCssKey = null;
      if (cfg.opacity > 0) {
        opacityCssKey = await wc.insertCSS(buildOpacityCss(cfg.opacity));
      }
      // 3. Emote configuration globals + script (Twitch only)
      if (cfg.platform === 'twitch') {
        await wc.executeJavaScript(`window.__tscoEmoteCfg = ${JSON.stringify({ bttv: !!cfg.bttv, ffz: !!cfg.ffz, seven: !!cfg.seven })};`);
        const emoteScript = fs.readFileSync(path.join(__dirname, 'renderer', 'inject', 'emotes-twitch.js'), 'utf8');
        await wc.executeJavaScript(emoteScript);
      }
      // 4. Sound alert configuration + script (all platforms)
      await wc.executeJavaScript(`window.__tscoSoundCfg = ${JSON.stringify({
        enabled: !!cfg.soundEnabled,
        file: cfg.soundFile || 'alert1.wav',
        volume: typeof cfg.soundVolume === 'number' ? cfg.soundVolume : 0.5,
        cooldownMs: cfg.soundCooldownMs || 4000
      })};`);
      const soundScript = fs.readFileSync(path.join(__dirname, 'renderer', 'inject', 'sound-alert.js'), 'utf8');
      await wc.executeJavaScript(soundScript);
      // 5. Overlay control bar — drag-to-move + Settings/Reload/Minimize.
      //    Only on Windows/Linux: the frameless window has no title bar there,
      //    so without this the window can't be moved and Settings is unreachable.
      //    macOS keeps its global menu bar and draggable title region.
      if (process.platform !== 'darwin') {
        const barScript = fs.readFileSync(path.join(__dirname, 'renderer', 'inject', 'overlay-bar.js'), 'utf8');
        await wc.executeJavaScript(barScript);
      }
    } catch (e) {
      console.error('inject failed:', e);
    }
  };
  wc.on('did-finish-load', inject);
}

function createOverlayWindow(cfg) {
  let resolvedUrl;
  try { resolvedUrl = popoutUrl(cfg.platform, cfg.channel); }
  catch (e) {
    console.error(e.message);
    writeConfig(Object.assign({}, DEFAULT_CONFIG));
    return createSetupWindow();
  }

  const win = new BrowserWindow({
    icon: APP_ICON,
    width: 420,
    height: 720,
    x: 80,
    y: 80,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadURL(resolvedUrl, {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  });

  bootstrapInjects(win, cfg);

  win.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
    console.error('overlay load fail', code, desc, failedUrl);
  });
  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: 'deny' };
  });

  return win;
}

function createSetupWindow() {
  const win = new BrowserWindow({
    icon: APP_ICON,
    width: 480,
    height: 470,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    resizable: false,
    title: 'Transparent Streaming Chat — Setup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'setup.html'));
  return win;
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }
  settingsWindow = new BrowserWindow({
    icon: APP_ICON,
    width: 540,
    height: 720,
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    title: 'Transparent Streaming Chat — Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
  return settingsWindow;
}

// ── Shared menu actions (used by both the macOS app menu and the tray) ──────
function openAbout() {
  shell.openExternal('https://github.com/LukeOkk/Transparent-Streaming-Chat-Overlay-Master');
}

function openSettings() {
  createSettingsWindow();
}

function reloadOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.reload();
}

function changeChannel() {
  writeConfig(Object.assign({}, DEFAULT_CONFIG));
  app.relaunch();
  app.exit(0);
}

function toggleDevTools() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.toggleDevTools();
}

function focusOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isMinimized()) overlayWindow.restore();
    overlayWindow.show();
    overlayWindow.focus();
  }
}

function buildMenu() {
  const template = [
    {
      label: 'Transparent Streaming Chat',
      submenu: [
        { label: 'About', click: openAbout },
        { type: 'separator' },
        { label: 'Settings…', click: openSettings },
        { label: 'Reload Overlay', click: reloadOverlay },
        { label: 'Change Channel / Platform…', click: changeChannel },
        { label: 'DevTools', click: toggleDevTools },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── System tray ────────────────────────────────────────────────────────────
// On Windows/Linux the overlay is a frameless window, so the application menu
// set above is not reachable from it. A tray icon exposes the same actions so
// the overlay stays usable. macOS keeps the global menu bar and skips the tray.
function trayImage() {
  const img = nativeImage.createFromPath(APP_ICON);
  if (img.isEmpty()) return img;
  return img.resize({ width: 16, height: 16 });
}

function createTray() {
  if (tray) return tray;
  tray = new Tray(trayImage());
  tray.setToolTip('Transparent Streaming Chat');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Focus Overlay', click: focusOverlay },
    { type: 'separator' },
    { label: 'Settings…', click: openSettings },
    { label: 'Reload Overlay', click: reloadOverlay },
    { label: 'Change Channel / Platform…', click: changeChannel },
    { label: 'DevTools', click: toggleDevTools },
    { type: 'separator' },
    { label: 'About', click: openAbout },
    { label: 'Quit', click: () => app.quit() }
  ]));
  // Left-click brings the overlay back to the foreground (handy on Windows).
  tray.on('click', focusOverlay);
  return tray;
}

// ── IPC handlers ──────────────────────────────────────────────────────────
ipcMain.handle('setup:save', (_e, payload) => {
  const allowed = ['twitch', 'kick', 'youtube', 'custom'];
  const platform = payload && allowed.includes(payload.platform) ? payload.platform : 'twitch';
  const channel = String((payload && payload.channel) || '').trim();
  if (!channel) return { ok: false, error: 'Field is empty.' };

  if (platform === 'custom' && !/^https?:\/\//i.test(channel)) {
    return { ok: false, error: 'Custom URL must start with http:// or https://' };
  }
  if (platform === 'youtube' && !extractYouTubeId(channel)) {
    return { ok: false, error: 'Could not parse YouTube video ID from input.' };
  }
  const next = Object.assign(readConfig(), { platform, channel });
  writeConfig(next);
  return { ok: true };
});

ipcMain.handle('setup:done', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('settings:get', () => readConfig());

ipcMain.handle('settings:set', async (_e, patch) => {
  const next = Object.assign(readConfig(), patch || {});
  writeConfig(next);
  // Apply live: opacity is the only one we can change without reload.
  if (typeof patch?.opacity === 'number') {
    await applyOpacity(patch.opacity);
  }
  return { ok: true };
});

ipcMain.handle('settings:reload-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.reload();
  return { ok: true };
});

ipcMain.handle('settings:test-sound', async (_e, file, volume) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return { ok: false, error: 'No overlay.' };
  try {
    await overlayWindow.webContents.executeJavaScript(
      `window.tsco && window.tsco.playSound(${JSON.stringify(file)}, ${Number(volume) || 0.5});`
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── IPC from the injected overlay control bar (Windows / Linux) ────────────
ipcMain.handle('overlay:open-settings',  () => { openSettings();  return { ok: true }; });
ipcMain.handle('overlay:reload',         () => { reloadOverlay(); return { ok: true }; });
ipcMain.handle('overlay:change-channel', () => { changeChannel(); return { ok: true }; });
ipcMain.handle('overlay:minimize', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.minimize();
  return { ok: true };
});
ipcMain.handle('overlay:close', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
  return { ok: true };
});

app.whenReady().then(() => {
  registerProtocol();
  buildMenu();
  // macOS exposes the menu globally; elsewhere the frameless overlay needs the tray.
  if (process.platform !== 'darwin') createTray();
  const cfg = readConfig();
  if (!cfg.channel) {
    overlayWindow = createSetupWindow();
  } else {
    overlayWindow = createOverlayWindow(cfg);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const c = readConfig();
      overlayWindow = c.channel ? createOverlayWindow(c) : createSetupWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (tray) { tray.destroy(); tray = null; }
});
