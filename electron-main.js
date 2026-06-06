const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset', // Gives it a sleek, modern, borderless look (Mac)
    autoHideMenuBar: true,        // Hides the classic Windows menu bar
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // In development, load the Vite local server
  win.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});