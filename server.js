// Carsinstore server: storefront API, guest checkout, private download links and admin.
try { process.loadEnvFile(); } catch { /* no .env file — fine */ }

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { all, one, run, getSettings, DATA_DIR } = require('./db');
const mailer = require('./mailer');

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
    return p.exp > Date.now() ? p : null;
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
  const token = sign({ uid: userId, exp: Date.now() + maxAge * 1000 });
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
const downloadUrl = token => `${BASE_URL}/#/download/${token}`;

// Buyers are just a name + email record (no password); repeat buyers reuse the same row.
function findOrCreateCustomer(name, email) {
  const u = one('SELECT * FROM users WHERE email = ?', email);
  if (u) {
    if (name && !u.is_admin) run('UPDATE users SET name = ? WHERE id = ?', name, u.id);
    return u;
  }
  return one('SELECT * FROM users WHERE id = ?', run("INSERT INTO users (email, name, password_hash) VALUES (?, ?, '')", email, name).lastInsertRowid);
}

function publicUser(u) { return u && { id: u.id, email: u.email, name: u.name, isAdmin: !!u.is_admin }; }

// Emails each order's download link (one email per order). The delivery email after payment uses a
// fixed idempotency key so it is never sent twice; manual re-sends get a fresh key each time.
async function sendLinks(orders, { resend = false } = {}) {
  if (!mailer.enabled) return;
  const store = getSettings().store_name;
  for (const o of orders) {
    const u = one('SELECT * FROM users WHERE id = ?', o.user_id);
    const title = one('SELECT title FROM products WHERE id = ?', o.product_id)?.title || 'your product';
    await mailer.sendDownload({
      to: u.email, store, name: u.name, title, url: downloadUrl(o.access_token),
      key: resend ? `order-${o.id}-resend-${Date.now()}` : `order-${o.id}-delivered`,
    });
  }
}

function productFiles(productId) {
  return all('SELECT * FROM files WHERE product_id = ? ORDER BY sort, id', productId)
    .map(f => ({ id: f.id, name: f.original_name, size: f.size, mime: f.mime, preview: !!f.preview, kind: fileKind(f.mime, f.original_name) }));
}

function productCard(p) {
  const files = productFiles(p.id);
  const students = one(`SELECT COUNT(*) AS n FROM orders WHERE product_id = ? AND status IN ${ACCESS_STATUSES}`, p.id).n;
  return {
    id: p.id, slug: p.slug, title: p.title, subtitle: p.subtitle,
    price: p.price_cents, compare: p.compare_cents, cover: p.cover_path ? `/media/covers/${p.cover_path}` : null,
    category: p.category_id ? one('SELECT name, slug FROM categories WHERE id = ?', p.category_id) : null,
    featured: !!p.featured, published: !!p.published, createdAt: p.created_at,
    files: files.length, totalSize: files.reduce((n, f) => n + f.size, 0), students,
    kinds: [...new Set(files.map(f => f.kind))],
  };
}

