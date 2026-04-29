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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    org_name TEXT,
    org_type TEXT,
    org_display_name TEXT,
    onboarding_complete INTEGER NOT NULL DEFAULT 0
  );
`);

// Migrate existing databases that pre-date the org columns
for (const sql of [
  'ALTER TABLE users ADD COLUMN org_name TEXT',
  'ALTER TABLE users ADD COLUMN org_type TEXT',
  'ALTER TABLE users ADD COLUMN org_display_name TEXT',
  'ALTER TABLE users ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0',
]) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

// Seed the admin account on every startup so it always exists.
const ADMIN_EMAIL = 'andre.jacob.anderson@gmail.com';
const ADMIN_PASSWORD = '7980';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
if (!existing) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.prepare(
    'INSERT INTO users (email, password_hash, role, onboarding_complete) VALUES (?, ?, ?, 1)'
  ).run(ADMIN_EMAIL, hash, 'admin');
  console.log('[db] Admin account seeded');
} else {
  // Ensure existing admin always has onboarding bypassed
  db.prepare('UPDATE users SET onboarding_complete = 1 WHERE email = ?').run(ADMIN_EMAIL);
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
  org_name: string | null;
  org_type: string | null;
  org_display_name: string | null;
  onboarding_complete: number;
}

export const userQueries = {
  findByEmail: db.prepare<[string], User>('SELECT * FROM users WHERE email = ?'),
  findById:    db.prepare<[number], User>('SELECT * FROM users WHERE id = ?'),
  create:      db.prepare<[string, string], { lastInsertRowid: number }>(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)'
  ),
  updateOrg: db.prepare<[string, string, string, number], void>(
    'UPDATE users SET org_name = ?, org_type = ?, org_display_name = ?, onboarding_complete = 1 WHERE id = ?'
  ),
  count: db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM users'),
};

export default db;
