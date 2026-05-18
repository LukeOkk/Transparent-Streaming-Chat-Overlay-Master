# Transparent Streaming Chat Overlay — Master

A cross-platform port of [Transparent Twitch Chat Overlay](https://github.com/baffler/Transparent-Twitch-Chat-Overlay) (originally Windows-only, WPF/.NET) to macOS (and Linux/Windows) via Electron. Loads the **official chat popout** for either **Twitch** or **Kick** inside a borderless, transparent, always-on-top desktop window — ideal for overlaying live chat on top of OBS, games, or any windowed application.

## Status

`v0.1.0` — initial macOS port. Apple Silicon (`arm64`) `.dmg` is the primary artifact. Unsigned (Gatekeeper will require Ctrl-click → Open on first launch).

## Features

- 🪟 Transparent, borderless, always-on-top window
- 🟣 **Twitch** popout chat — with **BTTV / FFZ / 7TV** emote rendering on top
- 🟢 **Kick** popout chat
- 🔴 **YouTube Live** chat (paste live URL or 11-char video ID)
- 🌐 **Custom URL** — KapChat, jChat, any OBS browser-source URL, etc.
- 🌓 **Opacity slider** in Settings — drag with mouse or use arrow keys (no keyboard shortcuts needed)
- 🔔 **Sound alerts** on new chat messages — pick from 6 bundled tones, volume + cooldown sliders, off by default
- 💾 Persistent config: `~/Library/Application Support/Transparent Streaming Chat/config.json`
- 🎨 First-run setup window with platform selector
- ✂️ Per-platform CSS injection: hides chat input, header, banners, scrollbars; adds text shadow for readability

## Run from source

Requires Node.js ≥ 18 (tested with 26) and pnpm.

```bash
pnpm install
pnpm start
```

## Build `.dmg`

```bash
pnpm dist:mac
```

Output lands in `dist/`. The first launch on a fresh Mac will require **Right-click → Open** because the app is unsigned.

## Configuration

- First launch shows a setup window asking for the Twitch channel name.
- Change channel later: menu bar → *Transparent Streaming Chat* → *Change Channel…*
- Config file: `~/Library/Application Support/Transparent Streaming Chat/config.json`

## Trade-offs vs. the original WPF app

| Feature                                     | WPF (Windows) | Port (macOS) |
|---------------------------------------------|---------------|--------------|
| Transparent borderless overlay              | ✅            | ✅           |
| Click-through                               | ✅            | ✅           |
| Global hotkeys                              | ✅ (Win32)    | ✅ (Electron `globalShortcut`) |
| Twitch chat                                 | ✅            | ✅ (official popout + CSS inject) |
| Kick chat                                   | ❌            | ✅ (official popout + CSS inject) |
| YouTube Live chat                           | ❌            | ✅ (live_chat?v=ID) |
| Custom URL (KapChat, jChat, any iframe)     | ✅ (CustomProvider) | ✅ |
| Background opacity toggle                   | ✅            | ✅ (`⌃⇧T`) |
| BTTV / FFZ / 7TV emotes                     | ✅ (NativeChat v2) | ✅ (Twitch only — global + channel emotes injected) |
| Sound alerts                                | ✅            | ✅ (6 bundled tones, volume + cooldown) |
| Built-in SettingsWindow                     | ✅            | ✅ (opacity slider, sound config, emote toggles) |
| Per-user chat filters / highlight colors    | ✅            | ❌ |
| KapChat / jChat / jCyan providers           | ✅            | ❌ |

## Credits

- Original WPF app & NativeChatClient: [baffler](https://github.com/baffler)

## License

MIT (inherits from upstream).
