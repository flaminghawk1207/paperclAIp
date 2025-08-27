import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getClipboard: () => ipcRenderer.invoke("get-clipboard"),
  setClipboard: (text: string) => ipcRenderer.invoke("set-clipboard", text),
  onClipboardChange: (callback: (text: string) => void) => {
    const listener = (_event: unknown, text: string) => callback(text);
    ipcRenderer.on("clipboard-changed", listener);
    return () => ipcRenderer.removeListener("clipboard-changed", listener);
  },
  fetchRecent: (limit?: number) => ipcRenderer.invoke("db:fetch-recent", limit),
  searchByTag: (tag: string, limit?: number) => ipcRenderer.invoke("db:search-by-tag", tag, limit),
});