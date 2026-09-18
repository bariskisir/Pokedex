/** Exposes scoped native controls and physical-device sizing to the sandboxed renderer. */
import { contextBridge, ipcRenderer } from 'electron';

/** Minimizes the sender's validated application window. */
function minimize(): void {
  ipcRenderer.send('pokedex:window', 'minimize');
}

/** Closes the sender's validated application window. */
function close(): void {
  ipcRenderer.send('pokedex:window', 'close');
}

/** Requests the trusted main process to fit the window around a closed or unfolded device. */
async function setExpanded(expanded: boolean): Promise<void> {
  await ipcRenderer.invoke('pokedex:expanded', expanded);
}

contextBridge.exposeInMainWorld('pokedex', Object.freeze({ minimize, close, setExpanded }));
