![iTune Desktop](https://github.com/user-attachments/assets/faad570e-b0c8-4234-b106-049e9ab6a354)

# iTune Desktop

A cross-platform YouTube Music desktop player with an Apple Music–inspired dark glass interface. Windows, macOS, and Linux builds include the same React and Electron app.

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
To build both the Windows installer and portable executable:
```bash
npm run electron:windows
```

Build macOS DMG and ZIP packages with `npm run electron:mac`. Build Linux AppImage and DEB packages with `npm run electron:linux`. All packages are written to `release/`.

GitHub release tags build and publish the Windows, macOS, and Linux packages together. iTune checks GitHub releases when it starts, downloads the matching package inside the app, and shows release notes and available downloads in Settings → General & About.

The update checker selects a Windows setup executable, macOS disk image, or Linux AppImage automatically. The About panel also lists every release file so users can choose the portable Windows executable, macOS ZIP, Linux DEB, or another available package. Package installation and available audio or system integrations can vary by operating system; all app screens remain part of each build.

## Project policies

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Copyright and third-party notices](COPYRIGHT.md)
- [Licensing guide](LICENSING.md)
- [GNU GPL v3 License](LICENSE)

---

## 🛠️ Architecture Overview

- **Frontend:** React 19 + Tailwind CSS + Lucide Icons (bundled with Vite).
- **Desktop Runtime:** Electron 33 (main process with native IPC handlers).
- **Core Engine:** `youtubei.js` (InnerTube client handling YouTube Music catalog, search, and cipher deciphering).
- **Session Management:** Local cookie persistence in Electron's per-user application data directory.

