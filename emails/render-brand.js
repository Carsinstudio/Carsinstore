// Renders PNG/JPEG versions of the SVG logos for places that can't use SVG, using Microsoft Edge headless:
//   public/brand/apple-touch-icon.png   iPhone home-screen icon (180x180)
//   public/brand/share.png              default link preview when a page has no product cover (1200x630)
//   public/brand/logo-email.png         email header logo, 2x for sharp screens (shown 170 px wide)
// Run after changing the SVGs: node emails/render-brand.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const brand = path.join(__dirname, '..', 'public', 'brand');
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!edge) throw new Error('Microsoft Edge not found');
const svg = name => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(brand, name)).toString('base64');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-brand-'));

function render(out, w, h, body, transparent) {
  const page = path.join(tmp, out + '.html');
  fs.writeFileSync(page, `<!doctype html><html><head><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;${transparent ? 'background:transparent' : ''}}</style></head><body>${body}</body></html>`);
  execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    ...(transparent ? ['--default-background-color=00000000'] : []), `--screenshot=${path.join(brand, out)}`, 'file:///' + page.replace(/\\/g, '/')], { stdio: 'ignore' });
  console.log(out, fs.statSync(path.join(brand, out)).size, 'bytes');
}

const mark = svg('logo-mark.svg'), logo = svg('logo-horizontal.svg');
render('apple-touch-icon.png', 180, 180,
  `<div style="width:180px;height:180px;background:#0b0b0b;display:flex;align-items:center;justify-content:center"><img src="${mark}" style="width:136px"></div>`);
render('share.png', 1200, 630,
  `<div style="width:1200px;height:630px;background:#080808 radial-gradient(ellipse 60% 70% at 30% 45%,rgba(236,98,48,.55) 0%,rgba(206,68,38,.25) 35%,rgba(8,8,8,0) 75%);display:flex;align-items:center;justify-content:center"><img src="${logo}" style="width:720px"></div>`);
render('logo-email.png', 340, 50, `<img src="${logo}" style="width:340px;display:block">`, true);
fs.rmSync(tmp, { recursive: true, force: true });
