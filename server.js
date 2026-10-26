// Carsinstore server: storefront API, guest checkout, private download links and admin.
try { process.loadEnvFile(); } catch { /* no .env file, which is fine */ }

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const { all, one, run, getSettings, DATA_DIR } = require('./db');
const mailer = require('./mailer');
const backup = require('./backup');
const { LEGAL_PAGES } = require('./legal');
const { limit, failures } = require('./ratelimit');

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECRET = process.env.SESSION_SECRET || persistentSecret();
const DEMO_CHECKOUT = process.env.DEMO_CHECKOUT === 'true';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 4096);
const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_API = process.env.PAYSTACK_API_URL || 'https://api.paystack.co';

const FILES_DIR = path.join(DATA_DIR, 'files');
const COVERS_DIR = path.join(DATA_DIR, 'covers');
fs.mkdirSync(FILES_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });

function persistentSecret() {
  const f = path.join(DATA_DIR, '.secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(f, 'utf8');
}

// ---------- helpers ----------
const ACCESS_STATUSES = "('paid','free','granted')";

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// Bumped on every backup restore so sign-ins made before the restore stop working
// (the restored database has its own accounts, and user ids may now point at different people).
const EPOCH_FILE = path.join(DATA_DIR, '.session-epoch');
let sessionEpoch = fs.existsSync(EPOCH_FILE) ? fs.readFileSync(EPOCH_FILE, 'utf8').trim() : '0';
function bumpSessionEpoch() {
  sessionEpoch = String(Number(sessionEpoch) + 1);
  fs.writeFileSync(EPOCH_FILE, sessionEpoch);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function unsign(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() && String(p.ep ?? '0') === sessionEpoch ? p : null;
  } catch { return null; }
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSession(res, userId) {
  const maxAge = 60 * 60 * 24 * 30;
  const token = sign({ uid: userId, ep: sessionEpoch, exp: Date.now() + maxAge * 1000 });
  const secure = BASE_URL.startsWith('https') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cs_sess=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 70) || 'item';
}
function uniqueSlug(table, base, ignoreId) {
  let slug = slugify(base), n = 1;
  while (one(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`, slug, ignoreId || 0)) slug = `${slugify(base)}-${++n}`;
  return slug;
}
function fileKind(mime = '', name = '') {
  const ext = path.extname(name).toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return 'archive';
  if (['.doc', '.docx', '.txt', '.md', '.rtf', '.pages', '.odt'].includes(ext)) return 'document';
  if (['.xls', '.xlsx', '.csv', '.numbers'].includes(ext)) return 'spreadsheet';
  if (['.ppt', '.pptx', '.key'].includes(ext)) return 'slides';
  return 'file';
}
const newToken = () => crypto.randomBytes(24).toString('base64url');
// Idempotency keys for an order's emails. Resend remembers keys across the whole account for 24 hours, and
// order numbers restart at 1 on every copy of the store, so keys come from the order's unique random token
// (hashed, so the download link itself never appears in Resend's logs).
const emailKey = o => 'order-' + crypto.createHash('sha256').update(o.access_token).digest('hex').slice(0, 24);
// Short reference shown on receipts and in Orders, e.g. CS-7F3A91 (not guessable into a download link).
const orderRef = o => 'CS-' + emailKey(o).slice(6, 12).toUpperCase();
const downloadUrl = token => `${BASE_URL}/#/download/${token}`;

// Buyers are just a name + email (+ optional phone) record, no password; repeat buyers reuse the same row.
function findOrCreateCustomer(name, email, phone = null) {
  const u = one('SELECT * FROM users WHERE email = ?', email);
  if (u) {
    if (name && !u.is_admin) run('UPDATE users SET name = ? WHERE id = ?', name, u.id);
    if (phone) run('UPDATE users SET phone = ? WHERE id = ?', phone, u.id);
    return one('SELECT * FROM users WHERE id = ?', u.id);
  }
  return one('SELECT * FROM users WHERE id = ?', run("INSERT INTO users (email, name, phone, password_hash) VALUES (?, ?, ?, '')", email, name, phone).lastInsertRowid);
}

// Accepts "0803 123 4567", "+234 803-123-4567" etc. Returns a cleaned number, or null if it doesn't look like one.
function cleanPhone(raw) {
  const s = String(raw || '').trim().replace(/[\s().-]/g, '');
  return /^\+?\d{7,15}$/.test(s) ? s : null;
}

// Currencies a product can be bought in: the store currency, plus any extra currency it has a price for.
function storeCurrencies(s = getSettings()) {
  const main = (s.currency || 'ngn').toLowerCase();
  const extra = String(s.extra_currencies || '').toLowerCase().split(',').map(c => c.trim()).filter(c => /^[a-z]{3}$/.test(c) && c !== main);
  return { main, extra };
}
function productPrices(p, s = getSettings()) {
  const { main, extra } = storeCurrencies(s);
  let alt = {};
  try { alt = JSON.parse(p.alt_prices || '{}'); } catch {}
  const prices = { [main]: p.price_cents };
  // Free products stay free everywhere; paid ones only get an extra currency once a price is set for it.
  for (const c of extra) if (p.price_cents === 0 || alt[c] > 0) prices[c] = p.price_cents === 0 ? 0 : alt[c];
  return prices;
}

// The affiliate whose ?ref= code brought this buyer, unless they're buying through their own link.
function affiliateFor(code, buyerEmail) {
  if (!code) return null;
  const a = one('SELECT * FROM affiliates WHERE code = ? AND active = 1', String(code).trim());
  return a && a.email.toLowerCase() !== buyerEmail ? a : null;
}

function publicUser(u) { return u && { id: u.id, email: u.email, name: u.name, isAdmin: !!u.is_admin }; }

// Where buyers can reach the store: the support email from settings, else the owner's email.
function supportEmail(s = getSettings()) {
  return s.support_email || one('SELECT email FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1')?.email || '';
}

// A legal page's text: the owner's edited version, or the built-in draft, with store details filled in.
function legalText(page, s = getSettings()) {
  const p = LEGAL_PAGES[page];
  const raw = (s[p.key] || '').trim() || p.text;
  const updated = s.legal_updated || new Date().toISOString().slice(0, 10);
  const vars = {
    STORE: s.store_name, EMAIL: supportEmail(s) || 'the email shown in the footer', WEBSITE: BASE_URL.replace(/^https?:\/\//, ''),
    LOCATION: s.business_location || 'Nigeria', UPDATED: new Date(updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
  return raw.replace(/\{\{(STORE|EMAIL|WEBSITE|LOCATION|UPDATED)\}\}/g, (_, k) => vars[k]);
}

// Emails each order's download link (one email per order). The delivery email after payment uses a
// fixed idempotency key so it is never sent twice; manual re-sends get a fresh key each time.
async function sendLinks(orders, { resend = false } = {}) {
  if (!mailer.enabled) return;
  const s = getSettings();
  const replyTo = supportEmail(s);
  for (const o of orders) {
    const u = one('SELECT * FROM users WHERE id = ?', o.user_id);
    const title = one('SELECT title FROM products WHERE id = ?', o.product_id)?.title || 'your product';
    // First delivery: a receipt for purchases, a welcome for free products. Gifts and re-sends: plain "your files".
    const kind = resend ? 'files' : o.status === 'paid' ? 'receipt' : o.status === 'free' ? 'welcome' : 'files';
    await mailer.sendDownload({
      kind, to: u.email, store: s.store_name, name: u.name, title, url: downloadUrl(o.access_token), replyTo,
      amount: formatPrice(o.amount_cents, o.currency), date: new Date(o.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      ref: orderRef(o), siteUrl: BASE_URL, support: replyTo,
      key: resend ? `${emailKey(o)}-resend-${Date.now()}` : `${emailKey(o)}-delivered`,
    });
  }
}

function productFiles(productId) {
  return all('SELECT * FROM files WHERE product_id = ? ORDER BY sort, id', productId)
    .map(f => ({ id: f.id, name: f.original_name, size: f.size, mime: f.mime, preview: !!f.preview, previewPages: f.preview_pages, kind: fileKind(f.mime, f.original_name) }));
}

// Extra product page sections: buyer reviews (everything else lives in the description).
function cleanSales(v) {
  let s = v; if (typeof s === 'string') { try { s = JSON.parse(s || '{}'); } catch { s = {}; } }
  s = s && typeof s === 'object' ? s : {};
  const str = (x, n) => String(x ?? '').trim().slice(0, n);
  const reviews = (Array.isArray(s.reviews) ? s.reviews : []).map(o => ({ quote: str(o?.quote, 800), name: str(o?.name, 80), detail: str(o?.detail, 80) }));
  return { reviews: reviews.filter(o => o.quote).slice(0, 12) };
}

const MAX_COVERS = 4;
const coversOf = p => { try { const c = JSON.parse(p.covers || '[]'); return Array.isArray(c) ? c.slice(0, MAX_COVERS) : []; } catch { return []; } };
const coverUrls = p => coversOf(p).map(c => `/media/covers/${c}`);
function setCovers(p, list) {
  run('UPDATE products SET covers = ?, cover_path = ? WHERE id = ?', JSON.stringify(list), list[0] || null, p.id);
}

// File types a visitor can view in the browser. Only these can be free previews.
const PREVIEWABLE = ['video', 'audio', 'pdf', 'image'];

// A free PDF preview is a separate, shorter PDF: the first few pages only, cached next to the files.
async function samplePdf(f) {
  const pages = Math.min(Math.max(Number(f.preview_pages) || 3, 1), 20);
  const dir = path.join(FILES_DIR, '.previews');
  const out = path.join(dir, `${f.stored_name}-${pages}p.pdf`);
  if (fs.existsSync(out)) return out;
  const src = await PDFDocument.load(await fs.promises.readFile(path.join(FILES_DIR, f.stored_name)), { ignoreEncryption: true });
  const doc = await PDFDocument.create();
  for (const pg of await doc.copyPages(src, src.getPageIndices().slice(0, pages))) doc.addPage(pg);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(out, await doc.save());
  return out;
}
const dropSamples = f => fs.promises.readdir(path.join(FILES_DIR, '.previews')).then(names => names
  .filter(n => n.startsWith(f.stored_name + '-')).forEach(n => fs.rm(path.join(FILES_DIR, '.previews', n), { force: true }, () => {}))).catch(() => {});

function productCard(p) {
  const files = productFiles(p.id);
  const students = one(`SELECT COUNT(*) AS n FROM orders WHERE product_id = ? AND status IN ${ACCESS_STATUSES}`, p.id).n;
  return {
    id: p.id, slug: p.slug, title: p.title, subtitle: p.subtitle,
    price: p.price_cents, compare: p.compare_cents, prices: productPrices(p), cover: p.cover_path ? `/media/covers/${p.cover_path}` : null,
    category: p.category_id ? one('SELECT name, slug FROM categories WHERE id = ?', p.category_id) : null,
    featured: !!p.featured, published: !!p.published, createdAt: p.created_at,
    files: files.length, totalSize: files.reduce((n, f) => n + f.size, 0), students,
    kinds: [...new Set(files.map(f => f.kind))],
  };
}

// Fixed-amount codes are in the store currency, so they only apply to prices in that currency.
function priceAfterCoupon(price, code, currency, mainCurrency = currency) {
  if (!code) return { price, coupon: null };
  const c = one('SELECT * FROM coupons WHERE code = ? AND active = 1', String(code).trim());
  if (!c) return { error: 'That code is not valid.' };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { error: 'That code has expired.' };
  if (c.max_uses && c.uses >= c.max_uses) return { error: 'That code has been fully redeemed.' };
  if (c.amount_off_cents && currency !== mainCurrency) return { error: `That code only works when paying in ${mainCurrency.toUpperCase()}.` };
  let next = price;
  if (c.percent_off) next = Math.round(price * (1 - c.percent_off / 100));
  if (c.amount_off_cents) next = price - c.amount_off_cents;
  return { price: Math.max(0, next), coupon: c };
}

function fulfill(orderId, status = 'paid') {
  const o = one('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o || ['paid', 'free', 'granted'].includes(o.status)) return o;
  run('UPDATE orders SET status = ? WHERE id = ?', status, orderId);
  if (o.coupon_code) run('UPDATE coupons SET uses = uses + 1 WHERE code = ?', o.coupon_code);
  // Lock in the affiliate's commission at the rate in force when the sale happened.
  if (status === 'paid' && o.affiliate_id) {
    const a = one('SELECT percent FROM affiliates WHERE id = ?', o.affiliate_id);
    if (a) run('UPDATE orders SET commission_cents = ? WHERE id = ?', Math.round((o.amount_cents * a.percent) / 100), orderId);
  }
  const done = one('SELECT * FROM orders WHERE id = ?', orderId);
  sendLinks([done]).catch(e => console.error('Email failed:', e.message));
  notifyOwner(done).catch(e => console.error('Sale alert failed:', e.message));
  return done;
}

// Emails the owner about a completed sale (and, if they opt in, free downloads). Never for manual grants.
async function notifyOwner(o) {
  const s = getSettings();
  const wanted = (o.status === 'paid' && s.notify_sales !== '0') || (o.status === 'free' && s.notify_free === '1');
  if (!wanted || !mailer.enabled) return;
  const to = s.notify_email || supportEmail(s);
  const u = one('SELECT * FROM users WHERE id = ?', o.user_id);
  const p = one('SELECT title FROM products WHERE id = ?', o.product_id);
  if (!to || !u || !p) return;
  await mailer.sendSaleAlert({
    to, store: s.store_name, type: o.status === 'paid' ? 'New sale' : 'Free download',
    amount: o.amount_cents ? formatPrice(o.amount_cents, o.currency) : 'Free', title: p.title,
    buyer: u.name, email: u.email, phone: u.phone, dashboardUrl: `${BASE_URL}/#/admin/orders`, siteUrl: BASE_URL, support: to, key: `${emailKey(o)}-owner-alert`,
  });
}

// ---------- Paystack ----------
async function paystack(method, pathname, body) {
  const res = await fetch(PAYSTACK_API + pathname, {
    method,
    headers: { Authorization: `Bearer ${PAYSTACK_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.status) throw new Error(data.message || `Paystack error ${res.status}`);
  return data.data;
}

// Asks Paystack whether a pending order's payment went through, and releases the files if it did.
async function confirmPayment(order) {
  if (!PAYSTACK_KEY || !order?.payment_ref || order.status !== 'pending') return order;
  const t = await paystack('GET', `/transaction/verify/${encodeURIComponent(order.payment_ref)}`);
  const paid = t.status === 'success' && Number(t.amount) === order.amount_cents && String(t.currency).toLowerCase() === order.currency.toLowerCase();
  return paid ? fulfill(order.id) : order;
}

// ---------- abandoned checkout reminders ----------
// A buyer who opened Paystack checkout but didn't pay gets one "still want it?" email, between 1 and 48 hours later.
// Each order is checked with Paystack first (bank transfers can confirm late), and nobody is reminded
// about a product they've since bought or been reminded about.
const REMIND_AFTER_MIN = Number(process.env.REMIND_AFTER_MINUTES || 60);
async function remindAbandoned() {
  const s = getSettings();
  if (s.abandoned_reminders === '0' || !mailer.enabled || !PAYSTACK_KEY) return;
  const due = all(`SELECT * FROM orders WHERE status = 'pending' AND payment_ref IS NOT NULL AND reminded_at IS NULL
    AND created_at <= datetime('now', ?) AND created_at >= datetime('now', '-48 hours') ORDER BY id LIMIT 50`, `-${REMIND_AFTER_MIN} minutes`);
  for (const o of due) {
    run("UPDATE orders SET reminded_at = datetime('now') WHERE id = ?", o.id); // mark first: never email twice, even if sending fails
    const fresh = await confirmPayment(o).catch(() => o);
    if (fresh.status !== 'pending') continue;
    const done = one(`SELECT 1 FROM orders WHERE user_id = ? AND product_id = ? AND id != ? AND (status IN ${ACCESS_STATUSES} OR reminded_at >= datetime('now', '-48 hours'))`, o.user_id, o.product_id, o.id);
    const u = one('SELECT * FROM users WHERE id = ?', o.user_id);
    const p = one('SELECT * FROM products WHERE id = ? AND published = 1', o.product_id);
    if (done || !u || !p) continue;
    await mailer.sendCheckoutReminder({
      to: u.email, store: s.store_name, name: u.name, title: p.title, amount: formatPrice(o.amount_cents, o.currency), ref: orderRef(o),
      url: `${BASE_URL}/p/${p.slug}`, siteUrl: BASE_URL, support: supportEmail(s), key: `${emailKey(o)}-reminder`, replyTo: supportEmail(s),
    }).catch(e => console.error('Reminder failed:', e.message));
  }
}
setInterval(() => remindAbandoned().catch(e => console.error('Reminders:', e.message)), Number(process.env.REMINDER_CHECK_SECONDS || 600) * 1000).unref();

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
// Behind a host's proxy (Railway, Render, Nginx), set TRUST_PROXY=1 so rate limits see each visitor's real IP.
// Left off by default: without a proxy, trusting X-Forwarded-For would let anyone fake their IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY'); // the store and dashboard can't be embedded in other sites (clickjacking)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (BASE_URL.startsWith('https')) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
});

// Paystack webhook needs the raw body to check its signature, so it is registered before the JSON parser.
app.post('/api/paystack/webhook', express.raw({ type: '*/*' }), wrap(async (req, res) => {
  if (!PAYSTACK_KEY) return res.status(400).end();
  const expected = crypto.createHmac('sha512', PAYSTACK_KEY).update(req.body).digest('hex');
  const given = String(req.headers['x-paystack-signature'] || '');
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return res.status(401).end();
  const event = JSON.parse(req.body.toString('utf8'));
  if (event.event === 'charge.success' && event.data?.reference) {
    // Never trust the webhook payload alone: re-verify with Paystack before releasing files.
    await confirmPayment(one('SELECT * FROM orders WHERE payment_ref = ?', event.data.reference));
  }
  if (event.event === 'refund.processed') {
    const ref = event.data?.transaction_reference || event.data?.transaction?.reference;
    if (ref) run("UPDATE orders SET status = 'refunded' WHERE payment_ref = ?", ref);
  }
  res.sendStatus(200);
}));

app.use(express.json({ limit: '2mb' }));
app.use((req, _res, next) => {
  const s = unsign(cookies(req).cs_sess);
  req.user = s ? one('SELECT * FROM users WHERE id = ?', s.uid) : null;
  next();
});
const requireAdmin = (req, res, next) => (req.user?.is_admin ? next() : bad(res, 'Admins only.', 403));

// ----- store -----
app.get('/api/store', (req, res) => {
  const categories = all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.published = 1) AS count
    FROM categories c ORDER BY c.sort, c.name`);
  const settings = getSettings();
  for (const k of Object.keys(settings)) if (k.startsWith('legal_')) delete settings[k];
  settings.support_email = supportEmail();
  res.json({
    settings, categories, user: req.user?.is_admin ? publicUser(req.user) : null,
    payments: PAYSTACK_KEY ? 'paystack' : DEMO_CHECKOUT ? 'demo' : 'off', emails: mailer.enabled,
    needsSetup: !one('SELECT id FROM users WHERE is_admin = 1'),
  });
});

app.get('/api/products', (req, res) => {
  const { cat, q, price, sort, featured, limit } = req.query;
  const where = ['p.published = 1'], params = [];
  if (cat) { where.push('c.slug = ?'); params.push(cat); }
  if (q) { where.push('(p.title LIKE ? OR p.subtitle LIKE ? OR p.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (price === 'free') where.push('p.price_cents = 0');
  if (price === 'paid') where.push('p.price_cents > 0');
  const KIND_SQL = {
    video: "f.mime LIKE 'video/%'",
    audio: "f.mime LIKE 'audio/%'",
    pdf: "(f.mime = 'application/pdf' OR lower(f.original_name) LIKE '%.pdf')",
    archive: "(lower(f.original_name) LIKE '%.zip' OR lower(f.original_name) LIKE '%.rar' OR lower(f.original_name) LIKE '%.7z')",
    document: "(lower(f.original_name) LIKE '%.doc' OR lower(f.original_name) LIKE '%.docx' OR lower(f.original_name) LIKE '%.txt' OR lower(f.original_name) LIKE '%.xlsx' OR lower(f.original_name) LIKE '%.pptx' OR lower(f.original_name) LIKE '%.csv')",
  };
  if (KIND_SQL[req.query.kind]) where.push(`EXISTS (SELECT 1 FROM files f WHERE f.product_id = p.id AND ${KIND_SQL[req.query.kind]})`);
  if (featured) where.push('p.featured = 1');
  const order = { 'price-asc': 'p.price_cents ASC', 'price-desc': 'p.price_cents DESC', popular: 'students DESC' }[sort] || 'p.featured DESC, p.created_at DESC';
  const rows = all(`SELECT p.*, (SELECT COUNT(*) FROM orders o WHERE o.product_id = p.id AND o.status IN ${ACCESS_STATUSES}) AS students
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`, ...params, Math.min(Number(limit) || 200, 200));
  res.json(rows.map(productCard));
});

app.get('/api/products/:slug', (req, res) => {
  const p = one('SELECT * FROM products WHERE slug = ?', req.params.slug);
  if (!p || (!p.published && !req.user?.is_admin)) return bad(res, 'Product not found.', 404);
  // File ids are only exposed for free previews; everything else stays locked until purchase.
  const files = productFiles(p.id).map(f => {
    const preview = f.preview && PREVIEWABLE.includes(f.kind);
    return { name: f.name, size: f.size, kind: f.kind, preview, ...(preview ? { id: f.id } : {}), ...(preview && f.kind === 'pdf' ? { previewPages: f.previewPages } : {}) };
  });
  res.json({ ...productCard(p), covers: coverUrls(p), description: p.description, sales: cleanSales(p.sales), fileList: files });
});

// An affiliate's own stats page (private link, no account): their sales and earnings, never buyer details.
app.get('/api/affiliate/:token', limit({ name: 'affiliate', max: 60, windowMs: 60 * 1000 }), (req, res) => {
  const a = one('SELECT * FROM affiliates WHERE token = ?', req.params.token);
  if (!a) return bad(res, 'This link is not valid.', 404);
  const sum = affiliateSummary(a);
  const recent = all(`SELECT o.created_at, o.amount_cents, o.currency, o.commission_cents, p.title FROM orders o JOIN products p ON p.id = o.product_id
    WHERE o.affiliate_id = ? AND o.status = 'paid' ORDER BY o.id DESC LIMIT 100`, a.id);
  res.json({ name: a.name, code: a.code, percent: a.percent, active: !!a.active, link: sum.link, totals: sum.totals, recent });
});

app.get('/api/legal/:page', (req, res) => {
  const p = LEGAL_PAGES[req.params.page];
  if (!p) return bad(res, 'Page not found.', 404);
  res.json({ title: p.title, text: legalText(req.params.page) });
});

// ----- owner auth (buyers never need an account) -----
// Password guessing: 5 wrong tries per email (from one IP) or 20 per IP lock sign-in for 15 minutes.
const LOGIN_WINDOW = 15 * 60 * 1000;
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const who = String(email || '').trim().toLowerCase();
  const keys = [`login:${req.ip}:${who}`, `login:${req.ip}`];
  const wait = failures.blocked(keys[0], 5) || failures.blocked(keys[1], 20);
  if (wait) return bad(res, `Too many sign-in attempts. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`, 429);
  const u = one('SELECT * FROM users WHERE email = ? AND is_admin = 1', who);
  // Check a dummy hash when there's no such owner, so response time doesn't reveal which emails exist.
  const ok = checkPassword(password || '', u ? u.password_hash : DUMMY_HASH) && !!u;
  if (!ok) {
    keys.forEach(k => failures.record(k, LOGIN_WINDOW));
    return bad(res, 'Wrong email or password.', 401);
  }
  failures.reset(keys[0]);
  setSession(res, u.id);
  res.json({ user: publicUser(u) });
});
app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'cs_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});
app.post('/api/auth/password', requireAdmin, (req, res) => {
  const { current, next } = req.body || {};
  const key = `pw:${req.user.id}`;
  const wait = failures.blocked(key, 5);
  if (wait) return bad(res, `Too many attempts. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`, 429);
  if (!checkPassword(current || '', req.user.password_hash)) { failures.record(key, LOGIN_WINDOW); return bad(res, 'Current password is wrong.'); }
  failures.reset(key);
  if (!next || next.length < 8) return bad(res, 'New password must be at least 8 characters.');
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), req.user.id);
  res.json({ ok: true });
});
app.post('/api/setup', limit({ name: 'setup', max: 10, windowMs: 60 * 60 * 1000 }), (req, res) => {
  if (one('SELECT id FROM users WHERE is_admin = 1')) return bad(res, 'Store owner already exists.', 403);
  const { email, password, name } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || '') || !password || password.length < 8) return bad(res, 'Enter an email and a password of 8+ characters.');
  const existing = one('SELECT * FROM users WHERE email = ?', email);
  let id;
  if (existing) {
    run('UPDATE users SET is_admin = 1, password_hash = ?, name = ? WHERE id = ?', hashPassword(password), name || existing.name || '', existing.id);
    id = existing.id;
  } else {
    id = Number(run('INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, 1)', email.trim(), name || '', hashPassword(password)).lastInsertRowid);
  }
  setSession(res, id);
  res.json({ user: publicUser(one('SELECT * FROM users WHERE id = ?', id)) });
});

// ----- checkout -----
// The price of `p` in the currency the buyer picked (or the store currency).
function priceIn(p, wanted, s) {
  const prices = productPrices(p, s);
  const currency = String(wanted || storeCurrencies(s).main).toLowerCase();
  return currency in prices ? { currency, base: prices[currency] } : { error: `This product can't be bought in ${currency.toUpperCase()}.` };
}

// Stops anyone guessing discount codes by trying thousands.
app.post('/api/coupons/validate', limit({ name: 'coupon', max: 30, windowMs: 10 * 60 * 1000, message: 'Too many code attempts. Try again in {minutes} minutes.' }), (req, res) => {
  const s = getSettings();
  const p = one('SELECT * FROM products WHERE id = ? AND published = 1', req.body?.productId);
  if (!p) return bad(res, 'Product not found.', 404);
  const cur = priceIn(p, req.body?.currency, s);
  if (cur.error) return bad(res, cur.error);
  const r = priceAfterCoupon(cur.base, req.body?.code, cur.currency, storeCurrencies(s).main);
  if (r.error) return bad(res, r.error);
  res.json({ price: r.price, original: cur.base, currency: cur.currency });
});

app.post('/api/checkout', limit({ name: 'checkout', max: 20, windowMs: 10 * 60 * 1000, message: 'Too many checkout attempts. Please wait {minutes} minutes and try again.' }), wrap(async (req, res) => {
  const s = getSettings();
  const p = one('SELECT * FROM products WHERE id = ? AND published = 1', req.body?.productId);
  if (!p) return bad(res, 'Product not found.', 404);
  const name = String(req.body?.name || '').trim().slice(0, 120);
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!name) return bad(res, 'Enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Enter a valid email address.');
  const askPhone = s.checkout_phone === 'optional' || s.checkout_phone === 'required';
  const phone = askPhone ? cleanPhone(req.body?.phone) : null;
  if (askPhone && String(req.body?.phone || '').trim() && !phone) return bad(res, 'Enter a valid phone number.');
  if (s.checkout_phone === 'required' && !phone) return bad(res, 'Enter your phone number.');
  const cur = priceIn(p, req.body?.currency, s);
  if (cur.error) return bad(res, cur.error);
  const priced = priceAfterCoupon(cur.base, req.body?.coupon, cur.currency, storeCurrencies(s).main);
  if (priced.error) return bad(res, priced.error);
  const currency = cur.currency;
  const customer = findOrCreateCustomer(name, email, phone);
  const affiliate = priced.price > 0 ? affiliateFor(req.body?.ref, email) : null;
  const token = newToken();
  const r = run("INSERT INTO orders (user_id, product_id, amount_cents, currency, status, coupon_code, access_token, affiliate_id) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)",
    customer.id, p.id, priced.price, currency, priced.coupon?.code || null, token, affiliate?.id || null);
  const orderId = Number(r.lastInsertRowid);

  if (priced.price === 0) {
    fulfill(orderId, 'free');
    return res.json({ token });
  }
  if (PAYSTACK_KEY) {
    const reference = `cs_${orderId}_${crypto.randomBytes(6).toString('hex')}`;
    run('UPDATE orders SET payment_ref = ? WHERE id = ?', reference, orderId);
    // Paystack amounts are in the currency's smallest unit (kobo for NGN), same as our *_cents columns.
    const t = await paystack('POST', '/transaction/initialize', {
      email, amount: priced.price, currency: currency.toUpperCase(), reference,
      callback_url: `${BASE_URL}/api/paystack/callback`,
      metadata: {
        order_id: orderId, product: p.title,
        custom_fields: [
          { display_name: 'Name', variable_name: 'name', value: name },
          ...(phone ? [{ display_name: 'Phone', variable_name: 'phone', value: phone }] : []),
          ...(affiliate ? [{ display_name: 'Referred by', variable_name: 'affiliate', value: affiliate.code }] : []),
        ],
      },
    });
    return res.json({ url: t.authorization_url });
  }
  if (DEMO_CHECKOUT) return res.json({ demo: true, token, amount: priced.price });
  return bad(res, 'Payments are not set up yet. Add your Paystack secret key to the .env file.', 503);
}));

// Paystack sends the buyer back here after paying (?reference=...).
app.get('/api/paystack/callback', wrap(async (req, res) => {
  const order = one('SELECT * FROM orders WHERE payment_ref = ?', String(req.query.reference || req.query.trxref || ''));
  if (!order) return res.redirect('/');
  await confirmPayment(order).catch(e => console.error('Paystack verify failed:', e.message));
  res.redirect(`/#/download/${order.access_token}`);
}));

app.post('/api/checkout/demo/:token', (req, res) => {
  if (!DEMO_CHECKOUT || PAYSTACK_KEY) return bad(res, 'Demo checkout is disabled.', 403);
  const o = one("SELECT * FROM orders WHERE access_token = ? AND status = 'pending'", req.params.token);
  if (!o) return bad(res, 'Order not found.', 404);
  fulfill(o.id);
  res.json({ ok: true });
});

// ----- delivery: the private link IS the access -----
app.get('/api/order/:token', limit({ name: 'order', max: 120, windowMs: 60 * 1000 }), wrap(async (req, res) => {
  const find = () => one('SELECT o.*, u.name, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.access_token = ?', req.params.token);
  let o = find();
  if (!o) return bad(res, 'This download link is not valid.', 404);
  // Bank transfers can confirm a little after the redirect; re-check with Paystack while the page waits.
  if (o.status === 'pending' && o.payment_ref) {
    await confirmPayment(o).catch(e => console.error('Paystack verify failed:', e.message));
    o = find();
  }
  if (o.status === 'pending') return res.json({ pending: true });
  if (!['paid', 'free', 'granted'].includes(o.status)) return bad(res, 'Access to this order has been removed.', 403);
  const p = one('SELECT * FROM products WHERE id = ?', o.product_id);
  res.json({
    ...productCard(p), description: p.description, downloads: productFiles(p.id),
    buyer: { name: o.name, email: o.email }, purchasedAt: o.created_at, emailed: mailer.enabled,
    // For analytics "purchase" events: what was actually paid, and an id that isn't the secret link.
    order: { ref: emailKey(o), status: o.status, amount: o.amount_cents, currency: o.currency },
  });
}));

// Emails every download link for an address. Same reply either way, so it can't be used to probe who bought what.
// Limited per address and per visitor so the form can't be used to flood someone's inbox.
app.post('/api/resend-links',
  limit({ name: 'links-ip', max: 10, windowMs: 60 * 60 * 1000, message: 'Too many requests. Try again in {minutes} minutes.' }),
  limit({ name: 'links-email', max: 3, windowMs: 60 * 60 * 1000, keyOf: req => String(req.body?.email || '').trim().toLowerCase(), message: 'We already sent your links recently. Check your inbox and spam folder.' }),
  wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!mailer.enabled) return bad(res, 'Email delivery is not set up for this store yet.', 503);
  const orders = all(`SELECT o.* FROM orders o JOIN users u ON u.id = o.user_id WHERE u.email = ? AND o.status IN ${ACCESS_STATUSES}`, email);
  if (orders.length) await sendLinks(orders, { resend: true }).catch(e => console.error('Email failed:', e.message));
  res.json({ ok: true });
}));

// Buyers (with their private link) and the owner get the whole file. Everyone else only gets a free preview:
// viewable in the browser, never as a download, and for PDFs just the first few pages.
// The owner can add ?sample=1 to see exactly what visitors get.
app.get('/api/files/:id', wrap(async (req, res) => {
  const f = one('SELECT * FROM files WHERE id = ?', req.params.id);
  if (!f) return bad(res, 'File not found.', 404);
  const viaLink = req.query.t && one(`SELECT 1 FROM orders WHERE access_token = ? AND product_id = ? AND status IN ${ACCESS_STATUSES}`, String(req.query.t), f.product_id);
  const full = viaLink || (req.user?.is_admin && !req.query.sample);
  const kind = fileKind(f.mime, f.original_name);
  if (!full && !(f.preview && PREVIEWABLE.includes(kind))) return bad(res, 'This file is only available to buyers.', 403);
  let file = path.join(FILES_DIR, f.stored_name), name = f.original_name;
  if (!full && kind === 'pdf') {
    try { file = await samplePdf(f); name = name.replace(/\.pdf$/i, '') + ' (sample).pdf'; }
    catch (e) { console.error('PDF sample failed:', e.message); return bad(res, 'The preview for this file is not available.', 404); }
  }
  const disp = req.query.inline || !full ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('Cache-Control', 'private, max-age=0');
  res.sendFile(file, { headers: { 'Content-Type': f.mime || 'application/octet-stream' } });
}));

// ---------- admin ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, file.fieldname === 'cover' ? COVERS_DIR : FILES_DIR),
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});
const admin = express.Router();
admin.use(requireAdmin);

