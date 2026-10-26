// Whole-store backups: one .tar.gz holding the database, product files and covers.
// Used to move a catalog from one computer/host to another, and for routine safety copies.
//
//   node backup.js export [--with-orders] [out.tar.gz]   (server can keep running)
//   node backup.js import <backup.tar.gz>                (stop the server first)
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const { Readable, Writable, pipeline } = require('stream');
const { DatabaseSync } = require('node:sqlite');
const store = require('./db');

const { DATA_DIR, DB_PATH } = store;
const FILES_DIR = path.join(DATA_DIR, 'files');
const COVERS_DIR = path.join(DATA_DIR, 'covers');
const FORMAT = 'carsinstore-backup';
const SAFE_NAME = /^(manifest\.json|store\.db|(files|covers)\/[A-Za-z0-9._-]+)$/;

// ---------- tar (ustar) writing ----------
function tarHeader(name, size, mtimeMs) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, 'utf8');
  h.write('0000644\0', 100);
  h.write('0000000\0', 108);
  h.write('0000000\0', 116);
  h.write(size.toString(8).padStart(11, '0') + '\0', 124);
  h.write(Math.floor(mtimeMs / 1000).toString(8).padStart(11, '0') + '\0', 136);
  h.fill(' ', 148, 156);
  h.write('0', 156);
  h.write('ustar\0', 257);
  h.write('00', 263);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}

async function* tarEntries(entries) {
  for (const e of entries) {
    const size = e.data ? e.data.length : fs.statSync(e.file).size;
    yield tarHeader(e.name, size, Date.now());
    if (e.data) yield e.data;
    else for await (const chunk of fs.createReadStream(e.file)) yield chunk;
    if (size % 512) yield Buffer.alloc(512 - (size % 512));
  }
  yield Buffer.alloc(1024);
}

// Writes a consistent snapshot of the store to `out` (a writable stream). With includeOrders off,
// buyers, orders and the email list are left out, which is what you want when moving a catalog to a fresh site.
async function exportBackup(out, { includeOrders = false } = {}) {
  const tmp = path.join(DATA_DIR, `.export-${crypto.randomBytes(4).toString('hex')}.db`);
  try {
    store.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const snap = new DatabaseSync(tmp);
    if (!includeOrders) {
      snap.exec('PRAGMA foreign_keys = ON; DELETE FROM orders; DELETE FROM users WHERE is_admin = 0; UPDATE coupons SET uses = 0;');
      snap.exec('VACUUM');
    }
    const files = snap.prepare('SELECT stored_name FROM files').all().map(r => r.stored_name);
    const covers = [...new Set(snap.prepare('SELECT cover_path, covers FROM products').all().flatMap(r => {
      let list = []; try { list = JSON.parse(r.covers || '[]'); } catch {}
      return [r.cover_path, ...(Array.isArray(list) ? list : [])];
    }).filter(Boolean))];
    const shareImage = snap.prepare("SELECT value FROM settings WHERE key = 'share_image'").get()?.value;
    if (shareImage) covers.push(shareImage);
    const counts = {
      products: snap.prepare('SELECT COUNT(*) AS n FROM products').get().n,
      files: files.length,
      orders: snap.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
    };
    snap.close();

    const entries = [];
    const missing = [];
    for (const f of files) fs.existsSync(path.join(FILES_DIR, f)) ? entries.push({ name: `files/${f}`, file: path.join(FILES_DIR, f) }) : missing.push(f);
    for (const c of covers) if (fs.existsSync(path.join(COVERS_DIR, c))) entries.push({ name: `covers/${c}`, file: path.join(COVERS_DIR, c) });
    const manifest = { format: FORMAT, version: 1, created: new Date().toISOString(), includesOrders: includeOrders, counts, missingFiles: missing.length };
    entries.unshift({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) }, { name: 'store.db', file: tmp });

    await new Promise((resolve, reject) =>
      pipeline(Readable.from(tarEntries(entries)), zlib.createGzip({ level: 1 }), out, err => (err ? reject(err) : resolve())));
    return manifest;
  } finally {
    fs.rm(tmp, { force: true }, () => {});
  }
}

