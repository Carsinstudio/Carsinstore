// Short vertical videos (Reels / TikTok) made from a product's cover pictures:
//   a blurred, slowly zooming copy of the first cover fills the background; each cover slides in and fades in
//   turn (3 seconds each, 5 when there is only one); the title stays at the top; the last 3 seconds show
//   "Link in bio". 1080x1920, 30 fps, H.264 + silent AAC (Instagram wants an audio track), MP4 with faststart.
// Needs ffmpeg on the server: FFMPEG_PATH, or "ffmpeg" on the PATH. hasFfmpeg() says whether it is there,
// so callers can fall back to a picture post.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const sharp = require('sharp');
const { renderReelLayers } = require('./cards');

const W = 1080, H = 1920;
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
let has;
function hasFfmpeg() {
  if (has !== undefined) return Promise.resolve(has);
  return new Promise(ok => execFile(FFMPEG, ['-version'], { timeout: 10000 }, err => ok((has = !err))));
}
const run = (args) => new Promise((ok, fail) => execFile(FFMPEG, args, { timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
  (err, _out, errOut) => (err ? fail(new Error(`ffmpeg failed: ${String(errOut || err.message).trim().split('\n').slice(-3).join(' ')}`)) : ok())));

async function slide(file, dir, i) {
  // The cover fitted into 920x920, rounded corners, a soft shadow, centred in the space under the title.
  const fit = await sharp(file, { failOn: 'none' }).rotate().resize(920, 920, { fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3' }).png().toBuffer();
  const m = await sharp(fit).metadata();
  const r = 34;
  const mask = Buffer.from(`<svg width="${m.width}" height="${m.height}"><rect width="${m.width}" height="${m.height}" rx="${r}" ry="${r}"/></svg>`);
  const rounded = await sharp(fit).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const shadow = await sharp({ create: { width: m.width + 120, height: m.height + 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg width="${m.width + 120}" height="${m.height + 120}"><rect x="60" y="76" width="${m.width}" height="${m.height}" rx="${r}" fill="rgba(0,0,0,0.55)"/></svg>`) }])
    .blur(26).png().toBuffer();
  const cx = Math.round((W - m.width) / 2), cy = Math.round(1110 - m.height / 2);
  const out = path.join(dir, `slide${i}.png`);
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shadow, left: cx - 60, top: cy - 60 }, { input: rounded, left: cx, top: cy }]).png().toFile(out);
  return out;
}

async function makeReel({ covers, title, label, site, publicDir, out }) {
  covers = (covers || []).filter(f => f && fs.existsSync(f)).slice(0, 4);
  if (!covers.length) throw new Error('No pictures to make a video from.');
  if (!(await hasFfmpeg())) throw new Error('ffmpeg is not installed on the server.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  try {
    // Background: first cover, filled, blurred and darkened; drawn 20% larger so the zoom never shows an edge.
    const bg = path.join(dir, 'bg.png');
    await sharp(covers[0], { failOn: 'none' }).rotate().resize(W, H, { fit: 'cover' }).blur(38).modulate({ brightness: 0.5, saturation: 1.15 }).png().toFile(bg);
    const slides = [];
    for (let i = 0; i < covers.length; i++) slides.push(await slide(covers[i], dir, i));
    const layers = await renderReelLayers({ title, label, site, publicDir });
    const top = path.join(dir, 'top.png'), end = path.join(dir, 'end.png');
    fs.writeFileSync(top, layers.top); fs.writeFileSync(end, layers.end);

    const per = slides.length === 1 ? 5 : 3;
    const start = 0.3, E = +(start + slides.length * per).toFixed(2), D = +(E + 3).toFixed(2);
    const fps = 30, frames = Math.round(D * fps);
    const args = ['-y', '-loglevel', 'error'];
    const still = f => args.push('-loop', '1', '-framerate', String(fps), '-t', String(D), '-i', f);
    still(bg); slides.forEach(still); still(top); still(end);
    args.push('-f', 'lavfi', '-t', String(D), '-i', 'anullsrc=r=44100:cl=stereo');
    const n = slides.length, iTop = 1 + n, iEnd = 2 + n, iAudio = 3 + n;
    const f = [];
    f.push(`[0:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.10*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps},setsar=1[b0]`);
    let prev = 'b0';
    slides.forEach((_, i) => {
      const st = +(start + i * per).toFixed(2), en = i === n - 1 ? D : +(st + per).toFixed(2);
      const fadeOut = i === n - 1 ? '' : `,fade=t=out:st=${(en - 0.35).toFixed(2)}:d=0.35:alpha=1`;
      f.push(`[${i + 1}:v]format=rgba,fade=t=in:st=${st}:d=0.5:alpha=1${fadeOut}[s${i}]`);
      f.push(`[${prev}][s${i}]overlay=x=0:y='if(lt(t,${st + 0.5}),max(0,80*(1-(t-${st})/0.5)),0)':enable='between(t,${st},${en})'[b${i + 1}]`);
      prev = `b${i + 1}`;
    });
    f.push(`[${iTop}:v]format=rgba,fade=t=in:st=0:d=0.6:alpha=1[tp]`);
    f.push(`[${prev}][tp]overlay=0:0[bt]`);
    f.push(`[${iEnd}:v]format=rgba,fade=t=in:st=${E}:d=0.5:alpha=1[en]`);
    f.push(`[bt][en]overlay=0:0:enable='gte(t,${E})',format=yuv420p[v]`);
    args.push('-filter_complex', f.join(';'), '-map', '[v]', '-map', `${iAudio}:a`,
      '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-t', String(D), '-movflags', '+faststart', out + '.tmp.mp4');
    await run(args);
    fs.renameSync(out + '.tmp.mp4', out);
    return { seconds: D };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { makeReel, hasFfmpeg };
