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

db.exec(`
  CREATE TABLE IF NOT EXISTS org_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    webhook_token TEXT,
    credentials_json TEXT,
    last_sync_at TEXT,
    connected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS corruption_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'HIGH',
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'recipient',
    score INTEGER NOT NULL DEFAULT 0,
    analysis_url TEXT,
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT,
    email_sent INTEGER NOT NULL DEFAULT 0,
    push_sent INTEGER NOT NULL DEFAULT 0
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

export interface OrgConnection {
  id: number;
  user_id: number;
  service: string;
  label: string | null;
  status: string;
  webhook_token: string | null;
  credentials_json: string | null;
  last_sync_at: string | null;
  connected_at: string;
}

export interface CorruptionAlert {
  id: number;
  user_id: number;
  title: string;
  description: string;
  severity: string;
  entity_name: string;
  entity_type: string;
  score: number;
  analysis_url: string | null;
  detected_at: string;
  read_at: string | null;
  email_sent: number;
  push_sent: number;
}

export interface PushSubscription {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
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

export const connectionQueries = {
  insert: db.prepare<[number, string, string | null, string | null, string | null], { lastInsertRowid: number }>(
    'INSERT INTO org_connections (user_id, service, label, webhook_token, credentials_json) VALUES (?, ?, ?, ?, ?)'
  ),
  listByUser: db.prepare<[number], OrgConnection>('SELECT * FROM org_connections WHERE user_id = ? ORDER BY connected_at DESC'),
  deleteById: db.prepare<[number, number], void>('DELETE FROM org_connections WHERE id = ? AND user_id = ?'),
  findByWebhookToken: db.prepare<[string], OrgConnection>('SELECT * FROM org_connections WHERE webhook_token = ?'),
  updateLastSync: db.prepare<[number], void>(`UPDATE org_connections SET last_sync_at = datetime('now') WHERE id = ?`),
};

export const alertQueries = {
  create: db.prepare<[number, string, string, string, string, string, number, string], { lastInsertRowid: number }>(
    'INSERT INTO corruption_alerts (user_id, title, description, severity, entity_name, entity_type, score, analysis_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  listByUser: db.prepare<[number], CorruptionAlert>('SELECT * FROM corruption_alerts WHERE user_id = ? ORDER BY detected_at DESC'),
  unreadCount: db.prepare<[number], { n: number }>('SELECT COUNT(*) as n FROM corruption_alerts WHERE user_id = ? AND read_at IS NULL'),
  markRead: db.prepare<[number, number], void>(`UPDATE corruption_alerts SET read_at = datetime('now') WHERE id = ? AND user_id = ?`),
  markAllRead: db.prepare<[number], void>(`UPDATE corruption_alerts SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`),
  findRecentByEntity: db.prepare<[number, string], CorruptionAlert>(
    `SELECT * FROM corruption_alerts WHERE user_id = ? AND entity_name = ? AND detected_at > datetime('now', '-24 hours') LIMIT 1`
  ),
  markEmailSent: db.prepare<[number], void>('UPDATE corruption_alerts SET email_sent = 1 WHERE id = ?'),
  markPushSent: db.prepare<[number], void>('UPDATE corruption_alerts SET push_sent = 1 WHERE id = ?'),
};

export const pushSubQueries = {
  upsert: db.prepare<[number, string, string, string], void>(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ),
  listByUser: db.prepare<[number], PushSubscription>('SELECT * FROM push_subscriptions WHERE user_id = ?'),
  deleteByEndpoint: db.prepare<[string], void>('DELETE FROM push_subscriptions WHERE endpoint = ?'),
};

export const userQueries_extra = {
  listAllActive: db.prepare<[], User>('SELECT * FROM users WHERE data_setup_complete = 1'),
};

export const orgFileQueries = {
  insert: db.prepare<[number, string, string, string, number], { lastInsertRowid: number }>(
    'INSERT INTO org_files (user_id, original_name, file_type, content, file_size) VALUES (?, ?, ?, ?, ?)'
  ),
  listByUser: db.prepare<[number], OrgFile>('SELECT * FROM org_files WHERE user_id = ? ORDER BY uploaded_at DESC'),
  deleteById: db.prepare<[number, number], void>('DELETE FROM org_files WHERE id = ? AND user_id = ?'),
};

export default db;
