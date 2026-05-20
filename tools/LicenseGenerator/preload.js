const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("GenBridge", {
  loadKeys: () => ipcRenderer.invoke("keys:load"),
  generate: (payload) => ipcRenderer.invoke("license:generate", payload),
});