admin.get('/stats', (_req, res) => {
  const main = storeCurrencies().main;
  const money = one(`SELECT COALESCE(SUM(amount_cents),0) AS revenue, COUNT(*) AS sales FROM orders WHERE status = 'paid' AND currency = ?`, main);
  const otherCurrencies = all(`SELECT currency, SUM(amount_cents) AS revenue, COUNT(*) AS sales FROM orders WHERE status = 'paid' AND currency != ? GROUP BY currency`, main);
  const free = one(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('free','granted')`).n;
  const customers = one(`SELECT COUNT(DISTINCT user_id) AS n FROM orders WHERE status IN ${ACCESS_STATUSES}`).n;
  const products = one('SELECT COUNT(*) AS n, SUM(published) AS live FROM products');
  const days = all(`SELECT date(created_at) AS day, SUM(amount_cents) AS revenue, COUNT(*) AS sales FROM orders
    WHERE status = 'paid' AND currency = ? AND created_at >= date('now','-29 days') GROUP BY day ORDER BY day`, main);
  const top = all(`SELECT p.title, p.slug, COUNT(o.id) AS sales, COALESCE(SUM(CASE WHEN o.status = 'paid' AND o.currency = ? THEN o.amount_cents END),0) AS revenue FROM products p
    LEFT JOIN orders o ON o.product_id = p.id AND o.status IN ${ACCESS_STATUSES} GROUP BY p.id ORDER BY sales DESC LIMIT 5`, main);
  const recent = all(`SELECT o.*, u.email, u.name, p.title FROM orders o JOIN users u ON u.id = o.user_id JOIN products p ON p.id = o.product_id
    WHERE o.status IN ${ACCESS_STATUSES} ORDER BY o.id DESC LIMIT 8`);
  res.json({ currency: main, revenue: money.revenue, sales: money.sales, otherCurrencies, free, customers, products: products.n, live: products.live || 0, days, top, recent });
});

admin.get('/products', (_req, res) => res.json(all('SELECT * FROM products ORDER BY created_at DESC').map(productCard)));
admin.post('/products', (req, res) => {
  const title = (req.body?.title || 'Untitled product').trim();
  const r = run('INSERT INTO products (slug, title, subtitle, description, price_cents) VALUES (?, ?, ?, ?, 0)', uniqueSlug('products', title), title,
    String(req.body?.subtitle || '').trim(), String(req.body?.description || '').trim());
  res.json({ id: Number(r.lastInsertRowid) });
});
admin.get('/products/:id', (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  res.json({ ...p, sales: cleanSales(p.sales), covers: coverUrls(p), files: productFiles(p.id) });
});
admin.put('/products/:id', (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  const b = { ...p, ...req.body };
  const slug = req.body.slug ? uniqueSlug('products', req.body.slug, p.id) : p.slug;
  // Prices in extra currencies, in cents: {"usd": 1500}. Empty or zero removes that currency for this product.
  const alt = {};
  for (const [c, v] of Object.entries(typeof b.alt_prices === 'string' ? JSON.parse(b.alt_prices || '{}') : b.alt_prices || {})) {
    const cents = Math.round(Number(v) || 0);
    if (/^[a-z]{3}$/.test(c) && cents > 0) alt[c] = cents;
  }
  run(`UPDATE products SET slug=?, title=?, subtitle=?, description=?, price_cents=?, compare_cents=?, category_id=?, published=?, featured=?, alt_prices=?, sales=? WHERE id=?`,
    slug, b.title, b.subtitle || '', b.description || '',
    Math.max(0, Math.round(Number(b.price_cents) || 0)), b.compare_cents ? Math.round(Number(b.compare_cents)) : null,
    b.category_id ? Number(b.category_id) : null, b.published ? 1 : 0, b.featured ? 1 : 0, JSON.stringify(alt), JSON.stringify(cleanSales(b.sales)), p.id);
  res.json({ ok: true, slug });
});
admin.delete('/products/:id', (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  for (const f of all('SELECT stored_name FROM files WHERE product_id = ?', p.id)) fs.rm(path.join(FILES_DIR, f.stored_name), { force: true }, () => {});
  for (const c of new Set([...coversOf(p), p.cover_path].filter(Boolean))) fs.rm(path.join(COVERS_DIR, c), { force: true }, () => {});
  for (const f of all('SELECT stored_name FROM files WHERE product_id = ?', p.id)) dropSamples(f);
  run('DELETE FROM products WHERE id = ?', p.id);
  res.json({ ok: true });
});
// Cover images: up to 4, shown as a slider on the product page. The first is the main one
// (product cards and link previews).
admin.post('/products/:id/cover', upload.single('cover'), (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p || !req.file) return bad(res, 'Upload failed.');
  const list = coversOf(p);
  if (list.length >= MAX_COVERS) {
    fs.rm(req.file.path, { force: true }, () => {});
    return bad(res, `You can have up to ${MAX_COVERS} cover images. Remove one first.`);
  }
  setCovers(p, [...list, req.file.filename]);
  res.json({ covers: coverUrls(one('SELECT * FROM products WHERE id = ?', p.id)) });
});
// New order of the cover images (as their URLs); any left out are deleted.
admin.put('/products/:id/covers', (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  const list = coversOf(p);
  const order = [...new Set((Array.isArray(req.body?.order) ? req.body.order : []).map(u => path.basename(String(u))).filter(c => list.includes(c)))];
  for (const c of list) if (!order.includes(c)) fs.rm(path.join(COVERS_DIR, c), { force: true }, () => {});
  setCovers(p, order);
  res.json({ covers: coverUrls(one('SELECT * FROM products WHERE id = ?', p.id)) });
});
admin.post('/products/:id/files', upload.array('files', 50), (req, res) => {
  const p = one('SELECT id FROM products WHERE id = ?', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  let sort = one('SELECT COALESCE(MAX(sort), -1) AS s FROM files WHERE product_id = ?', p.id).s;
  for (const f of req.files || []) {
    run('INSERT INTO files (product_id, original_name, stored_name, mime, size, sort) VALUES (?, ?, ?, ?, ?, ?)',
      p.id, f.originalname, f.filename, f.mimetype, f.size, ++sort);
  }
  res.json({ ok: true, count: (req.files || []).length });
});
admin.put('/files/:id', (req, res) => {
  const f = one('SELECT * FROM files WHERE id = ?', req.params.id);
  if (!f) return bad(res, 'Not found', 404);
  const pages = req.body.preview_pages === undefined ? f.preview_pages : Math.min(Math.max(Math.round(Number(req.body.preview_pages)) || 3, 1), 20);
  run('UPDATE files SET original_name = ?, preview = ?, sort = ?, preview_pages = ? WHERE id = ?', req.body.name || f.original_name,
    req.body.preview === undefined ? f.preview : req.body.preview ? 1 : 0, req.body.sort ?? f.sort, pages, f.id);
  res.json({ ok: true });
});
admin.delete('/files/:id', (req, res) => {
  const f = one('SELECT * FROM files WHERE id = ?', req.params.id);
  if (!f) return bad(res, 'Not found', 404);
  fs.rm(path.join(FILES_DIR, f.stored_name), { force: true }, () => {});
  dropSamples(f);
  run('DELETE FROM files WHERE id = ?', f.id);
  res.json({ ok: true });
});
admin.get('/categories', (_req, res) => res.json(all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS count FROM categories c ORDER BY sort, name`)));
admin.post('/categories', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return bad(res, 'Name required.');
  run('INSERT INTO categories (name, slug, description, sort) VALUES (?, ?, ?, ?)', name, uniqueSlug('categories', name), req.body.description || '', Number(req.body.sort) || 0);
  res.json({ ok: true });
});
admin.put('/categories/:id', (req, res) => {
  const c = one('SELECT * FROM categories WHERE id = ?', req.params.id);
  if (!c) return bad(res, 'Not found', 404);
  run('UPDATE categories SET name = ?, description = ?, sort = ? WHERE id = ?', req.body.name ?? c.name, req.body.description ?? c.description, Number(req.body.sort ?? c.sort), c.id);
  res.json({ ok: true });
});
admin.delete('/categories/:id', (req, res) => { run('DELETE FROM categories WHERE id = ?', req.params.id); res.json({ ok: true }); });

