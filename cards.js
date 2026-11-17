// Branded image cards for social posts that don't use a product picture as-is:
//   question: a research question in large type, with who it's for ("For freelancers")
//   tip:      a headline and up to 5 short steps, with the source product's cover and name at the bottom
// Drawn with satori (layout to SVG, fonts embedded) and resvg (SVG to PNG), then saved as JPEG because
// Instagram only accepts JPEG. Sizes: 1080x1350 (Instagram, Facebook, LinkedIn) and 1000x1500 (Pinterest).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');

const FONT_DIR = (pkg) => path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), 'files');
let fonts;
function loadFonts() {
  if (fonts) return fonts;
  const f = (pkg, file) => fs.readFileSync(path.join(FONT_DIR(pkg), file));
  fonts = [
    { name: 'Inter', data: f('inter', 'inter-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Inter', data: f('inter', 'inter-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Newsreader', data: f('newsreader', 'newsreader-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Newsreader', data: f('newsreader', 'newsreader-latin-400-italic.woff'), weight: 400, style: 'italic' },
  ];
  return fonts;
}
let satoriFn;
const satori = async (...a) => { satoriFn ||= (await import('satori')).default; return satoriFn(...a); };

const C = { bg: '#080808', text: '#f4f1ec', soft: '#cfcac3', muted: '#a9a49d', accent: '#e5573d', accent2: '#f2805a' };
const h = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });
const img = (src, style) => ({ type: 'img', props: { src, style } });
const dataUrl = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;

let logo;
function logoUrl(publicDir) {
  if (!logo) logo = dataUrl(fs.readFileSync(path.join(publicDir, 'brand', 'logo-email.png')), 'image/png');
  return logo;
}
async function coverUrl(file) {
  if (!file || !fs.existsSync(file)) return null;
  try { return dataUrl(await sharp(file).resize(240, 240, { fit: 'cover' }).png().toBuffer(), 'image/png'); } catch { return null; }
}
const STAR = dataUrl(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#f2805a" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>'), 'image/svg+xml');
const clip = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };

async function renderCard({ kind, label, title, points = [], product, site = 'carsin.store', publicDir }, { width = 1080, height = 1350 } = {}) {
  const pad = Math.round(width * 0.08);
  const tall = height / width > 1.4;
  const q = clip(title, 170);
  const steps = (points || []).filter(Boolean).slice(0, 5).map(p => clip(p, 95));
  const titleSize = kind === 'question'
    ? (q.length <= 60 ? 92 : q.length <= 110 ? 76 : 62) * (tall ? 1.05 : 1)
    : (q.length <= 50 ? 72 : 60);
  const cover = kind !== 'question' && product?.coverFile ? await coverUrl(product.coverFile) : null;

  // Glass look: bright brand-colour light behind frosted, translucent panels with a soft edge highlight.
  const blob = (x, y, size, rgba) => h('div', { position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: 9999,
    backgroundImage: `radial-gradient(circle, ${rgba} 0%, rgba(8,8,8,0) 65%)` });
  const glow = [
    blob(width * 0.86, height * 0.2, width * 1.05, 'rgba(229,87,61,0.75)'),
    blob(width * 0.12, height * 0.62, width * 0.9, 'rgba(242,128,90,0.45)'),
    blob(width * 0.7, height * 0.95, width * 0.8, 'rgba(160,40,30,0.55)'),
  ];
  const glass = (style, children) => h('div', {
    flexDirection: 'column', borderRadius: 40, border: '2px solid rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.07)', backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0))',
    position: 'relative', ...style,
  }, [
    h('div', { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)' }),
    ...children,
  ]);
  const top = h('div', { flexDirection: 'column', gap: 34 }, [
    img(logoUrl(publicDir), { width: 238, height: 35 }),
    h('div', { alignSelf: 'flex-start', padding: '12px 24px', borderRadius: 999, border: '2px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.12)',
      color: '#fff', fontFamily: 'Inter', fontWeight: 600, fontSize: 25, letterSpacing: 4, textTransform: 'uppercase' }, clip(label, 40)),
  ]);

  let middle;
  if (kind === 'review') {
    const rq = clip(title, 260);
    const size = rq.length <= 90 ? 64 : rq.length <= 170 ? 52 : 44;
    middle = glass({ padding: '52px 56px 58px', gap: 26 }, [
      h('div', { gap: 10 }, Array.from({ length: Math.max(1, Math.min(5, Number(points?.[0]) || 5)) }, () => img(STAR, { width: 46, height: 46 }))),
      h('div', { fontFamily: 'Newsreader', fontStyle: 'italic', fontSize: size, lineHeight: 1.2, color: '#fff' }, `“${rq}”`),
      h('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 30, color: C.accent2 }, `— ${clip(points?.[1] || 'A buyer', 40)}`),
    ]);
  } else if (kind === 'question') {
    middle = glass({ padding: '56px 60px 64px', gap: 18 }, [
      h('div', { fontFamily: 'Newsreader', fontSize: 170, lineHeight: 0.6, color: C.accent2, height: 70 }, '“'),
      h('div', { fontFamily: 'Newsreader', fontSize: titleSize * 0.92, lineHeight: 1.12, color: '#fff', letterSpacing: -1 }, q),
    ]);
  } else {
    middle = glass({ padding: '56px 56px 60px', gap: 40 }, [
      h('div', { fontFamily: 'Newsreader', fontSize: titleSize * 0.92, lineHeight: 1.1, color: '#fff', letterSpacing: -1 }, clip(title, 110)),
      h('div', { flexDirection: 'column', gap: 24 }, steps.map((s, i) => h('div', { alignItems: 'flex-start', gap: 22 }, [
        h('div', { width: 52, height: 52, borderRadius: 999, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
          backgroundImage: `linear-gradient(180deg, ${C.accent2}, ${C.accent})`, color: '#fff', fontFamily: 'Inter', fontWeight: 600, fontSize: 25,
          boxShadow: '0 8px 20px rgba(229,87,61,0.45)' }, String(i + 1)),
        h('div', { fontFamily: 'Inter', fontSize: steps.length > 4 ? 29 : 32, lineHeight: 1.38, color: '#f1ede7', paddingTop: 4, flex: 1 }, s),
      ]))),
    ]);
  }

  const footer = kind === 'question'
    ? glass({ flexDirection: 'row', borderRadius: 999, padding: '24px 36px', justifyContent: 'space-between', alignItems: 'center' }, [
        h('div', { fontFamily: 'Inter', fontSize: 29, color: '#f1ede7' }, 'Tell me in the comments'),
        h('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 27, color: '#fff' }, site),
      ])
    : glass({ flexDirection: 'row', borderRadius: 32, padding: '22px 30px', alignItems: 'center', gap: 24 }, [
        ...(cover ? [img(cover, { width: 110, height: 110, borderRadius: 18, border: '2px solid rgba(255,255,255,0.25)' })] : []),
        h('div', { flexDirection: 'column', gap: 6, flex: 1 }, [
          h('div', { fontFamily: 'Inter', fontSize: 23, color: '#d9d4cd', letterSpacing: 1 }, kind === 'review' ? 'Said about' : 'The full version is in'),
          h('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 29, lineHeight: 1.25, color: '#fff' }, clip(product?.title, 70)),
        ]),
        h('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 25, color: '#fff' }, site),
      ]);

  const tree = h('div', { width, height, background: C.bg, position: 'relative', overflow: 'hidden' }, [
    ...glow,
    h('div', { position: 'absolute', top: pad, left: pad, width: width - 2 * pad, height: height - 2 * pad, flexDirection: 'column', justifyContent: 'space-between' }, [top, middle, footer]),
  ]);
  const svg = await satori(tree, { width, height, fonts: loadFonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  return sharp(png).jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
}

// Transparent text layers for a short vertical video (1080x1920), laid over the moving pictures by ffmpeg:
//   top: logo, a label pill and the product title, kept out of the top ~200px that the apps cover with their own buttons
//   end: a dark scrim with "Link in bio" and the product name, shown for the last few seconds
async function renderReelLayers({ title, label, site = 'carsin.store', publicDir }) {
  const W = 1080, H = 1920;
  const t = clip(title, 90);
  const pill = (text, style = {}) => h('div', { alignSelf: 'flex-start', padding: '12px 24px', borderRadius: 999, border: '2px solid rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.14)', color: '#fff', fontFamily: 'Inter', fontWeight: 600, fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', ...style }, text);
  const top = h('div', { width: W, height: H, position: 'relative' }, [
    h('div', { position: 'absolute', left: 0, top: 0, width: W, height: 640, backgroundImage: 'linear-gradient(180deg, rgba(8,8,8,0.85) 0%, rgba(8,8,8,0.55) 70%, rgba(8,8,8,0) 100%)' }),
    h('div', { position: 'absolute', left: 80, top: 210, width: W - 160, flexDirection: 'column', gap: 26 }, [
      img(logoUrl(publicDir), { width: 238, height: 35 }),
      pill(clip(label, 30)),
      h('div', { fontFamily: 'Newsreader', fontSize: t.length <= 40 ? 76 : t.length <= 65 ? 64 : 54, lineHeight: 1.08, color: '#fff', letterSpacing: -1 }, t),
    ]),
    h('div', { position: 'absolute', left: 0, top: H - 330, width: W, justifyContent: 'center' }, [
      h('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 30, color: '#fff', letterSpacing: 1 }, site),
    ]),
  ]);
  const end = h('div', { width: W, height: H, position: 'relative', backgroundColor: 'rgba(8,8,8,0.88)', alignItems: 'center', justifyContent: 'center' }, [
    h('div', { flexDirection: 'column', alignItems: 'center', gap: 34, padding: '64px 70px', borderRadius: 44, width: 860, border: '2px solid rgba(255,255,255,0.22)',
      backgroundColor: 'rgba(30,30,30,0.9)', backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0))' }, [
      h('div', { fontFamily: 'Inter', fontSize: 30, color: '#d9d4cd', letterSpacing: 2, textTransform: 'uppercase' }, 'Get it now'),
      h('div', { fontFamily: 'Newsreader', fontSize: 104, lineHeight: 1, color: '#fff', letterSpacing: -2 }, 'Link in bio'),
      h('div', { padding: '18px 36px', borderRadius: 999, backgroundImage: `linear-gradient(180deg, ${C.accent2}, ${C.accent})`, color: '#fff', fontFamily: 'Inter', fontWeight: 600, fontSize: 32 }, site),
      h('div', { fontFamily: 'Inter', fontSize: 30, lineHeight: 1.3, color: '#f1ede7', textAlign: 'center' }, clip(title, 70)),
    ]),
  ]);
  const png = async tree => new Resvg(await satori(tree, { width: W, height: H, fonts: loadFonts() }), { fitTo: { mode: 'width', value: W } }).render().asPng();
  return { top: await png(top), end: await png(end) };
}

module.exports = { renderCard, renderReelLayers };
