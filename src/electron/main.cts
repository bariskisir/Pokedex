/** Owns the isolated desktop window, permission policy, and validated native controls. */
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  screen,
  session,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
const rendererUrl = pathToFileURL(rendererPath).href;

/** Applies native window actions only for the packaged renderer's top-level frame. */
function handleWindowAction(event: IpcMainEvent, action: unknown): void {
  if (event.senderFrame !== event.sender.mainFrame || event.senderFrame?.url !== rendererUrl)
    return;
  const window = BrowserWindow.fromWebContents(event.sender);
  if (action === 'minimize') window?.minimize();
  if (action === 'close') window?.close();
}

/** Resizes only the trusted device window to its closed or unfolded desktop footprint. */
function handleExpansion(event: IpcMainInvokeEvent, expanded: unknown): void {
  if (
    typeof expanded !== 'boolean' ||
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame?.url !== rendererUrl
  )
    return;
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  const current = window.getBounds();
  const workArea = screen.getDisplayMatching(current).workArea;
  const width = Math.min(expanded ? 812 : 440, workArea.width);
  const height = Math.min(680, workArea.height);
  const x = Math.max(
    workArea.x,
    Math.min(
      Math.round(current.x + current.width / 2 - width / 2),
      workArea.x + workArea.width - width,
    ),
  );
  const y = Math.max(workArea.y, Math.min(current.y, workArea.y + workArea.height - height));
  window.setBounds({ x, y, width, height });
}

/** Creates a compact transparent desktop window around the physical Pokédex silhouette. */
async function createWindow(): Promise<void> {
  const workArea = screen.getPrimaryDisplay().workArea;
  const window = new BrowserWindow({
    width: Math.min(440, workArea.width),
    height: Math.min(680, workArea.height),
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    transparent: true,
    hasShadow: false,
    show: false,
    frame: false,
    backgroundColor: '#00000000',
    title: 'Pokédex',
    icon: path.join(__dirname, '..', 'renderer', 'pokeball.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(denyNewWindow);
  window.webContents.on('will-navigate', preventNavigation);
  window.webContents.on('will-attach-webview', preventNavigation);
  await window.loadFile(rendererPath);
  window.show();
}

/** Rejects popup windows because all application navigation occurs inside the renderer. */
function denyNewWindow(): { action: 'deny' } {
  return { action: 'deny' };
}

/** Prevents loaded content from navigating away or attaching embedded webviews. */
function preventNavigation(event: { preventDefault: () => void }): void {
  event.preventDefault();
}

/** Refuses browser permissions because no application feature requires them. */
function denyPermissionRequest(
  _contents: Electron.WebContents,
  _permission: string,
  callback: (granted: boolean) => void,
): void {
  callback(false);
}

/** Refuses synchronous permission checks consistently with permission requests. */
function denyPermissionCheck(): boolean {
  return false;
}

/** Registers application-wide handlers once before creating the initial window. */
async function initialize(): Promise<void> {
  session.defaultSession.setPermissionRequestHandler(denyPermissionRequest);
  session.defaultSession.setPermissionCheckHandler(denyPermissionCheck);
  ipcMain.on('pokedex:window', handleWindowAction);
  ipcMain.handle('pokedex:expanded', handleExpansion);
  app.on('activate', handleActivate);
  await createWindow();
}

/** Restores the application when its dock icon is activated on macOS. */
function handleActivate(): void {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow().catch(handleStartupError);
}

/** Closes the process when the last window exits outside macOS. */
function handleAllWindowsClosed(): void {
  if (process.platform !== 'darwin') app.quit();
}

/** Reports a failed startup instead of leaving an invisible Electron process alive. */
function handleStartupError(error: unknown): void {
  dialog.showErrorBox(
    'Unable to start Pokédex',
    error instanceof Error ? error.message : 'An unexpected startup error occurred.',
  );
  app.exit(1);
}

app.whenReady().then(initialize).catch(handleStartupError);
app.on('window-all-closed', handleAllWindowsClosed);
