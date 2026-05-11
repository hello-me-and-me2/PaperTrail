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
    onboarding_complete INTEGER NOT NULL DEFAULT 0,
    survey_complete INTEGER NOT NULL DEFAULT 0,
    org_survey TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS org_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    content TEXT,
    file_size INTEGER,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate existing databases that pre-date the org columns
for (const sql of [
  'ALTER TABLE users ADD COLUMN org_name TEXT',
  'ALTER TABLE users ADD COLUMN org_type TEXT',
  'ALTER TABLE users ADD COLUMN org_display_name TEXT',
  'ALTER TABLE users ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN data_setup_complete INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN survey_complete INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN org_survey TEXT',
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
    'INSERT INTO users (email, password_hash, role, onboarding_complete, survey_complete, data_setup_complete) VALUES (?, ?, ?, 1, 1, 1)'
  ).run(ADMIN_EMAIL, hash, 'admin');
  console.log('[db] Admin account seeded');
} else {
  // Ensure existing admin always has all onboarding stages bypassed
  db.prepare('UPDATE users SET onboarding_complete = 1, survey_complete = 1, data_setup_complete = 1 WHERE email = ?').run(ADMIN_EMAIL);
}

// One-time reset: delete all non-admin accounts and their files
db.exec(`CREATE TABLE IF NOT EXISTS admin_flags (key TEXT PRIMARY KEY, value TEXT)`);
const resetDone = (db.prepare("SELECT value FROM admin_flags WHERE key = 'users_reset_v1'").get() as { value: string } | undefined);
if (!resetDone) {
  db.exec(`DELETE FROM org_files WHERE user_id IN (SELECT id FROM users WHERE role != 'admin')`);
  db.exec(`DELETE FROM users WHERE role != 'admin'`);
  db.prepare("INSERT OR REPLACE INTO admin_flags (key, value) VALUES ('users_reset_v1', '1')").run();
  console.log('[db] One-time reset: all non-admin accounts cleared');
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
  survey_complete: number;
  data_setup_complete: number;
  org_survey: string | null;
}

export interface OrgFile {
  id: number;
  user_id: number;
  original_name: string;
  file_type: string;
  content: string | null;
  file_size: number | null;
  uploaded_at: string;
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
  updateSurvey: db.prepare<[string, number], void>(
    'UPDATE users SET org_survey = ?, survey_complete = 1 WHERE id = ?'
  ),
  count: db.prepare<[], { n: number }>('SELECT COUNT(*) as n FROM users'),
  markDataSetupComplete: db.prepare<[number], void>('UPDATE users SET data_setup_complete = 1 WHERE id = ?'),
};

export const orgFileQueries = {
  insert: db.prepare<[number, string, string, string, number], { lastInsertRowid: number }>(
    'INSERT INTO org_files (user_id, original_name, file_type, content, file_size) VALUES (?, ?, ?, ?, ?)'
  ),
  listByUser: db.prepare<[number], OrgFile>('SELECT * FROM org_files WHERE user_id = ? ORDER BY uploaded_at DESC'),
  deleteById: db.prepare<[number, number], void>('DELETE FROM org_files WHERE id = ? AND user_id = ?'),
};

export default db;
