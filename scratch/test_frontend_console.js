const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on('console-message', (_e, level, msg, line, source) => {
    console.log(`[Frontend Console] ${msg} (${source}:${line})`);
  });

  await win.loadFile(path.join(__dirname, '../dist/index.html'));
  console.log('Dist index.html loaded.');

  await new Promise(r => setTimeout(r, 2000));
  app.quit();
});
