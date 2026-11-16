// Social auto-poster. Once a week (whenever fewer than 3 days of posts are queued) Claude drafts the next 7 days of
// posts, one a day per platform, each about one product, written for X, LinkedIn, Facebook and Instagram. The owner
// gets an email, skims and approves them on the Social page, and approved posts go out at the set hour.
// Nothing is ever posted without approval; drafts not approved by their time expire.
//
// Needs, as Railway variables:
//   ANTHROPIC_API_KEY                       writes the posts
//   META_APP_ID, META_APP_SECRET            Facebook Page + Instagram (one connection covers both)
//   META_CONFIG_ID                          Facebook Login for Business configuration (newer Meta apps)
//   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
//   X_CLIENT_ID, X_CLIENT_SECRET
// Each platform's app must allow the redirect URL  <BASE_URL>/api/social/callback/<meta|linkedin|x>
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const PLATFORMS = ['x', 'linkedin', 'facebook', 'instagram'];
const NAMES = { x: 'X', linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' };
const STAGGER = { x: 0, linkedin: 10, facebook: 20, instagram: 30 }; // minutes after the posting hour
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}`;
const LI_VERSION = process.env.LINKEDIN_VERSION || '202605';
const MODEL = process.env.SOCIAL_MODEL || 'claude-opus-5-5';

const env = k => process.env[k] || '';
const configured = {
  ai: () => !!env('ANTHROPIC_API_KEY'),
  meta: () => !!(env('META_APP_ID') && env('META_APP_SECRET')),
  linkedin: () => !!(env('LINKEDIN_CLIENT_ID') && env('LINKEDIN_CLIENT_SECRET')),
  x: () => !!(env('X_CLIENT_ID') && env('X_CLIENT_SECRET')),
};
// X counts every link as 23 characters, however long it is.
const xLength = t => String(t).replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
const sqlTime = d => d.toISOString().slice(0, 19).replace('T', ' ');
const fromSql = s => new Date(String(s).replace(' ', 'T') + 'Z');

module.exports = function setupSocial({ app, admin, one, all, run, getSettings, BASE_URL, mailer, coversOf, coverFile, isVideoCover, plain, shortText, shareImage, supportEmail, wrap, bad }) {
  const redirectUri = p => `${BASE_URL}/api/social/callback/${p}`;
  const account = p => { const a = one('SELECT * FROM social_accounts WHERE platform = ?', p); return a && { ...a, data: JSON.parse(a.data || '{}') }; };
  const saveAccount = (p, data, name, expiresAt = null) => run(`INSERT INTO social_accounts (platform, data, name, expires_at, connected_at) VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(platform) DO UPDATE SET data = excluded.data, name = excluded.name, expires_at = excluded.expires_at, connected_at = excluded.connected_at`,
    p, JSON.stringify(data), name, expiresAt);
  const enabledPlatforms = s => String(s.social_platforms || '').split(',').filter(p => PLATFORMS.includes(p));
  const connected = () => all('SELECT platform FROM social_accounts').map(r => r.platform);
  const activePlatforms = s => enabledPlatforms(s).filter(p => connected().includes(p));

  async function http(url, opts = {}, what = 'request') {
    const res = await fetch(url, opts);
    const text = await res.text();
    let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
    if (!res.ok) {
      const msg = data.error?.message || data.error_description || data.detail || data.message || data.title || (typeof data.error === 'string' ? data.error : '') || data.raw || res.statusText;
      throw new Error(`${what} failed (${res.status}): ${msg}`);
    }
    return { data, res };
  }
  const form = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null));

  // ---------- connecting accounts (OAuth) ----------
  const pkce = () => { const verifier = crypto.randomBytes(48).toString('base64url'); return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') }; };
  admin.get('/social/connect/:platform', (req, res) => {
    const p = req.params.platform;
    const state = crypto.randomBytes(24).toString('base64url');
    run("DELETE FROM social_oauth WHERE created_at < datetime('now', '-1 hour')");
    if (p === 'meta') {
      if (!configured.meta()) return bad(res, 'Add META_APP_ID and META_APP_SECRET in Railway first.');
      run('INSERT INTO social_oauth (state, platform) VALUES (?, ?)', state, p);
      // Newer Meta apps sign in with a Facebook Login for Business configuration (META_CONFIG_ID) that lists the
      // permissions; older ones take the permissions as a scope.
      const scope = 'pages_show_list,pages_read_engagement,pages_manage_posts,business_management,instagram_basic,instagram_content_publish';
      const how = env('META_CONFIG_ID') ? { config_id: env('META_CONFIG_ID'), override_default_response_type: 'true' } : { scope };
      return res.json({ url: `https://www.facebook.com/${GRAPH.split('/').pop()}/dialog/oauth?${form({ client_id: env('META_APP_ID'), redirect_uri: redirectUri('meta'), state, response_type: 'code', ...how })}` });
    }
    if (p === 'linkedin') {
      if (!configured.linkedin()) return bad(res, 'Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in Railway first.');
      run('INSERT INTO social_oauth (state, platform) VALUES (?, ?)', state, p);
      return res.json({ url: `https://www.linkedin.com/oauth/v2/authorization?${form({ response_type: 'code', client_id: env('LINKEDIN_CLIENT_ID'), redirect_uri: redirectUri('linkedin'), state, scope: 'openid profile w_member_social' })}` });
    }
    if (p === 'x') {
      if (!configured.x()) return bad(res, 'Add X_CLIENT_ID and X_CLIENT_SECRET in Railway first.');
      const { verifier, challenge } = pkce();
      run('INSERT INTO social_oauth (state, platform, verifier) VALUES (?, ?, ?)', state, p, verifier);
      return res.json({ url: `https://x.com/i/oauth2/authorize?${form({ response_type: 'code', client_id: env('X_CLIENT_ID'), redirect_uri: redirectUri('x'), scope: 'tweet.read tweet.write users.read offline.access', state, code_challenge: challenge, code_challenge_method: 'S256' })}` });
    }
    bad(res, 'Unknown platform.', 404);
  });

  // The platform sends the owner back here after they approve. Only the signed-in owner, with a fresh state, counts.
  app.get('/api/social/callback/:platform', wrap(async (req, res) => {
    const p = req.params.platform;
    const back = (q) => res.redirect(`/#/admin/social?${q}`);
    if (!req.user?.is_admin) return back('error=' + encodeURIComponent('Sign in to the store as the owner, then connect again.'));
    const st = one("SELECT * FROM social_oauth WHERE state = ? AND platform = ? AND created_at >= datetime('now', '-30 minutes')", String(req.query.state || ''), p);
    if (!st) return back('error=' + encodeURIComponent('That connection link expired. Please try again.'));
    run('DELETE FROM social_oauth WHERE state = ?', st.state);
    if (req.query.error) return back('error=' + encodeURIComponent(String(req.query.error_description || req.query.error)));
    const code = String(req.query.code || '');
    try {
      if (p === 'meta') await connectMeta(code);
      else if (p === 'linkedin') await connectLinkedIn(code);
      else if (p === 'x') await connectX(code, st.verifier);
      else return back('error=Unknown%20platform');
      back('connected=' + p);
    } catch (e) {
      console.error('Social connect:', e.message);
      back('error=' + encodeURIComponent(e.message.slice(0, 300)));
    }
  }));

  async function connectMeta(code) {
    const id = env('META_APP_ID'), secret = env('META_APP_SECRET');
    const short = (await http(`${GRAPH}/oauth/access_token?${form({ client_id: id, client_secret: secret, redirect_uri: redirectUri('meta'), code })}`, {}, 'Facebook sign-in')).data;
    const long = (await http(`${GRAPH}/oauth/access_token?${form({ grant_type: 'fb_exchange_token', client_id: id, client_secret: secret, fb_exchange_token: short.access_token })}`, {}, 'Facebook token')).data;
    const pages = (await http(`${GRAPH}/me/accounts?${form({ fields: 'id,name,access_token,instagram_business_account{id,username}', limit: 50, access_token: long.access_token })}`, {}, 'Facebook pages')).data.data || [];
    if (!pages.length) throw new Error('No Facebook Pages came back. Tick your Page when Facebook asks which ones to share.');
    const store = getSettings().store_name || '';
    const pick = pages.find(pg => pg.name.toLowerCase().replace(/\s/g, '') === store.toLowerCase().replace(/\s/g, '')) || pages.find(pg => /carsin/i.test(pg.name)) || pages[0];
    usePage(pick, pages.map(pg => ({ id: pg.id, name: pg.name, token: pg.access_token, ig: pg.instagram_business_account || null })));
  }
  function usePage(pg, pages) {
    const token = pg.access_token || pg.token;
    const ig = pg.instagram_business_account || pg.ig;
    saveAccount('facebook', { page_id: pg.id, token, pages }, pg.name);
    if (ig?.id) saveAccount('instagram', { ig_id: ig.id, token }, '@' + (ig.username || 'instagram'));
    else run("DELETE FROM social_accounts WHERE platform = 'instagram'");
  }
  admin.post('/social/facebook-page', (req, res) => {
    const fb = account('facebook');
    const pg = fb?.data.pages?.find(x => x.id === String(req.body?.id));
    if (!pg) return bad(res, 'Connect Facebook first.');
    usePage(pg, fb.data.pages);
    res.json({ ok: true });
  });

  async function connectLinkedIn(code) {
    const tok = (await http('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri('linkedin'), client_id: env('LINKEDIN_CLIENT_ID'), client_secret: env('LINKEDIN_CLIENT_SECRET') }) }, 'LinkedIn sign-in')).data;
    const me = (await http('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } }, 'LinkedIn profile')).data;
    saveAccount('linkedin', { token: tok.access_token, person: `urn:li:person:${me.sub}` }, me.name || 'LinkedIn', sqlTime(new Date(Date.now() + (Number(tok.expires_in) || 5184000) * 1000)));
  }

  const xBasic = () => 'Basic ' + Buffer.from(`${env('X_CLIENT_ID')}:${env('X_CLIENT_SECRET')}`).toString('base64');
  async function connectX(code, verifier) {
    const tok = (await http('https://api.x.com/2/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: xBasic() },
      body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri('x'), code_verifier: verifier, client_id: env('X_CLIENT_ID') }) }, 'X sign-in')).data;
    const me = (await http('https://api.x.com/2/users/me', { headers: { Authorization: `Bearer ${tok.access_token}` } }, 'X profile')).data.data;
    saveAccount('x', { token: tok.access_token, refresh: tok.refresh_token, username: me.username }, '@' + me.username, sqlTime(new Date(Date.now() + (Number(tok.expires_in) || 7200) * 1000)));
  }
  async function xToken() {
    const a = account('x');
    if (!a) throw new Error('X is not connected.');
    if (a.expires_at && fromSql(a.expires_at) > new Date(Date.now() + 120000)) return a;
    if (!a.data.refresh) throw new Error('X needs reconnecting.');
    const tok = (await http('https://api.x.com/2/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: xBasic() },
      body: form({ grant_type: 'refresh_token', refresh_token: a.data.refresh, client_id: env('X_CLIENT_ID') }) }, 'X token refresh')).data;
    const data = { ...a.data, token: tok.access_token, refresh: tok.refresh_token || a.data.refresh };
    saveAccount('x', data, a.name, sqlTime(new Date(Date.now() + (Number(tok.expires_in) || 7200) * 1000)));
    return { ...a, data };
  }

  admin.delete('/social/accounts/:platform', (req, res) => {
    const p = req.params.platform;
    if (p === 'facebook' || p === 'meta') run("DELETE FROM social_accounts WHERE platform IN ('facebook', 'instagram')");
    else run('DELETE FROM social_accounts WHERE platform = ?', p);
    res.json({ ok: true });
  });

  // ---------- publishing ----------
  // LinkedIn's post text uses "little text": these characters must be escaped or the post is cut short.
  const liEscape = t => String(t).replace(/[\\|{}@[\]()<>#*_~]/g, c => '\\' + c);
  async function publish(post) {
    if (post.platform === 'x') {
      const a = await xToken();
      const r = (await http('https://api.x.com/2/tweets', { method: 'POST', headers: { Authorization: `Bearer ${a.data.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: post.text }) }, 'X post')).data;
      return `https://x.com/${a.data.username}/status/${r.data.id}`;
    }
    if (post.platform === 'facebook') {
      const a = account('facebook'); if (!a) throw new Error('Facebook is not connected.');
      const r = post.image_url
        ? (await http(`${GRAPH}/${a.data.page_id}/photos`, { method: 'POST', body: form({ url: post.image_url, caption: post.text, access_token: a.data.token }) }, 'Facebook post')).data
        : (await http(`${GRAPH}/${a.data.page_id}/feed`, { method: 'POST', body: form({ message: post.text, link: post.link, access_token: a.data.token }) }, 'Facebook post')).data;
      return `https://www.facebook.com/${r.post_id || r.id}`;
    }
    if (post.platform === 'instagram') {
      const a = account('instagram'); if (!a) throw new Error('Instagram is not connected (link it to your Facebook Page, then reconnect Facebook).');
      if (!post.image_url) throw new Error('Instagram posts need a picture.');
      const c = (await http(`${GRAPH}/${a.data.ig_id}/media`, { method: 'POST', body: form({ image_url: post.image_url, caption: post.text, access_token: a.data.token }) }, 'Instagram upload')).data;
      for (let i = 0; i < 15; i++) {
        const st = (await http(`${GRAPH}/${c.id}?${form({ fields: 'status_code', access_token: a.data.token })}`, {}, 'Instagram upload check')).data.status_code;
        if (st === 'FINISHED') break;
        if (st === 'ERROR' || st === 'EXPIRED') throw new Error(`Instagram couldn't process the picture (${st}).`);
        await new Promise(ok => setTimeout(ok, 2000));
      }
      const m = (await http(`${GRAPH}/${a.data.ig_id}/media_publish`, { method: 'POST', body: form({ creation_id: c.id, access_token: a.data.token }) }, 'Instagram publish')).data;
      const link = (await http(`${GRAPH}/${m.id}?${form({ fields: 'permalink', access_token: a.data.token })}`, {}, 'Instagram link').catch(() => ({ data: {} }))).data.permalink;
      return link || 'https://www.instagram.com/';
    }
    if (post.platform === 'linkedin') {
      const a = account('linkedin'); if (!a) throw new Error('LinkedIn is not connected.');
      if (a.expires_at && fromSql(a.expires_at) < new Date()) throw new Error('LinkedIn access ran out (it lasts 60 days). Reconnect LinkedIn.');
      const h = { Authorization: `Bearer ${a.data.token}`, 'LinkedIn-Version': LI_VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' };
      let media = null;
      if (post.image_url) {
        const init = (await http('https://api.linkedin.com/rest/images?action=initializeUpload', { method: 'POST', headers: h, body: JSON.stringify({ initializeUploadRequest: { owner: a.data.person } }) }, 'LinkedIn image')).data.value;
        const img = await fetch(post.image_url); if (!img.ok) throw new Error(`Couldn't load the picture (${img.status}).`);
        await http(init.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${a.data.token}` }, body: Buffer.from(await img.arrayBuffer()) }, 'LinkedIn image upload');
        media = init.image;
      }
      const { res } = await http('https://api.linkedin.com/rest/posts', { method: 'POST', headers: h, body: JSON.stringify({
        author: a.data.person, commentary: liEscape(post.text), visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        ...(media ? { content: { media: { id: media, altText: 'Product picture' } } } : {}),
        lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
      }) }, 'LinkedIn post');
      const urn = res.headers.get('x-restli-id');
      return urn ? `https://www.linkedin.com/feed/update/${urn}/` : 'https://www.linkedin.com/feed/';
    }
    throw new Error('Unknown platform.');
  }

  async function publishOne(post) {
    run("UPDATE social_posts SET status = 'posting' WHERE id = ? AND status = 'approved'", post.id); // claim it: never twice
    try {
      const url = await publish(post);
      run("UPDATE social_posts SET status = 'posted', remote_url = ?, error = NULL, posted_at = datetime('now') WHERE id = ?", url, post.id);
      return { ok: true, url };
    } catch (e) {
      run("UPDATE social_posts SET status = 'failed', error = ? WHERE id = ?", String(e.message).slice(0, 500), post.id);
      console.error(`Social post ${post.id} (${post.platform}) failed:`, e.message);
      noteFailure(post, e.message).catch(() => {});
      return { ok: false, error: e.message };
    }
  }
  async function noteFailure(post, msg) {
    const s = getSettings();
    const today = new Date().toISOString().slice(0, 10);
    if (!mailer.enabled || s.social_fail_noted === today) return;
    run("INSERT INTO settings (key, value) VALUES ('social_fail_noted', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", today);
    await mailer.sendOwnerNote({
      to: s.notify_email || supportEmail(s), store: s.store_name, label: 'Social posts', heading: `A ${NAMES[post.platform]} post didn't go out`,
      message: `${msg}\n\nOpen the Social page to retry or fix the connection.`, ctaUrl: `${BASE_URL}/#/admin/social`, ctaLabel: 'Open Social',
      settingsUrl: `${BASE_URL}/#/admin/social`, siteUrl: BASE_URL, support: supportEmail(s), key: `social-fail-${today}`,
    });
  }

  let publishing = false;
  async function publishDue() {
    if (publishing) return;
    publishing = true;
    try {
      run("UPDATE social_posts SET status = 'expired' WHERE status = 'draft' AND scheduled_at < datetime('now')");
      run("UPDATE social_posts SET status = 'expired', error = 'Its time passed while it could not be posted.' WHERE status = 'approved' AND scheduled_at < datetime('now', '-12 hours')");
      for (const post of all("SELECT * FROM social_posts WHERE status = 'approved' AND scheduled_at <= datetime('now') ORDER BY scheduled_at LIMIT 8")) await publishOne(post);
    } finally { publishing = false; }
  }

  // ---------- writing posts ----------
  const productUrl = (p, platform) => `${BASE_URL}/p/${encodeURIComponent(p.slug)}?utm_source=${platform}&utm_medium=social&utm_campaign=autopost`;
  const imageFor = (p, s) => { const c = coversOf(p).find(x => !isVideoCover(x)); return c ? `${BASE_URL}/media/covers/${coverFile(c, 'og')}` : shareImage(s); };
  function pickProducts(n) {
    // Paid products most of the week, a free one now and then (they bring in new people). Least recently posted first.
    const rows = all(`SELECT p.*, (SELECT MAX(scheduled_at) FROM social_posts sp WHERE sp.product_id = p.id) AS last_post FROM products p
      WHERE p.published = 1 ORDER BY last_post IS NOT NULL, last_post, p.featured DESC, p.id DESC`);
    const paid = rows.filter(p => p.price_cents > 0), free = rows.filter(p => !p.price_cents);
    const out = [];
    let pi = 0, fi = 0;
    for (let i = 0; i < n; i++) {
      const useFree = free.length && (!paid.length || i === 2 || i === 5);
      if (useFree) out.push(free[fi++ % free.length]);
      else if (paid.length) out.push(paid[pi++ % paid.length]);
    }
    return out;
  }
  const SCHEMA = {
    type: 'object', additionalProperties: false, required: ['posts'],
    properties: { posts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['day', 'x', 'linkedin', 'facebook', 'instagram'],
      properties: { day: { type: 'integer' }, x: { type: 'string' }, linkedin: { type: 'string' }, facebook: { type: 'string' }, instagram: { type: 'string' } } } } },
  };
  async function writePosts(days, s) {
    const sale = s.announcement && s.announcement_style === 'promo' ? `${s.announcement_tag ? s.announcement_tag + ': ' : ''}${s.announcement}` : '';
    const brief = days.map((d, i) => ({
      day: i + 1, date: d.date.toISOString().slice(0, 10), product: d.product.title, free: !d.product.price_cents,
      subtitle: plain(d.product.subtitle), about: shortText(plain(d.product.description), 900),
    }));
    const system = `You write social media posts for an online store, ${s.store_name} (${BASE_URL.replace(/^https?:\/\//, '')}).
About the store and its voice: ${s.social_voice}

For each day you get one product. Write one post per platform about it, each in that platform's own style:
- x: under 230 characters. Punchy and conversational, one idea. At most one hashtag. No link (it is added after your text).
- linkedin: 60 to 160 words, first person from the founder, professional and warm. Open with a line that earns the click, share a useful point drawn from the product, end with a soft invitation. At most 3 hashtags at the end. No link (it is added after your text).
- facebook: 40 to 110 words, friendly and plain, a few emoji at most. No link (it is added after your text).
- instagram: 60 to 150 words, a strong first line, short paragraphs, end with "Link in bio" and 5 to 8 relevant hashtags. No links.

Vary the angle across the week: a problem it solves, a quick tip taken from it, who it is for, what is inside, a behind-the-scenes note. Do not open every post the same way.

Rules, because these posts must never mislead anyone:
- Only describe what the product details say is in it. Do not invent features, numbers, results, reviews, testimonials or statistics.
- No promises of outcomes such as getting a job, interviews, income or clients. Say what it helps with, not what it guarantees.
- No prices, no fake urgency or scarcity, no "limited spots".${sale ? `\n- There is a sale on right now; you may mention it once in some posts, exactly as worded: "${sale}"` : ''}
- Free products: say plainly that they are free to download.
- Write in plain English; no markdown, no asterisks for bold.`;
    const client = new (Anthropic.default || Anthropic)();
    let res;
    try {
      res = await client.beta.messages.create({
        model: MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system, messages: [{ role: 'user', content: `Write the posts for these ${days.length} days:\n${JSON.stringify(brief, null, 1)}` }],
      });
    } catch (e) {
      const A = Anthropic.default || Anthropic;
      if (e instanceof A.AuthenticationError) throw new Error('The Anthropic API key was not accepted. Check ANTHROPIC_API_KEY in Railway.');
      if (e instanceof A.RateLimitError) throw new Error('Anthropic is rate limiting right now. Try again in a few minutes.');
      if (e instanceof A.APIError) throw new Error(`Anthropic API error ${e.status}: ${e.message}`);
      throw e;
    }
    if (res.stop_reason === 'refusal') throw new Error('Claude declined to write these posts.');
    if (res.stop_reason === 'max_tokens') throw new Error('The posts came back cut off. Try again.');
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(text).posts;
  }
  const fitX = (text, link) => {
    const room = 280 - 24; // a link always counts as 23 characters, plus a space
    let t = String(text).trim();
    if (t.length > room) t = t.slice(0, room - 1).replace(/\s+\S*$/, '') + '…';
    return `${t} ${link}`;
  };
  function finalText(platform, text, p) {
    const t = String(text || '').trim();
    if (platform === 'x') return fitX(t, productUrl(p, 'x'));
    if (platform === 'instagram') return t.slice(0, 2150);
    return `${t}\n\n👉 ${productUrl(p, platform)}`;
  }

  let generating = false;
  async function generateWeek({ force = false } = {}) {
    const s = getSettings();
    const platforms = activePlatforms(s);
    if (generating) throw new Error('Already writing posts. Give it a minute.');
    if (!configured.ai()) throw new Error('Add ANTHROPIC_API_KEY in Railway first.');
    if (!platforms.length) throw new Error('Connect at least one account first.');
    generating = true;
    try {
      const hour = Math.min(Math.max(Number(s.social_hour) || 10, 0), 23);
      const last = one("SELECT MAX(scheduled_at) AS t FROM social_posts WHERE status IN ('draft', 'approved', 'posted')").t;
      const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() + 1);
      if (last && fromSql(last) >= start) { const l = fromSql(last); l.setUTCHours(0, 0, 0, 0); l.setUTCDate(l.getUTCDate() + 1); start.setTime(l.getTime()); }
      if (!force && start > new Date(Date.now() + 3 * 864e5)) return { created: 0 }; // 3+ days still queued
      const products = pickProducts(7);
      if (!products.length) throw new Error('Publish some products first.');
      const days = products.map((product, i) => ({ product, date: new Date(start.getTime() + i * 864e5) }));
      const posts = await writePosts(days, s);
      let created = 0;
      for (const d of posts) {
        const day = days[d.day - 1]; if (!day) continue;
        for (const platform of platforms) {
          if (!String(d[platform] || '').trim()) continue;
          const at = new Date(day.date); at.setUTCHours(hour - 1, STAGGER[platform], 0, 0); // WAT is UTC+1
          run('INSERT INTO social_posts (platform, product_id, text, image_url, link, scheduled_at) VALUES (?, ?, ?, ?, ?, ?)',
            platform, day.product.id, finalText(platform, d[platform], day.product), imageFor(day.product, s), productUrl(day.product, platform), sqlTime(at));
          created++;
        }
      }
      if (created && mailer.enabled) {
        await mailer.sendOwnerNote({
          to: s.notify_email || supportEmail(s), store: s.store_name, label: 'Social posts', heading: `${created} posts are ready for you to approve`,
          message: `Next week's posts for ${platforms.map(p => NAMES[p]).join(', ')} are written. Skim them, edit anything you like, and approve. Only approved posts go out; the rest are skipped.`,
          ctaUrl: `${BASE_URL}/#/admin/social`, ctaLabel: 'Review the posts', settingsUrl: `${BASE_URL}/#/admin/social`, siteUrl: BASE_URL, support: supportEmail(s),
          key: `social-ready-${sqlTime(start).slice(0, 10)}`,
        }).catch(e => console.error('Social note failed:', e.message));
      }
      return { created };
    } finally { generating = false; }
  }
  async function autoGenerate() {
    const s = getSettings();
    if (generating || s.social_enabled === '0' || !configured.ai() || !activePlatforms(s).length) return;
    const r = await generateWeek();
    if (r.created) console.log(`Social: wrote ${r.created} posts`);
  }

  // ---------- the Social page ----------
  admin.get('/social', (_req, res) => {
    const s = getSettings();
    const accounts = Object.fromEntries(all('SELECT platform, name, expires_at, connected_at, data FROM social_accounts').map(a => {
      const d = JSON.parse(a.data || '{}');
      return [a.platform, { name: a.name, expires_at: a.platform === 'linkedin' ? a.expires_at : null, connected_at: a.connected_at,
        ...(a.platform === 'facebook' ? { page_id: d.page_id, pages: (d.pages || []).map(p => ({ id: p.id, name: p.name, ig: p.ig?.username || null })) } : {}) }];
    }));
    res.json({
      ready: { ai: configured.ai(), meta: configured.meta(), linkedin: configured.linkedin(), x: configured.x(), email: mailer.enabled },
      redirects: { meta: redirectUri('meta'), linkedin: redirectUri('linkedin'), x: redirectUri('x') },
      accounts,
      settings: { social_enabled: s.social_enabled, social_hour: s.social_hour, social_platforms: s.social_platforms, social_voice: s.social_voice },
      queue: all(`SELECT sp.*, p.title AS product FROM social_posts sp LEFT JOIN products p ON p.id = sp.product_id
        WHERE sp.status IN ('draft', 'approved', 'posting', 'failed') AND sp.scheduled_at >= datetime('now', '-2 days') ORDER BY sp.scheduled_at, sp.platform`),
      history: all(`SELECT sp.id, sp.platform, sp.status, sp.scheduled_at, sp.posted_at, sp.remote_url, sp.error, p.title AS product FROM social_posts sp
        LEFT JOIN products p ON p.id = sp.product_id WHERE sp.status IN ('posted', 'expired', 'skipped') ORDER BY sp.scheduled_at DESC LIMIT 40`),
    });
  });
  admin.put('/social/posts/:id', (req, res) => {
    const post = one('SELECT * FROM social_posts WHERE id = ?', req.params.id);
    if (!post) return bad(res, 'Not found', 404);
    if (['posted', 'posting'].includes(post.status)) return bad(res, 'That post already went out.');
    const b = req.body || {};
    const text = b.text != null ? String(b.text).replace(/\r\n/g, '\n').trim().slice(0, 3000) : post.text;
    if (!text) return bad(res, 'The post is empty.');
    if (post.platform === 'x' && xLength(text) > 280) return bad(res, 'X posts can be at most 280 characters (each link counts as 23).');
    const status = ['draft', 'approved', 'skipped'].includes(b.status) ? b.status : post.status === 'failed' ? 'approved' : post.status;
    run('UPDATE social_posts SET text = ?, status = ?, error = NULL WHERE id = ?', text, status, post.id);
    res.json({ ok: true });
  });
  admin.post('/social/approve-all', (_req, res) => {
    const n = run("UPDATE social_posts SET status = 'approved' WHERE status = 'draft' AND scheduled_at > datetime('now')").changes;
    res.json({ ok: true, approved: Number(n) });
  });
  admin.post('/social/posts/:id/publish', wrap(async (req, res) => {
    const post = one('SELECT * FROM social_posts WHERE id = ?', req.params.id);
    if (!post) return bad(res, 'Not found', 404);
    if (['posted', 'posting'].includes(post.status)) return bad(res, 'That post already went out.');
    run("UPDATE social_posts SET status = 'approved' WHERE id = ?", post.id);
    const r = await publishOne({ ...post, status: 'approved' });
    r.ok ? res.json(r) : bad(res, r.error);
  }));
  admin.post('/social/generate', wrap(async (_req, res) => {
    try { res.json(await generateWeek({ force: true })); } catch (e) { bad(res, e.message); }
  }));

  setInterval(() => publishDue().catch(e => console.error('Social publish:', e.message)), Number(process.env.SOCIAL_PUBLISH_SECONDS || 120) * 1000).unref();
  setInterval(() => autoGenerate().catch(e => console.error('Social generate:', e.message)), Number(process.env.SOCIAL_GENERATE_SECONDS || 3600) * 1000).unref();
  return { generateWeek, publishDue, publish: publishOne };
};