admin.get('/orders', (_req, res) => res.json(all(`SELECT o.*, u.email, u.name, u.phone, p.title, p.slug, a.code AS affiliate_code FROM orders o
  JOIN users u ON u.id = o.user_id JOIN products p ON p.id = o.product_id LEFT JOIN affiliates a ON a.id = o.affiliate_id ORDER BY o.id DESC LIMIT 500`)
  .map(o => ({ ...o, ref: orderRef(o), link: downloadUrl(o.access_token) }))));
admin.get('/customers', (_req, res) => res.json(all(`SELECT u.id, u.email, u.name, u.phone, u.created_at, u.is_admin,
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status IN ${ACCESS_STATUSES}) AS products,
  (SELECT COALESCE(SUM(amount_cents),0) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid' AND o.currency = ?) AS spent
  FROM users u WHERE u.is_admin = 0 ORDER BY u.id DESC LIMIT 5000`, storeCurrencies().main)));
admin.post('/grant', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Enter a valid email address.');
  if (!one('SELECT id FROM products WHERE id = ?', req.body?.productId)) return bad(res, 'Product not found.', 404);
  const u = findOrCreateCustomer(String(req.body?.name || '').trim(), email);
  const token = newToken();
  const id = Number(run("INSERT INTO orders (user_id, product_id, amount_cents, status, access_token) VALUES (?, ?, 0, 'pending', ?)", u.id, req.body.productId, token).lastInsertRowid);
  fulfill(id, 'granted');
  res.json({ ok: true, link: downloadUrl(token), emailed: mailer.enabled });
});
admin.post('/orders/:id/resend', wrap(async (req, res) => {
  const o = one('SELECT * FROM orders WHERE id = ?', req.params.id);
  if (!o) return bad(res, 'Not found', 404);
  if (!mailer.enabled) return bad(res, 'Email is not set up. Copy the link and send it yourself.');
  await sendLinks([o], { resend: true });
  res.json({ ok: true });
}));
admin.post('/orders/:id/revoke', (req, res) => { run("UPDATE orders SET status = 'refunded' WHERE id = ?", req.params.id); res.json({ ok: true }); });

