import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.sqlite3');

let db: Database.Database;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      content TEXT NOT NULL,
      ai_prompt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      display_order INTEGER DEFAULT 0
    );
  `);
}

export type Platform = 'twitter' | 'dcinside' | 'navernews' | 'instagram' | 'kakao' | 'telegram';

export interface Post {
  id: number;
  platform: Platform;
  content: string;
  ai_prompt: string | null;
  created_at: string;
}

export function getPosts(platform?: string): Post[] {
  const d = getDb();
  if (platform && platform !== 'all') {
    return d.prepare('SELECT * FROM posts WHERE platform = ? ORDER BY created_at DESC').all(platform) as Post[];
  }
  return d.prepare('SELECT * FROM posts ORDER BY created_at DESC').all() as Post[];
}

export function getPost(id: number): Post | undefined {
  return getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
}

export function createPost(platform: Platform, content: object, ai_prompt?: string): number {
  const result = getDb()
    .prepare('INSERT INTO posts (platform, content, ai_prompt) VALUES (?, ?, ?)')
    .run(platform, JSON.stringify(content), ai_prompt ?? null);
  return result.lastInsertRowid as number;
}

export function deletePost(id: number) {
  getDb().prepare('DELETE FROM posts WHERE id = ?').run(id);
}

export function addImage(post_id: number, filename: string, display_order: number) {
  getDb()
    .prepare('INSERT INTO images (post_id, filename, display_order) VALUES (?, ?, ?)')
    .run(post_id, filename, display_order);
}
