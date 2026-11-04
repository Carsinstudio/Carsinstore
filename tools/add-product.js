#!/usr/bin/env node
// Adds a product to the live store from a folder on this computer, using an upload key.
//
//   node tools/add-product.js "<product folder>"             upload as a draft (check it, then publish)
//   node tools/add-product.js "<product folder>" --publish   upload and publish straight away
//   node tools/add-product.js "<product folder>" --check     only check the folder, upload nothing
//   node tools/add-product.js "<product folder>" --update    update the details of a product uploaded before
//                                                            (files and covers are left as they are)
//
// The folder holds product.json (details), description.md (optional, the sales text), covers/ (up to 4
// images or short videos, used in name order, the first is the main one) and files/ (what buyers download).
// Settings come from .env next to the store: CARSINSTORE_URL and CARSINSTORE_UPLOAD_KEY
// (made in Store settings > Upload keys).
const fs = require('fs');
const path = require('path');

try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const BASE = String(process.env.CARSINSTORE_URL || 'https://carsin.store').replace(/\/+$/, '');
const KEY = process.env.CARSINSTORE_UPLOAD_KEY || '';
const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const flag = f => args.includes(`--${f}`);
const MARK = '.carsinstore.json';
const IMAGE = /\.(png|jpe?g|webp|gif)$/i, VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const PREVIEWABLE = /\.(pdf|mp4|webm|mov|m4v|mp3|wav|m4a|ogg|png|jpe?g|webp|gif)$/i;
const MIME = { '.pdf': 'application/pdf', '.zip': 'application/zip', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain', '.csv': 'text/csv', '.psd': 'image/vnd.adobe.photoshop', '.fig': 'application/octet-stream' };
const mime = f => MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
const mb = n => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
const fail = msg => { console.error(`\n  ✗ ${msg}\n`); process.exit(1); };
const list = sub => { const d = path.join(dir, sub); return fs.existsSync(d) ? fs.readdirSync(d).filter(n => !n.startsWith('.') && fs.statSync(path.join(d, n)).isFile()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(n => path.join(d, n)) : []; };

async function api(method, url, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(BASE + '/api/admin' + url, {
    method, headers: { Authorization: `Bearer ${KEY}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${method} ${url} failed (${res.status})`);
  return data;
}
async function send(url, field, file) {
  const fd = new FormData();
  fd.append(field, await fs.openAsBlob(file, { type: mime(file) }), path.basename(file));
  return api('POST', url, fd);
}

(async () => {
  if (!dir) fail('Give the product folder, for example: node tools/add-product.js "C:\\...\\Products to upload\\My product"');
  if (!fs.existsSync(path.join(dir, 'product.json'))) fail(`No product.json in ${dir}. Copy the _TEMPLATE folder to start.`);
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join(dir, 'product.json'), 'utf8')); } catch (e) { fail(`product.json isn't valid JSON: ${e.message}`); }
  const descFile = path.join(dir, 'description.md');
  const description = fs.existsSync(descFile) ? fs.readFileSync(descFile, 'utf8').trim() : String(p.description || '').trim();
  const covers = list('covers'), files = list('files');

  // ----- check everything before uploading anything -----
  const problems = [], notes = [];
  if (!String(p.title || '').trim()) problems.push('product.json needs a "title".');
  if (!(Number(p.price) >= 0)) problems.push('"price" must be a number in Naira (0 for free).');
  if (p.compare_at && !(Number(p.compare_at) > Number(p.price))) problems.push('"compare_at" must be higher than "price" (or leave it out).');
  if (p.cover_ratio && !['1:1', '4:3'].includes(p.cover_ratio)) problems.push('"cover_ratio" must be "1:1" or "4:3".');
  if (covers.length > 4) problems.push(`covers/ has ${covers.length} files; the store takes up to 4.`);
  for (const c of covers) {
    if (!IMAGE.test(c) && !VIDEO.test(c)) problems.push(`Cover ${path.basename(c)} isn't an image or a short video.`);
    else if (VIDEO.test(c) && fs.statSync(c).size > 60 * 1024 * 1024) problems.push(`Cover video ${path.basename(c)} is over 60 MB.`);
  }
  if (!files.length) notes.push('files/ is empty: buyers would get nothing to download.');
  for (const name of [].concat(p.preview || [])) {
    if (!files.some(f => path.basename(f) === name)) problems.push(`"preview" names ${name}, which isn't in files/.`);
    else if (!PREVIEWABLE.test(name)) problems.push(`${name} can't be a free preview (only PDFs, videos, audio and images can).`);
  }
  const dashText = [p.title, p.subtitle, description].join('\n');
  if (/[\u2013\u2014]/.test(dashText)) notes.push('The title, short description or description has a long dash (– or —). Swap it for a comma, colon or full stop.');
  if (!covers.length) notes.push('No covers: the store will show a plain generated cover.');
  if (!description) notes.push('No description yet (add description.md).');

  console.log(`\n  ${p.title || '(no title)'}\n  ${'─'.repeat(Math.min(60, String(p.title || '').length + 2))}`);
  console.log(`  Price: ${Number(p.price) ? '₦' + Number(p.price).toLocaleString() : 'Free'}${p.compare_at ? ` (was ₦${Number(p.compare_at).toLocaleString()})` : ''}`);
  console.log(`  Categories: ${[].concat(p.categories || []).join(', ') || 'none'}`);
  console.log(`  Covers: ${covers.map(c => path.basename(c)).join(', ') || 'none'}   Shape: ${p.cover_ratio || '1:1'}`);
  console.log(`  Files: ${files.map(f => `${path.basename(f)} (${mb(fs.statSync(f).size)})`).join(', ') || 'none'}`);
  if ([].concat(p.preview || []).length) console.log(`  Free preview: ${[].concat(p.preview).join(', ')}${p.preview_pages ? ` (first ${p.preview_pages} pages of PDFs)` : ''}`);
  notes.forEach(n => console.log(`  ! ${n}`));
  if (problems.length) { problems.forEach(x => console.error(`  ✗ ${x}`)); fail('Fix the problems above, then run it again.'); }
  if (flag('check')) { console.log('\n  ✓ The folder looks good. Nothing was uploaded.\n'); return; }
  if (!/^cs_upload_/.test(KEY)) fail('No upload key. Create one in Store settings > Upload keys and put it in .env as CARSINSTORE_UPLOAD_KEY=...');

  const markFile = path.join(dir, MARK);
  const done = fs.existsSync(markFile) ? JSON.parse(fs.readFileSync(markFile, 'utf8')) : null;
  if (done && !flag('update')) fail(`This folder was already uploaded as "${done.title}" (${done.link}). Use --update to change its details.`);
  if (!done && flag('update')) fail('This folder has not been uploaded yet. Run it without --update first.');

  // categories by name; missing ones are created
  const cats = await api('GET', '/categories');
  const categoryIds = [];
  for (const name of [].concat(p.categories || [])) {
    let c = cats.find(x => x.name.toLowerCase() === String(name).trim().toLowerCase());
    if (!c) { await api('POST', '/categories', { name }); c = (await api('GET', '/categories')).find(x => x.name.toLowerCase() === String(name).trim().toLowerCase()); console.log(`  + Made a new category: ${name}`); }
    if (c) categoryIds.push(c.id);
  }

  const id = done ? done.id : (await api('POST', '/products', { title: p.title, subtitle: p.subtitle || '', description })).id;
  const details = {
    title: p.title, subtitle: p.subtitle || '', description, price_cents: Math.round(Number(p.price) * 100),
    compare_cents: p.compare_at ? Math.round(Number(p.compare_at) * 100) : null, category_ids: categoryIds,
    cover_ratio: p.cover_ratio || '1:1', featured: !!p.featured, ...(p.slug ? { slug: p.slug } : {}),
  };
  const saved = await api('PUT', `/products/${id}`, details);
  console.log(`\n  ✓ Details saved${done ? ' (updated)' : ''}`);

  if (!done) {
    for (const c of covers) { await send(`/products/${id}/cover`, 'cover', c); console.log(`  ✓ Cover: ${path.basename(c)}`); }
    for (const f of files) {
      const t0 = Date.now();
      process.stdout.write(`  … Uploading ${path.basename(f)} (${mb(fs.statSync(f).size)})`);
      await send(`/products/${id}/files`, 'files', f);
      process.stdout.write(`\r  ✓ File: ${path.basename(f)} (${mb(fs.statSync(f).size)}, ${Math.round((Date.now() - t0) / 1000)}s)          \n`);
    }
  }
  // free previews
  const prod = await api('GET', `/products/${id}`);
  for (const f of prod.files) {
    const want = [].concat(p.preview || []).includes(f.name);
    if (want !== f.preview || (want && p.preview_pages && f.previewPages !== Number(p.preview_pages))) {
      await api('PUT', `/files/${f.id}`, { preview: want, ...(p.preview_pages ? { preview_pages: Number(p.preview_pages) } : {}) });
      console.log(`  ✓ ${want ? 'Free preview on' : 'Free preview off'}: ${f.name}`);
    }
  }

  const publish = flag('publish') || p.publish === true;
  let link = `${BASE}/p/${prod.slug}`;
  if (publish) { link = (await api('POST', `/products/${id}/publish`)).link; console.log('  ✓ Published'); }
  fs.writeFileSync(markFile, JSON.stringify({ id, title: p.title, slug: saved.slug, link, uploaded_at: done?.uploaded_at || new Date().toISOString(), updated_at: new Date().toISOString(), published: publish || !!done?.published }, null, 2));

  console.log(publish
    ? `\n  Live at ${link}\n`
    : `\n  Saved as a draft. Check it, then publish from the dashboard (or run again with --update --publish):\n    Preview: ${BASE}/#/p/${prod.slug}?draft=1   (while signed in)\n    Edit:    ${BASE}/#/admin/products/${id}\n`);
})().catch(e => fail(e.message));
