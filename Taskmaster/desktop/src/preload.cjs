const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coreknotDesktop', {
  getInfo: () => ipcRenderer.invoke('coreknot:get-desktop-info'),
  checkForUpdates: () => ipcRenderer.invoke('coreknot:check-for-updates'),
  onUpdateStatus: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('coreknot:update-status', wrapped);
    return () => ipcRenderer.removeListener('coreknot:update-status', wrapped);
  },
});
