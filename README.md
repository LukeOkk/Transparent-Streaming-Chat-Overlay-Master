# Transparent Streaming Chat Overlay — Master

A cross-platform port of [Transparent Twitch Chat Overlay](https://github.com/baffler/Transparent-Twitch-Chat-Overlay) (originally Windows-only, WPF/.NET) to **Windows, macOS and Linux** via Electron. Loads the **official chat popout** for **Twitch**, **Kick**, **YouTube Live**, or any **custom URL** inside a borderless, transparent, always-on-top desktop window — ideal for overlaying live chat on top of OBS, games, or any windowed application.

## Status

`v0.4.2` — cross-platform. **Windows** (NSIS `.exe` installer) and **macOS** Apple Silicon (`arm64` `.dmg`) are the primary artifacts; Linux builds an `AppImage`. All builds are **unsigned** — see the per-OS first-launch notes below.

## Features

- 🪟 Transparent, borderless, always-on-top window
- 🟣 **Twitch** popout chat — with **BTTV / FFZ / 7TV** emote rendering on top
- 🟢 **Kick** popout chat
- 🔴 **YouTube Live** chat (paste live URL or 11-char video ID)
- 🌐 **Custom URL** — KapChat, jChat, any OBS browser-source URL, etc.
- 🌓 **Opacity slider** in Settings — drag with mouse or use arrow keys (no keyboard shortcuts needed)
- 🔔 **Sound alerts** on new chat messages — pick from 6 bundled tones, volume + cooldown sliders, off by default
- 🧭 **System-tray menu** on Windows/Linux (menu bar on macOS) — Settings, Reload, Change Channel, Quit
- 💾 Persistent config (`%APPDATA%` on Windows, `~/Library/Application Support` on macOS)
- 🎨 First-run setup window with platform selector
- ✂️ Per-platform CSS injection: hides chat input, header, banners, scrollbars; adds text shadow for readability

## Install

- **Windows** — download the `.exe` installer, run it, and follow the prompts (you can choose the install folder).
- **macOS (Apple Silicon)** — download the `.dmg`, open it, and drag the app to Applications.

## ⚠️ Windows SmartScreen warning

Because the build is **unsigned**, Windows SmartScreen may show *"Windows protected your PC"* on first launch. Click **More info → Run anyway** to continue. The app is otherwise a normal local install.

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

Requires Node.js ≥ 18. Works with `npm` or `pnpm`.

```bash
npm install        # or: pnpm install
npm start          # or: pnpm start
```

## Build installers

```bash
npm run dist:win   # Windows → NSIS installer (.exe)
npm run dist:mac   # macOS   → .dmg (Apple Silicon)
```

Output lands in `dist/`. Build each installer on its matching OS (build the Windows `.exe` on a Windows machine, the `.dmg` on a Mac).

**No Windows machine handy?** Push a `v*` tag — or trigger the **Build Windows installer** GitHub Action manually (Actions tab → *Run workflow*) — and download the `.exe` from the workflow artifacts. The first launch on a fresh Mac requires **Right-click → Open** because the app is unsigned.

## Configuration

- First launch shows a setup window asking for the channel name / URL.
- **Settings & Change Channel:** on **Windows/Linux** use the **system-tray icon** (notification area, bottom-right); on **macOS** use the menu bar → *Transparent Streaming Chat*.
- Config file:
  - **Windows:** `%APPDATA%\Transparent Streaming Chat\config.json`
  - **macOS:** `~/Library/Application Support/Transparent Streaming Chat/config.json`

## Trade-offs vs. the original WPF app

| Feature                                     | WPF (Windows) | Electron port |
|---------------------------------------------|---------------|---------------|
| Transparent borderless overlay              | ✅            | ✅           |
| Click-through                               | ✅            | ✅           |
| Global hotkeys                              | ✅ (Win32)    | ✅ (Electron `globalShortcut`) |
| Twitch chat                                 | ✅            | ✅ (official popout + CSS inject) |
| Kick chat                                   | ❌            | ✅ (official popout + CSS inject) |
| YouTube Live chat                           | ❌            | ✅ (live_chat?v=ID) |
| Custom URL (KapChat, jChat, any iframe)     | ✅ (CustomProvider) | ✅ |
| Background opacity toggle                   | ✅            | ✅ (slider in Settings) |
| BTTV / FFZ / 7TV emotes                     | ✅ (NativeChat v2) | ✅ (Twitch only — global + channel emotes injected) |
| Sound alerts                                | ✅            | ✅ (6 bundled tones, volume + cooldown) |
| Built-in SettingsWindow                     | ✅            | ✅ (opacity slider, sound config, emote toggles) |
| Per-user chat filters / highlight colors    | ✅            | ❌ |
| KapChat / jChat / jCyan providers           | ✅            | ❌ |

## Credits

- Original WPF app & NativeChatClient: [baffler](https://github.com/baffler)

## License

MIT (inherits from upstream).