function priceAfterCoupon(price, code) {
  if (!code) return { price, coupon: null };
  const c = one('SELECT * FROM coupons WHERE code = ? AND active = 1', String(code).trim());
  if (!c) return { error: 'That code is not valid.' };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { error: 'That code has expired.' };
  if (c.max_uses && c.uses >= c.max_uses) return { error: 'That code has been fully redeemed.' };
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
  const done = one('SELECT * FROM orders WHERE id = ?', orderId);
  sendLinks([done]).catch(e => console.error('Email failed:', e.message));
  return done;
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

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// ---------- app ----------
const app = express();
app.disable('x-powered-by');

// Paystack webhook needs the raw body to check its signature, so it is registered before the JSON parser.
app.post('/api/paystack/webhook', express.raw({ type: '*/*' }), wrap(async (req, res) => {
  if (!PAYSTACK_KEY) return res.status(400).end();
  const expected = crypto.createHmac('sha512', PAYSTACK_KEY).update(req.body).digest('hex');
  const given = String(req.headers['x-paystack-signature'] || '');
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return res.status(401).end();
  const event = JSON.parse(req.body.toString('utf8'));
  if (event.event === 'charge.success' && event.data?.reference) {
    // Never trust the webhook payload alone — re-verify with Paystack before releasing files.
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
  res.json({
    settings: getSettings(), categories, user: req.user?.is_admin ? publicUser(req.user) : null,
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
  const files = productFiles(p.id).map(f => ({ name: f.name, size: f.size, kind: f.kind, preview: f.preview, ...(f.preview ? { id: f.id } : {}) }));
  res.json({ ...productCard(p), description: p.description, fileList: files });
});

// ----- owner auth (buyers never need an account) -----
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = one('SELECT * FROM users WHERE email = ? AND is_admin = 1', String(email || '').trim());
  if (!u || !checkPassword(password || '', u.password_hash)) return bad(res, 'Wrong email or password.', 401);
  setSession(res, u.id);
  res.json({ user: publicUser(u) });
});
app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'cs_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});
app.post('/api/auth/password', requireAdmin, (req, res) => {
  const { current, next } = req.body || {};
  if (!checkPassword(current || '', req.user.password_hash)) return bad(res, 'Current password is wrong.');
  if (!next || next.length < 8) return bad(res, 'New password must be at least 8 characters.');
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), req.user.id);
  res.json({ ok: true });
});
app.post('/api/setup', (req, res) => {
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
app.post('/api/coupons/validate', (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ? AND published = 1', req.body?.productId);
  if (!p) return bad(res, 'Product not found.', 404);
  const r = priceAfterCoupon(p.price_cents, req.body?.code);
  if (r.error) return bad(res, r.error);
  res.json({ price: r.price, original: p.price_cents });
});

app.post('/api/checkout', wrap(async (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ? AND published = 1', req.body?.productId);
  if (!p) return bad(res, 'Product not found.', 404);
  const name = String(req.body?.name || '').trim().slice(0, 120);
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!name) return bad(res, 'Enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Enter a valid email address.');
  const priced = priceAfterCoupon(p.price_cents, req.body?.coupon);
  if (priced.error) return bad(res, priced.error);
  const currency = getSettings().currency || 'ngn';
  const customer = findOrCreateCustomer(name, email);
  const token = newToken();
  const r = run("INSERT INTO orders (user_id, product_id, amount_cents, currency, status, coupon_code, access_token) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
    customer.id, p.id, priced.price, currency, priced.coupon?.code || null, token);
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
      metadata: { order_id: orderId, product: p.title, custom_fields: [{ display_name: 'Name', variable_name: 'name', value: name }] },
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
app.get('/api/order/:token', wrap(async (req, res) => {
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
  });
}));

// Emails every download link for an address. Same reply either way, so it can't be used to probe who bought what.
app.post('/api/resend-links', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!mailer.enabled) return bad(res, 'Email delivery is not set up for this store yet.', 503);
  const orders = all(`SELECT o.* FROM orders o JOIN users u ON u.id = o.user_id WHERE u.email = ? AND o.status IN ${ACCESS_STATUSES}`, email);
  if (orders.length) await sendLinks(orders, { resend: true }).catch(e => console.error('Email failed:', e.message));
  res.json({ ok: true });
}));

