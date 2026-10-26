// SQLite storage using Node's built-in driver (no native build step needed).
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'storage');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'store.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'download',
  price_cents INTEGER NOT NULL DEFAULT 0,
  compare_cents INTEGER,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  cover_path TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  preview INTEGER NOT NULL DEFAULT 0,             -- 1 = free sample anyone can view
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ngn',
  status TEXT NOT NULL DEFAULT 'pending',         -- 'pending' | 'paid' | 'free' | 'granted' | 'refunded'
  coupon_code TEXT,
  payment_ref TEXT,                               -- Paystack transaction reference
  access_token TEXT,                              -- secret part of the buyer's private download link
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  percent_off INTEGER,
  amount_off_cents INTEGER,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_files_product ON files(product_id);
`);

// Pre-"downloads only" defaults; replaced on startup if the owner never changed them.
const OLD_DEFAULTS = {
  tagline: 'Courses, templates & tools — built to help you ship.',
  hero_sub: 'Courses, templates, files and toolkits — paid and free — delivered instantly to your personal library.',
};
const DEFAULT_SETTINGS = {
  store_name: 'Carsinstore',
  tagline: 'Videos, templates & tools — built to help you ship.',
  announcement: 'New drops every month — free resources inside the store.',
  hero_eyebrow: 'Digital Products',
  hero_title: 'Learn the craft,|Built to Work.',
  hero_sub: 'Videos, templates, guides and toolkits — paid and free — ready to download the moment you check out.',
  currency: 'ngn',
  footer_blurb: 'Digital products that keep your work moving.',
  instagram: '', x: '', youtube: '', tiktok: '',
  faq: JSON.stringify([
    { q: 'How do I get my product after buying?', a: 'Instantly. Right after checkout you land on your private download page, and the same link is emailed to you.' },
    { q: 'Do I need to create an account?', a: 'No. Just enter your name and email, pay, and download. No passwords.' },
    { q: 'Are free products really free?', a: 'Yes. Enter your name and email and you get the download link straight away.' },
    { q: 'I lost my download link — what now?', a: 'Use “Find my downloads” at the bottom of the page and we will email your links again.' },
    { q: 'What file types do you deliver?', a: 'Videos, PDFs, ZIP bundles, documents, templates, audio — whatever the product includes.' },
    { q: 'Can I use a discount code?', a: 'Yes — enter it on the product page before checkout and the price updates instantly.' },
    { q: 'What if I have a problem with my order?', a: 'Reach out through the contact link in the footer and we will sort it out quickly.' },
  ]),
};
const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

// Migration from the earlier course-based version: everything becomes a plain download.
const fileCols = db.prepare('PRAGMA table_info(files)').all().map(c => c.name);
if (!fileCols.includes('preview')) db.exec('ALTER TABLE files ADD COLUMN preview INTEGER NOT NULL DEFAULT 0');
if (!fileCols.includes('sort')) db.exec('ALTER TABLE files ADD COLUMN sort INTEGER NOT NULL DEFAULT 0');
if (fileCols.includes('lesson_id')) db.exec('UPDATE files SET lesson_id = NULL WHERE lesson_id IS NOT NULL');
db.exec("UPDATE products SET type = 'download' WHERE type != 'download'");
for (const [k, v] of Object.entries(OLD_DEFAULTS)) db.prepare('UPDATE settings SET value = ? WHERE key = ? AND value = ?').run(DEFAULT_SETTINGS[k], k, v);
db.prepare("UPDATE settings SET value = ? WHERE key = 'faq' AND (value LIKE '%Video lessons, PDFs%' OR value LIKE '%Create an account with your email%')").run(DEFAULT_SETTINGS.faq);

// Migration to guest checkout: every order carries its own private download token.
if (!db.prepare('PRAGMA table_info(orders)').all().some(c => c.name === 'access_token')) db.exec('ALTER TABLE orders ADD COLUMN access_token TEXT');
for (const o of db.prepare('SELECT id FROM orders WHERE access_token IS NULL').all()) {
  db.prepare('UPDATE orders SET access_token = ? WHERE id = ?').run(require('crypto').randomBytes(24).toString('base64url'), o.id);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token ON orders(access_token)');

// Migration to Paystack: orders are matched to payments by Paystack's transaction reference.
if (!db.prepare('PRAGMA table_info(orders)').all().some(c => c.name === 'payment_ref')) db.exec('ALTER TABLE orders ADD COLUMN payment_ref TEXT');
db.exec('CREATE INDEX IF NOT EXISTS idx_orders_payref ON orders(payment_ref)');

const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);

function getSettings() {
  const out = {};
  for (const r of all('SELECT key, value FROM settings')) out[r.key] = r.value;
  try { out.faq = JSON.parse(out.faq || '[]'); } catch { out.faq = []; }
  return out;
}

module.exports = { db, all, one, run, getSettings, DATA_DIR };
