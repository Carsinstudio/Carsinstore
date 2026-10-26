// Adds sample categories and products so the store isn't empty on first run.
// Safe to run more than once: it does nothing if products already exist.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { one, run, DATA_DIR } = require('./db');

if (one('SELECT COUNT(*) AS n FROM products').n > 0) {
  console.log('Store already has products — skipping seed.');
  process.exit(0);
}

const FILES_DIR = path.join(DATA_DIR, 'files');
const ASSETS = path.join(__dirname, 'seed-assets');
fs.mkdirSync(FILES_DIR, { recursive: true });

function pdf(title, lines) {
  const text = [title, '', ...lines].map((l, i) => `BT /F1 ${i ? 12 : 22} Tf 60 ${740 - i * 22} Td (${l.replace(/[()\\]/g, '')}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => { const at = Buffer.byteLength(out); out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n ').join('\n')}\n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out);
}
function fileData(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.mp4') {
    const src = path.join(ASSETS, /preview|sample/i.test(name) ? 'sample-clip.mp4' : 'full-walkthrough.mp4');
    return [fs.readFileSync(src), 'video/mp4'];
  }
  if (ext === '.pdf') return [pdf(name.replace(/-/g, ' ').replace('.pdf', ''), ['Sample file from your Carsinstore seed data.', 'Replace it with your real product in the dashboard.']), 'application/pdf'];
  return [Buffer.from('Thanks for your purchase!\n\nThis is a sample file. Upload your real files in the dashboard.\n'), 'text/plain'];
}

const cats = [
  ['Video Packs', 'Full-length videos to download and keep.'],
  ['Templates', 'Plug-and-play files to save you hours.'],
  ['Guides & Ebooks', 'Deep dives you can read anywhere.'],
  ['Free Resources', 'Starter kits on the house.'],
];
const catId = {};
cats.forEach(([name, description], i) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  catId[name] = Number(run('INSERT INTO categories (name, slug, description, sort) VALUES (?, ?, ?, ?)', name, slug, description, i).lastInsertRowid);
});

// files: [name, isFreePreview]
const products = [
  { title: 'Creator Systems Video Pack', subtitle: 'Three hours of workflow videos — download and watch offline.', price: 2500000, compare: 4000000, cat: 'Video Packs', featured: 1,
    description: 'Every video from my creator-systems workshop, in full quality, yours to download.\n\n## What you get\n- Full walkthrough videos (MP4, 1080p)\n- The companion workbook (PDF)\n- A free sample clip so you know what you are getting\n\n**Yours forever** — including any updated versions I upload.',
    files: [['Preview - Sample-Clip.mp4', true], ['01-Full-Walkthrough.mp4'], ['02-Batch-Production.mp4'], ['Companion-Workbook.pdf']] },
  { title: 'Brand Identity Template Kit', subtitle: '40+ editable templates for logos, socials and pitch decks.', price: 1500000, cat: 'Templates', featured: 1,
    description: 'Everything you need to look polished from day one.\n\n- Logo lockups & brand board\n- 30 social post templates\n- Pitch deck & one-pager\n- Brand guidelines PDF',
    files: [['Sample-Pages.pdf', true], ['Brand-Guidelines.pdf'], ['Quick-Start.txt']] },
  { title: 'Pricing Your Work: The Guide', subtitle: 'A 60-page playbook for charging what you are worth.', price: 800000, cat: 'Guides & Ebooks', featured: 1,
    description: 'Stop guessing. This guide walks through value-based pricing, packaging and negotiation with real scripts.',
    files: [['Pricing-Guide.pdf']] },
  { title: 'Starter Toolkit', subtitle: 'My favourite checklists and planners — free.', price: 0, cat: 'Free Resources', featured: 0,
    description: 'A free bundle to get you moving today. Create an account and it is yours.',
    files: [['Weekly-Planner.pdf'], ['Launch-Checklist.pdf']] },
  { title: 'First 1,000 Followers (Free Video)', subtitle: 'A free 8-minute video on growing from zero.', price: 0, cat: 'Free Resources', featured: 1,
    description: 'A short, practical video on picking your lane, posting rhythm and hooks that work.',
    files: [['First-1000-Followers.mp4']] },
];

for (const p of products) {
  const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = Number(run(`INSERT INTO products (slug, title, subtitle, description, price_cents, compare_cents, category_id, published, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`, slug, p.title, p.subtitle, p.description, p.price, p.compare || null, catId[p.cat], p.featured).lastInsertRowid);
  p.files.forEach(([name, preview], sort) => {
    const [buf, mime] = fileData(name);
    const stored = crypto.randomBytes(12).toString('hex') + path.extname(name).toLowerCase();
    fs.writeFileSync(path.join(FILES_DIR, stored), buf);
    run('INSERT INTO files (product_id, original_name, stored_name, mime, size, preview, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, name, stored, mime, buf.length, preview ? 1 : 0, sort);
  });
}
console.log(`Seeded ${products.length} sample products in ${cats.length} categories.`);
