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

## ⚠️ macOS says the app is "damaged" — what to do

Because the build is **unsigned** (no Apple Developer ID), macOS Gatekeeper attaches a "quarantine" flag to the `.dmg` when you download it from a browser. On launch it may show one of two messages:

- *"… is damaged and can't be opened. You should move it to the Trash."* — confusing but **the app is fine**, the quarantine flag is the problem.
- *"… cannot be opened because the developer cannot be verified."* — friendlier, with a `Cancel` / `Move to Bin` prompt. Use the fix below in either case.

### Fix (pick one)

**Option A — Right-click → Open** (one-time):
1. Drag the app to `/Applications`
2. **Right-click** the app → **Open**
3. macOS shows a confirmation dialog with an `Open` button → click it
4. App launches. Subsequent launches work normally.

**Option B — Strip the quarantine flag from Terminal** (most reliable):
```bash
xattr -cr "/Applications/Transparent Streaming Chat.app"
```
Then double-click as usual. The flag is what triggers the "damaged" warning — removing it makes macOS treat the app like any local build.

If neither works, open a GitHub issue with the exact error text.

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
