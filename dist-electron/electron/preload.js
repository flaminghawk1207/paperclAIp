"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    getClipboard: () => electron_1.ipcRenderer.invoke("get-clipboard"),
    setClipboard: (text) => electron_1.ipcRenderer.invoke("set-clipboard", text),
});
//# sourceMappingURL=preload.js.map