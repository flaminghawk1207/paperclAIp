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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.saveClipboardItem = saveClipboardItem;
exports.saveClipboardItemWithTags = saveClipboardItemWithTags;
exports.fetchRecentClipboardItems = fetchRecentClipboardItems;
exports.searchClipboardItemsByTag = searchClipboardItemsByTag;
exports.fetchUntaggedClipboardItems = fetchUntaggedClipboardItems;
exports.updateClipboardItemTags = updateClipboardItemTags;
exports.isDbEnabled = isDbEnabled;
const dotenv = __importStar(require("dotenv"));
const promise_1 = __importDefault(require("mysql2/promise"));
dotenv.config();
let pool = null;
function isConfigPresent() {
    return Boolean(process.env.MYSQL_HOST &&
        process.env.MYSQL_USER &&
        (process.env.MYSQL_PASSWORD !== undefined) &&
        process.env.MYSQL_DATABASE);
}
async function initDatabase() {
    if (!isConfigPresent()) {
        console.warn("[db] MySQL env vars missing; DB features disabled.");
        return;
    }
    try {
        pool = promise_1.default.createPool({
            host: process.env.MYSQL_HOST,
            port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            connectionLimit: 10,
            charset: "utf8mb4",
        });
        await pool.query(`
      CREATE TABLE IF NOT EXISTS clipboard_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        text LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        tags VARCHAR(255) NULL DEFAULT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
        console.log("[db] Connected and ensured schema.");
    }
    catch (err) {
        console.error("[db] Failed to initialize MySQL:", err);
        pool = null;
    }
}
async function saveClipboardItem(text) {
    if (!pool)
        return; // disabled or failed init
    try {
        await pool.query("INSERT INTO clipboard_items (text) VALUES (?)", [text]);
    }
    catch (err) {
        console.error("[db] Insert failed:", err);
    }
}
async function saveClipboardItemWithTags(text, tags) {
    if (!pool)
        return;
    try {
        const tagsString = Array.isArray(tags) && tags.length > 0
            ? tags
                .slice(0, 5)
                .map((t) => t.trim().toLowerCase())
                .filter((t) => t.length > 0)
                .join(",")
            : null;
        await pool.query("INSERT INTO clipboard_items (text, tags) VALUES (?, ?)", [text, tagsString]);
    }
    catch (err) {
        console.error("[db] Insert with tags failed:", err);
    }
}
async function fetchRecentClipboardItems(limit = 20) {
    if (!pool)
        return [];
    try {
        const [rows] = await pool.query("SELECT id, text, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, tags FROM clipboard_items ORDER BY id DESC LIMIT ?", [limit]);
        return rows;
    }
    catch (err) {
        console.error("[db] Fetch failed:", err);
        return [];
    }
}
async function searchClipboardItemsByTag(tag, limit = 50) {
    if (!pool)
        return [];
    const cleaned = tag.trim();
    if (!cleaned)
        return [];
    try {
        const needle = `%${cleaned.toLowerCase()}%`;
        const [rows] = await pool.query("SELECT id, text, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, tags FROM clipboard_items WHERE tags IS NOT NULL AND LOWER(tags) LIKE ? ORDER BY id DESC LIMIT ?", [needle, limit]);
        return rows;
    }
    catch (err) {
        console.error("[db] Search by tag failed:", err);
        return [];
    }
}
async function fetchUntaggedClipboardItems(limit = 50) {
    if (!pool)
        return [];
    try {
        const [rows] = await pool.query("SELECT id, text FROM clipboard_items WHERE tags IS NULL ORDER BY id DESC LIMIT ?", [limit]);
        return rows;
    }
    catch (err) {
        console.error("[db] Fetch untagged failed:", err);
        return [];
    }
}
async function updateClipboardItemTags(id, tags) {
    if (!pool)
        return;
    try {
        const tagsString = Array.isArray(tags) && tags.length > 0
            ? tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0).slice(0, 5).join(",")
            : null;
        await pool.query("UPDATE clipboard_items SET tags = ? WHERE id = ?", [tagsString, id]);
    }
    catch (err) {
        console.error("[db] Update tags failed:", err);
    }
}
function isDbEnabled() {
    return pool !== null;
}
//# sourceMappingURL=db.js.map