// ----- affiliates -----
const affiliateLink = a => `${BASE_URL}/?ref=${encodeURIComponent(a.code)}`;
const affiliateStatsUrl = a => `${BASE_URL}/#/affiliate/${a.token}`;
// Sales, commission earned, paid out and still owed, per currency, since sales can be in more than one.
function affiliateSummary(a) {
  const rows = all(`SELECT currency, COUNT(*) AS sales, SUM(amount_cents) AS revenue, SUM(commission_cents) AS earned
    FROM orders WHERE affiliate_id = ? AND status = 'paid' GROUP BY currency`, a.id);
  let paid = {};
  try { paid = JSON.parse(a.paid_out || '{}'); } catch {}
  const currencies = [...new Set([...rows.map(r => r.currency), ...Object.keys(paid)])];
  const totals = currencies.map(c => {
    const r = rows.find(x => x.currency === c) || { sales: 0, revenue: 0, earned: 0 };
    return { currency: c, sales: r.sales, revenue: r.revenue, earned: r.earned, paid: paid[c] || 0, owed: Math.max(0, r.earned - (paid[c] || 0)) };
  });
  return {
    id: a.id, name: a.name, email: a.email, code: a.code, percent: a.percent, active: !!a.active, created_at: a.created_at,
    link: affiliateLink(a), statsUrl: affiliateStatsUrl(a), sales: totals.reduce((n, t) => n + t.sales, 0), totals,
  };
}
admin.get('/affiliates', (_req, res) => res.json(all('SELECT * FROM affiliates ORDER BY id DESC').map(affiliateSummary)));
admin.post('/affiliates', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const percent = Math.round(Number(req.body?.percent));
  if (!name) return bad(res, 'Enter a name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Enter a valid email address.');
  if (!(percent >= 1 && percent <= 90)) return bad(res, 'Commission must be between 1% and 90%.');
  let code = String(req.body?.code || name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) || 'PARTNER';
  if (one('SELECT id FROM affiliates WHERE code = ?', code)) {
    if (req.body?.code) return bad(res, 'That code is already taken.');
    let n = 2; while (one('SELECT id FROM affiliates WHERE code = ?', code + n)) n++; code += n;
  }
  const id = run('INSERT INTO affiliates (name, email, code, token, percent) VALUES (?, ?, ?, ?, ?)', name, email, code, newToken(), percent).lastInsertRowid;
  res.json(affiliateSummary(one('SELECT * FROM affiliates WHERE id = ?', id)));
});
admin.put('/affiliates/:id', (req, res) => {
  const a = one('SELECT * FROM affiliates WHERE id = ?', req.params.id);
  if (!a) return bad(res, 'Not found', 404);
  const percent = req.body.percent === undefined ? a.percent : Math.round(Number(req.body.percent));
  if (!(percent >= 1 && percent <= 90)) return bad(res, 'Commission must be between 1% and 90%.');
  run('UPDATE affiliates SET name = ?, email = ?, percent = ?, active = ? WHERE id = ?', req.body.name ?? a.name, req.body.email ?? a.email,
    percent, req.body.active === undefined ? a.active : req.body.active ? 1 : 0, a.id);
  res.json(affiliateSummary(one('SELECT * FROM affiliates WHERE id = ?', a.id)));
});
// Records commission you've paid an affiliate (you pay them yourself, e.g. by bank transfer).
admin.post('/affiliates/:id/payout', (req, res) => {
  const a = one('SELECT * FROM affiliates WHERE id = ?', req.params.id);
  if (!a) return bad(res, 'Not found', 404);
  const currency = String(req.body?.currency || '').toLowerCase();
  const cents = Math.round(Number(req.body?.amount_cents));
  if (!/^[a-z]{3}$/.test(currency) || !(cents > 0)) return bad(res, 'Enter the amount you paid.');
  const paid = JSON.parse(a.paid_out || '{}');
  paid[currency] = (paid[currency] || 0) + cents;
  run('UPDATE affiliates SET paid_out = ? WHERE id = ?', JSON.stringify(paid), a.id);
  res.json(affiliateSummary(one('SELECT * FROM affiliates WHERE id = ?', a.id)));
});

