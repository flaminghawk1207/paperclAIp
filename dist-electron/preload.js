"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    getClipboard: () => electron_1.ipcRenderer.invoke("get-clipboard"),
    setClipboard: (text) => electron_1.ipcRenderer.invoke("set-clipboard", text),
    onClipboardChange: (callback) => {
        const listener = (_event, text) => callback(text);
        electron_1.ipcRenderer.on("clipboard-changed", listener);
        return () => electron_1.ipcRenderer.removeListener("clipboard-changed", listener);
    },
    fetchRecent: (limit) => electron_1.ipcRenderer.invoke("db:fetch-recent", limit),
    searchByTag: (tag, limit) => electron_1.ipcRenderer.invoke("db:search-by-tag", tag, limit),
});
//# sourceMappingURL=preload.js.map