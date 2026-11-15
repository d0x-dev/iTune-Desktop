# iTune Desktop (Windows .exe)

A standalone YouTube Music desktop player with an Apple Music–inspired dark glassmorphism interface.

Unlike web-based alternatives (such as BitChord Web), **iTune Desktop does NOT require any browser extensions**. It has full native network capabilities, embeds a secure Google sign-in window, and talks directly to YouTube Music's InnerTube APIs.

---

## ✨ Features

- 🔑 **Native Google Sign-In:** One-click Google Account sign-in via an embedded secure Chromium window. Captures your YouTube session cookies automatically. No extension needed!
- 📂 **Personal Playlists & Library:** Automatically loads your own YouTube Music playlists, albums, and liked songs.
- 🕒 **Listening History:** Real-time sync with your YouTube Music account's listening history.
- 🔍 **Universal Search:** Instant search for songs, albums, artists, music videos, and public playlists.
- 🎵 **High-Quality Audio Playback:** Resolves and streams adaptive 160kbps Opus / 128kbps AAC streams directly via YouTube's player API.
- 📝 **Lyrics Integration:** View lyrics fetched on-demand from YouTube Music.
- 🎨 **Apple Music Dark UI:** Beautiful dark theme with ambient background gradients, responsive cards, and full queue controls.

---

## 🚀 Getting Started

### Development Mode
To start the app with live reload:
```bash
npm run electron:dev
```

### Build Windows `.exe`
To package the app into a standalone Windows executable:
```bash
npm run electron:build
```
The compiled executables will be generated in the `release/` directory:
- `release/iTune Desktop 1.0.0.exe` (Standalone portable executable)
- `release/win-unpacked/iTune Desktop.exe` (Unpacked executable for quick testing)

---

## 🛠️ Architecture Overview

- **Frontend:** React 19 + Tailwind CSS + Lucide Icons (bundled with Vite).
- **Desktop Runtime:** Electron 33 (main process with native IPC handlers).
- **Core Engine:** `youtubei.js` (InnerTube client handling YouTube Music catalog, search, and cipher deciphering).
- **Session Management:** Secure local cookie persistence stored in `%APPDATA%/itune-desktop/itune_session.json`.
