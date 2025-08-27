import { app, BrowserWindow, ipcMain, clipboard, nativeImage, globalShortcut } from "electron";
import * as path from "path";
import { initDatabase, saveClipboardItemWithTags, fetchRecentClipboardItems, searchClipboardItemsByTag, fetchUntaggedClipboardItems, updateClipboardItemTags } from "./db";
import { generateTagsForText } from "./ai";

let mainWindow: BrowserWindow | null = null;
let lastClipboardText = "";
let clipboardInterval: NodeJS.Timeout | null = null;

const createWindow = () => {
  // Resolve icon from built assets (icns on macOS, png elsewhere)
  const appPath = app.getAppPath();
  const iconPath = process.platform === "darwin"
    ? path.join(appPath, "assets", "icon.icns")
    : path.join(appPath, "assets", "icon.png");
  const iconImage = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // secure bridge
    },
    icon: iconImage,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile("dist/index.html");
  }
};

function broadcastClipboard(text: string) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("clipboard-changed", text);
  }
}

async function onClipboardUpdated(text: string) {
  broadcastClipboard(text);
  let tags: string[] | null = null;
  try {
    // Use last few clipboard texts as context (excluding identical text)
    const recent = await fetchRecentClipboardItems(10);
    const contextSnippets = recent
      .map((r) => r.text)
      .filter((t) => t && t !== text)
      .slice(0, 5);
    tags = await generateTagsForText(text, contextSnippets);
  } catch {}
  await saveClipboardItemWithTags(text, tags);
}

function startClipboardWatcher() {
  if (clipboardInterval) return;
  lastClipboardText = clipboard.readText();
  clipboardInterval = setInterval(async () => {
    const current = clipboard.readText();
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
    const untagged = await fetchUntaggedClipboardItems(50);
    if (!untagged.length) return;
    const recent = await fetchRecentClipboardItems(10);
    const context = recent.map((r) => r.text);

    for (const row of untagged) {
      try {
        const tags = await generateTagsForText(row.text, context);
        await updateClipboardItemTags(row.id, tags);
      } catch {}
    }
  } catch {}
}

app.whenReady().then(async () => {
  // Set Dock icon on macOS
  try {
    if (process.platform === "darwin" && app.dock) {
      const appPath = app.getAppPath();
      const icnsPath = path.join(appPath, "assets", "icon.icns");
      const dockIcon = nativeImage.createFromPath(icnsPath);
      if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon);
    }
  } catch {}

  // Initialize database (no-op if env missing)
  await initDatabase();

  // Kick off background backfill for missing tags (non-blocking)
  void backfillMissingTags();

  // Register global copy shortcut to immediately reflect copied text
  globalShortcut.register("CommandOrControl+C", async () => {
    const text = clipboard.readText();
    if (text && text !== lastClipboardText) {
      lastClipboardText = text;
      await onClipboardUpdated(text);
    }
  });

  startClipboardWatcher();
  createWindow();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopClipboardWatcher();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// IPC handlers
ipcMain.handle("get-clipboard", () => clipboard.readText());
ipcMain.handle("set-clipboard", (_, text: string) => clipboard.writeText(text));
ipcMain.handle("db:fetch-recent", async (_evt, limit?: number) => {
  const rows = await fetchRecentClipboardItems(typeof limit === "number" ? limit : 20);
  return rows;
});
ipcMain.handle("db:search-by-tag", async (_evt, tag: string, limit?: number) => {
  const rows = await searchClipboardItemsByTag(tag, typeof limit === "number" ? limit : 50);
  return rows;
});