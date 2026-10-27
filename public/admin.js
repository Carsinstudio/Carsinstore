/* Carsinstore owner dashboard: products, uploads, categories, orders, customers, coupons, settings. */
(() => {
  const { api, upload, esc, money, size, plural, date, I, toast, modal, confirmDialog, coverHtml, loadStore, S, $, $$, extOf, spinner } = window.Store;
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
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  };

  function layout(active, content) {
    const items = [['', 'Overview', A.dash], ['products', 'Products', A.box], ['categories', 'Categories', A.tag], ['orders', 'Orders', A.receipt], ['customers', 'Customers', I.users], ['coupons', 'Discounts', A.pct], ['affiliates', 'Affiliates', A.link], ['settings', 'Store settings', A.gear]];
    app.innerHTML = `<div class="admin">
      <aside class="admin-side">
        <a class="brand" href="#/" style="border:0"><img class="brand-logo" src="/brand/logo-horizontal.png" alt="${esc(S.store.settings.store_name)}"></a>
        ${items.map(([k, l, ic]) => `<a href="#/admin${k ? '/' + k : ''}" class="${active === k ? 'on' : ''}">${ic}${l}</a>`).join('')}
        <div class="bottom"><a href="#/" target="_blank">${A.store}View store</a></div>
      </aside>
      <main class="admin-main">${S.store.payments !== 'paystack' ? `<div class="setup-banner">${S.store.payments === 'demo' ? '<b>Test mode.</b> Checkout is simulated, so no real payments are taken.' : '<b>Payments are off.</b> Paid products can’t be bought yet.'} Add <code>PAYSTACK_SECRET_KEY</code> to your <code>.env</code> file to take real payments (see README).</div>` : ''}${content}</main></div>`;
    window.onscroll = null;
  }
  const head = (title, actions = '') => `<div class="admin-head"><h1>${title}</h1><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div>`;
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
  function publishedModal(link) {
    modal(`<span class="status live">live</span><h3 style="margin-top:12px">Published</h3><p class="muted" style="margin:0 0 14px">It's live in the store. Here's the link to share:</p>
      <input class="input" readonly value="${esc(link)}" onclick="this.select()">
      <div class="actions"><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">View</a><button class="btn" id="pm-copy">Copy link</button><button class="btn btn-primary" data-close>Back to products</button></div>`,
      m => { $('#pm-copy', m).onclick = () => copyText(link, 'Link copied'); },
      () => { if (location.hash === '#/admin/products') products(); else location.hash = '#/admin/products'; });
  }
  async function publish(id, hasFiles) {
    if (!hasFiles && !(await confirmDialog('Publish without files?', busy.uploads ? 'Your files are still uploading. Buyers who check out before they finish would get nothing to download.' : 'This product has no files yet, so buyers would get nothing to download.', 'Publish anyway'))) return null;
    const r = await api(`/api/admin/products/${id}/publish`, { method: 'POST' });
    publishedModal(r.link);
    return r;
  }

  async function products() {
    const list = await api('/api/admin/products');
    layout('products', head('Products', `<button class="btn btn-primary" id="new">${I.plus.replace('<svg', '<svg width="14" height="14"')} New product</button>`) + (list.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Product</th><th>Price</th><th>Files</th><th>Sales</th><th>Status</th><th></th></tr>
      ${list.map(p => `<tr class="click" data-id="${p.id}"><td><div style="display:flex;gap:12px;align-items:center"><div class="thumb">${p.draftCover ? coverThumb(p.draftCover, p.draftCoverVideo) : coverHtml(p)}</div><div><div>${esc(p.name)}</div><small class="dim">${p.categories.length ? esc(p.categories.map(c => c.name).join(', ')) : 'No category'}${p.rating ? ` · ★ ${p.rating.avg} (${p.rating.count})` : ''}</small></div></div></td>
        <td>${p.price ? money(p.price) : '<span style="color:var(--amber)">Free</span>'}</td>
        <td class="muted">${p.files ? `${plural(p.files, 'file')} · ${size(p.totalSize)}` : '<span style="color:#ff8b7a">No files yet</span>'}</td><td>${p.students}</td>
        <td>${statusOf(p)}${p.featured ? ' <span class="status free">featured</span>' : ''}</td>
        <td style="text-align:right;width:1%"><button class="icon-btn" data-menu="${p.id}" title="Actions">${dots}</button></td></tr>`).join('')}</table></div>`
      : `<div class="empty"><h3>No products yet</h3><p>Create your first digital product, then upload its files.</p></div>`));
    // Clicking a product opens its actions; editing is one of them.
    const openMenu = (id, anchor) => {
      const p = list.find(x => x.id === Number(id));
      document.querySelector('.menu-pop')?.remove();
      const pop = document.createElement('div');
      pop.className = 'menu-pop';
      pop.innerHTML = `<button data-act="edit">${A.edit} Edit</button>
        ${p.published ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" data-act="view">${A.eye} View in store</a><button data-act="copy">${A.link} Copy link</button>` : ''}
        ${!p.published || p.changes ? `<button data-act="publish">${A.up} ${p.published ? 'Publish changes' : 'Publish'}</button>` : ''}
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
      openMenu(r.dataset.id, r.querySelector('[data-menu]'));
    }));
    $('#new').addEventListener('click', newProduct);
  }

  function newProduct() {
    modal(`<h3>New product</h3><p class="muted" style="margin:0 0 20px">Everything can be changed later.</p>
      <form id="np"><label class="field"><span>Title</span><input class="input" name="title" required placeholder="e.g. Cinematic LUT Pack + Tutorial"></label>
      <label class="field"><span>Short description</span><input class="input" name="subtitle" placeholder="One line that sells it"><small>Shown under the title, on product cards and as the text in link previews on WhatsApp, Instagram and X.</small></label>
      <label class="field"><span>Description</span><textarea class="input" name="description" rows="6" placeholder="What it is, what's inside, who it's for, questions buyers ask"></textarea><small>Next you'll upload the files and covers.</small></label>
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Create product</button></div></form>`,
      (m, close) => {
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

  const RATIOS = ['1:1', '4:3', '3:4', '16:9'];
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
        </div>
        <form class="panel" id="pf"><h3>Details</h3>
          <label class="field"><span>Title</span><input class="input" name="title" value="${esc(e0.title)}" required></label>
          <label class="field"><span>Short description</span><input class="input" name="subtitle" value="${esc(e0.subtitle)}" placeholder="One line that sells it"><small>Shown under the title, on product cards and as the text in link previews on WhatsApp, Instagram and X.</small></label>
          <label class="field"><span>Description</span><textarea class="input" name="description" rows="16" placeholder="Everything about the product: what it is, what's inside, who it's for, questions buyers ask">${esc(e0.description)}</textarea>
            <small>This is the whole sales page text. Formatting: blank line = new paragraph, <code>## Heading</code>, <code>- bullet</code>, <code>**bold**</code>, <code>[link](https://…)</code>.</small></label>
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
        cover_ratio: f.cover_ratio || '1:1',
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
    $('[name="title"]').addEventListener('input', e => { $('#head-title').textContent = $('#crumb-title').textContent = e.target.value || 'Untitled product'; });
    $('#pf').addEventListener('submit', e => e.preventDefault());
    // Save straight away when leaving this page.
    const leave = () => { if (!location.hash.startsWith(`#/admin/products/${id}`)) { flush(); window.removeEventListener('hashchange', leave); } };
    window.addEventListener('hashchange', leave);
    setState(published && changes ? 'Draft saved. Publish to make it live.' : 'Draft saved', 'ok');

    $('#publish').addEventListener('click', async () => {
      try {
        busy.dirty = busy.dirty || !!snapshot; await flush();
        const r = await publish(id, files.length > 0);
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
    const ratioHint = { '1:1': 'Square: 1080×1080 px', '4:3': 'Landscape: 1440×1080 px', '3:4': 'Portrait: 1080×1440 px', '16:9': 'Wide: 1920×1080 px' };
    const drawRatio = () => {
      const r = $('#pf').elements.cover_ratio.value || '1:1';
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
      $('#file-count').textContent = files.length ? `${plural(files.length, 'file')} · ${size(total)}` : '';
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
  async function customers() {
    const list = await api('/api/admin/customers');
    layout('customers', head('Customers', `<span class="muted" style="font-size:13px;align-self:center">${plural(list.length, 'buyer')}</span><button class="btn" id="csv">Export emails</button>`) + (list.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Name</th><th>Email</th><th>Phone</th><th>First seen</th><th>Products</th><th>Spent</th></tr>
      ${list.map(u => `<tr><td>${esc(u.name || 'No name')}</td><td class="muted">${esc(u.email)}</td><td class="muted">${esc(u.phone || 'Not given')}</td><td class="muted">${date(u.created_at)}</td><td>${u.products}</td><td>${money(u.spent)}</td></tr>`).join('')}</table></div>`
      : '<div class="empty"><h3>No buyers yet</h3><p>Everyone who buys or grabs a free product shows up here with their name and email.</p></div>'));
    $('#csv').addEventListener('click', () => {
      const blob = new Blob(['email,name,phone,joined,products,spent\n' + list.map(u => [u.email, u.name || '', u.phone || '', u.created_at, u.products, (u.spent / 100).toFixed(2)].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
      Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'customers.csv' }).click();
    });
  }

  // Extra currencies switched on in Store settings (besides the store currency).
  function extraCurrencies() {
    const main = (S.store.settings.currency || 'ngn').toLowerCase();
    return String(S.store.settings.extra_currencies || '').toLowerCase().split(',').map(c => c.trim()).filter(c => c && c !== main);
  }
  const copy = async (text, msg) => { try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Copy:', text); } };

  // ---------- affiliates ----------
  async function affiliates() {
    const list = await api('/api/admin/affiliates');
    const owedText = a => a.totals.filter(t => t.owed).map(t => money(t.owed, t.currency)).join(' + ') || 'Nothing owed';
    layout('affiliates', head('Affiliates', `<button class="btn btn-primary" id="new">${I.plus.replace('<svg', '<svg width="14" height="14"')} New affiliate</button>`) + `
      <p class="muted" style="margin:-12px 0 22px;font-size:13.5px;max-width:680px">Partners share their link, and earn a commission on every paid order from buyers who arrive through it (within 30 days). You pay them yourself, then record it here. Each partner has a private stats page you can send them.</p>` + (list.length ? `
      <div class="panel tbl-wrap" style="padding:0"><table class="tbl"><tr><th>Partner</th><th>Code</th><th>Commission</th><th>Sales</th><th>Owed</th><th>Status</th><th></th></tr>
      ${list.map(a => `<tr><td><div>${esc(a.name)}</div><small class="dim">${esc(a.email)}</small></td><td style="font-family:var(--mono)">${esc(a.code)}</td>
        <td>${a.percent}%</td><td>${a.sales}</td><td style="color:var(--amber)">${owedText(a)}</td><td>${a.active ? '<span class="status live">active</span>' : '<span class="status">paused</span>'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm btn-ghost" data-link="${a.id}">Copy link</button><button class="btn btn-sm btn-ghost" data-stats="${a.id}" title="Their private stats page">Stats page</button>
          <button class="btn btn-sm btn-ghost" data-pay="${a.id}">Record payout</button><button class="icon-btn" data-edit="${a.id}" title="Edit">${A.edit}</button></td></tr>`).join('')}</table></div>`
      : '<div class="empty"><h3>No affiliates yet</h3><p>Add creators, friends or customers who\'d like to promote your products for a commission.</p></div>'));
    const find = id => list.find(a => a.id === Number(id));
    $$('[data-link]').forEach(b => b.addEventListener('click', () => copy(find(b.dataset.link).link, 'Referral link copied')));
    $$('[data-stats]').forEach(b => b.addEventListener('click', () => copy(find(b.dataset.stats).statsUrl, 'Stats page link copied. Send it to your partner.')));
    const form = (a = {}) => modal(`<h3>${a.id ? 'Edit' : 'New'} affiliate</h3><form id="af" style="margin-top:16px">
      <label class="field"><span>Name</span><input class="input" name="name" value="${esc(a.name || '')}" required></label>
      <label class="field"><span>Email</span><input class="input" name="email" type="email" value="${esc(a.email || '')}" required><small>Where you'll reach them about payouts. Their own purchases don't earn commission.</small></label>
      <div class="row"><label class="field"><span>Commission %</span><input class="input" name="percent" type="number" min="1" max="90" value="${a.percent ?? 20}" required></label>
      ${a.id ? `<label class="field"><span>Status</span><select class="input" name="active"><option value="1" ${a.active ? 'selected' : ''}>Active</option><option value="0" ${a.active ? '' : 'selected'}>Paused</option></select></label>`
        : `<label class="field"><span>Code (optional)</span><input class="input" name="code" placeholder="e.g. ADA" style="text-transform:uppercase"><small>Used in their link. Made from their name if empty.</small></label>`}</div>
      ${a.id ? '<small class="dim" style="display:block;margin:-6px 0 6px;font-size:12px">A new commission rate applies to future sales only.</small>' : ''}
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form>`, (m, close) => {
      $('#af', m).addEventListener('submit', async e => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target));
        if (a.id) body.active = body.active === '1';
        try {
          const r = await api(`/api/admin/affiliates${a.id ? '/' + a.id : ''}`, { method: a.id ? 'PUT' : 'POST', body });
          close(); affiliates();
          if (!a.id) modal(`<h3>${esc(r.name)} is set up</h3><p class="muted" style="margin:0 0 14px">Send them both links:</p>
            <label class="field"><span>Referral link (to share)</span><input class="input" readonly value="${esc(r.link)}" onclick="this.select()"></label>
            <label class="field"><span>Private stats page (just for them)</span><input class="input" readonly value="${esc(r.statsUrl)}" onclick="this.select()"></label>
            <div class="actions"><button class="btn btn-primary" data-close>Done</button></div>`);
        } catch (err) { toast(err.message, true); }
      });
    });
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
        <label class="field"><span>Hero text</span><textarea class="input" name="hero_sub" rows="3">${esc(s.hero_sub || '')}</textarea></label></div>
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
      <div class="panel"><h3>Checkout</h3>
        <label class="field"><span>Ask for phone number</span><select class="input" name="checkout_phone">${[['off', 'No, just name and email'], ['optional', 'Optional'], ['required', 'Required']].map(([v, l]) => `<option value="${v}" ${s.checkout_phone === v ? 'selected' : ''}>${l}</option>`).join('')}</select><small>Each extra field costs a few sales. Only ask if you'll use it.</small></label>
        <label class="check" style="margin-bottom:6px"><span class="switch"><input type="checkbox" data-flag="abandoned_reminders" ${s.abandoned_reminders !== '0' ? 'checked' : ''}><i></i></span>Remind unfinished checkouts</label>
        <small class="dim" style="display:block;margin:0 0 16px;font-size:12px">If someone opens Paystack but doesn't pay, they get one "Still want it?" email about an hour later.</small>
        <span style="display:block;font-size:13px;color:#c9c5bf;margin-bottom:8px;font-weight:500">Also sell in</span>
        <div style="display:flex;flex-wrap:wrap;gap:12px 18px;margin-bottom:6px">${['ngn', 'ghs', 'kes', 'zar', 'usd'].filter(c => c !== (s.currency || 'ngn')).map(c => `<label class="check" style="font-size:13px"><input type="checkbox" data-extra-cur="${c}" ${String(s.extra_currencies || '').split(',').includes(c) ? 'checked' : ''} style="accent-color:var(--accent)">${c.toUpperCase()}</label>`).join('')}</div>
        <small class="dim" style="display:block;font-size:12px">Then set a price in that currency on each product. Your Paystack account must be enabled for it. USD needs Paystack's approval.</small>
      </div>
      <div class="panel"><h3>Analytics</h3>
        <p class="muted" style="margin:-8px 0 14px;font-size:12.5px">Optional. Paste an ID to switch a tool on; leave empty to keep it off. Visits, product views, checkouts and purchases are tracked, never names or emails. Your own visits while signed in aren't counted.</p>
        ${f('plausible_domain', 'Plausible: site domain', 'e.g. carsin.store (add the site in your Plausible account first)')}
        ${f('ga_id', 'Google Analytics 4: Measurement ID', 'Starts with G-, from Admin → Data streams')}
        ${f('meta_pixel_id', 'Meta Pixel ID', 'Numbers only, from Events Manager. Needed for Instagram/Facebook ads.')}
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
      return ({ products, categories, orders, customers, coupons, affiliates, settings }[section] || overview)();
    },
  };
})();
