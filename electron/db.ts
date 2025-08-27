import * as dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

let pool: mysql.Pool | null = null;

function isConfigPresent(): boolean {
  return Boolean(
    process.env.MYSQL_HOST &&
      process.env.MYSQL_USER &&
      (process.env.MYSQL_PASSWORD !== undefined) &&
      process.env.MYSQL_DATABASE
  );
}

export async function initDatabase(): Promise<void> {
  if (!isConfigPresent()) {
    console.warn("[db] MySQL env vars missing; DB features disabled.");
    return;
  }

  try {
    pool = mysql.createPool({
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
  } catch (err) {
    console.error("[db] Failed to initialize MySQL:", err);
    pool = null;
  }
}

export async function saveClipboardItem(text: string): Promise<void> {
  if (!pool) return; // disabled or failed init
  try {
    await pool.query("INSERT INTO clipboard_items (text) VALUES (?)", [text]);
  } catch (err) {
    console.error("[db] Insert failed:", err);
  }
}

export async function saveClipboardItemWithTags(text: string, tags: string[] | null): Promise<void> {
  if (!pool) return;
  try {
    const tagsString = Array.isArray(tags) && tags.length > 0
      ? tags
          .slice(0, 5)
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
          .join(",")
      : null;
    await pool.query("INSERT INTO clipboard_items (text, tags) VALUES (?, ?)", [text, tagsString]);
  } catch (err) {
    console.error("[db] Insert with tags failed:", err);
  }
}

export async function fetchRecentClipboardItems(limit = 20): Promise<Array<{ id: number; text: string; created_at: string; tags: string | null }>> {
  if (!pool) return [];
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT id, text, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, tags FROM clipboard_items ORDER BY id DESC LIMIT ?",
      [limit]
    );
    return rows as unknown as Array<{ id: number; text: string; created_at: string; tags: string | null }>;
  } catch (err) {
    console.error("[db] Fetch failed:", err);
    return [];
  }
}

export async function searchClipboardItemsByTag(tag: string, limit = 50): Promise<Array<{ id: number; text: string; created_at: string; tags: string | null }>> {
  if (!pool) return [];
  const cleaned = tag.trim();
  if (!cleaned) return [];
  try {
    const needle = `%${cleaned.toLowerCase()}%`;
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT id, text, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, tags FROM clipboard_items WHERE tags IS NOT NULL AND LOWER(tags) LIKE ? ORDER BY id DESC LIMIT ?",
      [needle, limit]
    );
    return rows as unknown as Array<{ id: number; text: string; created_at: string; tags: string | null }>;
  } catch (err) {
    console.error("[db] Search by tag failed:", err);
    return [];
  }
}

export async function fetchUntaggedClipboardItems(limit = 50): Promise<Array<{ id: number; text: string }>> {
  if (!pool) return [];
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT id, text FROM clipboard_items WHERE tags IS NULL ORDER BY id DESC LIMIT ?",
      [limit]
    );
    return rows as unknown as Array<{ id: number; text: string }>;
  } catch (err) {
    console.error("[db] Fetch untagged failed:", err);
    return [];
  }
}

export async function updateClipboardItemTags(id: number, tags: string[] | null): Promise<void> {
  if (!pool) return;
  try {
    const tagsString = Array.isArray(tags) && tags.length > 0
      ? tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0).slice(0, 5).join(",")
      : null;
    await pool.query("UPDATE clipboard_items SET tags = ? WHERE id = ?", [tagsString, id]);
  } catch (err) {
    console.error("[db] Update tags failed:", err);
  }
}

export function isDbEnabled(): boolean {
  return pool !== null;
}


