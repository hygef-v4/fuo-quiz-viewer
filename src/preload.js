const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectZipFile: () => ipcRenderer.invoke('select-zip-file'),
  loadZipFile: (zipPath) => ipcRenderer.invoke('load-zip-file', zipPath),
  saveAttachment: (zipPath, entryPath) => ipcRenderer.invoke('save-attachment', { zipPath, entryPath }),
  
  // Auto Updater
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, ...args) => callback(...args)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, ...args) => callback(...args)),
  onUpdateMessage: (callback) => ipcRenderer.on('update-message', (event, ...args) => callback(...args))
});
