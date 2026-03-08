const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.setPath('userData', path.join(__dirname, '.electron-data'));

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 700,
        resizable: false,
        transparent: true,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    ipcMain.on('close-app', () => app.quit());
    ipcMain.on('minimize-app', () => win.minimize());
    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win.setIgnoreMouseEvents(ignore, options);
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