admin.get('/coupons', (_req, res) => res.json(all('SELECT * FROM coupons ORDER BY id DESC')));
admin.post('/coupons', (req, res) => {
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  if (!code) return bad(res, 'Code required.');
  if (!b.percent_off && !b.amount_off_cents) return bad(res, 'Set a percent or an amount off.');
  if (one('SELECT id FROM coupons WHERE code = ?', code)) return bad(res, 'That code already exists.');
  run('INSERT INTO coupons (code, percent_off, amount_off_cents, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)',
    code, b.percent_off ? Math.min(100, Number(b.percent_off)) : null, b.amount_off_cents ? Number(b.amount_off_cents) : null,
    b.max_uses ? Number(b.max_uses) : null, b.expires_at || null);
  res.json({ ok: true });
});
admin.put('/coupons/:id', (req, res) => { run('UPDATE coupons SET active = ? WHERE id = ?', req.body.active ? 1 : 0, req.params.id); res.json({ ok: true }); });
admin.delete('/coupons/:id', (req, res) => { run('DELETE FROM coupons WHERE id = ?', req.params.id); res.json({ ok: true }); });

// Settings as the dashboard edits them: legal pages show their draft text until the owner changes them.
function adminSettings() {
  const s = getSettings();
  for (const p of Object.values(LEGAL_PAGES)) if (!(s[p.key] || '').trim()) s[p.key] = p.text;
  s.legal_defaults = Object.fromEntries(Object.values(LEGAL_PAGES).map(p => [p.key, p.text]));
  return s;
}
admin.get('/settings', (_req, res) => res.json(adminSettings()));
// The picture shown when the homepage (or a product without a cover) is shared.
admin.post('/share-image', upload.single('cover'), (req, res) => {
  if (!req.file) return bad(res, 'Upload failed.');
  const old = getSettings().share_image;
  if (old) fs.rm(path.join(COVERS_DIR, old), { force: true }, () => {});
  run("INSERT INTO settings (key, value) VALUES ('share_image', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", req.file.filename);
  res.json({ image: `/media/covers/${req.file.filename}` });
});
admin.put('/settings', (req, res) => {
  const before = adminSettings();
  let legalChanged = false;
  for (let [k, v] of Object.entries(req.body || {})) {
    if (k === 'legal_defaults' || k === 'legal_updated') continue;
    const legal = Object.values(LEGAL_PAGES).find(p => p.key === k);
    if (legal) {
      v = String(v).replace(/\r\n/g, '\n');
      if (v.trim() !== String(before[k]).trim()) legalChanged = true;
      if (v.trim() === legal.text.trim()) v = ''; // unchanged draft: keep following the built-in text
    }
    run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  if (legalChanged) run("INSERT INTO settings (key, value) VALUES ('legal_updated', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", new Date().toISOString().slice(0, 10));
  res.json(adminSettings());
});

// ----- backups: move the whole store between computers/hosts -----
admin.get('/backup', wrap(async (req, res) => {
  const includeOrders = req.query.orders === '1';
  const name = `carsinstore-${includeOrders ? 'full' : 'catalog'}-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  await backup.exportBackup(res, { includeOrders });
}));
const restoreUpload = multer({ dest: path.join(DATA_DIR, '.uploads'), limits: { fileSize: 200 * 1024 ** 3 } });
admin.post('/restore', restoreUpload.single('backup'), wrap(async (req, res) => {
  if (!req.file) return bad(res, 'Choose a backup file to restore.');
  try {
    const info = await backup.restoreBackup(req.file.path);
    // The restored database has its own owner account: sign everyone out, including this browser.
    bumpSessionEpoch();
    res.setHeader('Set-Cookie', 'cs_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.json({ ok: true, products: info.products, files: info.files, orders: info.orders, missingFiles: info.missingFiles });
  } finally {
    fs.rm(req.file.path, { force: true }, () => {});
  }
}));

app.use('/api/admin', admin);
app.use('/api', (_req, res) => bad(res, 'Not found', 404));

// ----- shareable pages with link previews -----
// WhatsApp, Instagram, X and Facebook read <meta> tags from the HTML and don't run JavaScript, so
// share links (/p/<slug>, /) get the page's title, description, price and image in the HTML itself.
// The app then turns the path into its usual #/ route without reloading.
const INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const attr = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = s => String(s || '').replace(/[#*_`>\[\]()]/g, '').replace(/\s+/g, ' ').trim();
const shortText = (s, n = 180) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
function formatPrice(cents, currency) {
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100); }
  catch { return `${currency.toUpperCase()} ${(cents / 100).toLocaleString()}`; }
}
function sendPage(res, m) {
  const tags = [
    `<title>${attr(m.title)}</title>`,
    `<meta name="description" content="${attr(m.description)}" />`,
    `<link rel="canonical" href="${attr(m.url)}" />`,
    `<meta property="og:site_name" content="${attr(m.site)}" />`,
    `<meta property="og:type" content="${m.type || 'website'}" />`,
    `<meta property="og:title" content="${attr(m.ogTitle || m.title)}" />`,
    `<meta property="og:description" content="${attr(m.description)}" />`,
    `<meta property="og:url" content="${attr(m.url)}" />`,
    m.image && `<meta property="og:image" content="${attr(m.image)}" />`,
    m.image && `<meta property="og:image:alt" content="${attr(m.ogTitle || m.title)}" />`,
    m.price && `<meta property="product:price:amount" content="${(m.price.cents / 100).toFixed(2)}" />`,
    m.price && `<meta property="product:price:currency" content="${m.price.currency.toUpperCase()}" />`,
    `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${attr(m.ogTitle || m.title)}" />`,
    `<meta name="twitter:description" content="${attr(m.description)}" />`,
    m.image && `<meta name="twitter:image" content="${attr(m.image)}" />`,
  ].filter(Boolean).join('\n  ');
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(INDEX_HTML.replace(/<!--META-->[\s\S]*?<!--\/META-->/, tags));
}
const shareImage = s => (s.share_image ? `${BASE_URL}/media/covers/${s.share_image}` : null);
function sendHome(res) {
  const s = getSettings();
  sendPage(res, { title: `${s.store_name} | ${plain(s.tagline)}`, ogTitle: s.store_name, description: shortText(plain(s.hero_sub || s.tagline)), url: `${BASE_URL}/`, site: s.store_name, image: shareImage(s) });
}

