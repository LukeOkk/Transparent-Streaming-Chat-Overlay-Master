/*
 * Transparent Streaming Chat — Twitch popout emote enhancer.
 * Injected into twitch.tv/popout/<channel>/chat after did-finish-load.
 *
 * Adds BTTV / FFZ / 7TV emote rendering on top of Twitch's native emote pipeline.
 * Toggles read from window.__tscoEmoteCfg = { bttv, ffz, seven } set by main process.
 *
 * Honest caveats:
 *  - Twitch DOM changes frequently. Selectors below are best-effort.
 *  - Resolves channel ID via public unauthenticated Twitch GQL (kimne78kx3ncx6brgo4mv6wki5h1ko).
 *    If Twitch rate-limits or changes the schema, FFZ-by-name still works as fallback.
 *  - Emote matching is whole-word against the message text; case-sensitive by default.
 *  - MutationObserver replaces matched words with <img> nodes; runs once per added message.
 */
(async function () {
  if (window.__tscoEmotesInstalled) return;
  window.__tscoEmotesInstalled = true;

  const cfg = window.__tscoEmoteCfg || { bttv: true, ffz: true, seven: true };
  if (!(cfg.bttv || cfg.ffz || cfg.seven)) {
    console.log('[tsco] all emote providers disabled');
    return;
  }

  const m = window.location.pathname.match(/^\/popout\/([^/]+)\/chat/i);
  if (!m) return;
  const login = m[1].toLowerCase();

  async function resolveChannelId(name) {
    try {
      const r = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
          'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `{ user(login: "${name.replace(/"/g, '')}") { id } }`
        })
      });
      const j = await r.json();
      return j && j.data && j.data.user && j.data.user.id;
    } catch (e) {
      console.warn('[tsco] resolve channel id failed', e);
      return null;
    }
  }

  const channelId = await resolveChannelId(login);
  console.log('[tsco] channel', login, 'id', channelId);

  const emotes = new Map();

  async function loadBttv() {
    try {
      const g = await fetch('https://api.betterttv.net/3/cached/emotes/global').then(r => r.json());
      g.forEach((e) => {
        emotes.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x.${e.imageType}`);
      });
      if (channelId) {
        const c = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`).then(r => r.json());
        [...(c.channelEmotes || []), ...(c.sharedEmotes || [])].forEach((e) => {
          emotes.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x.${e.imageType}`);
        });
      }
    } catch (e) { console.warn('[tsco] bttv:', e); }
  }

  async function loadFfz() {
    try {
      const g = await fetch('https://api.frankerfacez.com/v1/set/global').then(r => r.json());
      Object.values(g.sets || {}).forEach((set) => {
        (set.emoticons || []).forEach((em) => {
          const u = em.urls && (em.urls['2'] || em.urls['4'] || em.urls['1']);
          if (u) emotes.set(em.name, u.startsWith('http') ? u : 'https:' + u);
        });
      });
      const c = await fetch(`https://api.frankerfacez.com/v1/room/${encodeURIComponent(login)}`).then(r => r.json());
      Object.values(c.sets || {}).forEach((set) => {
        (set.emoticons || []).forEach((em) => {
          const u = em.urls && (em.urls['2'] || em.urls['4'] || em.urls['1']);
          if (u) emotes.set(em.name, u.startsWith('http') ? u : 'https:' + u);
        });
      });
    } catch (e) { console.warn('[tsco] ffz:', e); }
  }

  async function load7tv() {
    try {
      function pick7tvUrl(host) {
        if (!host || !host.url) return null;
        const files = host.files || [];
        const webp = files.find(f => f.name === '2x.webp') || files.find(f => f.name === '1x.webp') || files[0];
        if (!webp) return null;
        const base = host.url.startsWith('//') ? 'https:' + host.url : host.url.startsWith('http') ? host.url : 'https://' + host.url;
        return `${base}/${webp.name}`;
      }
      const g = await fetch('https://7tv.io/v3/emote-sets/global').then(r => r.json());
      (g.emotes || []).forEach((e) => {
        const u = pick7tvUrl(e.data && e.data.host);
        if (u) emotes.set(e.name, u);
      });
      if (channelId) {
        const u = await fetch(`https://7tv.io/v3/users/twitch/${channelId}`).then(r => r.json());
        ((u.emote_set && u.emote_set.emotes) || []).forEach((e) => {
          const url = pick7tvUrl(e.data && e.data.host);
          if (url) emotes.set(e.name, url);
        });
      }
    } catch (e) { console.warn('[tsco] 7tv:', e); }
  }

  const loaders = [];
  if (cfg.bttv)  loaders.push(loadBttv());
  if (cfg.ffz)   loaders.push(loadFfz());
  if (cfg.seven) loaders.push(load7tv());
  await Promise.all(loaders);
  console.log(`[tsco] loaded ${emotes.size} emotes for ${login}`);
  if (emotes.size === 0) return;

  function tokenIsEmote(token) {
    return emotes.has(token);
  }

  function replaceTextNode(textNode) {
    const txt = textNode.textContent;
    if (!txt || !txt.trim()) return;

    let needs = false;
    for (const name of emotes.keys()) {
      if (txt.includes(name)) { needs = true; break; }
    }
    if (!needs) return;

    const parts = txt.split(/(\s+)/);
    const span = document.createElement('span');
    let touched = false;
    parts.forEach((p) => {
      if (tokenIsEmote(p)) {
        touched = true;
        const img = document.createElement('img');
        img.src = emotes.get(p);
        img.alt = p;
        img.title = p;
        img.style.height = '24px';
        img.style.verticalAlign = 'middle';
        img.style.margin = '-4px 2px';
        span.appendChild(img);
      } else {
        span.appendChild(document.createTextNode(p));
      }
    });
    if (touched && textNode.parentNode) {
      textNode.parentNode.replaceChild(span, textNode);
    }
  }

  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) { replaceTextNode(node); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'IMG' || tag === 'SVG' || tag === 'VIDEO' || tag === 'STYLE' || tag === 'SCRIPT') return;
    Array.from(node.childNodes).forEach(walk);
  }

  function processMessage(line) {
    const body = line.querySelector('[data-a-target="chat-line-message-body"]')
              || line.querySelector('.chat-line__message-body')
              || line;
    walk(body);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mut) => {
      mut.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches('.chat-line__message')) {
          processMessage(n);
        } else if (n.querySelectorAll) {
          n.querySelectorAll('.chat-line__message').forEach(processMessage);
        }
      });
    });
  });

  function attach() {
    const root = document.querySelector('.chat-list--default')
              || document.querySelector('.chat-scrollable-area__message-container')
              || document.querySelector('[role="log"]');
    if (!root) { setTimeout(attach, 1000); return; }
    document.querySelectorAll('.chat-line__message').forEach(processMessage);
    observer.observe(root, { childList: true, subtree: true });
    console.log('[tsco] emote observer attached');
  }
  attach();
})();
