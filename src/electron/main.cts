/**
 * Starts the Electron main process and owns native window lifecycle behavior.
 */

import { app, BrowserWindow, ipcMain, type IpcMainEvent } from 'electron';
import path from 'node:path';

/**
 * Resolves a file path inside the built renderer output.
 */
function resolveRendererPath(...segments: string[]): string {
  return path.join(__dirname, '..', 'renderer', ...segments);
}

/**
 * Registers IPC handlers that the renderer uses for custom window controls.
 */
function registerWindowIpc(window: BrowserWindow): void {
  ipcMain.on('close-app', () => app.quit());
  ipcMain.on('minimize-app', () => window.minimize());
  ipcMain.on('set-ignore-mouse-events', (event: IpcMainEvent, ignore: boolean, options?: { forward?: boolean }) => {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    sourceWindow?.setIgnoreMouseEvents(ignore, options);
  });
}

/**
 * Creates the frameless Pokedex application window.
 */
function createWindow(): void {
  const window = new BrowserWindow({
    width: 900,
    height: 700,
    resizable: false,
    transparent: true,
    frame: false,
    icon: resolveRendererPath('pokeball.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  registerWindowIpc(window);
  window.loadFile(resolveRendererPath('index.html'));
}

/**
 * Bootstraps Electron after Chromium is ready.
 */
function handleReady(): void {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

/**
 * Exits the application when all windows close on non-macOS platforms.
 */
function handleAllWindowsClosed(): void {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

app.whenReady().then(handleReady);
app.on('window-all-closed', handleAllWindowsClosed);