app.get('/api/files/:id', (req, res) => {
  const f = one('SELECT * FROM files WHERE id = ?', req.params.id);
  if (!f) return bad(res, 'File not found.', 404);
  const viaLink = req.query.t && one(`SELECT 1 FROM orders WHERE access_token = ? AND product_id = ? AND status IN ${ACCESS_STATUSES}`, String(req.query.t), f.product_id);
  if (!f.preview && !viaLink && !req.user?.is_admin) return bad(res, 'This file is only available to buyers.', 403);
  const disp = req.query.inline ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);
  res.setHeader('Cache-Control', 'private, max-age=0');
  res.sendFile(path.join(FILES_DIR, f.stored_name), { headers: { 'Content-Type': f.mime || 'application/octet-stream' } });
});

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
  const money = one(`SELECT COALESCE(SUM(amount_cents),0) AS revenue, COUNT(*) AS sales FROM orders WHERE status = 'paid'`);
  const free = one(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('free','granted')`).n;
  const customers = one(`SELECT COUNT(DISTINCT user_id) AS n FROM orders WHERE status IN ${ACCESS_STATUSES}`).n;
  const products = one('SELECT COUNT(*) AS n, SUM(published) AS live FROM products');
  const days = all(`SELECT date(created_at) AS day, SUM(amount_cents) AS revenue, COUNT(*) AS sales FROM orders
    WHERE status = 'paid' AND created_at >= date('now','-29 days') GROUP BY day ORDER BY day`);
  const top = all(`SELECT p.title, p.slug, COUNT(o.id) AS sales, COALESCE(SUM(o.amount_cents),0) AS revenue FROM products p
    LEFT JOIN orders o ON o.product_id = p.id AND o.status IN ${ACCESS_STATUSES} GROUP BY p.id ORDER BY sales DESC LIMIT 5`);
  const recent = all(`SELECT o.*, u.email, u.name, p.title FROM orders o JOIN users u ON u.id = o.user_id JOIN products p ON p.id = o.product_id
    WHERE o.status IN ${ACCESS_STATUSES} ORDER BY o.id DESC LIMIT 8`);
  res.json({ revenue: money.revenue, sales: money.sales, free, customers, products: products.n, live: products.live || 0, days, top, recent });
});

admin.get('/products', (_req, res) => res.json(all('SELECT * FROM products ORDER BY created_at DESC').map(productCard)));
admin.post('/products', (req, res) => {
  const title = (req.body?.title || 'Untitled product').trim();
  const r = run('INSERT INTO products (slug, title, price_cents) VALUES (?, ?, 0)', uniqueSlug('products', title), title);
  res.json({ id: Number(r.lastInsertRowid) });
});
admin.get('/products/:id', (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  res.json({ ...p, cover: p.cover_path ? `/media/covers/${p.cover_path}` : null, files: productFiles(p.id) });
});
admin.put('/products/:id', (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  const b = { ...p, ...req.body };
  const slug = req.body.slug ? uniqueSlug('products', req.body.slug, p.id) : p.slug;
  run(`UPDATE products SET slug=?, title=?, subtitle=?, description=?, price_cents=?, compare_cents=?, category_id=?, published=?, featured=? WHERE id=?`,
    slug, b.title, b.subtitle || '', b.description || '',
    Math.max(0, Math.round(Number(b.price_cents) || 0)), b.compare_cents ? Math.round(Number(b.compare_cents)) : null,
    b.category_id ? Number(b.category_id) : null, b.published ? 1 : 0, b.featured ? 1 : 0, p.id);
  res.json({ ok: true, slug });
});
admin.delete('/products/:id', (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p) return bad(res, 'Not found', 404);
  for (const f of all('SELECT stored_name FROM files WHERE product_id = ?', p.id)) fs.rm(path.join(FILES_DIR, f.stored_name), { force: true }, () => {});
  if (p.cover_path) fs.rm(path.join(COVERS_DIR, p.cover_path), { force: true }, () => {});
  run('DELETE FROM products WHERE id = ?', p.id);
  res.json({ ok: true });
});
admin.post('/products/:id/cover', upload.single('cover'), (req, res) => {
  const p = one('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p || !req.file) return bad(res, 'Upload failed.');
  if (p.cover_path) fs.rm(path.join(COVERS_DIR, p.cover_path), { force: true }, () => {});
  run('UPDATE products SET cover_path = ? WHERE id = ?', req.file.filename, p.id);
  res.json({ cover: `/media/covers/${req.file.filename}` });
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
  run('UPDATE files SET original_name = ?, preview = ?, sort = ? WHERE id = ?', req.body.name || f.original_name,
    req.body.preview === undefined ? f.preview : req.body.preview ? 1 : 0, req.body.sort ?? f.sort, f.id);
  res.json({ ok: true });
});
admin.delete('/files/:id', (req, res) => {
  const f = one('SELECT * FROM files WHERE id = ?', req.params.id);
  if (!f) return bad(res, 'Not found', 404);
  fs.rm(path.join(FILES_DIR, f.stored_name), { force: true }, () => {});
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

admin.get('/orders', (_req, res) => res.json(all(`SELECT o.*, u.email, u.name, p.title, p.slug FROM orders o
  JOIN users u ON u.id = o.user_id JOIN products p ON p.id = o.product_id ORDER BY o.id DESC LIMIT 500`)
  .map(o => ({ ...o, link: downloadUrl(o.access_token) }))));
admin.get('/customers', (_req, res) => res.json(all(`SELECT u.id, u.email, u.name, u.created_at, u.is_admin,
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status IN ${ACCESS_STATUSES}) AS products,
  (SELECT COALESCE(SUM(amount_cents),0) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS spent
  FROM users u WHERE u.is_admin = 0 ORDER BY u.id DESC LIMIT 5000`)));
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
  if (!mailer.enabled) return bad(res, 'Email is not set up — copy the link and send it yourself.');
  await sendLinks([o], { resend: true });
  res.json({ ok: true });
}));
admin.post('/orders/:id/revoke', (req, res) => { run("UPDATE orders SET status = 'refunded' WHERE id = ?", req.params.id); res.json({ ok: true }); });

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

admin.get('/settings', (_req, res) => res.json(getSettings()));
admin.put('/settings', (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
    run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  res.json(getSettings());
});

app.use('/api/admin', admin);
app.use('/api', (_req, res) => bad(res, 'Not found', 404));

app.use('/media/covers', express.static(COVERS_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return bad(res, `File is larger than ${MAX_UPLOAD_MB} MB.`, 413);
  bad(res, err.message || 'Something went wrong.', 500);
});

app.listen(PORT, () => {
  console.log(`Carsinstore running at ${BASE_URL}`);
  console.log(`Payments: ${PAYSTACK_KEY ? (PAYSTACK_KEY.startsWith('sk_live') ? 'Paystack (LIVE)' : 'Paystack (test mode)') : DEMO_CHECKOUT ? 'DEMO mode (no real charges)' : 'OFF — add PAYSTACK_SECRET_KEY to .env'}`);
});
