"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const db_1 = require("./db");
const ai_1 = require("./ai");
let mainWindow = null;
let lastClipboardText = "";
let clipboardInterval = null;
const createWindow = () => {
    // Resolve icon from built assets (icns on macOS, png elsewhere)
    const appPath = electron_1.app.getAppPath();
    const iconPath = process.platform === "darwin"
        ? path.join(appPath, "assets", "icon.icns")
        : path.join(appPath, "assets", "icon.png");
    const iconImage = electron_1.nativeImage.createFromPath(iconPath);
    mainWindow = new electron_1.BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"), // secure bridge
        },
        icon: iconImage,
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        mainWindow.loadFile("dist/index.html");
    }
};
function broadcastClipboard(text) {
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
        win.webContents.send("clipboard-changed", text);
    }
}
async function onClipboardUpdated(text) {
    broadcastClipboard(text);
    let tags = null;
    try {
        // Use last few clipboard texts as context (excluding identical text)
        const recent = await (0, db_1.fetchRecentClipboardItems)(10);
        const contextSnippets = recent
            .map((r) => r.text)
            .filter((t) => t && t !== text)
            .slice(0, 5);
        tags = await (0, ai_1.generateTagsForText)(text, contextSnippets);
    }
    catch { }
    await (0, db_1.saveClipboardItemWithTags)(text, tags);
}
function startClipboardWatcher() {
    if (clipboardInterval)
        return;
    lastClipboardText = electron_1.clipboard.readText();
    clipboardInterval = setInterval(async () => {
        const current = electron_1.clipboard.readText();
        if (current !== lastClipboardText) {
            lastClipboardText = current;
            await onClipboardUpdated(current);
        }
    }, 300);
}
function stopClipboardWatcher() {
    if (clipboardInterval) {
        clearInterval(clipboardInterval);
        clipboardInterval = null;
    }
}
async function backfillMissingTags() {
    try {
        const untagged = await (0, db_1.fetchUntaggedClipboardItems)(50);
        if (!untagged.length)
            return;
        const recent = await (0, db_1.fetchRecentClipboardItems)(10);
        const context = recent.map((r) => r.text);
        for (const row of untagged) {
            try {
                const tags = await (0, ai_1.generateTagsForText)(row.text, context);
                await (0, db_1.updateClipboardItemTags)(row.id, tags);
            }
            catch { }
        }
    }
    catch { }
}
electron_1.app.whenReady().then(async () => {
    // Set Dock icon on macOS
    try {
        if (process.platform === "darwin" && electron_1.app.dock) {
            const appPath = electron_1.app.getAppPath();
            const icnsPath = path.join(appPath, "assets", "icon.icns");
            const dockIcon = electron_1.nativeImage.createFromPath(icnsPath);
            if (!dockIcon.isEmpty())
                electron_1.app.dock.setIcon(dockIcon);
        }
    }
    catch { }
    // Initialize database (no-op if env missing)
    await (0, db_1.initDatabase)();
    // Kick off background backfill for missing tags (non-blocking)
    void backfillMissingTags();
    // Register global copy shortcut to immediately reflect copied text
    electron_1.globalShortcut.register("CommandOrControl+C", async () => {
        const text = electron_1.clipboard.readText();
        if (text && text !== lastClipboardText) {
            lastClipboardText = text;
            await onClipboardUpdated(text);
        }
    });
    startClipboardWatcher();
    createWindow();
});
electron_1.app.on("will-quit", () => {
    electron_1.globalShortcut.unregisterAll();
    stopClipboardWatcher();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
// IPC handlers
electron_1.ipcMain.handle("get-clipboard", () => electron_1.clipboard.readText());
electron_1.ipcMain.handle("set-clipboard", (_, text) => electron_1.clipboard.writeText(text));
electron_1.ipcMain.handle("db:fetch-recent", async (_evt, limit) => {
    const rows = await (0, db_1.fetchRecentClipboardItems)(typeof limit === "number" ? limit : 20);
    return rows;
});
electron_1.ipcMain.handle("db:search-by-tag", async (_evt, tag, limit) => {
    const rows = await (0, db_1.searchClipboardItemsByTag)(tag, typeof limit === "number" ? limit : 50);
    return rows;
});
//# sourceMappingURL=main.js.map