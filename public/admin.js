/* Carsinstore owner dashboard: products, uploads, categories, orders, customers, coupons, settings. */
(() => {
  const { api, upload, esc, money, size, plural, date, I, toast, modal, confirmDialog, coverHtml, loadStore, S, $, $$, extOf, spinner, passwordToggles } = window.Store;
  const app = document.getElementById('app');

  const A = {
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-4H4z"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    pct: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15 6-6 6 6"/></svg>',
    dn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  };

  function layout(active, content) {
    const items = [['', 'Overview', A.dash], ['products', 'Products', A.box], ['categories', 'Categories', A.tag], ['orders', 'Orders', A.receipt], ['payouts', 'Payouts', A.bank], ['customers', 'Customers', I.users], ['coupons', 'Discounts', A.pct], ['affiliates', 'Affiliates', A.link], ['settings', 'Store settings', A.gear]];
    app.innerHTML = `<div class="admin">
      <aside class="admin-side">
        <a class="brand" href="#/" style="border:0"><img class="brand-logo" src="/brand/logo-horizontal.svg" alt="${esc(S.store.settings.store_name)}"></a>
        ${items.map(([k, l, ic]) => `<a href="#/admin${k ? '/' + k : ''}" class="${active === k ? 'on' : ''}">${ic}${l}</a>`).join('')}
        <div class="bottom"><a href="#/" target="_blank">${A.store}View store</a></div>
      </aside>
      <main class="admin-main">${S.store.payments !== 'paystack' ? `<div class="setup-banner">${S.store.payments === 'demo' ? '<b>Test mode.</b> Checkout is simulated, so no real payments are taken.' : '<b>Payments are off.</b> Paid products can’t be bought yet.'} Add <code>PAYSTACK_SECRET_KEY</code> to your <code>.env</code> file to take real payments (see README).</div>` : ''}${content}</main></div>`;
    window.onscroll = null;
  }
  const head = (title, actions = '') => `<div class="admin-head"><h1>${title}</h1><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div>`;
  const people = n => (n === 1 ? '1 person' : `${n} people`);
  const statusPill = s => `<span class="status ${s}">${s}</span>`;

  // ---------- gate ----------
  function setupScreen() {
    const u = S.store.user;
    app.innerHTML = `<div class="auth"><div class="aurora"><i></i></div><div class="grain"></div>
      <form class="auth-card" id="setup"><span class="label">First-time setup</span><h1>Claim your store.</h1>
        <p>Create the owner account for ${esc(S.store.settings.store_name)}. Only this account can manage products and see sales.</p>
        <label class="field"><span>Your name</span><input class="input" name="name" value="${esc(u?.name || '')}"></label>
        <label class="field"><span>Email</span><input class="input" type="email" name="email" required value="${esc(u?.email || '')}"></label>
        <label class="field"><span>Password</span><input class="input" type="password" name="password" minlength="8" required><small>${u ? 'Your current account password.' : 'At least 8 characters.'}</small></label>
        <div class="error-msg" id="err"></div>
        <button class="btn btn-primary btn-lg btn-block">Create owner account ${I.arrow}</button></form></div>`;
    passwordToggles();
    $('#setup').addEventListener('submit', async e => {
      e.preventDefault();
      try { await api('/api/setup', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); await loadStore(); toast('Welcome to your store'); location.hash = '#/admin'; window.Store.route(); }
      catch (err) { $('#err').textContent = err.message; }
    });
  }

  // ---------- overview ----------
  async function overview() {
    const s = await api('/api/admin/stats');
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      days.push({ d, ...(s.days.find(x => x.day === d) || { revenue: 0, sales: 0 }) });
    }
    const max = Math.max(1, ...days.map(d => d.revenue));
    layout('', head('Overview', `<a class="btn btn-primary" href="#/admin/products/new">${I.plus.replace('<svg', '<svg width="14" height="14"')} New product</a>`) + `
      <div class="stats">
        <div class="stat"><small>Revenue</small><b>${money(s.revenue)}</b>${(s.otherCurrencies || []).map(c => `<div class="muted" style="font-size:12.5px;margin-top:4px">+ ${money(c.revenue, c.currency)} in ${c.currency.toUpperCase()}</div>`).join('')}</div>
        <div class="stat"><small>Paid sales</small><b>${s.sales}</b></div>
        <div class="stat"><small>Customers</small><b>${s.customers}</b></div>
        <div class="stat"><small>Free claims</small><b>${s.free}</b></div>
      </div>
      <div class="panel" style="padding:0"><div class="box-head"><h3 style="font-size:18px">Revenue · last 30 days</h3><span class="muted" style="font-size:13px">${s.live}/${s.products} products live</span></div>
        <div class="chart">${days.map(d => `<div class="b" style="height:${(d.revenue / max) * 100}%" data-t="${d.d.slice(5)} · ${money(d.revenue)}"></div>`).join('')}</div></div>
      <div class="row">
        <div class="panel" style="padding:0"><div class="box-head"><h3 style="font-size:18px">Top products</h3></div>
          ${s.top.length ? `<table class="tbl"><tr><th>Product</th><th>Sales</th><th>Revenue</th></tr>${s.top.map(t => `<tr><td>${esc(t.title)}</td><td>${t.sales}</td><td>${money(t.revenue)}</td></tr>`).join('')}</table>` : '<p class="muted" style="padding:20px;margin:0">No products yet.</p>'}</div>
        <div class="panel" style="padding:0"><div class="box-head"><h3 style="font-size:18px">Recent activity</h3><a class="btn btn-sm btn-ghost" href="#/admin/orders">All orders</a></div>
          ${s.recent.length ? `<table class="tbl">${s.recent.map(o => `<tr><td><div>${esc(o.name || o.email)}</div><small class="dim">${esc(o.title)}</small></td><td>${statusPill(o.status)}</td><td style="text-align:right">${o.amount_cents ? money(o.amount_cents) : 'Free'}</td></tr>`).join('')}</table>` : '<p class="muted" style="padding:20px;margin:0">Sales will show up here.</p>'}</div>
      </div>`);
  }

  // ---------- products ----------
  const dots = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  const coverThumb = (url, isVideo) => isVideo
    ? `<video src="${esc(url)}" muted loop autoplay playsinline preload="metadata"></video>`
    : `<img src="${esc(url)}" alt="" loading="lazy">`;
  const statusOf = p => p.published ? (p.changes ? `${statusPill('live')} <span class="status pending">edits not live</span>` : statusPill('live')) : statusPill('draft');
  const copyText = async (text, ok) => { try { await navigator.clipboard.writeText(text); toast(ok); } catch { prompt('Copy this link:', text); } };

  // After publishing: the link to share, then back to the product list.
  function publishedModal(link, id) {
    let announce = false;
    modal(`<span class="status live">live</span><h3 style="margin-top:12px">Published</h3><p class="muted" style="margin:0 0 14px">It's live in the store. Here's the link to share:</p>
      <input class="input" readonly value="${esc(link)}" onclick="this.select()">
      ${id && S.store.emails ? `<button class="btn btn-block" id="pm-announce" style="margin-top:12px">${A.mail.replace('<svg', '<svg width="15" height="15"')} Email past buyers about it</button>` : ''}
      <div class="actions"><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">View</a><button class="btn" id="pm-copy">Copy link</button><button class="btn btn-primary" data-close>Back to products</button></div>`,
      (m, close) => {
        $('#pm-copy', m).onclick = () => copyText(link, 'Link copied');
        $('#pm-announce', m)?.addEventListener('click', () => { announce = true; close(); });
      },
      () => {
        if (announce) return announceModal(id);
        if (location.hash === '#/admin/products') products(); else location.hash = '#/admin/products';
      });
  }
  async function publish(id, hasFiles) {
    if (!hasFiles && !(await confirmDialog('Publish without files?', busy.uploads ? 'Your files are still uploading. Buyers who check out before they finish would get nothing to download.' : 'This product has no files yet, so buyers would get nothing to download.', 'Publish anyway'))) return null;
    const r = await api(`/api/admin/products/${id}/publish`, { method: 'POST' });
    publishedModal(r.link, id);
    return r;
  }

  // "Email past buyers": a short announcement about one product, to people who don't have it yet.
  async function announceModal(id) {
    const a = await api(`/api/admin/products/${id}/announce`);
    if (!a.emails) return toast("Email isn't set up on this store, so announcements can't be sent.", true);
    if (!a.published) return toast('Publish the product first, so the link in the email works.', true);
    const AUD = [['all', 'Everyone with a product'], ['paid', 'Paying buyers'], ['free', 'Free downloads only']];
    const room = Math.max(0, a.limit - a.sentToday);
    modal(`<h3>Email past buyers</h3>
      <p class="muted" style="margin:0 0 16px;font-size:13.5px">Tell people who bought or downloaded from you about <b style="color:var(--text);font-weight:500">${esc(a.title)}</b>. The email shows its cover, your message, the price and a button to the product. People who already have it${a.unsubscribed ? `, the ${people(a.unsubscribed)} who unsubscribed,` : ' or unsubscribed'} and anyone already told about it are left out.</p>
      <label class="field"><span>Send to</span><select class="input" id="an-aud">${AUD.map(([k, l]) => `<option value="${k}">${l} (${a.counts[k]})</option>`).join('')}</select></label>
      <label class="field"><span>Subject</span><input class="input" id="an-sub" maxlength="150" value="${esc(a.subject)}"></label>
      <label class="field"><span>Message</span><textarea class="input" id="an-msg" rows="5" maxlength="2000">${esc(a.message)}</textarea><small>Starts with "Hi [their first name], there's something new you might like." Keep it short: what it is and who it helps.</small></label>
      <p class="muted" id="an-note" style="font-size:12.5px;margin:2px 0 0"></p>
      ${a.previous.length ? `<p class="muted" style="font-size:12.5px;margin:8px 0 0">Announced before: ${a.previous.map(x => `${date(x.created_at)} (${plural(x.sent, 'email')})`).join(', ')}.</p>` : ''}
      <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn" id="an-test">Send me a test</button><button class="btn btn-primary" id="an-send"></button></div>`, (m, close) => {
      const n = () => a.counts[$('#an-aud', m).value];
      const draw = () => {
        const b = $('#an-send', m); b.textContent = `Send to ${people(n())}`; b.disabled = !n();
        $('#an-note', m).textContent = !n() ? 'Nobody in this group to send to.'
          : n() > room ? `Up to ${a.limit} go out a day, to leave room for receipts. ${room ? `${room} today, then` : 'None left today, so they start tomorrow:'} the rest over the next ${plural(Math.ceil((n() - room) / a.limit), 'day')}.`
          : 'They go out over the next few minutes.';
      };
      $('#an-aud', m).addEventListener('change', draw); draw();
      const body = test => ({ audience: $('#an-aud', m).value, subject: $('#an-sub', m).value, message: $('#an-msg', m).value, test });
      $('#an-test', m).addEventListener('click', async e => {
        e.target.disabled = true;
        try { const r = await api(`/api/admin/products/${id}/announce`, { method: 'POST', body: body(true) }); toast(`Test sent to ${r.to}. Check your inbox.`); }
        catch (err) { toast(err.message, true); } finally { e.target.disabled = false; }
      });
      $('#an-send', m).addEventListener('click', async e => {
        e.target.disabled = true;
        try {
          const r = await api(`/api/admin/products/${id}/announce`, { method: 'POST', body: body(false) });
          close(); toast(`Sending to ${people(r.total)}. Track it on the Customers page.`);
          location.hash = '#/admin/customers';
        } catch (err) { toast(err.message, true); e.target.disabled = false; }
      });
    });
  }

  // What Paystack has paid into your bank, and what's on the way. Money is never held in the store.
  async function payouts(page = 1) {
    const intro = '<p class="muted" style="margin:-12px 0 22px;font-size:13.5px;max-width:700px">Paystack collects each payment, takes its fee, and pays the rest into the bank account on your Paystack account automatically, usually the next business day. There is nothing to withdraw: this page shows those payouts.</p>';
    const link = `<a class="btn" href="https://dashboard.paystack.com/#/settlements" target="_blank" rel="noopener">Open Paystack</a>`;
    let d;
    try { d = await api(`/api/admin/payouts?page=${page}`); }
    catch (e) { return layout('payouts', head('Payouts', link) + intro + `<div class="empty"><h3>Couldn't load payouts</h3><p>${esc(e.message)}</p></div>`); }
    if (!d.configured) return layout('payouts', head('Payouts') + intro + '<div class="empty"><h3>Paystack isn\'t connected yet</h3><p>Add your Paystack secret key on your host to take payments. Payouts show here once it is.</p></div>');
    const sum = (list, cur) => list.filter(s => s.currency === cur).reduce((n, s) => n + s.net, 0);
    const paid = d.settlements.filter(s => s.status === 'success'), waiting = d.settlements.filter(s => s.status !== 'success' && s.status !== 'failed');
    const currencies = [...new Set([...d.pending.map(p => p.currency), ...d.settlements.map(s => s.currency)])];
    const label = { success: 'paid', processing: 'processing', pending: 'pending', failed: 'failed' };
    layout('payouts', head('Payouts', link) + intro + `
      ${d.mode === 'test' ? '<div class="setup-banner"><b>Test mode.</b> Paystack never pays out test payments, so this stays empty until the live key is in. Amounts waiting below are from test payments.</div>' : ''}
      <div class="stats">
        <div class="stat"><small>Waiting to be paid out</small><b>${d.pending.length ? d.pending.map(p => money(p.amount, p.currency)).join(' + ') : money(0)}</b><div class="muted" style="font-size:12.5px;margin-top:4px">Sales not in a payout yet, before Paystack's fee</div></div>
        <div class="stat"><small>Payouts on the way</small><b>${currencies.map(c => money(sum(waiting, c), c)).join(' + ') || money(0)}</b><div class="muted" style="font-size:12.5px;margin-top:4px">${plural(waiting.length, 'payout')} processing</div></div>
        <div class="stat"><small>Paid to your bank</small><b>${currencies.map(c => money(sum(paid, c), c)).join(' + ') || money(0)}</b><div class="muted" style="font-size:12.5px;margin-top:4px">${paid[0] ? 'Last on ' + date(String(paid[0].date).slice(0, 19).replace('T', ' ')) : 'No payouts yet'}${d.pages > 1 ? ', this page' : ''}</div></div>
      </div>
      ${d.settlements.length ? `<div class="panel tbl-wrap" style="padding:0;margin-top:18px"><table class="tbl"><tr><th>Date</th><th>Status</th><th style="text-align:right">Sales</th><th style="text-align:right">Paystack fees</th><th style="text-align:right">Paid out</th></tr>
        ${d.settlements.map(s => `<tr class="click" data-payout="${s.id}"><td>${date(String(s.date).slice(0, 19).replace('T', ' '))}</td><td>${statusPill(s.status === 'success' ? 'paid' : s.status === 'failed' ? 'refunded' : 'pending').replace(/>[^<]*</, `>${label[s.status] || esc(s.status)}<`)}</td>
          <td style="text-align:right">${money(s.gross, s.currency)}</td><td style="text-align:right" class="muted">${s.fees ? '-' + money(s.fees, s.currency) : money(0, s.currency)}${s.deductions ? `<br><small>-${money(s.deductions, s.currency)} other</small>` : ''}</td><td style="text-align:right"><b style="font-weight:500">${money(s.net, s.currency)}</b></td></tr>`).join('')}
      </table></div>
      ${d.pages > 1 ? `<div style="display:flex;justify-content:center;gap:8px;margin-top:14px">${page > 1 ? '<button class="btn btn-sm" data-page="-1">Newer</button>' : ''}<span class="muted" style="align-self:center;font-size:13px">Page ${page} of ${d.pages}</span>${page < d.pages ? '<button class="btn btn-sm" data-page="1">Older</button>' : ''}</div>` : ''}`
      : '<div class="empty" style="margin-top:18px"><h3>No payouts yet</h3><p>Your first one shows here after Paystack pays your first sales into your bank.</p></div>'}`);
    $$('[data-page]').forEach(b => b.addEventListener('click', () => payouts(page + Number(b.dataset.page))));
    // Click a payout to see which sales were in it.
    $$('tr[data-payout]').forEach(r => r.addEventListener('click', async () => {
      const s = d.settlements.find(x => String(x.id) === r.dataset.payout);
      modal(`<h3>Payout of ${money(s.net, s.currency)}</h3><p class="muted" style="margin:0 0 14px">${date(String(s.date).slice(0, 19).replace('T', ' '))} · ${label[s.status] || esc(s.status)}</p><div id="po-items">${spinner()}</div><div class="actions"><button class="btn" data-close>Close</button></div>`,
        async m => {
          m.style.maxWidth = '640px';
          try {
            const { items } = await api(`/api/admin/payouts/${s.id}`);
            $('#po-items', m).innerHTML = items.length ? `<table class="tbl" style="font-size:13px"><tr><th>Sale</th><th style="text-align:right">Amount</th><th style="text-align:right">Fee</th></tr>${items.map(t => `<tr><td>${esc(t.product || t.reference)}<br><small class="dim">${esc(t.buyer || '')}${t.paidAt ? ' · ' + date(String(t.paidAt).slice(0, 19).replace('T', ' ')) : ''}</small></td><td style="text-align:right">${money(t.amount, t.currency)}</td><td style="text-align:right" class="muted">-${money(t.fees, t.currency)}</td></tr>`).join('')}</table>` : '<p class="muted">No sales listed for this payout.</p>';
          } catch (e) { $('#po-items', m).innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
        });
    }));
  }

  async function products() {
    const list = await api('/api/admin/products');
    const canArrange = list.some(p => p.featured && p.published);
    layout('products', head('Products', `${canArrange ? `<button class="btn" id="arrange">${A.up.replace('<svg', '<svg width="14" height="14"')} Arrange featured</button>` : ''}<button class="btn btn-primary" id="new">${I.plus.replace('<svg', '<svg width="14" height="14"')} New product</button>`) + (list.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Product</th><th>Price</th><th>Files</th><th>Sales</th><th>Status</th><th></th></tr>
      ${list.map(p => `<tr class="click" data-id="${p.id}"><td><div style="display:flex;gap:12px;align-items:center"><div class="thumb">${p.draftCover ? coverThumb(p.draftCover, p.draftCoverVideo) : coverHtml(p)}</div><div><div>${esc(p.name)}</div><small class="dim">${p.categories.length ? esc(p.categories.map(c => c.name).join(', ')) : 'No category'}${p.rating ? ` · ★ ${p.rating.avg} (${p.rating.count})` : ''}</small></div></div></td>
        <td>${p.price ? money(p.price) : '<span style="color:var(--amber)">Free</span>'}</td>
        <td class="muted">${p.files ? `${plural(p.files, 'file')}${p.totalSize ? ' · ' + size(p.totalSize) : ''}` : '<span style="color:#ff8b7a">No files yet</span>'}</td><td>${p.students}</td>
        <td>${statusOf(p)}${p.featured ? ' <span class="status free">featured</span>' : ''}</td>
        <td style="text-align:right;width:1%"><button class="icon-btn" data-menu="${p.id}" title="Actions">${dots}</button></td></tr>`).join('')}</table></div>`
      : `<div class="empty"><h3>No products yet</h3><p>Create your first digital product, then upload its files.</p></div>`));
    // The ⋯ button opens a product's actions; clicking anywhere else on the row shows its sales page as buyers see it.
    const openMenu = (id, anchor) => {
      const p = list.find(x => x.id === Number(id));
      document.querySelector('.menu-pop')?.remove();
      const pop = document.createElement('div');
      pop.className = 'menu-pop';
      pop.innerHTML = `<button data-act="edit">${A.edit} Edit</button>
        ${p.published ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" data-act="view">${A.eye} View in store</a><button data-act="copy">${A.link} Copy link</button>` : ''}
        ${!p.published || p.changes ? `<button data-act="publish">${A.up} ${p.published ? 'Publish changes' : 'Publish'}</button>` : ''}
        ${p.published && S.store.emails ? `<button data-act="announce">${A.mail} Email past buyers</button>` : ''}
        ${p.published ? `<button data-act="unpublish">${A.dn} Unpublish</button>` : ''}
        <hr><button data-act="delete" class="danger">${A.trash} Delete</button>`;
      document.body.append(pop);
      const r = anchor.getBoundingClientRect();
      pop.style.top = `${Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8) + scrollY}px`;
      pop.style.left = `${Math.max(8, Math.min(r.right, innerWidth - 8) - pop.offsetWidth) + scrollX}px`;
      const close = () => { pop.remove(); document.removeEventListener('click', outside, true); document.removeEventListener('keydown', esc_); };
      const outside = e => { if (!pop.contains(e.target)) close(); };
      const esc_ = e => { if (e.key === 'Escape') close(); };
      setTimeout(() => { document.addEventListener('click', outside, true); document.addEventListener('keydown', esc_); });
      pop.addEventListener('click', async e => {
        const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
        close();
        try {
          if (act === 'edit') location.hash = `#/admin/products/${p.id}`;
          if (act === 'copy') copyText(p.link, 'Link copied');
          if (act === 'announce') await announceModal(p.id);
          if (act === 'publish') await publish(p.id, p.files > 0);
          if (act === 'unpublish') { await api(`/api/admin/products/${p.id}/unpublish`, { method: 'POST' }); toast('Unpublished. Only you can see it now.'); products(); }
          if (act === 'delete') {
            if (!(await confirmDialog(`Delete "${p.name}"?`, 'Its files, covers and customer access will be removed permanently. This cannot be undone.', 'Delete', true))) return;
            await api(`/api/admin/products/${p.id}`, { method: 'DELETE' }); toast('Product deleted'); products();
          }
        } catch (err) { toast(err.message, true); }
      });
    };
    $$('tr[data-id]').forEach(r => r.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      const menu = e.target.closest('[data-menu]');
      if (menu) return openMenu(r.dataset.id, menu);
      location.hash = `#/p/${list.find(x => x.id === Number(r.dataset.id)).slug}?draft=1`;
    }));
    $('#new').addEventListener('click', newProduct);
    $('#arrange')?.addEventListener('click', arrangeFeatured);
  }

  function newProduct() {
    modal(`<h3>New product</h3><p class="muted" style="margin:0 0 20px">Everything can be changed later.</p>
      <form id="np"><label class="field"><span>Title</span><input class="input" name="title" required placeholder="e.g. Cinematic LUT Pack + Tutorial"></label>
      <label class="field"><span>Short description</span><input class="input" name="subtitle" placeholder="One line that sells it"><small>Shown under the title, on product cards and as the text in link previews on WhatsApp, Instagram and X.</small></label>
      <div class="field"><span>Description</span><textarea class="input" name="description" rows="6"></textarea><small>Next you'll upload the files and covers.</small></div>
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Create product</button></div></form>`,
      (m, close) => {
        m.style.maxWidth = '760px';
        richEditor($('[name="description"]', m), { placeholder: "What it is, what's inside, who it's for, questions buyers ask" }).el.style.minHeight = '180px';
        $('#np', m).addEventListener('submit', async e => {
          e.preventDefault();
          const r = await api('/api/admin/products', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
          close(); location.hash = `#/admin/products/${r.id}`;
        });
      });
  }

  // Unsaved edits and uploads in progress, so closing the tab can warn first.
  const busy = { dirty: false, uploads: 0 };
  window.addEventListener('beforeunload', e => { if (busy.dirty || busy.uploads) { e.preventDefault(); e.returnValue = ''; } });

  const RATIOS = ['1:1', '4:3'];
  const isVideoUrl = u => /\.(mp4|webm|mov|m4v)$/i.test(u || '');

  // Everything typed here saves by itself as a draft. Visitors only see it after Publish.
  // Files are the exception: they update for buyers straight away.
  async function editor(id) {
    if (id === 'new') { location.hash = '#/admin/products'; return setTimeout(newProduct, 50); }
    const [p, cats] = await Promise.all([api(`/api/admin/products/${id}`), api('/api/admin/categories')]);
    const e0 = p.edit;
    const dollars = c => (c ? (c / 100).toFixed(2).replace(/\.00$/, '') : '');
    const alt = e0.alt_prices || {};
    const sales = e0.sales;
    let files = p.files, covers = e0.covers, published = p.published, changes = p.changes, reviews = p.reviews;
    const here = () => location.hash.startsWith(`#/admin/products/${id}`) && $('#file-list');

    layout('products', `<div class="crumbs" style="margin-bottom:12px"><a href="#/admin/products">Products</a><span>/</span><span id="crumb-title">${esc(e0.title)}</span></div>` +
      head(`<span id="head-title">${esc(e0.title)}</span>`, `<span class="save-state" id="save-state">Draft saved</span><a class="btn" id="preview-link" href="#/p/${esc(p.slug)}?draft=1" target="_blank">${A.eye.replace('<svg', '<svg width="15" height="15"')} Preview</a><button class="btn" id="unpublish">Unpublish</button><button class="btn btn-primary" id="publish">Publish</button>`) + `
      <div class="editor"><div>
        <div class="panel"><h3>Files <span class="muted" id="file-count" style="font:13px var(--sans)"></span></h3>
          <p class="muted" style="margin:-8px 0 14px;font-size:13px">These are what buyers download, and they update for buyers straight away. Switch on <b style="color:var(--text);font-weight:500">Free preview</b> to let visitors view a video, audio, image or the first pages of a PDF on the product page. They can view it there but not download it.</p>
          <div class="mini-files" id="file-list"></div>
          <div id="up-list"></div>
          <div class="dropzone" data-drop>${A.upload}<div><b style="font-weight:500;color:var(--text)">Drop files here</b> or click to upload</div><small class="dim">Videos, PDFs, ZIPs, documents, audio, anything. Max 4 GB each. You can keep editing while they upload.</small></div>
          <div class="link-add"><span class="muted">Big video course on Google Drive or Dropbox?</span><button type="button" class="btn btn-sm" id="add-link">${A.link} Add a link instead</button></div>
        </div>
        <form class="panel" id="pf"><h3>Details</h3>
          <label class="field"><span>Title</span><input class="input" name="title" value="${esc(e0.title)}" required></label>
          <label class="field"><span>Short description</span><input class="input" name="subtitle" value="${esc(e0.subtitle)}" placeholder="One line that sells it"><small>Shown under the title, on product cards and as the text in link previews on WhatsApp, Instagram and X.</small></label>
          <div class="field"><span>Description</span><textarea class="input" name="description" rows="16">${esc(e0.description)}</textarea>
            <small>This is the whole sales page text. Use the toolbar for headings, bold, colours, lists and links. Add pictures with the picture button, or paste or drop them in.</small></div>
          <label class="field"><span>URL slug</span><input class="input" name="slug" value="${esc(e0.slug)}"><small>Share link: <span id="share-url">${esc(location.origin)}/p/${esc(e0.slug)}</span>. It shows the cover, title and price when posted on WhatsApp, Instagram or X.</small></label>
        </form>
        <div class="panel"><h3>Buyer reviews <span class="muted" id="rv-count" style="font:13px var(--sans)"></span></h3>
          <p class="muted" style="margin:-8px 0 14px;font-size:13px">Buyers can rate this product and write a review from their download page. They show on the product page straight away. Hide any you don't want shown.</p>
          <div id="buyer-reviews" style="display:grid;gap:8px"></div>
        </div>
        <div class="panel"><h3>Reviews you add</h3>
          <p class="muted" style="margin:-8px 0 16px;font-size:13px">For praise you got elsewhere, like a DM or an email. Shown with the buyer reviews.</p>
          <div class="field" style="margin-bottom:0"><div id="reviews" style="display:grid;gap:8px"></div><button type="button" class="btn btn-sm" id="add-review" style="margin-top:8px;justify-self:start">${I.plus.replace('<svg', '<svg width="13" height="13"')} Add review</button><small style="display:block;margin-top:6px">Real words from real people, with their permission.</small></div>
        </div>
      </div>
      <aside>
        <div class="panel"><h3>Status</h3>
          <p id="status-line" style="margin:-4px 0 14px;font-size:13px;line-height:1.6"></p>
          <label class="check"><span class="switch"><input type="checkbox" form="pf" name="featured" ${e0.featured ? 'checked' : ''}><i></i></span>Featured on the homepage</label>
          <small class="dim" style="display:block;margin-top:8px;font-size:12px">Change their order with <a href="#/admin/products" style="color:var(--accent-2)">Products &gt; Arrange featured</a>.</small>
        </div>
        <div class="panel"><h3>Pricing</h3>
          <div class="row"><label class="field"><span>Price</span><input class="input" form="pf" name="price" inputmode="decimal" value="${dollars(e0.price_cents)}" placeholder="0 = free"></label>
          <label class="field"><span>Compare at</span><input class="input" form="pf" name="compare" inputmode="decimal" value="${dollars(e0.compare_cents)}" placeholder="optional"></label></div>
          ${extraCurrencies().length ? `<div class="row" style="margin-top:4px">${extraCurrencies().map(c => `<label class="field"><span>Price in ${c.toUpperCase()}</span><input class="input" form="pf" name="price_${c}" inputmode="decimal" value="${dollars(alt[c])}" placeholder="not sold in ${c.toUpperCase()}"></label>`).join('')}</div>` : ''}
          <small class="dim" style="font-size:12px">Leave price at 0 to make it a free product (buyers just enter their name and email).${extraCurrencies().length ? ' Leave an extra currency empty to sell only in ' + (S.store.settings.currency || 'ngn').toUpperCase() + '.' : ''}</small>
        </div>
        <div class="panel"><h3>Categories</h3>
          <div class="check-list">${cats.map(c => `<label class="check"><input type="checkbox" form="pf" name="category_ids" value="${c.id}" ${e0.category_ids.includes(c.id) ? 'checked' : ''}>${esc(c.name)}</label>`).join('') || '<p class="muted" style="margin:0;font-size:13px">No categories yet.</p>'}</div>
          <small class="dim" style="display:block;margin-top:10px;font-size:12px">Pick as many as fit. <a href="#/admin/categories" style="color:var(--accent-2)">Manage categories</a></small>
        </div>
        <div class="panel" id="cover-panel"><h3>Covers <span class="muted" id="cover-count" style="font:13px var(--sans)"></span></h3>
          <p class="muted" style="margin:-8px 0 10px;font-size:12.5px">Up to 4 images or short videos. Drag to reorder. The first is the main one, used on product cards and when the link is shared (a video's link preview uses the first image instead).</p>
          <div class="seg ratio-seg" id="ratio">${RATIOS.map(r => `<label><input type="radio" form="pf" name="cover_ratio" value="${r}" ${r === e0.cover_ratio ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div>
          <small class="dim" id="ratio-hint" style="display:block;margin:6px 0 12px;font-size:12px"></small>
          <div class="cover-grid" id="covers"></div>
          <input type="file" id="cover-in" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden>
        </div>
        <div class="panel"><h3>You might also like</h3>
          <p class="muted" style="margin:-8px 0 10px;font-size:12.5px">Up to 4 products shown on this product's page and on the buyer's download page. Pick none to show others from the same categories.</p>
          <div class="check-list" id="xsell">${p.others.map(o => `<label class="check"><input type="checkbox" form="pf" name="cross_sells" value="${o.id}" ${e0.cross_sells.includes(o.id) ? 'checked' : ''}>${esc(o.title)}</label>`).join('') || '<p class="muted" style="margin:0;font-size:13px">Add more products first.</p>'}</div>
        </div>
        <div class="panel"><h3>Bundle <span class="muted" id="bundle-sum" style="font:13px var(--sans)"></span></h3>
          <p class="muted" style="margin:-8px 0 10px;font-size:12.5px">Tick products to sell them together as this one product. Buyers get every file from each, on one download page. Set this product's price lower than the total to show the saving.</p>
          <div class="check-list" id="bundle">${p.others.filter(o => !o.isBundle).map(o => `<label class="check"><input type="checkbox" form="pf" name="bundle_items" value="${o.id}" data-price="${o.price}" ${e0.bundle_items.includes(o.id) ? 'checked' : ''}>${esc(o.title)} <small class="dim" style="margin-left:auto">${o.price ? money(o.price) : 'Free'}</small></label>`).join('') || '<p class="muted" style="margin:0;font-size:13px">Add more products first.</p>'}</div>
        </div>
        <div class="panel"><h3>Give access</h3><p class="muted" style="font-size:13px;margin:-6px 0 12px">Give someone this product for free. You get a download link to send them.</p>
          <form id="grant" style="display:grid;gap:8px"><input class="input" name="name" placeholder="Their name" style="height:36px"><div style="display:flex;gap:8px"><input class="input" name="email" type="email" placeholder="their@email.com" required style="height:36px"><button class="btn btn-sm">Grant</button></div></form></div>
        <button class="btn btn-danger btn-block" id="del">${A.trash.replace('<svg', '<svg width="15" height="15"')} Delete product</button>
      </aside></div>`);

    // ----- publish state -----
    const drawPublish = () => {
      $('#unpublish').hidden = !published;
      const b = $('#publish');
      b.disabled = published && !changes;
      b.textContent = !published ? 'Publish' : changes ? 'Publish changes' : 'Published';
      $('#status-line').innerHTML = !published
        ? `${statusPill('draft')} <span class="muted" style="margin-left:6px">Only you can see it. Publish to put it in the store.</span>`
        : changes
          ? `${statusPill('live')} <span class="status pending">edits not live</span><br><span class="muted">Visitors see the last published version. Publish changes to update it.</span>`
          : `${statusPill('live')} <span class="muted" style="margin-left:6px">Visible in the store</span>`;
    };
    drawPublish();

    richEditor($('#pf [name="description"]'), { productId: id, placeholder: "Everything about the product: what it is, what's inside, who it's for, questions buyers ask" });

    // ----- autosave to the draft -----
    const stateEl = $('#save-state');
    const setState = (text, cls = '') => { stateEl.textContent = text; stateEl.className = 'save-state ' + cls; };
    let timer, saving = Promise.resolve(), snapshot = null;
    const body = () => {
      const fd = new FormData($('#pf')), f = Object.fromEntries(fd);
      return {
        title: f.title, subtitle: f.subtitle, description: f.description, slug: f.slug,
        price_cents: Math.round(parseFloat(f.price || 0) * 100) || 0, compare_cents: f.compare ? Math.round(parseFloat(f.compare) * 100) : null,
        featured: !!f.featured, category_ids: fd.getAll('category_ids').map(Number), cross_sells: fd.getAll('cross_sells').map(Number),
        bundle_items: fd.getAll('bundle_items').map(Number), cover_ratio: f.cover_ratio || '1:1',
        alt_prices: Object.fromEntries(extraCurrencies().map(c => [c, Math.round(parseFloat(f['price_' + c] || 0) * 100) || 0])),
        sales: { reviews: sales.reviews.filter(x => x.quote.trim()) },
      };
    };
    const flush = () => {
      clearTimeout(timer);
      if (!busy.dirty) return saving;
      busy.dirty = false;
      // The form may already be gone (you moved to another page), so use what was captured while typing.
      const data = $('#pf') ? body() : snapshot;
      snapshot = null;
      if (!data.title.trim()) { busy.dirty = true; snapshot = data; setState('Add a title to save', 'err'); return saving; }
      setState('Saving…');
      saving = saving.then(() => api(`/api/admin/products/${id}`, { method: 'PUT', body: data })).then(r => {
        if (r.slug !== data.slug) { const s = $('[name="slug"]'); if (s && document.activeElement !== s) s.value = r.slug; }
        if ($('#share-url')) $('#share-url').textContent = `${location.origin}/p/${r.slug}`;
        changes = r.changes; published = r.published;
        if ($('#publish')) drawPublish();
        if (!busy.dirty) setState(published && changes ? 'Draft saved. Publish to make it live.' : 'Draft saved', 'ok');
      }).catch(e => { busy.dirty = true; snapshot = snapshot || data; setState('Not saved yet. Retrying…', 'err'); console.error(e); timer = setTimeout(flush, 4000); });
      return saving;
    };
    const queueSave = () => { busy.dirty = true; snapshot = body(); setState('Saving…'); clearTimeout(timer); timer = setTimeout(flush, 700); };
    const onEdit = e => { if (e.target.form?.id === 'pf' || e.target.closest('#reviews')) queueSave(); };
    $('.editor').addEventListener('input', onEdit);
    $('.editor').addEventListener('change', onEdit);
    // Bundle: what the ticked products cost one by one, against this product's price.
    const drawBundle = () => {
      const picked = $$('[name="bundle_items"]:checked'), el = $('#bundle-sum');
      if (!el) return;
      const worth = picked.reduce((n, b) => n + Number(b.dataset.price || 0), 0);
      const price = Math.round(parseFloat($('[name="price"]').value || 0) * 100) || 0;
      el.textContent = !picked.length ? '' : `${plural(picked.length, 'product')} worth ${money(worth)}${worth > price ? `, buyers save ${money(worth - price)}` : ''}`;
    };
    $('.editor').addEventListener('input', drawBundle);
    $('.editor').addEventListener('change', drawBundle);
    drawBundle();
    $('[name="title"]').addEventListener('input', e => { $('#head-title').textContent = $('#crumb-title').textContent = e.target.value || 'Untitled product'; });
    $('#pf').addEventListener('submit', e => e.preventDefault());
    // Save straight away when leaving this page.
    const leave = () => { if (!location.hash.startsWith(`#/admin/products/${id}`)) { flush(); window.removeEventListener('hashchange', leave); } };
    window.addEventListener('hashchange', leave);
    setState(published && changes ? 'Draft saved. Publish to make it live.' : 'Draft saved', 'ok');

    $('#publish').addEventListener('click', async () => {
      try {
        busy.dirty = busy.dirty || !!snapshot; await flush();
        const r = await publish(id, files.length > 0 || $$('[name="bundle_items"]:checked').length > 0);
        if (r) { published = true; changes = false; drawPublish(); setState('Published', 'ok'); }
      } catch (err) { toast(err.message, true); }
    });
    $('#unpublish').addEventListener('click', async () => {
      if (!(await confirmDialog('Unpublish this product?', 'It disappears from the store and its link stops working until you publish it again. Buyers keep their downloads.', 'Unpublish'))) return;
      await api(`/api/admin/products/${id}/unpublish`, { method: 'POST' });
      published = false; drawPublish(); toast('Unpublished. Only you can see it now.');
    });

    // At most 4 picks for "You might also like".
    const limitXsell = () => { const boxes = $$('#xsell input'), n = boxes.filter(b => b.checked).length; boxes.forEach(b => (b.disabled = !b.checked && n >= 4)); };
    $('#xsell').addEventListener('change', limitXsell); limitXsell();

    // ----- reviews you add, edited as small cards -----
    const repeater = (box, list, fields, empty) => {
      const draw = () => {
        $(box).innerHTML = list.map((x, i) => `<div class="mod-edit" style="padding:12px">${fields.map(([k, ph, area], j) => {
          const el = area ? `<textarea class="input" data-k="${k}" data-i="${i}" rows="2" style="min-height:60px" placeholder="${ph}">${esc(x[k])}</textarea>` : `<input class="input" data-k="${k}" data-i="${i}" value="${esc(x[k])}" placeholder="${ph}">`;
          return j === 0 ? `<div style="display:flex;gap:8px;align-items:start">${el}<button type="button" class="icon-btn" data-del="${i}" title="Remove">${A.trash}</button></div>` : `<div style="margin-top:8px">${el}</div>`;
        }).join('')}</div>`).join('') || `<p class="muted" style="margin:0;font-size:13px">${empty}</p>`;
        $$(`${box} [data-k]`).forEach(el => el.addEventListener('input', () => (list[el.dataset.i][el.dataset.k] = el.value)));
        $$(`${box} [data-del]`).forEach(b => b.addEventListener('click', () => { list.splice(Number(b.dataset.del), 1); draw(); queueSave(); }));
      };
      draw();
      return () => { list.push(Object.fromEntries(fields.map(([k]) => [k, '']))); draw(); $(`${box} .mod-edit:last-child [data-k]`)?.focus(); };
    };
    $('#add-review').addEventListener('click', repeater('#reviews', sales.reviews, [['quote', 'What they said', true], ['name', 'Their name'], ['detail', 'Optional, e.g. Video editor, Lagos']], 'None added.'));

    // ----- buyer reviews -----
    const stars = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    const drawReviews = () => {
      const shown = reviews.filter(r => !r.hidden);
      $('#rv-count').textContent = reviews.length ? `${shown.length ? (shown.reduce((s, r) => s + r.rating, 0) / shown.length).toFixed(1) + ' ★ · ' : ''}${plural(reviews.length, 'review')}` : '';
      $('#buyer-reviews').innerHTML = reviews.map(r => `<div class="mod-edit buyer-review ${r.hidden ? 'is-hidden' : ''}" style="padding:12px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><span class="stars">${stars(r.rating)}</span>
            <span style="display:flex;gap:6px"><button type="button" class="btn btn-sm" data-rv-hide="${r.id}">${r.hidden ? 'Show' : 'Hide'}</button><button type="button" class="icon-btn" data-rv-del="${r.id}" title="Delete">${A.trash}</button></span></div>
          ${r.body ? `<p style="margin:8px 0 6px;font-size:13.5px">${esc(r.body)}</p>` : ''}
          <small class="dim">${esc(r.name)} · ${esc(r.email)} · ${date(r.updated_at)}${r.hidden ? ' · hidden' : ''}</small></div>`).join('')
        || '<p class="muted" style="margin:0;font-size:13px">No buyer reviews yet.</p>';
    };
    drawReviews();
    $('#buyer-reviews').addEventListener('click', async e => {
      const hide = e.target.closest('[data-rv-hide]'), del = e.target.closest('[data-rv-del]');
      try {
        if (hide) {
          const r = reviews.find(x => x.id === Number(hide.dataset.rvHide));
          await api(`/api/admin/reviews/${r.id}`, { method: 'PUT', body: { hidden: !r.hidden } });
          r.hidden = r.hidden ? 0 : 1; drawReviews(); toast(r.hidden ? 'Review hidden' : 'Review shown');
        }
        if (del) {
          if (!(await confirmDialog('Delete this review?', 'The buyer can still leave a new one from their download page.', 'Delete', true))) return;
          await api(`/api/admin/reviews/${del.dataset.rvDel}`, { method: 'DELETE' });
          reviews = reviews.filter(x => x.id !== Number(del.dataset.rvDel)); drawReviews(); toast('Review deleted');
        }
      } catch (err) { toast(err.message, true); }
    });

    // ----- delete, give access -----
    $('#del').addEventListener('click', async () => {
      if (busy.uploads) return toast('Wait for the uploads to finish first.', true);
      if (!(await confirmDialog('Delete this product?', 'Its files, covers and customer access will be removed permanently. This cannot be undone.', 'Delete', true))) return;
      clearTimeout(timer); busy.dirty = false;
      await api(`/api/admin/products/${id}`, { method: 'DELETE' }); toast('Product deleted'); location.hash = '#/admin/products';
    });
    $('#grant').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const r = await api('/api/admin/grant', { method: 'POST', body: { name: e.target.name.value, email: e.target.email.value, productId: p.id } });
        e.target.reset();
        modal(`<h3>Access granted</h3><p class="muted" style="margin:0 0 14px">${r.emailed ? 'We emailed them their download link. Here it is too:' : 'Send them this private download link:'}</p>
          <input class="input" readonly value="${esc(r.link)}" onclick="this.select()">
          <div class="actions"><button class="btn" data-close>Done</button><button class="btn btn-primary" id="cp">Copy link</button></div>`, (m) => {
          $('#cp', m).onclick = () => copyText(r.link, 'Link copied');
        });
      } catch (err) { toast(err.message, true); }
    });

    // ----- covers: up to 4 images or short videos, dragged to reorder, dropped in to upload -----
    const ratioHint = { '1:1': 'Square: 1080×1080 px', '4:3': 'Landscape: 1440×1080 px' };
    const drawRatio = () => {
      const r = RATIOS.includes($('#pf').elements.cover_ratio.value) ? $('#pf').elements.cover_ratio.value : '1:1';
      $('#covers').style.setProperty('--ratio', r.replace(':', '/'));
      $('#ratio-hint').textContent = `${ratioHint[r]}. Applies to every cover of this product, on its page and its card.`;
      $$('#ratio label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    };
    $('#ratio').addEventListener('change', drawRatio);
    drawRatio();
    let uploadingCovers = 0;
    const drawCovers = () => {
      $('#cover-count').textContent = `${covers.length} of 4`;
      $('#covers').innerHTML = covers.map((c, i) => `<div class="cover-thumb" draggable="true" data-i="${i}">${coverThumb(c, isVideoUrl(c))}${i === 0 ? '<span class="main-tag">Main</span>' : ''}${isVideoUrl(c) ? '<span class="vid-tag">Video</span>' : ''}
          <div class="ct-actions">${i ? `<button type="button" class="btn btn-sm" data-cv-main="${i}">Make main</button>` : ''}<button type="button" class="icon-btn" data-cv-del="${i}" title="Remove">${A.trash}</button></div></div>`).join('')
        + (covers.length + uploadingCovers < 4 ? `<button type="button" class="cover-add ${covers.length ? '' : 'wide'}" id="cover-add">${I.plus}<span>${uploadingCovers ? 'Uploading…' : covers.length ? 'Add or drop' : 'Drop images or short videos here'}</span><small>or click to choose</small></button>` : '');
      $('#cover-add')?.addEventListener('click', () => $('#cover-in').click());
    };
    const coversChanged = r => { covers = r.covers; changes = r.changes; if (here()) { drawCovers(); drawPublish(); setState(published && changes ? 'Draft saved. Publish to make it live.' : 'Draft saved', 'ok'); } };
    const setCoverOrder = async order => {
      try { coversChanged(await api(`/api/admin/products/${id}/covers`, { method: 'PUT', body: { order } })); }
      catch (err) { toast(err.message, true); }
    };
    const uploadCovers = async list => {
      const ok = list.filter(f => /^(image|video)\//.test(f.type));
      if (ok.length < list.length) toast('Covers can be images or short videos.', true);
      const room = 4 - covers.length - uploadingCovers;
      const picked = ok.slice(0, Math.max(0, room));
      if (ok.length > picked.length) toast(`Only ${plural(Math.max(0, room), 'more cover')} fit. You can have 4 in total.`, true);
      for (const file of picked) {
        uploadingCovers++; if (here()) drawCovers();
        const fd = new FormData(); fd.append('cover', file);
        try { const r = await upload(`/api/admin/products/${id}/cover`, fd); uploadingCovers--; coversChanged(r); }
        catch (err) { uploadingCovers--; toast(err.message, true); if (here()) drawCovers(); }
      }
    };
    $('#covers').addEventListener('click', e => {
      const main = e.target.closest('[data-cv-main]'), del = e.target.closest('[data-cv-del]');
      if (main) { const i = Number(main.dataset.cvMain); setCoverOrder([covers[i], ...covers.filter((_, j) => j !== i)]); }
      if (del) setCoverOrder(covers.filter((_, j) => j !== Number(del.dataset.cvDel)));
    });
    $('#cover-in').addEventListener('change', e => { const list = [...e.target.files]; e.target.value = ''; uploadCovers(list); });
    // Dragging a cover onto another moves it there; dropping files from the computer uploads them.
    let dragFrom = null;
    const panel = $('#cover-panel');
    $('#covers').addEventListener('dragstart', e => { const t = e.target.closest('.cover-thumb'); if (!t) return; dragFrom = Number(t.dataset.i); t.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'cover'); });
    $('#covers').addEventListener('dragend', () => { dragFrom = null; $$('.cover-thumb').forEach(t => t.classList.remove('dragging', 'drop-here')); });
    panel.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragFrom === null) { panel.classList.add('over'); return; }
      $$('.cover-thumb').forEach(t => t.classList.toggle('drop-here', t === e.target.closest('.cover-thumb') && Number(t.dataset.i) !== dragFrom));
    });
    panel.addEventListener('dragleave', e => { if (!panel.contains(e.relatedTarget)) panel.classList.remove('over'); });
    panel.addEventListener('drop', e => {
      e.preventDefault(); panel.classList.remove('over');
      if (dragFrom === null) return uploadCovers([...e.dataTransfer.files]);
      const t = e.target.closest('.cover-thumb'); const to = t ? Number(t.dataset.i) : covers.length - 1;
      if (to === dragFrom) return;
      const next = [...covers]; const [moved] = next.splice(dragFrom, 1); next.splice(to, 0, moved);
      dragFrom = null; setCoverOrder(next);
    });
    drawCovers();

    // ----- files -----
    const drawFiles = () => {
      const total = files.reduce((n, f) => n + f.size, 0);
      $('#file-count').textContent = files.length ? `${plural(files.length, 'file')}${total ? ' · ' + size(total) : ''}` : '';
      $('#file-list').innerHTML = files.map((f, i) => fileHtml(f, i, files.length)).join('');
    };
    const refreshFiles = async () => {
      const r = await api(`/api/admin/products/${id}`);
      files = r.files;
      if (here()) drawFiles();
    };
    drawFiles();
    const fileAction = async (fn, ok) => { try { await fn(); if (ok) toast(ok); await refreshFiles(); } catch (err) { toast(err.message, true); } };
    const putFile = (fid, data) => api(`/api/admin/files/${fid}`, { method: 'PUT', body: data });
    $('#file-list').addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.delFile) {
        if (!(await confirmDialog('Delete this file?', 'Customers will no longer be able to download it.', 'Delete', true))) return;
        fileAction(() => api(`/api/admin/files/${b.dataset.delFile}`, { method: 'DELETE' }), 'File deleted');
      }
      if (b.dataset.editLink) return linkModal(files.find(f => f.id === Number(b.dataset.editLink)));
      if (b.dataset.renFile) {
        const cur = files.find(f => f.id === Number(b.dataset.renFile)).name;
        modal(`<h3>Rename file</h3><form id="rn"><label class="field" style="margin-top:14px"><span>Name buyers see</span><input class="input" name="name" value="${esc(cur)}"></label>
          <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form>`, (m, close) => {
          $('#rn', m).addEventListener('submit', e2 => { e2.preventDefault(); close(); fileAction(() => putFile(b.dataset.renFile, { name: e2.target.name.value })); });
        });
      }
      if (b.dataset.moveFile) {
        const [fid, dir] = b.dataset.moveFile.split(':');
        const ids = files.map(f => f.id), i = ids.indexOf(Number(fid)), j = i + Number(dir);
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        fileAction(() => Promise.all(ids.map((x, k) => putFile(x, { sort: k }))));
      }
    });
    $('#file-list').addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.previewFile) fileAction(() => putFile(t.dataset.previewFile, { preview: t.checked }), t.checked ? 'Visitors can now preview this file' : 'Preview turned off');
      if (t.dataset.previewPages) fileAction(() => putFile(t.dataset.previewPages, { preview_pages: Number(t.value) }), `Preview shows the first ${plural(Number(t.value), 'page')}`);
    });

    // A link instead of an upload: buyers press Download and are sent to it. Only buyers ever get the address.
    const linkModal = (f = null) => modal(`<h3>${f ? 'Edit link' : 'Add a link'}</h3>
      <p class="muted" style="margin:6px 0 0;font-size:13.5px">For big files kept on Google Drive, Dropbox or similar. Buyers see it with their other files, and pressing Download takes them there. Visitors never see the address.</p>
      <form id="lf" style="margin-top:16px">
        <label class="field"><span>Link</span><input class="input" name="url" type="url" required placeholder="https://drive.google.com/drive/folders/..." value="${esc(f?.url || '')}"></label>
        <label class="field"><span>Name buyers see</span><input class="input" name="name" placeholder="Full course videos" value="${esc(f?.name || '')}"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label class="field"><span>What's there</span><select class="input" name="kind"><option value="video"${f?.kind === 'video' || !f ? ' selected' : ''}>Videos</option><option value="file"${f && f.kind !== 'video' ? ' selected' : ''}>Files (ZIP, PDFs, other)</option></select></label>
          <label class="field"><span>Size (optional)</span><input class="input" name="size" placeholder="e.g. 4.5 GB" value="${f?.size ? esc(size(f.size)) : ''}"></label>
        </div>
        <div style="font-size:13px;margin:4px 0 0;padding:10px 12px;border-radius:10px;background:rgba(243,178,108,.08);border:1px solid rgba(243,178,108,.25);color:var(--muted)">On Google Drive, set sharing to <b>Anyone with the link</b> (Viewer), or buyers will be asked to request access.</div>
        <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">${f ? 'Save' : 'Add link'}</button></div>
      </form>`, (m, close) => {
      $('#lf', m).addEventListener('submit', async e => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target));
        try {
          if (f) await api(`/api/admin/files/${f.id}`, { method: 'PUT', body: { ...body, name: body.name || f.name } });
          else await api(`/api/admin/products/${id}/links`, { method: 'POST', body });
          close(); toast(f ? 'Link saved' : 'Link added'); await refreshFiles();
        } catch (err) { toast(err.message, true); }
      });
    });
    $('#add-link').addEventListener('click', () => linkModal());

    // Uploads go one file at a time, each with its own progress bar, and keep going if you leave this page.
    const dz = $('[data-drop]');
    const input = Object.assign(document.createElement('input'), { type: 'file', multiple: true, hidden: true });
    dz.after(input);
    let queue = Promise.resolve();
    const send = picked => {
      for (const file of picked) {
        const row = document.createElement('div');
        row.className = 'up-row';
        row.innerHTML = `<div class="up-top"><span class="grow">${esc(file.name)}</span><small class="dim">Waiting</small></div><div class="upbar"><i></i></div>`;
        $('#up-list').append(row);
        busy.uploads++;
        queue = queue.then(async () => {
          const pct = row.querySelector('small'), bar = row.querySelector('.upbar i');
          const fd = new FormData(); fd.append('files', file);
          try {
            await upload(`/api/admin/products/${id}/files`, fd, x => { bar.style.width = x * 100 + '%'; pct.textContent = `${Math.round(x * 100)}%`; });
            row.remove();
            await refreshFiles().catch(() => {});
            if (!here()) toast(`${file.name} uploaded to ${e0.title}`);
          } catch (err) {
            pct.textContent = 'Failed'; row.classList.add('failed');
            toast(`${file.name}: ${err.message}`, true);
          } finally { busy.uploads--; }
        });
      }
    };
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { send([...input.files]); input.value = ''; });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); send([...e.dataTransfer.files]); });
  }

  const PREVIEWABLE = ['video', 'audio', 'pdf', 'image'];
  function fileHtml(f, i, count) {
    if (f.link) return `<div class="mini-file"><div class="file-ico ${f.kind}" style="width:30px;height:30px">${A.link.replace('<svg', '<svg width="14" height="14"')}</div><span class="grow" title="${esc(f.name)}">${esc(f.name)}</span><small class="dim" style="white-space:nowrap">${esc(f.host)}${f.size ? ' · ' + size(f.size) : ''}</small>
      <button class="icon-btn" data-move-file="${f.id}:-1" ${i === 0 ? 'disabled' : ''} title="Move up">${A.up}</button><button class="icon-btn" data-move-file="${f.id}:1" ${i === count - 1 ? 'disabled' : ''} title="Move down">${A.dn}</button>
      <a class="icon-btn" href="/api/files/${f.id}" target="_blank" rel="noopener noreferrer" title="Open link">${A.eye}</a>
      <button class="icon-btn" data-edit-link="${f.id}" title="Edit">${A.edit}</button><button class="icon-btn" data-del-file="${f.id}" title="Delete">${A.trash}</button></div>`;
    const preview = PREVIEWABLE.includes(f.kind)
      ? `<label class="check" style="font-size:12px;gap:6px;white-space:nowrap" title="Visitors can view this file on the product page, but not download it"><span class="switch" style="transform:scale(.8)"><input type="checkbox" data-preview-file="${f.id}" ${f.preview ? 'checked' : ''}><i></i></span><span class="${f.preview ? '' : 'dim'}">Free preview</span></label>`
      : '';
    const pages = f.kind === 'pdf' && f.preview
      ? `<div class="mini-sub">Visitors can view the first <select class="input pages-sel" data-preview-pages="${f.id}">${[1, 2, 3, 5, 10].map(n => `<option value="${n}" ${n === f.previewPages ? 'selected' : ''}>${plural(n, 'page')}</option>`).join('')}</select> of this PDF. Buyers get all of it.</div>`
      : '';
    return `<div class="mini-file"><div class="file-ico ${f.kind}" style="width:30px;height:30px;font-size:8.5px">${esc(extOf(f.name))}</div><span class="grow" title="${esc(f.name)}">${esc(f.name)}</span><small class="dim" style="white-space:nowrap">${size(f.size)}</small>
      ${preview}
      <button class="icon-btn" data-move-file="${f.id}:-1" ${i === 0 ? 'disabled' : ''} title="Move up">${A.up}</button><button class="icon-btn" data-move-file="${f.id}:1" ${i === count - 1 ? 'disabled' : ''} title="Move down">${A.dn}</button>
      <a class="icon-btn" href="/api/files/${f.id}?inline=1" target="_blank" title="Open">${A.eye}</a>
      <button class="icon-btn" data-ren-file="${f.id}" title="Rename">${A.edit}</button><button class="icon-btn" data-del-file="${f.id}" title="Delete">${A.trash}</button>${pages}</div>`;
  }

  // ---------- homepage Featured order ----------
  // Drag the featured products (or use the arrows) into the order visitors see on the homepage.
  async function arrangeFeatured() {
    let items;
    try { items = await api('/api/admin/featured'); } catch (err) { return toast(err.message, true); }
    const draw = m => {
      $('#fo-list', m).innerHTML = items.map((p, i) => `<div class="fo-row" draggable="true" data-i="${i}">
        <span class="fo-grip" aria-hidden="true">⋮⋮</span><span class="fo-n">${i + 1}</span>
        <div class="thumb">${p.cover ? coverThumb(p.cover, p.coverVideo) : coverHtml(p)}</div>
        <span class="grow">${esc(p.title)}</span>
        <button type="button" class="icon-btn" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''} title="Move up">${A.up}</button>
        <button type="button" class="icon-btn" data-mv="${i}:1" ${i === items.length - 1 ? 'disabled' : ''} title="Move down">${A.dn}</button></div>`).join('');
    };
    const move = (from, to, m) => { if (to < 0 || to >= items.length || to === from) return; const [x] = items.splice(from, 1); items.splice(to, 0, x); draw(m); };
    modal(`<h3>Arrange featured products</h3>
      <p class="muted" style="margin:6px 0 0;font-size:13.5px">Drag them, or use the arrows, into the order you want on the homepage. The first one shows first, and the Featured section shows up to 8.</p>
      <div id="fo-list" class="fo-list"></div>
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" id="fo-save">Save order</button></div>`, (m, close) => {
      m.style.maxWidth = '620px';
      draw(m);
      const listEl = $('#fo-list', m);
      listEl.addEventListener('click', e => { const b = e.target.closest('[data-mv]'); if (!b) return; const [i, d] = b.dataset.mv.split(':').map(Number); move(i, i + d, m); });
      let from = null;
      listEl.addEventListener('dragstart', e => { const r = e.target.closest('.fo-row'); if (!r) return; from = Number(r.dataset.i); r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'featured'); });
      listEl.addEventListener('dragover', e => { if (from === null) return; e.preventDefault(); $$('.fo-row', m).forEach(r => r.classList.toggle('drop-here', r === e.target.closest('.fo-row') && Number(r.dataset.i) !== from)); });
      listEl.addEventListener('drop', e => { e.preventDefault(); const r = e.target.closest('.fo-row'); const f = from; from = null; if (r && f !== null) move(f, Number(r.dataset.i), m); });
      listEl.addEventListener('dragend', () => { from = null; $$('.fo-row', m).forEach(r => r.classList.remove('dragging', 'drop-here')); });
      $('#fo-save', m).addEventListener('click', async () => {
        try { await api('/api/admin/featured', { method: 'PUT', body: { order: items.map(p => p.id) } }); close(); toast('Homepage order saved'); }
        catch (err) { toast(err.message, true); }
      });
    });
  }

  // ---------- description editor ----------
  // Turns the description textarea into a formatting editor: headings, bold, colours, lists, links, pictures, videos.
  // The textarea stays (hidden) and holds the result, so saving works as before. Old plain-text descriptions open
  // formatted and are only rewritten once you change them.
  const RI = {
    b: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></svg>',
    i: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 5h-4M14 19h-4M14.5 5l-5 14M19 5h-5M10 19H5"/></svg>',
    u: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/></svg>',
    s: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h16M16.5 7.5C16 5.5 14.3 4.5 12 4.5c-2.8 0-4.5 1.4-4.5 3.4 0 1.3.8 2.3 2.5 3M7.5 16.5c.5 2 2.2 3 4.5 3 2.8 0 4.5-1.4 4.5-3.4"/></svg>',
    link: A.link,
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
    color: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 16 6-12 6 12M8.5 11h7"/></svg>',
    mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m9 15 7.5-7.5a2.1 2.1 0 0 0-3-3L6 12l-1 4z"/><path d="M4 20h7"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
    center: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>',
    ol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 6h10M10 12h10M10 18h10M4 5h1.5v4M4 9h3M4 14.5a1.5 1.5 0 0 1 3 .2c0 .8-3 2.3-3 3.3h3"/></svg>',
    ul: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 6h10M10 12h10M10 18h10"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/></svg>',
    clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 5h12M12 5l-3 14M4 21h8M15 15l5 5M20 15l-5 5"/></svg>',
  };
  // YouTube or Vimeo address -> the privacy-friendly embed address (or null).
  const embedUrl = u => {
    const s = String(u || '').trim();
    let m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/);
    if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
    m = s.match(/vimeo\.com\/(?:video\/)?(\d{4,12})/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  };
  const { cleanHtml, isRich, md } = window.Store;
  function richEditor(ta, { productId, placeholder = '' } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'rte';
    const btn = (cmd, icon, title) => `<button type="button" data-cmd="${cmd}" title="${title}" aria-label="${title}">${icon}</button>`;
    wrap.innerHTML = `<div class="rte-bar" role="toolbar" aria-label="Formatting">
        <select data-block title="Text style" aria-label="Text style"><option value="p">Normal</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="h4">Heading 3</option><option value="blockquote">Quote</option></select><span class="sep"></span>
        ${btn('bold', RI.b, 'Bold (Ctrl+B)')}${btn('italic', RI.i, 'Italic (Ctrl+I)')}${btn('underline', RI.u, 'Underline (Ctrl+U)')}${btn('strikeThrough', RI.s, 'Strikethrough')}<span class="sep"></span>
        ${btn('link', RI.link, 'Link')}${productId ? btn('image', RI.img, 'Add a picture') : ''}${btn('video', RI.video, 'Add a YouTube or Vimeo video')}${btn('code', RI.code, 'Code')}<span class="sep"></span>
        <label class="rte-col" title="Text colour">${RI.color}<i style="background:#f3b26c"></i><input type="color" data-color="foreColor" value="#f3b26c" aria-label="Text colour"></label>
        <label class="rte-col" title="Highlight">${RI.mark}<i style="background:#5a3a12"></i><input type="color" data-color="hiliteColor" value="#5a3a12" aria-label="Highlight"></label><span class="sep"></span>
        ${btn('justifyLeft', RI.left, 'Align left')}${btn('justifyCenter', RI.center, 'Centre')}${btn('justifyRight', RI.right, 'Align right')}<span class="sep"></span>
        ${btn('insertOrderedList', RI.ol, 'Numbered list')}${btn('insertUnorderedList', RI.ul, 'Bullet list')}<span class="sep"></span>
        ${btn('clear', RI.clear, 'Clear formatting')}
      </div>
      <div class="rte-body prose" contenteditable="true" data-placeholder="${esc(placeholder)}" role="textbox" aria-multiline="true" aria-label="Description"></div>
      <div class="rte-foot"><span>${productId ? 'Paste or drop pictures straight in.' : 'You can add pictures after creating the product.'}</span><span data-count></span></div>`;
    ta.hidden = true;
    ta.after(wrap);
    const ed = $('.rte-body', wrap), bar = $('.rte-bar', wrap);
    const startHtml = ta.value.trim() ? (isRich(ta.value) ? cleanHtml(ta.value) : md(ta.value)) : '';
    ed.innerHTML = startHtml;
    const count = () => { const n = (ed.innerText.trim().match(/\S+/g) || []).length; $('[data-count]', wrap).textContent = n ? plural(n, 'word') : ''; };
    count();
    // Keep the hidden textarea in step and tell the form something changed (autosave listens for that).
    const sync = () => {
      const empty = !ed.textContent.trim() && !ed.querySelector('img, iframe');
      ta.value = empty ? '' : cleanHtml(ed.innerHTML);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      count();
    };
    ed.addEventListener('input', e => { e.stopPropagation(); sync(); });
    // Bold, italic and lists as plain tags (<b>, <i>, <ul>); only colours need inline styles.
    try { document.execCommand('styleWithCSS', false, false); document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}

    // The selection is lost when a dialog opens; keep the last one inside the editor.
    let range = null;
    const keep = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) range = s.getRangeAt(0).cloneRange(); };
    const restore = () => {
      keep(); // the current selection, if it's in the editor
      ed.focus();
      if (!range || !ed.contains(range.startContainer)) { range = document.createRange(); range.selectNodeContents(ed); range.collapse(false); } // no cursor yet: add at the end
      const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    };
    const exec = (cmd, val = null) => {
      restore();
      const css = cmd === 'foreColor' || cmd === 'hiliteColor';
      if (css) document.execCommand('styleWithCSS', false, true);
      document.execCommand(cmd, false, val);
      if (css) document.execCommand('styleWithCSS', false, false);
      keep(); sync(); paint();
    };
    const insert = html => exec('insertHTML', html);
    const paint = () => {
      if (!ed.contains(getSelection().anchorNode)) return;
      $$('[data-cmd]', bar).forEach(b => { try { b.classList.toggle('on', document.queryCommandState(b.dataset.cmd)); } catch {} });
      let blk = ''; try { blk = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch {}
      $('[data-block]', bar).value = ['h2', 'h3', 'h4', 'blockquote'].includes(blk) ? blk : 'p';
    };
    document.addEventListener('selectionchange', () => { if (!document.body.contains(ed)) return; keep(); paint(); });
    // Toolbar buttons must not take focus away from the text.
    bar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });

    const uploadImages = async list => {
      const imgs = [...list].filter(f => /^image\//.test(f.type));
      if (!imgs.length) return;
      if (!productId) return toast('Create the product first, then add pictures.', true);
      for (const f of imgs) {
        toast(`Uploading ${f.name || 'picture'}...`);
        const fd = new FormData(); fd.append('cover', f);
        try {
          const r = await upload(`/api/admin/products/${productId}/description-image`, fd);
          insert(`<img src="${esc(r.url)}" alt="${esc((f.name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 120))}"><p><br></p>`);
        } catch (err) { toast(err.message, true); }
      }
    };
    const picker = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, hidden: true });
    wrap.append(picker);
    picker.addEventListener('change', () => { uploadImages(picker.files); picker.value = ''; });

    const linkDialog = () => {
      const a = getSelection().anchorNode?.parentElement?.closest('a');
      modal(`<h3>${a ? 'Edit link' : 'Add a link'}</h3><form id="rl" style="margin-top:14px">
        <label class="field"><span>Link</span><input class="input" name="url" required placeholder="https://... or #/p/product-slug" value="${esc(a?.getAttribute('href') || '')}"></label>
        <div class="actions">${a ? '<button type="button" class="btn" id="rl-remove">Remove link</button>' : ''}<button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form>`, (m, close) => {
        $('#rl-remove', m)?.addEventListener('click', () => { close(); restore(); if (a) { const s = getSelection(); const r = document.createRange(); r.selectNodeContents(a); s.removeAllRanges(); s.addRange(r); range = r; } exec('unlink'); });
        $('#rl', m).addEventListener('submit', e => {
          e.preventDefault();
          let url = e.target.url.value.trim();
          if (!/^(https?:\/\/|mailto:|#\/)/i.test(url)) url = /@/.test(url) && !/\//.test(url) ? 'mailto:' + url : 'https://' + url.replace(/^\/+/, '');
          close();
          if (a) { a.setAttribute('href', url); sync(); return; }
          if (range && !range.collapsed) exec('createLink', url);
          else insert(`<a href="${esc(url)}">${esc(url.replace(/^(https?:\/\/|mailto:)/, ''))}</a>&nbsp;`);
        });
      });
    };
    const videoDialog = () => modal(`<h3>Add a video</h3><p class="muted" style="margin:6px 0 0;font-size:13.5px">Paste a YouTube or Vimeo link. It plays right in the description.</p>
      <form id="rv" style="margin-top:14px"><label class="field"><span>Video link</span><input class="input" name="url" required placeholder="https://www.youtube.com/watch?v=..."></label>
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Add video</button></div></form>`, (m, close) => {
      $('#rv', m).addEventListener('submit', e => {
        e.preventDefault();
        const src = embedUrl(e.target.url.value);
        if (!src) return toast('That is not a YouTube or Vimeo link.', true);
        close();
        insert(`<div class="rt-video"><iframe src="${src}"></iframe></div><p><br></p>`);
      });
    });

    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-cmd]'); if (!b) return;
      const cmd = b.dataset.cmd;
      if (cmd === 'link') return linkDialog();
      if (cmd === 'image') return picker.click();
      if (cmd === 'video') return videoDialog();
      if (cmd === 'code') { const t = range && !range.collapsed ? range.toString() : ''; return insert(`<code>${esc(t || 'code')}</code>&nbsp;`); }
      if (cmd === 'clear') { exec('removeFormat'); exec('unlink'); return exec('formatBlock', '<p>'); }
      exec(cmd);
    });
    $('[data-block]', bar).addEventListener('change', e => exec('formatBlock', `<${e.target.value}>`));
    $$('[data-color]', bar).forEach(inp => inp.addEventListener('input', () => {
      inp.previousElementSibling.style.background = inp.value;
      exec(inp.dataset.color, inp.value);
    }));

    // Pasting keeps the structure (headings, lists, links, bold) but not other sites' fonts and colours.
    ed.addEventListener('paste', e => {
      const cd = e.clipboardData;
      if (cd.files?.length) { e.preventDefault(); return uploadImages(cd.files); }
      const html = cd.getData('text/html');
      if (!html) return; // plain text pastes as it is
      e.preventDefault();
      const box = document.createElement('div');
      box.innerHTML = cleanHtml(html.replace(/<!--[\s\S]*?-->/g, ''));
      box.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
      box.querySelectorAll('img').forEach(img => { if (!/^\/media\/covers\//.test(img.getAttribute('src'))) img.remove(); }); // pictures from other sites: upload them instead
      document.execCommand('insertHTML', false, box.innerHTML);
      sync();
    });
    ed.addEventListener('dragover', e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
    ed.addEventListener('drop', e => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      const pos = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (pos && ed.contains(pos.startContainer)) range = pos;
      uploadImages(e.dataTransfer.files);
    });
    ed.addEventListener('click', e => {
      $$('img.sel', ed).forEach(i => i.classList.remove('sel'));
      if (e.target.tagName === 'IMG') { e.target.classList.add('sel'); const r = document.createRange(); r.selectNode(e.target); const s = getSelection(); s.removeAllRanges(); s.addRange(r); range = r; }
    });
    return { el: ed, sync };
  }

  // ---------- categories ----------
  async function categories() {
    const list = await api('/api/admin/categories');
    layout('categories', head('Categories', `<button class="btn btn-primary" id="new">${I.plus.replace('<svg', '<svg width="14" height="14"')} New category</button>`) + (list.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Name</th><th>Description</th><th>Products</th><th>Order</th><th></th></tr>
      ${list.map(c => `<tr><td>${esc(c.name)}</td><td class="muted">${esc(c.description)}</td><td>${c.count}</td><td>${c.sort}</td>
        <td style="text-align:right;white-space:nowrap"><button class="icon-btn" data-edit="${c.id}">${A.edit}</button><button class="icon-btn" data-del="${c.id}">${A.trash}</button></td></tr>`).join('')}</table></div>`
      : '<div class="empty"><h3>No categories</h3><p>Group your products, e.g. Video Packs, Templates, Presets, Ebooks.</p></div>'));
    const form = (c = {}) => modal(`<h3>${c.id ? 'Edit' : 'New'} category</h3><form id="cf" style="margin-top:16px">
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(c.name || '')}" required></label>
      <label class="field"><span>Description</span><input class="input" name="description" value="${esc(c.description || '')}"></label>
      <label class="field"><span>Display order</span><input class="input" name="sort" type="number" value="${c.sort ?? list.length}"></label>
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form>`, (m, close) => {
      $('#cf', m).addEventListener('submit', async e => {
        e.preventDefault();
        try {
          await api(`/api/admin/categories${c.id ? '/' + c.id : ''}`, { method: c.id ? 'PUT' : 'POST', body: Object.fromEntries(new FormData(e.target)) });
          close(); await loadStore(); categories();
        } catch (err) { toast(err.message, true); }
      });
    });
    $('#new').addEventListener('click', () => form());
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => form(list.find(c => c.id === Number(b.dataset.edit)))));
    $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Delete category?', 'Products in it will become uncategorised (not deleted).', 'Delete', true))) return;
      await api(`/api/admin/categories/${b.dataset.del}`, { method: 'DELETE' }); await loadStore(); categories();
    }));
  }

  // ---------- orders / customers ----------
  async function orders() {
    const list = await api('/api/admin/orders');
    const shown = list.filter(o => o.status !== 'pending');
    const csv = () => {
      const rows = [['ref', 'date', 'name', 'email', 'phone', 'product', 'amount', 'currency', 'status', 'coupon', 'referred_by', 'commission', 'download_link'], ...shown.map(o => [o.ref, o.created_at, o.name || '', o.email, o.phone || '', o.title, (o.amount_cents / 100).toFixed(2), o.currency, o.status, o.coupon_code || '', o.affiliate_code || '', (o.commission_cents / 100).toFixed(2), o.link])];
      const blob = new Blob([rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
      Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'orders.csv' }).click();
    };
    layout('orders', head('Orders', `<button class="btn" id="csv">Export CSV</button>`) + (shown.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Ref</th><th>Date</th><th>Buyer</th><th>Product</th><th>Amount</th><th>Status</th><th></th></tr>
      ${shown.map(o => `<tr><td class="dim" style="font-family:var(--mono);font-size:12px">${esc(o.ref)}</td><td class="muted">${date(o.created_at)}</td><td><div>${esc(o.name || 'No name')}</div><small class="dim">${esc(o.email)}${o.phone ? ' · ' + esc(o.phone) : ''}</small>${o.affiliate_code ? `<div><span class="status free" title="Referred by an affiliate">via ${esc(o.affiliate_code)}</span></div>` : ''}</td><td>${esc(o.title)}</td>
        <td>${o.amount_cents ? money(o.amount_cents, o.currency) : 'Free'}${o.coupon_code ? ` <small class="dim">${esc(o.coupon_code)}</small>` : ''}</td><td>${statusPill(o.status)}</td>
        <td style="text-align:right;white-space:nowrap">${o.status !== 'refunded' ? `<button class="btn btn-sm btn-ghost" data-copy="${esc(o.link)}" title="Copy this buyer's private download link">Copy link</button>${S.store.emails ? `<button class="btn btn-sm btn-ghost" data-resend="${o.id}">Email link</button>` : ''}<button class="btn btn-sm btn-ghost" data-revoke="${o.id}">Revoke</button>` : ''}</td></tr>`).join('')}</table></div>`
      : '<div class="empty"><h3>No orders yet</h3><p>Purchases and free claims will show up here.</p></div>'));
    $('#csv').addEventListener('click', csv);
    $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('Download link copied. Paste it to the buyer.'); } catch { prompt('Copy this link:', b.dataset.copy); }
    }));
    $$('[data-resend]').forEach(b => b.addEventListener('click', async () => {
      try { await api(`/api/admin/orders/${b.dataset.resend}/resend`, { method: 'POST' }); toast('Download link emailed'); } catch (err) { toast(err.message, true); }
    }));
    $$('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Revoke access?', 'The customer loses access to this product. Refund the payment separately in your Paystack dashboard.', 'Revoke', true))) return;
      await api(`/api/admin/orders/${b.dataset.revoke}/revoke`, { method: 'POST' }); orders();
    }));
  }
  // A CSV cell. Values starting with = + - @ are prefixed with ' so spreadsheet apps never run them as formulas.
  const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  async function customers(filter = 'all') {
    const [everyone, sent] = await Promise.all([api('/api/admin/customers'), api('/api/admin/announcements')]);
    const GROUPS = [['all', 'Everyone with a product'], ['paid', 'Paying buyers'], ['free', 'Free downloads only'], ['unfinished', 'Started checkout, never paid']];
    const pick = k => (k === 'all' ? everyone.filter(u => u.kind !== 'unfinished') : everyone.filter(u => u.kind === k));
    const list = pick(filter);
    const count = k => pick(k).length;
    layout('customers', head('Customers', `<select class="input" id="cust-filter" style="width:auto;min-width:220px">${GROUPS.map(([k, l]) => `<option value="${k}" ${k === filter ? 'selected' : ''}>${l} (${count(k)})</option>`).join('')}</select><button class="btn" id="csv" ${list.length ? '' : 'disabled'}>${I.down} Export ${plural(list.length, 'contact')}</button>`) + `
      <p class="muted" style="margin:-6px 0 16px;font-size:13px;max-width:760px">Everyone who bought or downloaded something from your store. Export the list as a spreadsheet (CSV) to import into an email tool like Mailchimp, Brevo or Kit, or a WhatsApp broadcast list. Or tell them about a new product from here: open a product's <b style="color:var(--text);font-weight:500">⋯</b> menu on the Products page and choose <b style="color:var(--text);font-weight:500">Email past buyers</b>.</p>
      ${sent.length ? `<div class="panel tbl-wrap" style="padding:0;margin-bottom:18px"><div class="box-head"><h3 style="font-size:18px">Product announcements</h3><span class="muted" style="font-size:12.5px">${people(everyone.filter(u => u.unsubscribed_at).length)} unsubscribed</span></div>
        <table class="tbl"><tr><th>Product</th><th>Subject</th><th>Started</th><th>Sent</th><th>Status</th><th></th></tr>
        ${sent.map(a => `<tr><td>${esc(a.title)}</td><td class="muted">${esc(a.subject)}</td><td class="muted">${date(a.created_at)}</td><td>${a.sent} of ${a.total}${a.failed ? ` <small style="color:#ff8b7a">${a.failed} failed</small>` : ''}</td>
          <td>${a.status === 'sending' ? `<span class="status pending">sending</span>${a.queued ? ` <small class="dim">${a.queued} waiting</small>` : ''}` : a.status === 'done' ? '<span class="status live">sent</span>' : '<span class="status draft">stopped</span>'}</td>
          <td style="text-align:right">${a.status === 'sending' ? `<button class="btn btn-sm btn-ghost" data-stop="${a.id}">Stop</button>` : ''}</td></tr>`).join('')}</table></div>` : ''}` + (list.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Name</th><th>Email</th><th>Phone</th><th>Products</th><th>Last order</th><th>Spent</th></tr>
      ${list.map(u => `<tr><td>${esc(u.name || 'No name')}</td><td class="muted">${esc(u.email)}${u.unsubscribed_at ? ' <span class="status draft" title="Unsubscribed from product announcements">unsubscribed</span>' : ''}</td><td class="muted">${esc(u.phone || '')}</td><td>${u.titles.length ? `<span title="${esc(u.titles.join('\n'))}">${esc(u.titles[0])}${u.titles.length > 1 ? ` <small class="dim">+${u.titles.length - 1}</small>` : ''}</span>` : '<span class="dim">None yet</span>'}</td><td class="muted">${u.last_at ? date(u.last_at) : date(u.created_at)}</td><td>${u.spent ? money(u.spent) : '<span class="dim">Free</span>'}</td></tr>`).join('')}</table></div>`
      : `<div class="empty"><h3>Nobody here yet</h3><p>${filter === 'unfinished' ? 'People who start paying but don\'t finish show up here.' : 'Everyone who buys or grabs a free product shows up here with their name and email.'}</p></div>`));
    $('#cust-filter').addEventListener('change', e => customers(e.target.value));
    $$('[data-stop]').forEach(b => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Stop sending?', 'Emails already sent stay sent. Nobody else in this announcement gets it.', 'Stop sending', true))) return;
      await api(`/api/admin/announcements/${b.dataset.stop}/stop`, { method: 'POST' }); toast('Stopped'); customers(filter);
    }));
    $('#csv').addEventListener('click', () => {
      const rows = [['email', 'name', 'phone', 'type', 'products', 'first_seen', 'last_order', 'orders', 'spent', 'unsubscribed'],
        ...list.map(u => [u.email, u.name || '', u.phone || '', u.kind, u.titles.join('; '), (u.created_at || '').slice(0, 10), (u.last_at || '').slice(0, 10), u.products, (u.spent / 100).toFixed(2), u.unsubscribed_at ? 'yes' : ''])];
      const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const day = new Date().toISOString().slice(0, 10);
      Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `carsinstore-${filter === 'all' ? 'customers' : filter}-${day}.csv` }).click();
      toast(`Exported ${plural(list.length, 'contact')}`);
    });
  }

  // Extra currencies switched on in Store settings (besides the store currency).
  function extraCurrencies() {
    const main = (S.store.settings.currency || 'ngn').toLowerCase();
    return String(S.store.settings.extra_currencies || '').toLowerCase().split(',').map(c => c.trim()).filter(c => c && c !== main);
  }

  // ---------- affiliates ----------
  async function affiliates() {
    const list = await api('/api/admin/affiliates');
    const owedText = a => a.totals.filter(t => t.owed).map(t => money(t.owed, t.currency)).join(' + ') || 'Nothing owed';
    const payHow = a => a.auto ? `<span class="status live">automatic</span><br><small class="dim">${esc(a.auto.bank)} ••${esc(a.auto.last4)}</small>` : '<span class="status">manual</span>';
    layout('affiliates', head('Affiliates', `<button class="btn btn-primary" id="new">${I.plus.replace('<svg', '<svg width="14" height="14"')} New affiliate</button>`) + `
      <p class="muted" style="margin:-12px 0 22px;font-size:13.5px;max-width:700px">Partners share their link and earn a commission on every paid order from buyers who arrive through it (within 30 days). Partners with a bank account on file are paid by Paystack automatically on each sale. Anyone else, you pay yourself and record it here. Each partner has a private stats page you can send them.</p>` + (list.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Partner</th><th>Code</th><th>Commission</th><th>Sales</th><th>Payouts</th><th>Owed</th><th>Status</th><th></th></tr>
      ${list.map(a => `<tr><td><div>${esc(a.name)}</div><small class="dim">${esc(a.email)}</small></td><td style="font-family:var(--mono)">${esc(a.code)}</td>
        <td>${a.percent}%</td><td>${a.sales}</td><td>${payHow(a)}</td><td style="color:${a.totals.some(t => t.owed) ? 'var(--amber)' : 'var(--muted)'}">${owedText(a)}</td><td>${a.active ? '<span class="status live">active</span>' : '<span class="status">paused</span>'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm btn-ghost" data-link="${a.id}">Copy link</button><button class="btn btn-sm btn-ghost" data-stats="${a.id}" title="Their private stats page">Stats page</button>
          ${a.totals.some(t => t.owed) ? `<button class="btn btn-sm btn-ghost" data-pay="${a.id}">Record payout</button>` : ''}<button class="icon-btn" data-edit="${a.id}" title="Edit">${A.edit}</button></td></tr>`).join('')}</table></div>`
      : `<div class="panel aff-how"><h3>How affiliates work</h3><ol>
          <li><b>Add a partner</b><span>Their name, email, commission (for example 20%) and bank account. Nobody needs an account on the store, not them and not the buyers.</span></li>
          <li><b>Send them two links</b><span>Their referral link to share, and a private stats page where they see their sales and earnings.</span></li>
          <li><b>Buyers buy as usual</b><span>Anyone who opens their link and pays within 30 days counts as their sale. The commission is worked out on the price actually paid.</span></li>
          <li><b>Paystack pays them</b><span>On each of their sales, Paystack sends their commission straight to their bank and the rest to yours. You cover Paystack's fee. No bank account on file? Then you pay them yourself and click Record payout.</span></li>
        </ol><button class="btn btn-primary" id="new2">${I.plus.replace('<svg', '<svg width="14" height="14"')} Add your first partner</button></div>`));
    $('#new2')?.addEventListener('click', () => form());
    const find = id => list.find(a => a.id === Number(id));
    const copyText = async (text, ok) => { try { await navigator.clipboard.writeText(text); toast(ok); } catch { prompt('Copy:', text); } };
    $$('[data-link]').forEach(b => b.addEventListener('click', () => copyText(find(b.dataset.link).link, 'Referral link copied')));
    $$('[data-stats]').forEach(b => b.addEventListener('click', () => copyText(find(b.dataset.stats).statsUrl, 'Stats page link copied. Send it to your partner.')));

    let banks = null;
    const loadBanks = async () => (banks = banks || await api('/api/admin/banks').catch(() => []));
    const form = async (a = {}) => {
      const bankList = S.store.payments === 'paystack' ? await loadBanks() : [];
      modal(`<h3>${a.id ? 'Edit' : 'New'} affiliate</h3><form id="af" style="margin-top:16px">
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(a.name || '')}" required></label>
      <label class="field"><span>Email</span><input class="input" name="email" type="email" value="${esc(a.email || '')}" required><small>Their own purchases don't earn commission.</small></label>
      <div class="row"><label class="field"><span>Commission %</span><input class="input" name="percent" type="number" min="1" max="90" value="${a.percent ?? 20}" required></label>
      ${a.id ? `<label class="field"><span>Status</span><select class="input" name="active"><option value="1" ${a.active ? 'selected' : ''}>Active</option><option value="0" ${a.active ? '' : 'selected'}>Paused</option></select></label>`
        : `<label class="field"><span>Code (optional)</span><input class="input" name="code" placeholder="e.g. ADA" style="text-transform:uppercase"><small>Used in their link. Made from their name if empty.</small></label>`}</div>
      ${a.id ? '<small class="dim" style="display:block;margin:-6px 0 12px;font-size:12px">A new commission rate applies to future sales only.</small>' : ''}
      <div class="aff-bank">
        <b>Pay them automatically</b>
        ${S.store.payments !== 'paystack' ? '<p class="muted">Available once Paystack is connected. Until then you pay partners yourself.</p>' : a.auto ? `
          <p class="muted" id="bank-current">Paystack sends their commission to <b>${esc(a.auto.bank)} ••${esc(a.auto.last4)}</b> (${esc(a.auto.accountName)}) on each Naira sale.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-sm" id="bank-change">Change bank account</button><label class="check" style="font-size:13px"><input type="checkbox" name="stop_auto"> Stop automatic payouts</label></div>` : `
          <p class="muted">Paystack sends their commission straight to this account on each sale they bring in (Naira sales). Leave empty to pay them yourself.</p>`}
        <div id="bank-fields" ${a.auto ? 'hidden' : ''} ${S.store.payments !== 'paystack' ? 'hidden' : ''}>
          <div class="row"><label class="field"><span>Bank</span><input class="input" name="bank" list="bank-list" placeholder="Start typing, e.g. GTBank" autocomplete="off">
            <datalist id="bank-list">${bankList.map(b => `<option value="${esc(b.name)}">`).join('')}</datalist></label>
          <label class="field"><span>Account number</span><input class="input" name="account_number" inputmode="numeric" maxlength="10" placeholder="10 digits" autocomplete="off"></label></div>
          <small id="acct-name" class="dim" style="display:block;margin:-6px 0 4px;font-size:12.5px"></small>
        </div>
      </div>
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary" id="af-save">Save</button></div></form>`, (m, close) => {
        const f = $('#af', m);
        const bankCode = () => (bankList.find(b => b.name.toLowerCase() === f.bank?.value.trim().toLowerCase()) || {}).code;
        $('#bank-change', m)?.addEventListener('click', () => { $('#bank-fields', m).hidden = false; f.bank.focus(); });
        // Show the account holder's name as soon as the bank and 10 digits are in, to catch typos.
        let lookup = 0;
        const check = async () => {
          const out = $('#acct-name', m), code = bankCode(), num = f.account_number?.value.trim();
          if (!out) return;
          if (!code || !/^\d{10}$/.test(num || '')) { out.textContent = ''; return; }
          const mine = ++lookup; out.textContent = 'Checking account…'; out.style.color = '';
          try { const r = await api('/api/admin/banks/resolve', { method: 'POST', body: { bank_code: code, account_number: num } }); if (mine === lookup) { out.textContent = `Account name: ${r.accountName}`; out.style.color = 'var(--green)'; } }
          catch (err) { if (mine === lookup) { out.textContent = err.message; out.style.color = '#ff8b7a'; } }
        };
        f.bank?.addEventListener('change', check); f.account_number?.addEventListener('input', check);
        f.addEventListener('submit', async e => {
          e.preventDefault();
          const body = Object.fromEntries(new FormData(f));
          if (a.id) body.active = body.active === '1';
          body.stop_auto = !!body.stop_auto;
          if (body.bank || body.account_number) {
            body.bank_code = bankCode();
            if (!body.bank_code) return toast('Pick the bank from the list.', true);
          }
          delete body.bank;
          const save = $('#af-save', m); save.disabled = true; save.textContent = 'Saving…';
          try {
            const r = await api(`/api/admin/affiliates${a.id ? '/' + a.id : ''}`, { method: a.id ? 'PUT' : 'POST', body });
            close(); affiliates();
            if (r.warning) toast(r.warning, true);
            if (!a.id) modal(`<h3>${esc(r.name)} is set up</h3><p class="muted" style="margin:0 0 14px">${r.auto ? `Paystack will pay their commission to ${esc(r.auto.bank)} ••${esc(r.auto.last4)}. ` : ''}Send them both links:</p>
              <label class="field"><span>Referral link (to share)</span><input class="input" readonly value="${esc(r.link)}" onclick="this.select()"></label>
              <label class="field"><span>Private stats page (just for them)</span><input class="input" readonly value="${esc(r.statsUrl)}" onclick="this.select()"></label>
              <div class="actions"><button class="btn btn-primary" data-close>Done</button></div>`);
          } catch (err) { toast(err.message, true); save.disabled = false; save.textContent = 'Save'; }
        });
      });
    };
    $('#new').addEventListener('click', () => form());
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => form(find(b.dataset.edit))));
    $$('[data-pay]').forEach(b => b.addEventListener('click', () => {
      const a = find(b.dataset.pay);
      const owed = a.totals.filter(t => t.owed);
      const cur = (owed[0] || a.totals[0] || { currency: S.store.settings.currency || 'ngn' }).currency;
      const curs = [...new Set([cur, ...a.totals.map(t => t.currency)])];
      modal(`<h3>Record a payout to ${esc(a.name)}</h3><p class="muted" style="margin:0 0 16px">Owed: ${owedText(a)}. Record what you've sent them (e.g. by bank transfer).</p>
        <form id="pf2"><div class="row"><label class="field"><span>Amount</span><input class="input" name="amount" inputmode="decimal" required value="${owed[0] ? (owed[0].owed / 100) : ''}"></label>
        <label class="field"><span>Currency</span><select class="input" name="currency">${curs.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join('')}</select></label></div>
        <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Record payout</button></div></form>`, (m, close) => {
        $('#pf2', m).addEventListener('submit', async e => {
          e.preventDefault();
          try {
            await api(`/api/admin/affiliates/${a.id}/payout`, { method: 'POST', body: { currency: e.target.currency.value, amount_cents: Math.round(parseFloat(e.target.amount.value) * 100) } });
            close(); toast('Payout recorded'); affiliates();
          } catch (err) { toast(err.message, true); }
        });
      });
    }));
  }

  // ---------- coupons ----------
  async function coupons() {
    const list = await api('/api/admin/coupons');
    layout('coupons', head('Discount codes', `<button class="btn btn-primary" id="new">${I.plus.replace('<svg', '<svg width="14" height="14"')} New code</button>`) + (list.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Code</th><th>Discount</th><th>Used</th><th>Expires</th><th>Active</th><th></th></tr>
      ${list.map(c => `<tr><td style="font-family:var(--mono)">${esc(c.code)}</td><td>${c.percent_off ? c.percent_off + '% off' : money(c.amount_off_cents) + ' off'}</td>
        <td>${c.uses}${c.max_uses ? ' / ' + c.max_uses : ''}</td><td class="muted">${c.expires_at ? esc(c.expires_at) : 'Never'}</td>
        <td><label class="switch"><input type="checkbox" data-toggle="${c.id}" ${c.active ? 'checked' : ''}><i></i></label></td>
        <td style="text-align:right"><button class="icon-btn" data-del="${c.id}">${A.trash}</button></td></tr>`).join('')}</table></div>`
      : '<div class="empty"><h3>No discount codes</h3><p>Create codes for launches, newsletters or creators.</p></div>'));
    $('#new').addEventListener('click', () => modal(`<h3>New discount code</h3><form id="cf" style="margin-top:16px">
      <label class="field"><span>Code</span><input class="input" name="code" required placeholder="LAUNCH20" style="text-transform:uppercase"></label>
      <div class="row"><label class="field"><span>Percent off</span><input class="input" name="percent_off" type="number" min="1" max="100" placeholder="20"></label>
      <label class="field"><span>…or amount off</span><input class="input" name="amount" inputmode="decimal" placeholder="10.00"></label></div>
      <div class="row"><label class="field"><span>Max uses</span><input class="input" name="max_uses" type="number" min="1" placeholder="Unlimited"></label>
      <label class="field"><span>Expires</span><input class="input" name="expires_at" type="date"></label></div>
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Create code</button></div></form>`, (m, close) => {
      $('#cf', m).addEventListener('submit', async e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        try {
          await api('/api/admin/coupons', { method: 'POST', body: { code: f.code, percent_off: f.percent_off || null, amount_off_cents: f.amount ? Math.round(parseFloat(f.amount) * 100) : null, max_uses: f.max_uses || null, expires_at: f.expires_at ? f.expires_at + 'T23:59:59' : null } });
          close(); coupons();
        } catch (err) { toast(err.message, true); }
      });
    }));
    $$('[data-toggle]').forEach(i => i.addEventListener('change', () => api(`/api/admin/coupons/${i.dataset.toggle}`, { method: 'PUT', body: { active: i.checked } }).then(() => toast(i.checked ? 'Code enabled' : 'Code disabled'))));
    $$('[data-del]').forEach(b => b.addEventListener('click', async () => { await api(`/api/admin/coupons/${b.dataset.del}`, { method: 'DELETE' }); coupons(); }));
  }

  // ---------- settings ----------
  async function settings() {
    const s = await api('/api/admin/settings');
    const f = (k, label, hint = '', type = 'text') => `<label class="field"><span>${label}</span><input class="input" name="${k}" type="${type}" value="${esc(s[k] || '')}">${hint ? `<small>${hint}</small>` : ''}</label>`;
    layout('settings', head('Store settings', '<button class="btn btn-primary" id="save">Save settings</button>') + `<form id="sf"><div class="editor"><div>
      <div class="panel"><h3>Brand</h3>${f('store_name', 'Store name')}${f('tagline', 'Tagline')}${f('footer_blurb', 'Footer text')}
        <label class="field"><span>Currency</span><select class="input" name="currency">${[['ngn', 'NGN (Naira)'], ['ghs', 'GHS (Cedi)'], ['kes', 'KES (Shilling)'], ['zar', 'ZAR (Rand)'], ['usd', 'USD (Dollar)']].map(([c, l]) => `<option value="${c}" ${s.currency === c ? 'selected' : ''}>${l}</option>`).join('')}</select><small>Paystack charges in the currency your account is approved for. Naira works for every Nigerian account; USD needs to be enabled by Paystack.</small></label></div>
      <div class="panel"><h3>Homepage</h3>${f('announcement', 'Announcement bar', 'Leave empty to hide it.')}${f('hero_eyebrow', 'Hero label', 'The last word is highlighted.')}${f('hero_title', 'Hero headline', 'Use | to split into two lines. The second line is softly faded.')}
        <label class="field"><span>Hero text</span><textarea class="input" name="hero_sub" rows="3">${esc(s.hero_sub || '')}</textarea></label>
        <label class="check" style="margin-bottom:6px"><span class="switch"><input type="checkbox" data-flag="home_reviews" ${s.home_reviews !== '0' ? 'checked' : ''}><i></i></span>Show buyer reviews on the homepage</label>
        <small class="dim" style="display:block;font-size:12px">Up to 6 recent 4 and 5 star reviews with written comments. Hidden reviews never show. The section appears once you have one.</small></div>
      <div class="panel"><h3>FAQ <button type="button" class="btn btn-sm" id="add-faq">${I.plus.replace('<svg', '<svg width="13" height="13"')} Add question</button></h3><div id="faq"></div></div>
      <div class="panel"><h3>Legal pages</h3>
        <p class="muted" style="margin:-6px 0 16px;font-size:13px">Drafts written for how this store works (guest checkout, Paystack, emailed download links, Nigerian law). Read them and adjust anything that doesn't match your business. They're a starting point, not legal advice. <code>{{STORE}}</code>, <code>{{EMAIL}}</code>, <code>{{WEBSITE}}</code>, <code>{{LOCATION}}</code> and <code>{{UPDATED}}</code> are filled in automatically.</p>
        ${[['legal_terms', 'Terms of Sale', 'terms'], ['legal_refunds', 'Refund Policy', 'refunds'], ['legal_privacy', 'Privacy Policy', 'privacy']].map(([k, label, page]) => `
          <label class="field"><span style="display:flex;justify-content:space-between;align-items:center">${label}
            <span style="display:flex;gap:6px"><a class="btn btn-sm btn-ghost" href="#/${page}" target="_blank">View</a><button type="button" class="btn btn-sm btn-ghost" data-reset-legal="${k}">Reset to draft</button></span></span>
            <textarea class="input" name="${k}" rows="12" style="font-family:var(--mono);font-size:12.5px">${esc(s[k] || '')}</textarea></label>`).join('')}
      </div>
    </div><aside>
      <div class="panel"><h3>Contact &amp; business</h3>${f('support_email', 'Support email', 'Shown in the footer and legal pages. When buyers reply to an email from the store, the reply goes here. Leave empty to use your owner email.', 'email')}${f('business_location', 'Business location', 'e.g. Lagos, Nigeria')}</div>
      <div class="panel"><h3>WhatsApp chat</h3>
        ${f('whatsapp', 'WhatsApp number', 'Shows a "Chat on WhatsApp" button on every store page. With country code, e.g. 2348012345678 (0801... works too). Leave empty to hide the button.', 'tel')}
        ${f('whatsapp_message', 'First message', 'Typed in for them when they tap the button. On a product page the product name is added at the end.')}
        ${s.whatsapp ? `<a class="btn btn-sm" href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener">Test the link</a>` : ''}
      </div>
      <div class="panel"><h3>Checkout</h3>
        <label class="field"><span>Ask for phone number</span><select class="input" name="checkout_phone">${[['off', 'No, just name and email'], ['optional', 'Optional'], ['required', 'Required']].map(([v, l]) => `<option value="${v}" ${s.checkout_phone === v ? 'selected' : ''}>${l}</option>`).join('')}</select><small>Each extra field costs a few sales. Only ask if you'll use it.</small></label>
        <label class="check" style="margin-bottom:6px"><span class="switch"><input type="checkbox" data-flag="abandoned_reminders" ${s.abandoned_reminders !== '0' ? 'checked' : ''}><i></i></span>Remind unfinished checkouts</label>
        <small class="dim" style="display:block;margin:0 0 16px;font-size:12px">If someone opens Paystack but doesn't pay, they get one "your checkout didn't go through" email about an hour later.</small>
        <label class="check" style="margin-bottom:6px"><span class="switch"><input type="checkbox" data-flag="review_requests" ${s.review_requests !== '0' ? 'checked' : ''}><i></i></span>Ask buyers for a review</label>
        <label class="field" style="margin:8px 0 4px"><span>Send it after</span><select class="input" name="review_after_days">${[1, 2, 3, 5, 7, 14].map(d => `<option value="${d}" ${String(s.review_after_days || 3) === String(d) ? 'selected' : ''}>${plural(d, 'day')}</option>`).join('')}</select></label>
        <small class="dim" style="display:block;margin:0 0 16px;font-size:12px">One "How was it?" email per order, with stars to tap. Skipped if they already left a review. Free downloads count too; gifts you send don't.</small>
        <span style="display:block;font-size:13px;color:#c9c5bf;margin-bottom:8px;font-weight:500">Also sell in</span>
        <div style="display:flex;flex-wrap:wrap;gap:12px 18px;margin-bottom:6px">${['ngn', 'ghs', 'kes', 'zar', 'usd'].filter(c => c !== (s.currency || 'ngn')).map(c => `<label class="check" style="font-size:13px"><input type="checkbox" data-extra-cur="${c}" ${String(s.extra_currencies || '').split(',').includes(c) ? 'checked' : ''} style="accent-color:var(--accent)">${c.toUpperCase()}</label>`).join('')}</div>
        <small class="dim" style="display:block;font-size:12px">Then set a price in that currency on each product. Your Paystack account must be enabled for it. USD needs Paystack's approval.</small>
      </div>
      <div class="panel"><h3>Analytics</h3>
        <p class="muted" style="margin:-8px 0 14px;font-size:12.5px">Optional. Paste an ID to switch a tool on; leave empty to keep it off. Visits, product views, checkouts and purchases are tracked, never names or emails. Your own visits while signed in aren't counted.</p>
        ${f('plausible_domain', 'Plausible: site domain', 'e.g. carsin.store (add the site in your Plausible account first)')}
        ${f('ga_id', 'Google Analytics 4: Measurement ID', 'Starts with G-, from Admin → Data streams')}
        ${f('meta_pixel_id', 'Meta Pixel ID', 'Numbers only, from Events Manager. Needed for Instagram/Facebook ads.')}
        ${f('tiktok_pixel_id', 'TikTok Pixel ID', 'Letters and numbers, from TikTok Ads Manager > Tools > Events. Needed for TikTok ads.')}
      </div>
      <div class="panel"><h3>Notifications</h3>
        ${S.store.emails ? '' : '<p class="muted" style="margin:-8px 0 12px;font-size:12.5px">Email isn\'t set up on this copy of the store, so alerts won\'t be sent from here.</p>'}
        <label class="check" style="margin-bottom:12px"><span class="switch"><input type="checkbox" data-flag="notify_sales" ${s.notify_sales !== '0' ? 'checked' : ''}><i></i></span>Email me for every sale</label>
        <label class="check" style="margin-bottom:14px"><span class="switch"><input type="checkbox" data-flag="notify_free" ${s.notify_free === '1' ? 'checked' : ''}><i></i></span>Also for free downloads</label>
        ${f('notify_email', 'Send alerts to', 'Leave empty to use your support email.', 'email')}
      </div>
      <div class="panel"><h3>Share image</h3>
        <p class="muted" style="margin:-8px 0 12px;font-size:12.5px">Shown when your homepage, or a product without a cover, is posted on WhatsApp, Instagram or X. 1200×630 px, under 600 KB.</p>
        <div class="cover-edit" id="share-img" style="aspect-ratio:1200/630">${s.share_image ? `<img src="/media/covers/${esc(s.share_image)}">` : '<div style="display:grid;place-items:center;height:100%;font-size:13px" class="muted">No image yet</div>'}<div class="over">Upload image</div></div>
        <input type="file" id="share-in" accept="image/png,image/jpeg,image/webp" hidden>
      </div>
      <div class="panel"><h3>Social links</h3>${f('instagram', 'Instagram URL')}${f('x', 'X / Twitter URL')}${f('youtube', 'YouTube URL')}${f('tiktok', 'TikTok URL')}${f('linkedin', 'LinkedIn URL')}</div></aside></div></form>
      <div class="panel" style="max-width:860px" id="keys-panel"></div>
      <div class="panel" style="max-width:860px"><h3>Backup &amp; move</h3>
        <p class="muted" style="margin:-6px 0 18px;font-size:13.5px">Download your whole store (products, files, covers and settings) as one file, then restore it on another computer or host. Also a good safety copy to keep.</p>
        <div class="row" style="align-items:start">
          <div>
            <label class="check" style="margin-bottom:14px"><span class="switch"><input type="checkbox" id="bk-orders"><i></i></span>Include orders &amp; buyers</label>
            <small class="dim" style="display:block;margin:-6px 0 14px;font-size:12px">Leave off when moving your catalog to a new site (test orders stay behind). Turn on for a complete safety copy.</small>
            <a class="btn" id="bk-download" href="/api/admin/backup?orders=0">${I.down} Download backup</a>
          </div>
          <div>
            <div class="dropzone" id="bk-drop" style="padding:20px">${A.upload}<div><b style="font-weight:500;color:var(--text)">Restore a backup</b><br>Drop a <code>.tar.gz</code> backup here or click</div><div class="upbar hidden"><i></i></div></div>
            <input type="file" id="bk-file" accept=".gz,.tgz,application/gzip" hidden>
            <small class="dim" style="display:block;margin-top:8px;font-size:12px">Replaces everything on this store with the backup. You'll sign in again with the owner account from the backup.</small>
          </div>
        </div>
      </div>`);
    let faq = Array.isArray(s.faq) ? s.faq : [];
    const drawFaq = () => {
      $('#faq').innerHTML = faq.map((x, i) => `<div class="mod-edit" style="padding:12px"><div style="display:flex;gap:8px"><input class="input" data-fq="${i}" value="${esc(x.q)}" placeholder="Question"><button type="button" class="icon-btn" data-fdel="${i}">${A.trash}</button></div>
        <textarea class="input" data-fa="${i}" rows="2" style="margin-top:8px;min-height:60px" placeholder="Answer">${esc(x.a)}</textarea></div>`).join('') || '<p class="muted" style="margin:0">No questions yet, so the FAQ section is hidden.</p>';
      $$('[data-fq]').forEach(i => i.addEventListener('input', () => (faq[i.dataset.fq].q = i.value)));
      $$('[data-fa]').forEach(i => i.addEventListener('input', () => (faq[i.dataset.fa].a = i.value)));
      $$('[data-fdel]').forEach(b => b.addEventListener('click', () => { faq.splice(Number(b.dataset.fdel), 1); drawFaq(); }));
    };
    drawFaq();
    $('#add-faq').addEventListener('click', () => { faq.push({ q: '', a: '' }); drawFaq(); });

    // Upload keys: for the product upload tool on your computer. Shown once, switched off any time.
    const drawKeys = async () => {
      const box = $('#keys-panel'); if (!box) return;
      const keys = await api('/api/admin/keys').catch(() => []);
      const live = keys.filter(k => !k.revoked_at);
      box.innerHTML = `<h3>Keys for tools on your computer</h3>
        <p class="muted" style="margin:-6px 0 16px;font-size:13.5px">Let tools on your computer work with this store without your password. An <b style="color:var(--text);font-weight:500">upload key</b> can only add and edit products: it can't delete them, and it can't see orders, customers, payouts or settings. A <b style="color:var(--text);font-weight:500">backup key</b> can only download a backup of the store, for the daily backup on your computer.</p>
        ${live.length ? `<table class="tbl" style="margin-bottom:14px"><tr><th>Name</th><th>Type</th><th>Key</th><th>Made</th><th>Last used</th><th></th></tr>${live.map(k => `<tr><td>${esc(k.name)}</td><td>${k.scope === 'backup' ? 'Backup' : 'Upload'}</td><td style="font-family:var(--mono);font-size:12px">cs_${esc(k.scope || 'upload')}_…${esc(k.hint)}</td><td class="muted">${date(k.created_at)}</td><td class="muted">${k.last_used_at ? date(k.last_used_at) : 'Never'}</td>
          <td style="text-align:right"><button type="button" class="btn btn-sm btn-ghost" data-revoke-key="${k.id}">Switch off</button></td></tr>`).join('')}</table>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" data-new-key="upload">${I.plus.replace('<svg', '<svg width="14" height="14"')} Create upload key</button><button type="button" class="btn" data-new-key="backup">${I.plus.replace('<svg', '<svg width="14" height="14"')} Create backup key</button></div>`;
      $$('[data-new-key]').forEach(btn => btn.addEventListener('click', () => { const scope = btn.dataset.newKey; modal(`<h3>Create ${scope === 'backup' ? 'a backup' : 'an upload'} key</h3><form id="kf" style="margin-top:14px">
          <label class="field"><span>Name</span><input class="input" name="name" value="${scope === 'backup' ? 'Daily backup' : 'My computer'}" maxlength="60"><small>So you can tell keys apart later.</small></label>
          <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Create key</button></div></form>`, (m, close) => {
        $('#kf', m).addEventListener('submit', async e => {
          e.preventDefault();
          try {
            const r = await api('/api/admin/keys', { method: 'POST', body: { name: e.target.name.value, scope } });
            close(); drawKeys();
            modal(`<h3>Your ${scope} key</h3><p class="muted" style="margin:0 0 12px">Copy it now: it won't be shown again. Paste it into <code>carsinstore\\.env</code> on your computer as <code>${scope === 'backup' ? 'CARSINSTORE_BACKUP_KEY' : 'CARSINSTORE_UPLOAD_KEY'}=</code>, never into chat, email or a website.</p>
              <input class="input" readonly value="${esc(r.key)}" onclick="this.select()" style="font-family:var(--mono);font-size:12.5px">
              <div class="actions"><button class="btn" id="kcopy">Copy key</button><button class="btn btn-primary" data-close>Done</button></div>`, m2 => {
              $('#kcopy', m2).onclick = async () => { try { await navigator.clipboard.writeText(r.key); toast('Key copied'); } catch { m2.querySelector('input').select(); } };
            });
          } catch (err) { toast(err.message, true); }
        });
      }); }));
      $$('[data-revoke-key]').forEach(b => b.addEventListener('click', async () => {
        if (!(await confirmDialog('Switch off this key?', 'Anything using it stops working straight away. You can create a new one at any time.', 'Switch off', true))) return;
        await api(`/api/admin/keys/${b.dataset.revokeKey}`, { method: 'DELETE' }); toast('Key switched off'); drawKeys();
      }));
    };
    drawKeys();

    $('#share-img').addEventListener('click', () => $('#share-in').click());
    $('#share-in').addEventListener('change', async e => {
      const fd = new FormData(); fd.append('cover', e.target.files[0]);
      try { const r = await upload('/api/admin/share-image', fd); $('#share-img').innerHTML = `<img src="${esc(r.image)}"><div class="over">Upload image</div>`; toast('Share image updated'); }
      catch (err) { toast(err.message, true); }
    });
    $$('[data-reset-legal]').forEach(b => b.addEventListener('click', () => {
      $(`[name="${b.dataset.resetLegal}"]`).value = s.legal_defaults[b.dataset.resetLegal];
      toast('Draft restored. Click Save settings to keep it.');
    }));

    // backup & restore
    $('#bk-orders').addEventListener('change', e => ($('#bk-download').href = `/api/admin/backup?orders=${e.target.checked ? 1 : 0}`));
    const drop = $('#bk-drop'), picker = $('#bk-file');
    const restore = async file => {
      if (!file) return;
      if (!(await confirmDialog('Restore this backup?', `“${file.name}” will replace ALL products, files, settings and the owner account on this store. The current data is kept in storage/.before-restore in case you need it back.`, 'Replace everything', true))) return;
      const fd = new FormData(); fd.append('backup', file);
      const bar = drop.querySelector('.upbar'), label = drop.querySelector('div');
      bar.classList.remove('hidden');
      try {
        const r = await upload('/api/admin/restore', fd, pct => {
          bar.firstElementChild.style.width = pct * 100 + '%';
          label.textContent = pct < 1 ? `Uploading backup… ${Math.round(pct * 100)}%` : 'Restoring. This can take a minute for large stores…';
        });
        modal(`<h3>Store restored</h3><p class="muted" style="margin:0">${plural(r.products, 'product')}, ${plural(r.files, 'file')}${r.orders ? ` and ${plural(r.orders, 'order')}` : ''} are now on this store.${r.missingFiles ? ` ${plural(r.missingFiles, 'file')} referenced in the backup were missing from it.` : ''}</p>
          <p class="muted">Sign in again with the owner email and password from the backup.</p>
          <div class="actions"><button class="btn btn-primary" id="relog">Sign in</button></div>`, m => { $('#relog', m).onclick = () => { location.hash = '#/login?next=' + encodeURIComponent('#/admin'); location.reload(); }; });
      } catch (err) { toast(err.message, true); label.innerHTML = '<b style="font-weight:500;color:var(--text)">Restore a backup</b><br>Drop a <code>.tar.gz</code> backup here or click'; bar.classList.add('hidden'); }
    };
    drop.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => restore(picker.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); restore(e.dataTransfer.files[0]); });
    $('#sf').addEventListener('submit', e => e.preventDefault());
    $('#save').addEventListener('click', async () => {
      const body = Object.fromEntries(new FormData($('#sf')));
      for (const k of Object.keys(body)) if (k.startsWith('data-')) delete body[k];
      $$('[data-flag]').forEach(i => (body[i.dataset.flag] = i.checked ? '1' : '0'));
      body.extra_currencies = $$('[data-extra-cur]').filter(i => i.checked).map(i => i.dataset.extraCur).join(',');
      body.faq = faq.filter(x => x.q.trim());
      await api('/api/admin/settings', { method: 'PUT', body });
      await loadStore(); toast('Settings saved');
    });
  }

  window.Admin = {
    async render(parts) {
      if (S.store.needsSetup) return setupScreen();
      if (!S.store.user) return (location.hash = '#/login?next=' + encodeURIComponent('#/admin'));
      if (!S.store.user.isAdmin) { app.innerHTML = '<div class="wrap page" style="text-align:center;padding-top:140px"><h1>Owners only.</h1><p class="muted">This area is for the store owner.</p><a class="btn" href="#/">Back to store</a></div>'; return; }
      app.innerHTML = spinner();
      const [section, id] = parts;
      if (section === 'products' && id) return editor(id);
      return ({ products, categories, orders, payouts, customers, coupons, affiliates, settings }[section] || overview)();
    },
  };
})();
