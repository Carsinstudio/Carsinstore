#!/usr/bin/env node
// Downloads a full backup of the live store (products, files, covers, orders, customers, reviews, settings)
// to a folder on this computer, checks it is complete, and keeps only the newest few.
//
//   node tools/backup-store.js            make a backup now
//
// Runs every day by itself once tools/schedule-backup.ps1 has set up the Windows task.
// Settings come from .env next to the store:
//   CARSINSTORE_URL          the store (default https://carsin.store)
//   CARSINSTORE_BACKUP_KEY   made in Store settings > Keys > Create backup key (can only download backups)
//   BACKUP_DIR               where to save (default: OneDrive\Carsinstore Backups, so copies also go to the cloud)
//   BACKUP_KEEP              how many backups to keep (default 7)
// Each run adds a line to backup-log.txt in the backup folder.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Readable, Writable } = require('stream');
const { pipeline } = require('stream/promises');

try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const BASE = String(process.env.CARSINSTORE_URL || 'https://carsin.store').replace(/\/+$/, '');
const KEY = process.env.CARSINSTORE_BACKUP_KEY || '';
const DIR = process.env.BACKUP_DIR || (process.env.OneDrive ? path.join(process.env.OneDrive, 'Carsinstore Backups') : path.join(__dirname, '..', '..', 'Backups'));
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 7);
const NAME = /^carsinstore-full-backup-\d{4}-\d{2}-\d{2}-\d{4}\.tar\.gz$/;

const mb = n => `${(n / 1024 / 1024).toFixed(1)} MB`;
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
const log = line => {
  const text = `${new Date().toLocaleString('en-GB')}  ${line}`;
  console.log(text);
  try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(path.join(DIR, 'backup-log.txt'), text + '\n'); } catch {}
};

// Reads the whole archive through gunzip, so a cut-off or damaged download is caught (gzip checks its own CRC),
// and confirms it is a Carsinstore backup (manifest.json and store.db inside).
async function verify(file) {
  const seen = new Set();
  let buf = Buffer.alloc(0), skip = 0;
  const tar = new Writable({
    write(chunk, _enc, done) {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length) {
        if (skip) { const n = Math.min(skip, buf.length); buf = buf.subarray(n); skip -= n; continue; }
        if (buf.length < 512) break;
        const h = buf.subarray(0, 512); buf = buf.subarray(512);
        const name = h.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
        if (!name) continue;
        seen.add(name);
        const size = parseInt(h.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim() || '0', 8);
        skip = Math.ceil(size / 512) * 512;
      }
      done();
    },
  });
  await pipeline(fs.createReadStream(file), zlib.createGunzip(), tar);
  if (!seen.has('manifest.json') || !seen.has('store.db')) throw new Error('the download is not a complete store backup');
  return seen.size;
}

(async () => {
  if (!KEY) { log('FAILED: no backup key. Add CARSINSTORE_BACKUP_KEY=... to carsinstore\\.env (Store settings > Keys > Create backup key).'); process.exit(1); }
  fs.mkdirSync(DIR, { recursive: true });
  const out = path.join(DIR, `carsinstore-full-backup-${stamp()}.tar.gz`);
  const part = out + '.part';
  try {
    const res = await fetch(`${BASE}/api/admin/backup?orders=1`, { headers: { Authorization: `Bearer ${KEY}` } });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error || `the store answered ${res.status}`;
      throw new Error(msg);
    }
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part));
    const entries = await verify(part);
    fs.renameSync(part, out);
    // Keep the newest KEEP backups; older ones are deleted.
    const old = fs.readdirSync(DIR).filter(n => NAME.test(n)).sort().reverse().slice(KEEP);
    for (const n of old) fs.rmSync(path.join(DIR, n), { force: true });
    log(`OK: ${path.basename(out)} (${mb(fs.statSync(out).size)}, ${entries} items)${old.length ? `, removed ${old.length} older` : ''}`);
  } catch (e) {
    fs.rmSync(part, { force: true });
    log(`FAILED: ${e.message}`);
    process.exit(1);
  }
})();
