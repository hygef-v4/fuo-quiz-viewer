const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectZipFile: () => ipcRenderer.invoke('select-zip-file'),
  loadZipFile: (zipPath) => ipcRenderer.invoke('load-zip-file', zipPath),
  saveAttachment: (zipPath, entryPath) => ipcRenderer.invoke('save-attachment', { zipPath, entryPath })
});
