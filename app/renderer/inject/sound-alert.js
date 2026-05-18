/*
 * Transparent Streaming Chat — chat-message sound alert.
 * Injected into any popout (Twitch / Kick / YouTube / Custom).
 *
 * Reads config from window.__tscoSoundCfg = { enabled, file, volume (0..1), cooldownMs }.
 * Plays via window.tsco.playSound(file, volume) exposed by preload.
 *
 * Honest caveats:
 *  - Selectors are platform-specific best-effort; a small fallback observes any chat-ish container.
 *  - Cooldown prevents alert spam on chat bursts.
 */
(function () {
  if (window.__tscoSoundInstalled) return;
  window.__tscoSoundInstalled = true;

  const cfg = window.__tscoSoundCfg || { enabled: false, file: 'alert1.wav', volume: 0.5, cooldownMs: 4000 };
  if (!cfg.enabled) return;
  if (!window.tsco || typeof window.tsco.playSound !== 'function') {
    console.warn('[tsco] window.tsco.playSound missing — sound disabled');
    return;
  }

  let lastFired = 0;
  function maybeFire() {
    const now = Date.now();
    if (now - lastFired < (cfg.cooldownMs || 4000)) return;
    lastFired = now;
    window.tsco.playSound(cfg.file || 'alert1.wav', cfg.volume == null ? 0.5 : cfg.volume);
  }

  // Selectors for "new message added". Listed in priority — first match wins.
  const SELECTORS = [
    '.chat-list--default',
    '.chat-scrollable-area__message-container',
    'yt-live-chat-item-list-renderer #items',
    '.chat-messages-container',
    '.chatroom',
    '[role="log"]'
  ];

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        // Heuristic: only fire if at least one added node looks like a chat line.
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const cls = (n.className || '') + '';
          if (cls.includes('chat-line') || cls.includes('chat-entry') || cls.includes('chat-message') || n.tagName === 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER' || n.tagName === 'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER') {
            maybeFire();
            return;
          }
        }
      }
    }
  });

  function attach() {
    for (const sel of SELECTORS) {
      const root = document.querySelector(sel);
      if (root) {
        observer.observe(root, { childList: true, subtree: true });
        console.log('[tsco] sound observer attached to', sel);
        return;
      }
    }
    setTimeout(attach, 1000);
  }
  attach();
})();