app.get('/p/:slug', (req, res) => {
  const s = getSettings();
  const p = one('SELECT * FROM products WHERE slug = ? AND published = 1', req.params.slug);
  if (!p) return sendHome(res);
  const price = p.price_cents ? formatPrice(p.price_cents, s.currency || 'ngn') : 'Free';
  sendPage(res, {
    title: `${p.title} | ${s.store_name}`, ogTitle: `${p.title} · ${price}`,
    description: shortText(plain(p.description) || s.tagline),
    url: `${BASE_URL}/p/${p.slug}`, site: s.store_name, type: 'product',
    image: p.cover_path ? `${BASE_URL}/media/covers/${p.cover_path}` : shareImage(s),
    price: p.price_cents ? { cents: p.price_cents, currency: s.currency || 'ngn' } : null,
  });
});
app.get('/', (_req, res) => sendHome(res));
for (const page of ['shop', 'terms', 'privacy', 'refunds', 'find']) app.get(`/${page}`, (_req, res) => sendHome(res));

app.use('/media/covers', express.static(COVERS_DIR, { maxAge: '7d' }));
app.use(['/media', '/api'], (_req, res) => res.status(404).json({ error: 'Not found.' })); // never fall through to the store page
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], index: false }));
app.get('*', (_req, res) => sendHome(res));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return bad(res, `File is larger than ${MAX_UPLOAD_MB} MB.`, 413);
  bad(res, err.message || 'Something went wrong.', 500);
});

app.listen(PORT, () => {
  console.log(`Carsinstore running at ${BASE_URL}`);
  console.log(`Payments: ${PAYSTACK_KEY ? (PAYSTACK_KEY.startsWith('sk_live') ? 'Paystack (LIVE)' : 'Paystack (test mode)') : DEMO_CHECKOUT ? 'DEMO mode (no real charges)' : 'OFF (add PAYSTACK_SECRET_KEY to .env)'}`);
});
