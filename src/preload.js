const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("AppBridge", {
  readAutoLicense: () => ipcRenderer.invoke("app:readAutoLicense"),
getMachineId: () => ipcRenderer.invoke("app:getMachineId"),
  sendZplTcp9100: (payload) => ipcRenderer.invoke("zpl:sendTcp9100", payload),
  listPrinters: () => ipcRenderer.invoke("print:listPrinters"),
  rawPrintZpl: (payload) => ipcRenderer.invoke("print:rawZpl", payload),
  printCurrentPage: (payload) => ipcRenderer.invoke("print:currentPage", payload),
  printLabels: (payload) => ipcRenderer.invoke("print:labels", payload),
});


// ===== License API (Machine ID) =====
contextBridge.exposeInMainWorld('licenseAPI', {
  getMachineId: () => ipcRenderer.invoke('lic:get-machine-id')
});
