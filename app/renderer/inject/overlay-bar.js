/*
 * Transparent Streaming Chat — injected overlay control bar.
 * Injected into the popout (Windows / Linux only) by main.js.
 *
 * The overlay window is frameless, so on Windows/Linux there is no title bar
 * to move the window with and no way to reach Settings. This adds a thin bar
 * pinned to the top of the page:
 *   - the bar itself is a drag region (-webkit-app-region: drag) → move window
 *   - the buttons are no-drag → Settings / Reload / Change channel / Minimize / Hide
 *
 * Talks to the main process through window.tscoOverlay (exposed by preload.js).
 */
(function () {
  if (window.__tscoBarInstalled) return;
  window.__tscoBarInstalled = true;

  const api = window.tscoOverlay || {};

  const style = document.createElement('style');
  style.id = 'tsco-bar-style';
  style.textContent = `
    #tsco-bar {
      position: fixed; top: 0; left: 0; right: 0; height: 30px;
      box-sizing: border-box;
      display: flex; align-items: center; justify-content: space-between;
      font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
      font-size: 12px; color: #fff;
      background: rgba(0, 0, 0, 0.32);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 2147483647;
      -webkit-app-region: drag;
      user-select: none; cursor: move;
      opacity: 0.5;
      transition: opacity .15s ease, background .15s ease;
    }
    #tsco-bar:hover { opacity: 1; background: rgba(0, 0, 0, 0.68); }
    #tsco-bar .tsco-grip {
      padding: 0 10px; letter-spacing: 1px; opacity: .75;
      pointer-events: none; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis;
    }
    #tsco-bar .tsco-btns { display: flex; height: 100%; -webkit-app-region: no-drag; }
    #tsco-bar button {
      -webkit-app-region: no-drag;
      width: 34px; height: 100%; border: 0; margin: 0; padding: 0;
      background: transparent; color: #fff; font-size: 14px; line-height: 1;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    #tsco-bar button:hover { background: rgba(255, 255, 255, 0.16); }
    #tsco-bar button.tsco-close:hover { background: #e0245e; }
  `;
  (document.head || document.documentElement).appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'tsco-bar';
  bar.innerHTML =
    '<span class="tsco-grip">⠿ Transparent Streaming Chat</span>' +
    '<span class="tsco-btns">' +
      '<button class="tsco-settings" title="Settings">⚙</button>' +
      '<button class="tsco-channel"  title="Change channel / platform">⇄</button>' +
      '<button class="tsco-reload"   title="Reload">⟳</button>' +
      '<button class="tsco-min"      title="Minimize">—</button>' +
      '<button class="tsco-close"    title="Hide (reopen from the tray icon)">✕</button>' +
    '</span>';

  function wire() {
    const on = (sel, fn) => { const el = bar.querySelector(sel); if (el) el.onclick = fn; };
    on('.tsco-settings', () => api.openSettings  && api.openSettings());
    on('.tsco-channel',  () => api.changeChannel && api.changeChannel());
    on('.tsco-reload',   () => api.reload        && api.reload());
    on('.tsco-min',      () => api.minimize      && api.minimize());
    on('.tsco-close',    () => api.close         && api.close());
  }

  function mount() {
    const root = document.body || document.documentElement;
    if (!root) { setTimeout(mount, 200); return; }
    if (!bar.isConnected) root.appendChild(bar);
    wire();
  }
  mount();

  // SPA frameworks (Twitch/Kick/YouTube) can re-render and drop our node;
  // re-attach it if it disappears.
  try {
    const obs = new MutationObserver(() => { if (!bar.isConnected) mount(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch {}
})();
