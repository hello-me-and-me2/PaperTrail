import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Prefer /data (Railway persistent volume) then fall back to repo root
const dataDir = fs.existsSync('/data') ? '/data' : path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'papertrail.db');
console.log(`[db] ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed the admin account on every startup so it always exists.
const ADMIN_EMAIL = 'andre.jacob.anderson@gmail.com';
const ADMIN_PASSWORD = '7980';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
if (!existing) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(
    ADMIN_EMAIL,
    hash,
    'admin'
  );
  console.log('[db] Admin account seeded');
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
}

export const userQueries = {
  findByEmail: db.prepare<[string], User>('SELECT * FROM users WHERE email = ?'),
  findById:    db.prepare<[number], User>('SELECT * FROM users WHERE id = ?'),
  create:      db.prepare<[string, string], { lastInsertRowid: number }>(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)'
  ),
  count:       db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM users'),
};

export default db;
