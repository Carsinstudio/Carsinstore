// SQLite storage using Node's built-in driver (no native build step needed).
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'storage');
const DB_PATH = path.join(DATA_DIR, 'store.db');
fs.mkdirSync(DATA_DIR, { recursive: true });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  phone TEXT,
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
CREATE TABLE IF NOT EXISTS affiliates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,       -- goes in links: ?ref=CODE
  token TEXT NOT NULL UNIQUE,                     -- secret part of the affiliate's private stats page
  percent INTEGER NOT NULL DEFAULT 20,            -- commission on each paid order
  paid_out TEXT NOT NULL DEFAULT '{}',            -- commission already paid, per currency: {"ngn": 500000}
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_files_product ON files(product_id);
`;

// Defaults from older versions; replaced on startup if the owner never changed them.
// (Kept escaped: the store no longer uses dashes in any of its text.)
const OLD_DEFAULTS = [
  ['tagline', 'Courses, templates & tools \u2014 built to help you ship.'],
  ['hero_sub', 'Courses, templates, files and toolkits \u2014 paid and free \u2014 delivered instantly to your personal library.'],
  ['tagline', 'Videos, templates & tools \u2014 built to help you ship.'],
  ['announcement', 'New drops every month \u2014 free resources inside the store.'],
  ['hero_sub', 'Videos, templates, guides and toolkits \u2014 paid and free \u2014 ready to download the moment you check out.'],
];
// Old default FAQ answers that used dashes, matched one by one so edited questions are left alone.
const OLD_FAQ_TEXT = {
  'I lost my download link \u2014 what now?': 'I lost my download link. What now?',
  'Videos, PDFs, ZIP bundles, documents, templates, audio \u2014 whatever the product includes.': 'Videos, PDFs, ZIP bundles, documents, templates, audio: whatever the product includes.',
  'Yes \u2014 enter it on the product page before checkout and the price updates instantly.': 'Yes. Enter it on the product page before checkout and the price updates instantly.',
};
const DEFAULT_SETTINGS = {
  store_name: 'Carsinstore',
  tagline: 'Videos, templates and tools, built to help you ship.',
  announcement: 'New drops every month, plus free resources inside the store.',
  hero_eyebrow: 'Digital Products',
  hero_title: 'Learn the craft,|Built to Work.',
  hero_sub: 'Videos, templates, guides and toolkits, paid and free, ready to download the moment you check out.',
  currency: 'ngn',
  footer_blurb: 'Digital products that keep your work moving.',
  instagram: '', x: '', youtube: '', tiktok: '', linkedin: '',
  support_email: '', business_location: 'Nigeria',
  notify_sales: '1', notify_free: '0', notify_email: '',
  checkout_phone: 'off',          // 'off' | 'optional' | 'required'
  abandoned_reminders: '1',       // email buyers once if they start paying but don't finish
  review_requests: '1',           // email buyers once, a few days after they get a product, asking for a rating
  review_after_days: '3',
  extra_currencies: '',           // e.g. 'usd': products can then have a price in that currency too
  plausible_domain: '', ga_id: '', meta_pixel_id: '',   // analytics, all optional
  legal_terms: '', legal_privacy: '', legal_refunds: '', legal_updated: new Date().toISOString().slice(0, 10),
  faq: JSON.stringify([
    { q: 'How do I get my product after buying?', a: 'Instantly. Right after checkout you land on your private download page, and the same link is emailed to you.' },
    { q: 'Do I need to create an account?', a: 'No. Just enter your name and email, pay, and download. No passwords.' },
    { q: 'Are free products really free?', a: 'Yes. Enter your name and email and you get the download link straight away.' },
    { q: 'I lost my download link. What now?', a: 'Use “Find my downloads” at the bottom of the page and we will email your links again.' },
    { q: 'What file types do you deliver?', a: 'Videos, PDFs, ZIP bundles, documents, templates, audio: whatever the product includes.' },
    { q: 'Can I use a discount code?', a: 'Yes. Enter it on the product page before checkout and the price updates instantly.' },
    { q: 'What if I have a problem with my order?', a: 'Reach out through the contact link in the footer and we will sort it out quickly.' },
  ]),
};

const hasColumn = (db, table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);

// Creates missing tables, fills default settings and upgrades databases made by older versions.
// Runs on every open, including after a backup is restored, so old backups load cleanly.
function migrate(db) {
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

  // Earlier course-based version: everything becomes a plain download.
  if (!hasColumn(db, 'files', 'preview')) db.exec('ALTER TABLE files ADD COLUMN preview INTEGER NOT NULL DEFAULT 0');
  if (!hasColumn(db, 'files', 'sort')) db.exec('ALTER TABLE files ADD COLUMN sort INTEGER NOT NULL DEFAULT 0');
  if (hasColumn(db, 'files', 'lesson_id')) db.exec('UPDATE files SET lesson_id = NULL WHERE lesson_id IS NOT NULL');
  db.exec("UPDATE products SET type = 'download' WHERE type != 'download'");
  for (const [k, v] of OLD_DEFAULTS) db.prepare('UPDATE settings SET value = ? WHERE key = ? AND value = ?').run(DEFAULT_SETTINGS[k], k, v);
  const faqRow = db.prepare("SELECT value FROM settings WHERE key = 'faq'").get();
  try {
    const faq = JSON.parse(faqRow?.value || '[]');
    const fixed = faq.map(f => ({ q: OLD_FAQ_TEXT[f.q] || f.q, a: OLD_FAQ_TEXT[f.a] || f.a }));
    if (JSON.stringify(fixed) !== JSON.stringify(faq)) db.prepare("UPDATE settings SET value = ? WHERE key = 'faq'").run(JSON.stringify(fixed));
  } catch {}
  db.prepare("UPDATE settings SET value = ? WHERE key = 'faq' AND (value LIKE '%Video lessons, PDFs%' OR value LIKE '%Create an account with your email%')").run(DEFAULT_SETTINGS.faq);

  // Guest checkout: every order carries its own private download token.
  if (!hasColumn(db, 'orders', 'access_token')) db.exec('ALTER TABLE orders ADD COLUMN access_token TEXT');
  for (const o of db.prepare('SELECT id FROM orders WHERE access_token IS NULL').all()) {
    db.prepare('UPDATE orders SET access_token = ? WHERE id = ?').run(crypto.randomBytes(24).toString('base64url'), o.id);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token ON orders(access_token)');

  // Paystack: orders are matched to payments by Paystack's transaction reference.
  if (!hasColumn(db, 'orders', 'payment_ref')) db.exec('ALTER TABLE orders ADD COLUMN payment_ref TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_payref ON orders(payment_ref)');

  if (!hasColumn(db, 'users', 'phone')) db.exec('ALTER TABLE users ADD COLUMN phone TEXT');

  // Abandoned-checkout reminders, affiliates and extra currencies.
  if (!hasColumn(db, 'orders', 'reminded_at')) db.exec('ALTER TABLE orders ADD COLUMN reminded_at TEXT');
  if (!hasColumn(db, 'orders', 'affiliate_id')) db.exec('ALTER TABLE orders ADD COLUMN affiliate_id INTEGER REFERENCES affiliates(id) ON DELETE SET NULL');
  if (!hasColumn(db, 'orders', 'commission_cents')) db.exec('ALTER TABLE orders ADD COLUMN commission_cents INTEGER NOT NULL DEFAULT 0');
  // Automatic partner payouts: the partner's bank account as a Paystack subaccount, and which sales Paystack split.
  if (!hasColumn(db, 'affiliates', 'subaccount')) {
    for (const col of ['subaccount', 'bank_code', 'bank_name', 'account_name', 'account_last4']) db.exec(`ALTER TABLE affiliates ADD COLUMN ${col} TEXT`);
  }
  if (!hasColumn(db, 'orders', 'commission_auto')) db.exec('ALTER TABLE orders ADD COLUMN commission_auto INTEGER NOT NULL DEFAULT 0'); // 1 = Paystack paid the partner directly
  if (!hasColumn(db, 'files', 'preview_pages')) db.exec('ALTER TABLE files ADD COLUMN preview_pages INTEGER NOT NULL DEFAULT 3'); // PDF previews show only this many pages
  if (!hasColumn(db, 'products', 'covers')) {
    db.exec("ALTER TABLE products ADD COLUMN covers TEXT NOT NULL DEFAULT '[]'"); // up to 4 cover images; cover_path mirrors the first
    db.exec('UPDATE products SET covers = json_array(cover_path) WHERE cover_path IS NOT NULL');
  }
  if (!hasColumn(db, 'products', 'sales')) db.exec("ALTER TABLE products ADD COLUMN sales TEXT NOT NULL DEFAULT '{}'"); // sales page sections, see cleanSales in server.js
  if (!hasColumn(db, 'products', 'alt_prices')) db.exec("ALTER TABLE products ADD COLUMN alt_prices TEXT NOT NULL DEFAULT '{}'"); // {"usd": 1500} in cents
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(status, created_at)');

  // Edits wait in a draft until Publish; covers can be any of four shapes; hand-picked "you might also like".
  if (!hasColumn(db, 'products', 'draft')) db.exec('ALTER TABLE products ADD COLUMN draft TEXT');
  if (!hasColumn(db, 'products', 'cover_ratio')) db.exec("ALTER TABLE products ADD COLUMN cover_ratio TEXT NOT NULL DEFAULT '1:1'");
  db.exec("UPDATE products SET cover_ratio = CASE cover_ratio WHEN '16:9' THEN '4:3' ELSE '1:1' END WHERE cover_ratio NOT IN ('1:1', '4:3')"); // only square and 4:3 are offered now
  if (!hasColumn(db, 'products', 'cross_sells')) db.exec("ALTER TABLE products ADD COLUMN cross_sells TEXT NOT NULL DEFAULT '[]'");
  // A product can be in several categories; products.category_id stays as the first one.
  db.exec(`CREATE TABLE IF NOT EXISTS product_categories (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    sort INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, category_id)
  )`);
  db.exec('INSERT OR IGNORE INTO product_categories (product_id, category_id) SELECT id, category_id FROM products WHERE category_id IS NOT NULL');
  // Star ratings and reviews from buyers, one per order, left from their download page.
  db.exec(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, hidden)');
  // When the "how was it?" email went out. Orders from before this existed count as asked, so nobody gets a late one.
  if (!hasColumn(db, 'orders', 'review_asked_at')) {
    db.exec('ALTER TABLE orders ADD COLUMN review_asked_at TEXT');
    db.exec("UPDATE orders SET review_asked_at = created_at WHERE status IN ('paid', 'free', 'granted')");
  }
}

let db;
function open() {
  db = new DatabaseSync(DB_PATH);
  migrate(db);
}
open();

// Closes the connection so the database file can be swapped (backup restore), then reopens it.
function close() { if (db) { try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {} db.close(); db = null; } }
function reopen() { close(); open(); }

const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const exec = sql => db.exec(sql);

function getSettings() {
  const out = {};
  for (const r of all('SELECT key, value FROM settings')) out[r.key] = r.value;
  try { out.faq = JSON.parse(out.faq || '[]'); } catch { out.faq = []; }
  return out;
}

module.exports = { all, one, run, exec, getSettings, close, reopen, migrate, DATA_DIR, DB_PATH };
