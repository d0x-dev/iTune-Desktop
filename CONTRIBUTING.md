# Contributing to iTune Desktop

Thanks for helping improve iTune Desktop. This repository contains the Electron desktop application for Windows, macOS, and Linux.

## Development setup

1. Install Node.js 20 or newer and Git.
2. Clone this repository and run `npm ci`.
3. Run `npm run electron:dev` to start the desktop app with Vite live reload.
4. Run `npm run build` for a production frontend build.
5. Build platform packages with `npm run electron:windows`, `npm run electron:mac`, or `npm run electron:linux` on a compatible host.

## Changes and pull requests

- Keep changes focused and preserve feature parity across supported platforms.
- Update documentation when behavior, setup, packaging, or platform support changes.
- Never commit credentials, cookies, signing keys, user data, or private logs.
- Include a concise description, reproduction steps for fixes, and the checks you ran.
- Include screenshots or a recording for visible UI changes.
- Run `npm run build`, `node --check electron/main.js`, `node --check electron/preload.js`, and `git diff --check` where applicable. Platform packaging should be checked on its matching operating system or by the CI matrix.

Contributions are distributed under the repository's GPL-3.0-or-later terms unless the contributor and project maintainers agree otherwise in writing. Submit only work you have the right to contribute.
