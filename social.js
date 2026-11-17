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
//   PINTEREST_APP_ID, PINTEREST_APP_SECRET
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET (+ TIKTOK_VERIFY_FILE / TIKTOK_VERIFY_CONTENT for TikTok's link check)
// TikTok gets photo posts: the post's card or product cover, with the Instagram caption minus hashtags.
// Besides the morning product post there is an evening post each day: a research question for one of the store's
// audiences (what frustrates them, what they repeat, what they'd pay to simplify) or a useful tip / short how-to
// taken from a product, as a teaser for the full product.
// Each platform's app must allow the redirect URL  <BASE_URL>/api/social/callback/<meta|linkedin|x>
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { renderCard } = require('./cards');

const PLATFORMS = ['x', 'linkedin', 'facebook', 'instagram', 'pinterest', 'tiktok'];
const NAMES = { x: 'X', linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', pinterest: 'Pinterest', tiktok: 'TikTok' };
const STAGGER = { x: 0, linkedin: 10, facebook: 20, instagram: 30, pinterest: 40, tiktok: 50 }; // minutes after the posting hour
const FEATURED = 'Grab it from the Featured section on my profile.';
const AUDIENCES = ['freelancers', 'job seekers', 'graphic designers and creatives', 'small business owners', 'content creators', 'parents and teachers'];
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}`;
const LI_VERSION = process.env.LINKEDIN_VERSION || '202605';
const MODEL = process.env.SOCIAL_MODEL || 'claude-opus-5-5';

const env = k => process.env[k] || '';
const configured = {
  ai: () => !!env('ANTHROPIC_API_KEY'),
  meta: () => !!(env('META_APP_ID') && env('META_APP_SECRET')),
  linkedin: () => !!(env('LINKEDIN_CLIENT_ID') && env('LINKEDIN_CLIENT_SECRET')),
  x: () => !!(env('X_CLIENT_ID') && env('X_CLIENT_SECRET')),
  pinterest: () => !!(env('PINTEREST_APP_ID') && env('PINTEREST_APP_SECRET')),
  tiktok: () => !!(env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET')),
};
const TT_API = 'https://open.tiktokapis.com/v2';
// X counts every link as 23 characters, however long it is.
const xLength = t => String(t).replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
const sqlTime = d => d.toISOString().slice(0, 19).replace('T', ' ');
const fromSql = s => new Date(String(s).replace(' ', 'T') + 'Z');

module.exports = function setupSocial({ DATA_DIR, COVERS_DIR, PUBLIC_DIR, app, admin, one, all, run, getSettings, BASE_URL, mailer, coversOf, coverFile, isVideoCover, plain, shortText, shareImage, supportEmail, wrap, bad }) {
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
      const code = data.error?.code && data.error.code !== 'ok' ? ` [${data.error.code}]` : '';
      const msg = (data.error?.message ? data.error.message + code : '') || data.error_description || data.detail || data.message || data.title || (typeof data.error === 'string' ? data.error : '') || data.raw || res.statusText;
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
      return res.json({ url: `https://x.com/i/oauth2/authorize?${form({ response_type: 'code', client_id: env('X_CLIENT_ID'), redirect_uri: redirectUri('x'), scope: 'tweet.read tweet.write users.read media.write offline.access', state, code_challenge: challenge, code_challenge_method: 'S256' })}` });
    }
    if (p === 'tiktok') {
      if (!configured.tiktok()) return bad(res, 'Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Railway first.');
      run('INSERT INTO social_oauth (state, platform) VALUES (?, ?)', state, p);
      return res.json({ url: `https://www.tiktok.com/v2/auth/authorize/?${form({ client_key: env('TIKTOK_CLIENT_KEY'), redirect_uri: redirectUri('tiktok'), response_type: 'code', scope: 'user.info.basic,video.publish', state })}` });
    }
    if (p === 'pinterest') {
      if (!configured.pinterest()) return bad(res, 'Add PINTEREST_APP_ID and PINTEREST_APP_SECRET in Railway first.');
      run('INSERT INTO social_oauth (state, platform) VALUES (?, ?)', state, p);
      return res.json({ url: `https://www.pinterest.com/oauth/?${form({ client_id: env('PINTEREST_APP_ID'), redirect_uri: redirectUri('pinterest'), response_type: 'code', scope: 'boards:read,boards:write,pins:read,pins:write,user_accounts:read', state })}` });
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
      else if (p === 'pinterest') await connectPinterest(code);
      else if (p === 'tiktok') await connectTikTok(code);
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

  // Pinterest: pins go to a board called after the store (made on first connect if it doesn't exist).
  const PIN_API = 'https://api.pinterest.com/v5';
  const pinBasic = () => 'Basic ' + Buffer.from(`${env('PINTEREST_APP_ID')}:${env('PINTEREST_APP_SECRET')}`).toString('base64');
  async function connectPinterest(code) {
    const tok = (await http(`${PIN_API}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: pinBasic() },
      body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri('pinterest') }) }, 'Pinterest sign-in')).data;
    const h = { Authorization: `Bearer ${tok.access_token}` };
    const me = (await http(`${PIN_API}/user_account`, { headers: h }, 'Pinterest profile')).data;
    const name = getSettings().store_name || 'Carsin Store';
    const boards = (await http(`${PIN_API}/boards?page_size=100`, { headers: h }, 'Pinterest boards')).data.items || [];
    let board = boards.find(b => b.name.toLowerCase() === name.toLowerCase()) || boards.find(b => /carsin/i.test(b.name));
    if (!board) board = (await http(`${PIN_API}/boards`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: 'Templates, guides, video courses and printables from ' + name, privacy: 'PUBLIC' }) }, 'Pinterest board')).data;
    saveAccount('pinterest', { token: tok.access_token, refresh: tok.refresh_token, board_id: board.id, board: board.name, username: me.username },
      '@' + me.username + ' · ' + board.name, sqlTime(new Date(Date.now() + (Number(tok.expires_in) || 2592000) * 1000)));
  }
  async function pinterestToken() {
    const a = account('pinterest');
    if (!a) throw new Error('Pinterest is not connected.');
    if (a.expires_at && fromSql(a.expires_at) > new Date(Date.now() + 3600e3)) return a;
    if (!a.data.refresh) throw new Error('Pinterest needs reconnecting.');
    const tok = (await http(`${PIN_API}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: pinBasic() },
      body: form({ grant_type: 'refresh_token', refresh_token: a.data.refresh }) }, 'Pinterest token refresh')).data;
    const data = { ...a.data, token: tok.access_token, refresh: tok.refresh_token || a.data.refresh };
    saveAccount('pinterest', data, a.name, sqlTime(new Date(Date.now() + (Number(tok.expires_in) || 2592000) * 1000)));
    return { ...a, data };
  }

  // TikTok: tokens last a day and refresh for a year.
  async function ttTokenRequest(params, what) {
    const r = (await http(`${TT_API}/oauth/token/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), ...params }) }, what)).data;
    if (r.error && r.error !== 'ok') throw new Error(`${what} failed: ${r.error_description || r.error}`);
    return r;
  }
  async function connectTikTok(code) {
    const tok = await ttTokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri('tiktok') }, 'TikTok sign-in');
    const me = (await http(`${TT_API}/user/info/?fields=open_id,display_name`, { headers: { Authorization: `Bearer ${tok.access_token}` } }, 'TikTok profile')).data.data?.user || {};
    saveAccount('tiktok', { token: tok.access_token, refresh: tok.refresh_token, open_id: tok.open_id }, me.display_name || 'TikTok',
      sqlTime(new Date(Date.now() + (Number(tok.expires_in) || 86400) * 1000)));
  }
  async function tiktokToken() {
    const a = account('tiktok');
    if (!a) throw new Error('TikTok is not connected.');
    if (a.expires_at && fromSql(a.expires_at) > new Date(Date.now() + 600e3)) return a;
    const tok = await ttTokenRequest({ grant_type: 'refresh_token', refresh_token: a.data.refresh }, 'TikTok token refresh');
    const data = { ...a.data, token: tok.access_token, refresh: tok.refresh_token || a.data.refresh };
    saveAccount('tiktok', data, a.name, sqlTime(new Date(Date.now() + (Number(tok.expires_in) || 86400) * 1000)));
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
      // Attach the picture when there is one. Needs the media.write permission (reconnect X once to grant it);
      // without it the post still goes out as text.
      let media = null;
      if (post.image_url) {
        try {
          const img = await fetch(post.image_url);
          if (img.ok) {
            const fd = new FormData();
            fd.append('media', new Blob([Buffer.from(await img.arrayBuffer())], { type: img.headers.get('content-type') || 'image/jpeg' }), 'image.jpg');
            fd.append('media_category', 'tweet_image');
            const up = (await http('https://api.x.com/2/media/upload', { method: 'POST', headers: { Authorization: `Bearer ${a.data.token}` }, body: fd }, 'X image upload')).data;
            media = up.data?.id || up.media_id_string || null;
          }
        } catch (e) { console.error('X image upload skipped:', e.message); }
      }
      const r = (await http('https://api.x.com/2/tweets', { method: 'POST', headers: { Authorization: `Bearer ${a.data.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: post.text, ...(media ? { media: { media_ids: [String(media)] } } : {}) }) }, 'X post')).data;
      return `https://x.com/${a.data.username}/status/${r.data.id}`;
    }
    if (post.platform === 'tiktok') {
      const a = await tiktokToken();
      if (!post.image_url) throw new Error('TikTok photo posts need a picture.');
      const h = { Authorization: `Bearer ${a.data.token}`, 'Content-Type': 'application/json; charset=UTF-8' };
      // Until TikTok approves the app (then set TIKTOK_APPROVED=1), only private (SELF_ONLY) posts are allowed.
      // After approval, use the most public level the account offers.
      const info = (await http(`${TT_API}/post/publish/creator_info/query/`, { method: 'POST', headers: h, body: '{}' }, 'TikTok account check')).data.data || {};
      const levels = info.privacy_level_options || ['SELF_ONLY'];
      const privacy = env('TIKTOK_APPROVED') === '1'
        ? ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'].find(l => levels.includes(l)) || levels[0]
        : 'SELF_ONLY';
      const r = (await http(`${TT_API}/post/publish/content/init/`, { method: 'POST', headers: h, body: JSON.stringify({
        post_info: { title: String(post.title || '').slice(0, 90), description: String(post.text).slice(0, 4000), privacy_level: privacy, disable_comment: false, auto_add_music: true },
        source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: [post.image_url] },
        post_mode: 'DIRECT_POST', media_type: 'PHOTO',
      }) }, 'TikTok post')).data;
      if (r.error && r.error.code && r.error.code !== 'ok') throw new Error(`TikTok post failed: ${r.error.message || r.error.code}`);
      return `https://www.tiktok.com/${privacy === 'SELF_ONLY' ? '?private_post=' : '?post='}${r.data?.publish_id || ''}`;
    }
    if (post.platform === 'pinterest') {
      const a = await pinterestToken();
      if (!post.image_url) throw new Error('Pins need a picture.');
      const r = (await http(`${PIN_API}/pins`, { method: 'POST', headers: { Authorization: `Bearer ${a.data.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_id: a.data.board_id, title: String(post.title || '').slice(0, 100), description: String(post.text).slice(0, 500),
          link: post.link || undefined, alt_text: String(post.title || '').slice(0, 500), media_source: { source_type: 'image_url', url: post.image_url } }) }, 'Pinterest pin')).data;
      return `https://www.pinterest.com/pin/${r.id}/`;
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
    properties: { posts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['day', 'x', 'linkedin', 'facebook', 'instagram', 'pinterest_title', 'pinterest'],
      properties: { day: { type: 'integer' }, x: { type: 'string' }, linkedin: { type: 'string' }, facebook: { type: 'string' }, instagram: { type: 'string' },
        pinterest_title: { type: 'string' }, pinterest: { type: 'string' } } } } },
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
- x: under 230 characters. Punchy and conversational, one idea. No hashtags. No link (it is added after your text).
- linkedin: 60 to 160 words, first person from the founder, professional and warm. Open with a line that earns the click, share a useful point drawn from the product, end by telling people to grab it from the Featured section on your profile. No hashtags. No link.
- facebook: 40 to 110 words, friendly and plain, a few emoji at most. No hashtags. No link (it is added after your text).
- instagram: 60 to 150 words, a strong first line, short paragraphs, end with "Link in bio" and 5 to 8 relevant hashtags. No links.
- pinterest_title: up to 90 characters, search-friendly, says what it is and who it helps.
- pinterest: 150 to 400 characters, a keyword-rich description of what's inside and who it's for. No hashtags, no link.

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
  // X posts carry no visible link: link previews don't always show, so product and tip posts end with
  // "Link in bio" and go out with the picture attached instead.
  const BIO = 'Link in bio.';
  const fitX = text => {
    let t = String(text).replace(/\s*https?:\/\/\S+/g, '').trim();
    if (/link in bio/i.test(t)) return t.slice(0, 280);
    const room = 280 - BIO.length - 2;
    if (t.length > room) t = t.slice(0, room - 1).replace(/\s+\S*$/, '') + '…';
    return `${t}\n\n${BIO}`;
  };
  // Hashtags only on Instagram: removed from every other platform's text, whatever the writer returns.
  const stripTags = s => String(s)
    .replace(/(?<=^|[\s(])#[\p{L}][\p{L}\p{N}_]*/gu, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Product posts get the product link (X and Facebook), LinkedIn points to the Featured section instead.
  // Question posts get no link at all.
  function finalText(platform, text, p) {
    const t = platform === 'instagram' ? String(text || '').trim() : stripTags(text || '');
    if (!p) return platform === 'x' ? t.slice(0, 280) : t;
    if (platform === 'x') return fitX(t);
    if (platform === 'instagram') return t.slice(0, 2150);
    if (platform === 'tiktok') return t.slice(0, 2200);
    if (platform === 'pinterest') return t.slice(0, 500);
    if (platform === 'linkedin') return /featured/i.test(t) ? t : `${t}\n\n${FEATURED}`;
    return `${t}\n\n👉 ${productUrl(p, platform)}`;
  }
  for (const post of all("SELECT id, text FROM social_posts WHERE platform != 'instagram' AND status IN ('draft', 'approved', 'failed') AND text LIKE '%#%'")) {
    const clean = stripTags(post.text);
    if (clean !== post.text) run('UPDATE social_posts SET text = ? WHERE id = ?', clean, post.id);
  }
  // Older X drafts carried the product link; switch them to "Link in bio".
  for (const post of all("SELECT id, text FROM social_posts WHERE platform = 'x' AND status IN ('draft', 'approved', 'failed') AND text LIKE '%http%'")) {
    run('UPDATE social_posts SET text = ? WHERE id = ?', fitX(post.text), post.id);
  }
  // X evening drafts made before X got pictures: give them the same card as that evening's LinkedIn post.
  for (const post of all(`SELECT x.id, (SELECT l.image_url FROM social_posts l WHERE l.slot = 'evening' AND l.platform = 'linkedin'
      AND substr(l.scheduled_at, 1, 10) = substr(x.scheduled_at, 1, 10) AND l.image_url LIKE '%/media/social/%' LIMIT 1) AS card
      FROM social_posts x WHERE x.platform = 'x' AND x.slot = 'evening' AND x.status IN ('draft', 'approved') AND (x.image_url IS NULL OR x.image_url NOT LIKE '%/media/social/%')`)) {
    if (post.card) run('UPDATE social_posts SET image_url = ? WHERE id = ?', post.card, post.id);
  }
  // Older LinkedIn drafts carried the product link; switch them to the Featured section line.
  for (const post of all("SELECT id, text FROM social_posts WHERE platform = 'linkedin' AND status IN ('draft', 'approved') AND text LIKE '%👉 http%'")) {
    run('UPDATE social_posts SET text = ? WHERE id = ?', post.text.replace(/\n*👉 https?:\/\/\S+\s*$/, '').trim() + '\n\n' + FEATURED, post.id);
  }

  // ---------- evening posts: research questions and tips ----------
  const EVENING_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['posts'],
    properties: { posts: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['day', 'x', 'linkedin', 'facebook', 'instagram', 'pinterest_title', 'pinterest', 'morning_pinterest_title', 'morning_pinterest', 'card_title', 'card_points'],
      properties: { day: { type: 'integer' }, x: { type: 'string' }, linkedin: { type: 'string' }, facebook: { type: 'string' }, instagram: { type: 'string' },
        card_title: { type: 'string' }, card_points: { type: 'array', items: { type: 'string' } },
        pinterest_title: { type: 'string' }, pinterest: { type: 'string' }, morning_pinterest_title: { type: 'string' }, morning_pinterest: { type: 'string' } } } } },
  };
  async function claudeJson(system, user, schema) {
    const client = new (Anthropic.default || Anthropic)();
    let res;
    try {
      res = await client.beta.messages.create({
        model: MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
        system, messages: [{ role: 'user', content: user }],
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
    return JSON.parse(res.content.filter(b => b.type === 'text').map(b => b.text).join('')).posts;
  }
  async function writeEvenings(days, s) {
    const brief = days.map((d, i) => ({
      day: i + 1, date: d.date, kind: d.kind,
      ...(d.kind === 'question' ? { audience: d.audience } : { product: d.tip.title, free: !d.tip.price_cents, subtitle: plain(d.tip.subtitle), about: shortText(plain(d.tip.description), 1200) }),
      ...(d.morning ? { morning_product: d.morning.title, morning_about: shortText(plain(d.morning.subtitle) || plain(d.morning.description), 400) } : {}),
    }));
    const system = `You write evening social media posts for ${s.store_name} (${BASE_URL.replace(/^https?:\/\//, '')}). They are not adverts: they build trust and conversation.
About the store and its voice: ${s.social_voice}

Each day is one of two kinds:
- question: a research question for the given audience, to learn what they struggle with. Ask about their frustrations, the repetitive tasks they hate, what slows them down, what they would happily pay to have done or automated, what they wish someone had told them. One clear question, with one or two warm lines of context from shared experience. Invite replies in the comments. Never ask what product they want, never mention the store or any product, no link, no selling.
- tip: a genuinely useful tip or a short step-by-step (3 to 5 numbered steps) drawn only from the given product's details, as a teaser. Give real value, then say the full version is in the product, by name. Do not invent steps, numbers or claims that the product details don't support.

Platform styles:
- x: under 230 characters (tip) or under 270 (question). Conversational. No hashtags. No link (added after tips automatically).
- linkedin: 60 to 170 words, first person from the founder. For tips, end by saying the full version is in the Featured section on your profile. No hashtags. No link.
- facebook: 40 to 120 words, friendly. No hashtags. No link.
- instagram: tips: 60 to 150 words, end with "Link in bio" and 5 to 8 hashtags. Questions: 40 to 120 words inviting answers in the comments, with 3 to 6 hashtags at the end, no "link in bio".
- card_title / card_points: the text for the post's image card. Questions: card_title is the question itself, at most 110 characters, card_points is an empty list. Tips: card_title is a short headline (at most 70 characters) and card_points are the 3 to 5 steps, each at most 90 characters, written to be read at a glance.
- pinterest_title / pinterest: tips only: a how-to title up to 90 characters and a 150 to 400 character description. For questions return empty strings.
- morning_pinterest_title / morning_pinterest: if the day has a morning_product, a search-friendly pin title (up to 90 characters) and description (150 to 400 characters) for that product; otherwise empty strings.

Rules: no invented results, numbers, reviews or statistics; no promises of jobs, income or clients; no prices; no fake urgency. Plain English, no markdown, no asterisks.`;
    return claudeJson(system, `Write the evening posts for these ${days.length} days:\n${JSON.stringify(brief, null, 1)}`, EVENING_SCHEMA);
  }
  // ---------- image cards ----------
  const CARD_DIR = path.join(DATA_DIR, 'social-cards');
  const coverFileOf = p => { const c = p && coversOf(p).find(x => !isVideoCover(x)); return c ? path.join(COVERS_DIR, c) : null; };
  const labelFor = d => (d.kind === 'question' ? `For ${d.audience || 'you'}` : 'Quick tip');
  async function saveCard(spec, size, tag) {
    fs.mkdirSync(CARD_DIR, { recursive: true });
    const name = `${tag}-${crypto.randomBytes(6).toString('hex')}.jpg`;
    fs.writeFileSync(path.join(CARD_DIR, name), await renderCard({ ...spec, publicDir: PUBLIC_DIR, site: BASE_URL.replace(/^https?:\/\//, '') }, size));
    return `${BASE_URL}/media/social/${name}`;
  }
  async function makeCards(d, e, p, platforms) {
    if (!String(e.card_title || '').trim()) return {};
    const spec = { kind: d.kind, label: labelFor(d), title: e.card_title, points: e.card_points || [], product: p ? { title: p.title, coverFile: coverFileOf(p) } : null };
    const tag = `${d.date}-${d.kind}`;
    return {
      square: await saveCard(spec, { width: 1080, height: 1350 }, tag),
      tall: d.kind === 'tip' && platforms.includes('pinterest') ? await saveCard(spec, { width: 1000, height: 1500 }, tag + '-pin') : null,
    };
  }
  // Evening posts written before cards existed: write card text (and Instagram copy) for them, draw the cards,
  // and put them on LinkedIn, Facebook and Instagram. Runs once per day that needs it.
  const CARD_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['posts'],
    properties: { posts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['day', 'card_title', 'card_points', 'instagram'],
      properties: { day: { type: 'integer' }, card_title: { type: 'string' }, card_points: { type: 'array', items: { type: 'string' } }, instagram: { type: 'string' } } } } },
  };
  async function cardify() {
    const s = getSettings();
    const platforms = activePlatforms(s);
    const days = all(`SELECT substr(scheduled_at, 1, 10) AS day, MAX(kind) AS kind, MAX(product_id) AS product_id FROM social_posts
      WHERE slot = 'evening' AND status IN ('draft', 'approved') AND scheduled_at > datetime('now', '+10 minutes') GROUP BY day ORDER BY day`)
      .filter(d => !one(`SELECT 1 FROM social_posts WHERE slot = 'evening' AND substr(scheduled_at, 1, 10) = ? AND image_url LIKE '%/media/social/%'`, d.day)
        || (platforms.includes('tiktok') && !one("SELECT 1 FROM social_posts WHERE slot = 'evening' AND platform = 'tiktok' AND substr(scheduled_at, 1, 10) = ?", d.day)));
    if (!days.length) return 0;
    const brief = days.map((d, i) => {
      const x = one("SELECT text FROM social_posts WHERE slot = 'evening' AND platform IN ('linkedin', 'x', 'facebook') AND substr(scheduled_at, 1, 10) = ? ORDER BY platform = 'linkedin' DESC LIMIT 1", d.day);
      const p = d.product_id && one('SELECT title, subtitle, description FROM products WHERE id = ?', d.product_id);
      return { day: i + 1, kind: d.kind, existing_post: String(x?.text || '').replace(/https?:\/\/\S+/g, '').slice(0, 1500),
        ...(p ? { product: p.title, about: shortText(plain(p.subtitle) || plain(p.description), 600) } : {}) };
    });
    const system = `You prepare image cards for evening social posts of ${s.store_name} that were already written.
For each day, read the existing post and return:
- card_title: questions: the question itself, at most 110 characters. Tips: a short headline, at most 70 characters.
- card_points: tips: the 3 to 5 steps from the post, each at most 90 characters, readable at a glance. Questions: an empty list.
- instagram: an Instagram caption for the same post. Tips: 60 to 150 words ending with "Link in bio" and 5 to 8 hashtags. Questions: 40 to 120 words inviting answers in the comments, with 3 to 6 hashtags.
Keep exactly to what the existing post says. Plain English, no markdown.`;
    const res = await claudeJson(system, `Days:\n${JSON.stringify(brief, null, 1)}`, CARD_SCHEMA);
    let changed = 0;
    for (const e of res) {
      const d = days[e.day - 1]; if (!d) continue;
      const p = d.product_id ? one('SELECT * FROM products WHERE id = ?', d.product_id) : null;
      const audience = d.kind === 'question' ? (AUDIENCES.find(a => brief[e.day - 1].existing_post.toLowerCase().includes(a.split(' ')[0])) || 'you') : null;
      const cards = await makeCards({ date: d.day, kind: d.kind, audience }, e, p, platforms);
      if (!cards.square) continue;
      changed += Number(run(`UPDATE social_posts SET image_url = ? WHERE slot = 'evening' AND substr(scheduled_at, 1, 10) = ? AND platform IN ('x', 'linkedin', 'facebook', 'instagram') AND status IN ('draft', 'approved')`, cards.square, d.day).changes);
      if (cards.tall) run(`UPDATE social_posts SET image_url = ? WHERE slot = 'evening' AND substr(scheduled_at, 1, 10) = ? AND platform = 'pinterest' AND status IN ('draft', 'approved')`, cards.tall, d.day);
      const hasTt = one("SELECT 1 FROM social_posts WHERE slot = 'evening' AND platform = 'tiktok' AND substr(scheduled_at, 1, 10) = ?", d.day);
      if (platforms.includes('tiktok') && !hasTt && String(e.instagram || '').trim()) {
        const hour = Math.min(Math.max(Number(s.social_evening_hour) || 19, 0), 23);
        run(`INSERT INTO social_posts (platform, product_id, text, title, image_url, link, scheduled_at, slot, kind) VALUES ('tiktok', ?, ?, ?, ?, ?, ?, 'evening', ?)`,
          p?.id ?? null, finalText('tiktok', e.instagram, p), String(e.card_title || '').slice(0, 90), cards.square, p ? productUrl(p, 'tiktok') : null, sqlTime(atHour(d.day, hour, 'tiktok')), d.kind);
        changed++;
      }
      const hasIg = one("SELECT 1 FROM social_posts WHERE slot = 'evening' AND platform = 'instagram' AND substr(scheduled_at, 1, 10) = ?", d.day);
      if (platforms.includes('instagram') && !hasIg && String(e.instagram || '').trim()) {
        const hour = Math.min(Math.max(Number(s.social_evening_hour) || 19, 0), 23);
        run(`INSERT INTO social_posts (platform, product_id, text, image_url, link, scheduled_at, slot, kind) VALUES ('instagram', ?, ?, ?, ?, ?, 'evening', ?)`,
          p?.id ?? null, finalText('instagram', e.instagram, p), cards.square, p ? productUrl(p, 'instagram') : null, sqlTime(atHour(d.day, hour, 'instagram')), d.kind);
        changed++;
      }
    }
    return changed;
  }
  admin.post('/social/cards', wrap(async (_req, res) => {
    if (!configured.ai()) return bad(res, 'Add ANTHROPIC_API_KEY in Railway first.');
    if (generating) return bad(res, 'Already writing posts. Give it a minute.');
    generating = true;
    try { res.json({ updated: await cardify() }); } catch (e) { bad(res, e.message); } finally { generating = false; }
  }));

  const atHour = (day, hour, platform) => { const at = new Date(day + 'T00:00:00Z'); at.setUTCHours(hour - 1, STAGGER[platform], 0, 0); return at; }; // WAT is UTC+1
  // Adds evening posts (and Pinterest pins for the morning product) to every upcoming day that has a morning post but
  // no evening one yet. Alternates tips and questions; tips use a different product from that morning's.
  async function fillEvenings() {
    const s = getSettings();
    const platforms = activePlatforms(s);
    if (s.social_evening === '0' || !platforms.length) return 0;
    const hour = Math.min(Math.max(Number(s.social_evening_hour) || 19, 0), 23);
    const morningHour = Math.min(Math.max(Number(s.social_hour) || 10, 0), 23);
    const days = all(`SELECT substr(scheduled_at, 1, 10) AS day, MIN(product_id) AS product_id FROM social_posts
      WHERE slot = 'morning' AND status IN ('draft', 'approved') GROUP BY day ORDER BY day`)
      .filter(d => atHour(d.day, hour, 'x') > new Date(Date.now() + 15 * 60e3))
      .filter(d => !one("SELECT 1 FROM social_posts WHERE slot = 'evening' AND substr(scheduled_at, 1, 10) = ?", d.day));
    if (!days.length) return 0;
    const pool = pickProducts(14);
    const past = one("SELECT COUNT(*) AS n FROM social_posts WHERE slot = 'evening' AND platform = 'x'").n;
    const plan = days.map((d, i) => {
      const n = past + i;
      const morning = one('SELECT * FROM products WHERE id = ?', d.product_id);
      const needPin = platforms.includes('pinterest') && morning && !one("SELECT 1 FROM social_posts WHERE platform = 'pinterest' AND slot = 'morning' AND substr(scheduled_at, 1, 10) = ?", d.day);
      if (n % 2 === 1) return { date: d.day, kind: 'question', audience: AUDIENCES[Math.floor(n / 2) % AUDIENCES.length], morning: needPin ? morning : null };
      const tip = pool.find(p => p.id !== d.product_id && !days.some((x, j) => j < i && x.tipId === p.id)) || pool[0];
      d.tipId = tip.id;
      return { date: d.day, kind: 'tip', tip, morning: needPin ? morning : null };
    });
    const posts = await writeEvenings(plan, s);
    let created = 0;
    for (const e of posts) {
      const d = plan[e.day - 1]; if (!d) continue;
      const p = d.kind === 'tip' ? d.tip : null;
      const cards = await makeCards(d, e, p, platforms).catch(err => { console.error('Card failed:', err.message); return {}; });
      e.tiktok = e.instagram;
      for (const platform of platforms) {
        const text = String(e[platform] || '').trim();
        if (!text) continue;
        if (d.kind === 'question' && platform === 'pinterest') continue;
        if (['instagram', 'tiktok'].includes(platform) && !cards.square && !p) continue; // these need a picture
        const image = platform === 'pinterest' ? (cards.tall || (p && imageFor(p, s))) : (cards.square || (p ? imageFor(p, s) : null));
        run(`INSERT INTO social_posts (platform, product_id, text, title, image_url, link, scheduled_at, slot, kind) VALUES (?, ?, ?, ?, ?, ?, ?, 'evening', ?)`,
          platform, p?.id ?? null, finalText(platform, text, p), platform === 'pinterest' ? String(e.pinterest_title || p?.title || '').slice(0, 100) : platform === 'tiktok' ? String(e.card_title || p?.title || '').slice(0, 90) : null,
          image, p ? productUrl(p, platform) : null, sqlTime(atHour(d.date, hour, platform)), d.kind);
        created++;
      }
      if (d.morning && String(e.morning_pinterest || '').trim()) {
        run(`INSERT INTO social_posts (platform, product_id, text, title, image_url, link, scheduled_at, slot, kind) VALUES ('pinterest', ?, ?, ?, ?, ?, ?, 'morning', 'product')`,
          d.morning.id, finalText('pinterest', e.morning_pinterest, d.morning), String(e.morning_pinterest_title || d.morning.title).slice(0, 100),
          imageFor(d.morning, s), productUrl(d.morning, 'pinterest'), sqlTime(atHour(d.date, morningHour, 'pinterest')));
        created++;
      }
    }
    return created;
  }

  // Morning posts written before an account was connected: write that platform's post for the same product, for
  // today and every upcoming day. A time that has already passed today moves to 30 minutes from now (as a draft).
  async function fillMornings() {
    const s = getSettings();
    const platforms = activePlatforms(s).filter(p => p !== 'pinterest'); // morning pins come with the evening posts
    const hour = Math.min(Math.max(Number(s.social_hour) || 10, 0), 23);
    const today = new Date().toISOString().slice(0, 10);
    const days = all(`SELECT substr(scheduled_at, 1, 10) AS day, MIN(product_id) AS product_id FROM social_posts
      WHERE slot = 'morning' AND product_id IS NOT NULL AND status IN ('draft', 'approved', 'posted') AND substr(scheduled_at, 1, 10) >= ? GROUP BY day ORDER BY day`, today)
      .map(d => ({ ...d, missing: platforms.filter(p => !one("SELECT 1 FROM social_posts WHERE slot = 'morning' AND platform = ? AND substr(scheduled_at, 1, 10) = ?", p, d.day)) }))
      .filter(d => d.missing.length)
      .map(d => ({ ...d, product: one('SELECT * FROM products WHERE id = ?', d.product_id), date: new Date(d.day + 'T00:00:00Z') }))
      .filter(d => d.product);
    if (!days.length) return 0;
    const posts = await writePosts(days, s);
    let created = 0;
    for (const e of posts) {
      const d = days[e.day - 1]; if (!d) continue;
      e.tiktok = e.instagram;
      for (const platform of d.missing) {
        if (!String(e[platform] || '').trim()) continue;
        let at = atHour(d.day, hour, platform);
        if (at < new Date(Date.now() + 10 * 60e3)) at = new Date(Date.now() + 30 * 60e3);
        run("INSERT INTO social_posts (platform, product_id, text, title, image_url, link, scheduled_at, slot, kind) VALUES (?, ?, ?, ?, ?, ?, ?, 'morning', 'product')",
          platform, d.product.id, finalText(platform, e[platform], d.product), platform === 'tiktok' ? d.product.title.slice(0, 90) : null,
          imageFor(d.product, s), productUrl(d.product, platform), sqlTime(at));
        created++;
      }
    }
    return created;
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
      const last = one("SELECT MAX(scheduled_at) AS t FROM social_posts WHERE slot = 'morning' AND status IN ('draft', 'approved', 'posted')").t;
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
          if (platform === 'tiktok') d.tiktok = d.instagram;
          if (!String(d[platform] || '').trim()) continue;
          const at = new Date(day.date); at.setUTCHours(hour - 1, STAGGER[platform], 0, 0); // WAT is UTC+1
          run("INSERT INTO social_posts (platform, product_id, text, title, image_url, link, scheduled_at, slot, kind) VALUES (?, ?, ?, ?, ?, ?, ?, 'morning', 'product')",
            platform, day.product.id, finalText(platform, d[platform], day.product), platform === 'pinterest' ? String(d.pinterest_title || day.product.title).slice(0, 100) : platform === 'tiktok' ? day.product.title.slice(0, 90) : null,
            imageFor(day.product, s), productUrl(day.product, platform), sqlTime(at));
          created++;
        }
      }
      created += await fillEvenings().catch(e => { console.error('Evening posts:', e.message); return 0; });
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
    else if (!generating) {
      generating = true;
      try {
        const n = await fillEvenings(); if (n) console.log(`Social: wrote ${n} evening posts`);
        const m = await fillMornings(); if (m) console.log(`Social: wrote ${m} morning posts for newly connected accounts`);
        const c = await cardify(); if (c) console.log(`Social: added cards to ${c} posts`);
      } finally { generating = false; }
    }
  }

  // ---------- the Social page ----------
  admin.get('/social', (_req, res) => {
    const s = getSettings();
    const accounts = Object.fromEntries(all('SELECT platform, name, expires_at, connected_at, data FROM social_accounts').map(a => {
      const d = JSON.parse(a.data || '{}');
      return [a.platform, { name: a.name, expires_at: a.platform === 'linkedin' ? a.expires_at : null, connected_at: a.connected_at, ...(a.platform === 'pinterest' ? { board: d.board } : {}),
        ...(a.platform === 'facebook' ? { page_id: d.page_id, pages: (d.pages || []).map(p => ({ id: p.id, name: p.name, ig: p.ig?.username || null })) } : {}) }];
    }));
    res.json({
      ready: { ai: configured.ai(), meta: configured.meta(), linkedin: configured.linkedin(), x: configured.x(), pinterest: configured.pinterest(), tiktok: configured.tiktok(), email: mailer.enabled },
      redirects: { meta: redirectUri('meta'), linkedin: redirectUri('linkedin'), x: redirectUri('x'), pinterest: redirectUri('pinterest'), tiktok: redirectUri('tiktok') },
      accounts,
      settings: { social_enabled: s.social_enabled, social_hour: s.social_hour, social_platforms: s.social_platforms, social_voice: s.social_voice,
        social_evening: s.social_evening, social_evening_hour: s.social_evening_hour },
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
    const title = b.title != null ? String(b.title).trim().slice(0, 100) : post.title;
    run('UPDATE social_posts SET text = ?, title = ?, status = ?, error = NULL WHERE id = ?', text, title, status, post.id);
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
    try {
      if (!configured.ai()) throw new Error('Add ANTHROPIC_API_KEY in Railway first.');
      if (generating) throw new Error('Already writing posts. Give it a minute.');
      generating = true;
      let evenings = 0;
      try { evenings = await fillEvenings(); evenings += await fillMornings(); } finally { generating = false; }
      if (evenings) return res.json({ created: evenings, evenings: true });
      res.json(await generateWeek({ force: true }));
    } catch (e) { bad(res, e.message); }
  }));

  setInterval(() => publishDue().catch(e => console.error('Social publish:', e.message)), Number(process.env.SOCIAL_PUBLISH_SECONDS || 120) * 1000).unref();
  setInterval(() => autoGenerate().catch(e => console.error('Social generate:', e.message)), Number(process.env.SOCIAL_GENERATE_SECONDS || 3600) * 1000).unref();
  return { generateWeek, publishDue, publish: publishOne };
};
