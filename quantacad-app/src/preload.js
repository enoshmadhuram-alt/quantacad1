const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close:    () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // File operations
  importDrawing: () => ipcRenderer.invoke('import-drawing'),
  saveProject:   (data) => ipcRenderer.invoke('save-project', data),
  openProject:   () => ipcRenderer.invoke('open-project'),
  exportReport:  (opts) => ipcRenderer.invoke('export-report', opts),
  showMessage:   (opts) => ipcRenderer.invoke('show-message', opts),

  // Menu events from main process → renderer
  onMenu:         (cb) => ipcRenderer.on('menu', (_, cmd) => cb(cmd)),
  onLoadProject:  (cb) => ipcRenderer.on('load-project', (_, data) => cb(data)),
  onImportFiles:  (cb) => ipcRenderer.on('import-files', (_, files) => cb(files)),

  // Platform
  platform: process.platform,
});
