const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Run main.js logic check
const mainPath = path.join(__dirname, '../electron/main.js');
console.log('Testing main.js require & startup...');
require(mainPath);
