// Branded post images for Carsin Studio's LinkedIn-branding posts, built from the owner's two templates.
// Only the hook line changes; everything else is the template as designed.
//   portrait (1080x1350): the photo template. The card is redrawn over the same spot; it grows upwards when the
//                          hook runs to more lines, so the original card is always fully covered.
//   post     (1080x646):  the dark "post" template, redrawn from scratch, content centred vertically.
// Source pictures live in seed-assets/templates (samples sent by the owner, and avatars cut from them).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');

const DIR = path.join(__dirname, 'seed-assets', 'templates');
const font = (w) => fs.readFileSync(path.join(path.dirname(require.resolve('@fontsource/inter/package.json')), 'files', `inter-latin-${w}-normal.woff`));
let fonts;
const loadFonts = () => (fonts ||= [400, 500, 600].map(w => ({ name: 'Inter', data: font(w), weight: w, style: 'normal' })));
let satoriFn;
const satori = async (...a) => { satoriFn ||= (await import('satori')).default; return satoriFn(...a); };

const h = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });
const img = (src, style) => ({ type: 'img', props: { src, style } });
const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(path.join(DIR, file)).toString('base64')}`;
// LinkedIn-style verified badge: a scalloped blue rosette with a white tick.
const BADGE = (() => {
  const pts = []; const n = 16;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 10.4 : 12; pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polygon points="${pts.join(' ')}" fill="#3e8ef7" stroke="#3e8ef7" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.6 12.3l2.9 2.9 5.9-6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
})();
const dots = (color, size) => h('div', { flexDirection: 'column', gap: size * 0.55 }, [0, 1, 2].map(() => h('div', { width: size, height: size, borderRadius: 99, backgroundColor: color })));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);

const PROFILE = { name: 'Francis Adediran', portraitTitle: 'LinkedIn Brand Strategist', postTitle: 'Founder Carsin Studio' };

async function renderPortrait(text) {
  const W = 1080, H = 1350;
  const card = h('div', {
    position: 'absolute', left: 165, bottom: H - 1107, width: 750 - 82, minHeight: 255 - 67, /* padding is added on top of these */ backgroundColor: '#fff', borderRadius: 10,
    flexDirection: 'column', padding: '33px 41px 34px 41px',
  }, [
    h('div', { alignItems: 'center', width: '100%' }, [
      img(dataUrl('avatar-light.png'), { width: 92, height: 92, borderRadius: 4 }),
      h('div', { flexDirection: 'column', marginLeft: 17, flex: 1 }, [
        h('div', { alignItems: 'center', gap: 8 }, [
          h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 34, letterSpacing: -2.1, color: '#1d1d1f' }, PROFILE.name),
          img(BADGE, { width: 27, height: 27 }),
        ]),
        h('div', { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, letterSpacing: -0.6, color: '#6b6b70', marginTop: 2 }, PROFILE.portraitTitle),
      ]),
      h('div', { marginRight: 18 }, [dots('#4a4a4f', 6)]),
    ]),
    h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 29.5, lineHeight: 1.26, letterSpacing: -1.15, color: '#111114', marginTop: 22, width: 560 }, clean(text)),
  ]);
  const svg = await satori(h('div', { width: W, height: H, position: 'relative' }, [card]), { width: W, height: H, fonts: loadFonts() });
  const layer = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return sharp(path.join(DIR, 'sample-portrait.webp')).composite([{ input: layer }]).jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
}

async function renderPost(text) {
  const W = 1080, H = 646;
  const tree = h('div', { width: W, height: H, backgroundColor: '#060414', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 173px' }, [
    h('div', { alignItems: 'center', width: 690 }, [
      img(dataUrl('avatar-lime.png'), { width: 73, height: 73, borderRadius: 4 }),
      h('div', { flexDirection: 'column', marginLeft: 18, flex: 1 }, [
        h('div', { alignItems: 'center', gap: 8 }, [
          h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 35, letterSpacing: -1.7, color: '#ffffff' }, PROFILE.name),
          img(BADGE, { width: 28, height: 28 }),
        ]),
        h('div', { fontFamily: 'Inter', fontWeight: 400, fontSize: 17.5, letterSpacing: -0.3, color: '#b9b8c6', marginTop: 4 }, PROFILE.postTitle),
      ]),
      dots('#ffffff', 7),
    ]),
    h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 31.5, lineHeight: 1.22, letterSpacing: -0.7, color: '#ffffff', marginTop: 24, width: 705 }, clean(text)),
    h('div', { gap: 52, marginTop: 38 }, ['Like', 'Comment', 'Share'].map(t => h('div', { fontFamily: 'Inter', fontWeight: 400, fontSize: 21, letterSpacing: -0.3, color: '#6d75b4' }, t))),
  ]);
  const svg = await satori(tree, { width: W, height: H, fonts: loadFonts() });
  return sharp(new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng()).jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
}

const TEMPLATES = { portrait: renderPortrait, post: renderPost };
async function renderTemplate(name, text) {
  const fn = TEMPLATES[name];
  if (!fn) throw new Error(`Unknown template: ${name}`);
  return fn(text);
}

module.exports = { renderTemplate, TEMPLATE_NAMES: Object.keys(TEMPLATES) };