// ---------- tar reading ----------
// Unpacks a backup into `dest`, accepting only the names a backup can contain (no path tricks).
function extractBackup(src, dest) {
  fs.mkdirSync(path.join(dest, 'files'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'covers'), { recursive: true });
  let pending = Buffer.alloc(0), cur = null, done = false, count = 0;
  const parser = new Writable({
    write(chunk, _enc, cb) {
      try {
        pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
        while (!done) {
          if (cur) {
            const take = Math.min(cur.remaining, pending.length);
            if (take) { if (cur.fd !== null) fs.writeSync(cur.fd, pending, 0, take); pending = pending.subarray(take); cur.remaining -= take; }
            if (cur.remaining > 0) break;
            if (pending.length < cur.pad) break;
            pending = pending.subarray(cur.pad);
            if (cur.fd !== null) fs.closeSync(cur.fd);
            cur = null;
            continue;
          }
          if (pending.length < 512) break;
          const h = pending.subarray(0, 512);
          pending = pending.subarray(512);
          if (h.every(b => b === 0)) { done = true; break; }
          const name = h.toString('utf8', 0, 100).replace(/\0.*$/s, '');
          const size = parseInt(h.toString('ascii', 124, 136).replace(/\0.*$/s, '').trim() || '0', 8);
          const type = String.fromCharCode(h[156] || 48);
          const keep = (type === '0' || type === '\0') && SAFE_NAME.test(name);
          if (keep) count++;
          cur = { remaining: size, pad: size % 512 ? 512 - (size % 512) : 0, fd: keep ? fs.openSync(path.join(dest, name), 'w') : null };
        }
        cb();
      } catch (e) { cb(e); }
    },
    final(cb) { if (cur && cur.fd !== null) fs.closeSync(cur.fd); cb(); },
  });
  return new Promise((resolve, reject) =>
    pipeline(fs.createReadStream(src), zlib.createGunzip(), parser, err => (err ? reject(new Error('That file is not a valid store backup.')) : resolve(count))));
}

// Checks an unpacked backup before anything live is touched. Returns what it contains.
function inspect(dir) {
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf) || !fs.existsSync(path.join(dir, 'store.db'))) throw new Error('That file is not a Carsinstore backup.');
  const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  if (manifest.format !== FORMAT) throw new Error('That file is not a Carsinstore backup.');
  const db = new DatabaseSync(path.join(dir, 'store.db'));
  try {
    store.migrate(db); // upgrades backups made by older versions of the store
    const files = db.prepare('SELECT stored_name FROM files').all().map(r => r.stored_name);
    return {
      manifest,
      products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
      files: files.length,
      missingFiles: files.filter(f => !fs.existsSync(path.join(dir, 'files', f))).length,
      orders: db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
      hasOwner: !!db.prepare('SELECT id FROM users WHERE is_admin = 1').get(),
    };
  } finally { db.close(); }
}

// Replaces this store's database, files and covers with the backup's. The previous state is kept in
// storage/.before-restore so a bad restore can be undone by hand.
async function restoreBackup(src) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const work = path.join(DATA_DIR, `.restore-${stamp}`);
  const keep = path.join(DATA_DIR, '.before-restore');
  try {
    await extractBackup(src, work);
    const info = inspect(work);
    if (!info.hasOwner) throw new Error('This backup has no owner account, so it was not restored.');

    store.close();
    try {
      fs.rmSync(keep, { recursive: true, force: true });
      fs.mkdirSync(keep, { recursive: true });
      for (const n of ['store.db', 'store.db-wal', 'store.db-shm', 'files', 'covers']) {
        const p = path.join(DATA_DIR, n);
        if (fs.existsSync(p)) fs.renameSync(p, path.join(keep, n));
      }
      fs.renameSync(path.join(work, 'store.db'), DB_PATH);
      fs.renameSync(path.join(work, 'files'), FILES_DIR);
      fs.renameSync(path.join(work, 'covers'), COVERS_DIR);
    } finally {
      store.reopen();
    }
    return info;
  } finally {
    fs.rm(work, { recursive: true, force: true }, () => {});
  }
}

module.exports = { exportBackup, restoreBackup, extractBackup, inspect };

// ---------- command line ----------
if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  (async () => {
    if (cmd === 'export') {
      const includeOrders = args.includes('--with-orders');
      const file = args.find(a => !a.startsWith('--')) || `carsinstore-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;
      const m = await exportBackup(fs.createWriteStream(file), { includeOrders });
      console.log(`Saved ${file}: ${m.counts.products} products, ${m.counts.files} files${includeOrders ? `, ${m.counts.orders} orders` : ''}.`);
    } else if (cmd === 'import' && args[0]) {
      const info = await restoreBackup(args[0]);
      console.log(`Restored ${info.products} products, ${info.files} files, ${info.orders} orders. Previous data kept in storage/.before-restore`);
    } else {
      console.log('Usage:\n  node backup.js export [--with-orders] [out.tar.gz]\n  node backup.js import <backup.tar.gz>   (stop the server first)');
      process.exitCode = 1;
    }
  })().catch(e => { console.error(e.message); process.exitCode = 1; });
}
