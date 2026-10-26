/* Carsinstore storefront — a small hash-routed single-page app. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $('#app');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { store: null };

  // ---------- api ----------
  async function api(url, opts = {}) {
    const init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
    return data;
  }
  function upload(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', url);
      x.upload.onprogress = e => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
      x.onload = () => {
        let d = {}; try { d = JSON.parse(x.responseText); } catch {}
        x.status < 300 ? resolve(d) : reject(new Error(d.error || 'Upload failed'));
      };
      x.onerror = () => reject(new Error('Network error during upload'));
      x.send(formData);
    });
  }

  // ---------- formatting ----------
  const money = (cents, cur) => new Intl.NumberFormat(undefined, { style: 'currency', currency: (cur || S.store?.settings.currency || 'ngn').toUpperCase(), currencyDisplay: 'narrowSymbol', minimumFractionDigits: cents % 100 ? 2 : 0 }).format((cents || 0) / 100);
  const size = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const date = d => new Date(d.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const kindLabel = { video: 'MP4', pdf: 'PDF', archive: 'ZIP', document: 'DOC', spreadsheet: 'XLS', slides: 'PPT', audio: 'AUD', image: 'IMG', file: 'FILE' };
  const extOf = name => (name.split('.').pop() || 'file').slice(0, 4);

  function md(src) {
    // Tiny markdown: headings, bullet lists, bold, italics, links, paragraphs.
    const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\[([^\]]+)\]\((#\/[\w/-]*)\)/g, '<a href="$2">$1</a>')
      .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]+\w)/g, '$1<a href="mailto:$2">$2</a>');
    let out = '', para = [], list = [];
    const flush = () => {
      if (para.length) out += `<p>${para.map(inline).join('<br>')}</p>`;
      if (list.length) out += `<ul>${list.map(l => `<li>${inline(l)}</li>`).join('')}</ul>`;
      para = []; list = [];
    };
    for (const line of String(src || '').split('\n')) {
      const h = line.match(/^(#{1,3})\s+(.*)$/), li = line.match(/^\s*[-*]\s+(.*)$/);
      if (!line.trim()) flush();
      else if (h) { flush(); out += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`; }
      else if (li) { if (para.length) flush(); list.push(li[1]); }
      else { if (list.length) flush(); para.push(line); }
    }
    flush();
    return out;
  }

  // ---------- icons ----------
  const I = {
    logo: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17 15 5h4L7 17zM3 11l6-6h4L3 15zM9 19 21 7v4l-8 8z"/></svg>',
    arrow: '<svg class="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chev: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    playO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z" fill="currentColor"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 5 5 9-10"/></svg>',
    checkC: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
    down: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 3 4 14h7l-1 7 9-11h-7z"/></svg>',
    infinity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 8c-2.2 0-4 1.8-4 4s1.8 4 4 4c4 0 6-8 10-8 2.2 0 4 1.8 4 4s-1.8 4-4 4c-4 0-6-8-10-8z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zm0 0s2-5 4.5-3.5S15 8 12 8z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 4h2l2.5 11h11L21 7H6.5"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2"/></svg>',
    menu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.3 4.7H5.5z"/></svg>',
    yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8zM10 15V9l5.2 3z"/></svg>',
    tt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.4 2.2 1.8 3.7 4 3.9v3.1c-1.5.1-2.8-.4-4-1.2v6.4c0 3.8-3.6 6.3-7 5.2-3.7-1.2-4.6-6-1.8-8.5 1.1-1 2.6-1.5 4.2-1.3v3.2c-1.3-.4-2.8.3-3 1.7-.3 1.6 1.2 2.9 2.7 2.4 1-.3 1.6-1.2 1.6-2.3V3z"/></svg>',
  };
  const kindIcon = { video: I.playO, pdf: I.file, archive: I.grid, document: I.file, audio: I.playO, image: I.grid, file: I.file, spreadsheet: I.grid, slides: I.grid };

  // ---------- ui helpers ----------
  function toast(msg, err) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.innerHTML = `<span class="dot"></span><span>${esc(msg)}</span>`;
    $('#toasts').append(t);
    setTimeout(() => { t.style.transition = '.3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
  }
  function modal(html, onMount) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = e => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    $('.modal-back', root).addEventListener('mousedown', e => e.target.classList.contains('modal-back') && close());
    $$('[data-close]', root).forEach(b => b.addEventListener('click', close));
    onMount && onMount($('.modal', root), close);
    return close;
  }
  function confirmDialog(title, text, okLabel = 'Confirm', danger) {
    return new Promise(res => {
      modal(`<h3>${esc(title)}</h3><p class="muted" style="margin:0">${esc(text)}</p>
        <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="ok">${esc(okLabel)}</button></div>`,
        (m, close) => { $('#ok', m).onclick = () => { close(); res(true); }; $$('[data-close]', m).forEach(b => b.addEventListener('click', () => res(false))); });
    });
  }
  function observeReveal() {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal:not(.in)').forEach(el => io.observe(el));
  }
  const spinner = () => '<div class="spinner"></div>';

  function coverHtml(p, opts = {}) {
    if (p.cover) return `<img src="${esc(p.cover)}" alt="" loading="lazy">`;
    const hues = [[229, 87, 61, 243, 178, 108], [200, 70, 60, 90, 100, 150], [240, 120, 70, 120, 60, 50], [180, 60, 50, 243, 150, 90]];
    const h = hues[(p.id || 0) % hues.length];
    const g = `radial-gradient(circle at 25% 35%, rgba(${h[0]},${h[1]},${h[2]},.75), transparent 55%), radial-gradient(circle at 78% 72%, rgba(${h[3]},${h[4]},${h[5]},.55), transparent 55%)`;
    const mark = p.kinds?.includes('video') ? I.play : kindIcon[p.kinds?.[0]] || I.file;
    return `<div class="cover-gen" style="--g:${g}"><div class="mark">${mark}</div>${opts.title ? `<div class="ttl">${esc(p.title)}</div>` : ''}</div>`;
  }
  // Short format label for a product, e.g. "Video", "PDF", "Bundle".
  const formatNames = { video: 'Video', pdf: 'PDF', archive: 'ZIP', document: 'Document', spreadsheet: 'Spreadsheet', slides: 'Slides', audio: 'Audio', image: 'Image', file: 'Download' };
  const formatOf = p => (!p.kinds?.length ? 'Download' : p.kinds.length > 1 ? 'Bundle' : formatNames[p.kinds[0]]);
  function priceHtml(p) {
    if (!p.price) return '<span class="price free">Free</span>';
    return `<span class="price">${money(p.price)}${p.compare && p.compare > p.price ? `<s>${money(p.compare)}</s>` : ''}</span>`;
  }
  function metaHtml(p) {
    const bits = [];
    if (p.files) bits.push(`<span>${I.file}${plural(p.files, 'file')}</span>`);
    if (p.totalSize) bits.push(`<span>${size(p.totalSize)}</span>`);
    return bits.join('');
  }
  function productCard(p) {
    return `<a class="card reveal" href="#/p/${esc(p.slug)}">
      <div class="cover">${coverHtml(p)}
        <div class="badge-row"><span class="badge">${formatOf(p)}</span>${!p.price ? '<span class="badge free">Free</span>' : p.featured ? '<span class="badge hot">Featured</span>' : ''}</div>
      </div>
      <div class="card-body">
        ${p.category ? `<span class="cat">${esc(p.category.name)}</span>` : ''}
        <h3>${esc(p.title)}</h3>
        <p class="sub">${esc(p.subtitle || '')}</p>
        <div class="card-foot"><div class="meta">${metaHtml(p)}</div>${priceHtml(p)}</div>
      </div></a>`;
  }

  // ---------- chrome ----------
  function nav(active) {
    const s = S.store.settings, u = S.store.user;
    const cats = S.store.categories.filter(c => c.count > 0);
    return `
    ${s.announcement ? `<div class="announce-wrap"><div class="announce"><span class="tag">NEW</span><span>${esc(s.announcement)}</span><a href="#/shop">Browse the store ${I.arrow}</a></div></div>` : ''}
    <header class="nav" id="nav"><div class="nav-inner">
      <a class="brand" href="#/">${I.logo}<span>${esc(s.store_name)}</span></a>
      <nav class="nav-links" id="nav-links">
        <a href="#/shop" class="${active === 'shop' ? 'active' : ''}">All products</a>
        <div class="dropdown" id="cat-dd"><button>Categories ${I.chev}</button>
          <div class="dropdown-menu">${cats.length ? cats.map(c => `<a href="#/shop?cat=${esc(c.slug)}">${esc(c.name)}<span class="count">${c.count}</span></a>`).join('') : '<a href="#/shop">Everything</a>'}</div>
        </div>
        <a href="#/shop?kind=video" class="${active === 'videos' ? 'active' : ''}">Videos</a>
        <a href="#/shop?price=free" class="${active === 'free' ? 'active' : ''}">Free</a>
      </nav>
      <div class="nav-right">
        ${u ? `<div class="dropdown right" id="user-dd"><button class="avatar" aria-label="Owner menu">${esc((u.name || u.email)[0].toUpperCase())}</button>
            <div class="dropdown-menu"><div style="padding:8px 12px 10px;font-size:12.5px" class="muted">${esc(u.email)}</div><hr>
              <a href="#/admin">Store dashboard</a><a href="#/account">Change password</a><hr>
              <button id="logout">Sign out</button></div></div>`
          : `<a class="btn btn-sm ${active === 'find' ? '' : 'btn-ghost'}" href="#/find">My downloads</a>`}
        <button class="btn btn-sm menu-btn" id="menu-btn" aria-label="Menu">${I.menu}</button>
      </div>
    </div></header>`;
  }
  function footer() {
    const s = S.store.settings;
    const cats = S.store.categories.slice(0, 6);
    const social = [['instagram', I.ig], ['x', I.x], ['youtube', I.yt], ['tiktok', I.tt]].filter(([k]) => s[k]);
    return `<footer class="site"><div class="foot-card">
      <div class="foot-grid">
        <div><a class="brand" href="#/">${I.logo}<span>${esc(s.store_name)}</span></a><p class="foot-blurb">${esc(s.footer_blurb)}</p>
          ${social.length ? `<div class="muted" style="font-size:12.5px;margin-bottom:10px">Stay connected</div><div class="socials">${social.map(([k, ic]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener" aria-label="${k}">${ic}</a>`).join('')}</div>` : ''}</div>
        <div><h5>Store</h5><a href="#/shop">All products</a><a href="#/shop?kind=video">Videos</a><a href="#/shop?kind=pdf">PDFs & guides</a><a href="#/shop?price=free">Free resources</a></div>
        <div><h5>Categories</h5>${cats.map(c => `<a href="#/shop?cat=${esc(c.slug)}">${esc(c.name)}</a>`).join('') || '<a href="#/shop">Browse all</a>'}</div>
        <div><h5>Help</h5><a href="#/find">Find my downloads</a><a href="#/" data-faq>FAQ</a>${s.support_email ? `<a href="mailto:${esc(s.support_email)}">Contact us</a>` : ''}<a href="#/refunds">Refund policy</a></div>
      </div>
      <div class="foot-bottom"><span>© ${new Date().getFullYear()} ${esc(s.store_name)}. All rights reserved.</span><div><a href="#/terms">Terms</a><a href="#/privacy">Privacy</a><a href="#/refunds">Refunds</a></div></div>
    </div><div class="wordmark">${esc(s.store_name)}</div><div class="foot-glow"></div></footer>`;
  }
  function shell(content, { active, bare } = {}) {
    app.innerHTML = nav(active) + `<main>${content}</main>` + (bare ? '' : footer());
    wireChrome();
  }
  function wireChrome() {
    const navEl = $('#nav');
    const onScroll = () => navEl && navEl.classList.toggle('scrolled', scrollY > 10);
    window.onscroll = onScroll; onScroll();
    $$('.dropdown').forEach(dd => {
      const btn = dd.querySelector('button');
      btn.addEventListener('click', e => { e.stopPropagation(); $$('.dropdown.open').forEach(o => o !== dd && o.classList.remove('open')); dd.classList.toggle('open'); });
    });
    $('#menu-btn')?.addEventListener('click', () => $('#nav-links').classList.toggle('open'));
    $('#logout')?.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); await loadStore(); location.hash = '#/'; toast('Signed out'); });
    $$('[data-faq]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); location.hash = '#/'; setTimeout(() => $('#faq')?.scrollIntoView(), 120); }));
    observeReveal();
  }
  document.addEventListener('click', () => $$('.dropdown.open').forEach(o => o.classList.remove('open')));

  // ---------- pages ----------
  async function home() {
    const s = S.store.settings;
    const [featured, all] = await Promise.all([api('/api/products?featured=1&limit=6'), api('/api/products?limit=60')]);
    const free = all.filter(p => !p.price).slice(0, 3);
    const highlight = (featured.length ? featured : all).slice(0, 6);
    const [t1, t2] = String(s.hero_title || '').split('|');
    const cats = S.store.categories;
    const catIcons = [I.playO, I.file, I.grid, I.book, I.bolt, I.gift];
    const faq = s.faq || [];

    shell(`
    <section class="hero">
      <div class="aurora"><i></i></div><div class="grain"></div><div class="hero-fade"></div>
      <div class="wrap hero-content">
        <span class="pill">${esc(s.hero_eyebrow).replace(/(\S+)$/, '<b>$1</b>')}</span>
        <h1><span>${esc(t1)}</span>${t2 ? `<span class="line2 fade-2">${esc(t2)}</span>` : ''}</h1>
        <p class="lead">${esc(s.hero_sub)}</p>
        <div class="actions"><a class="btn btn-primary btn-lg" href="#/shop">Explore the store ${I.arrow}</a><a class="btn btn-lg" href="#/shop?price=free">Get free resources</a></div>
        <div class="showcase reveal"><div class="showcase-inner">
          <div class="window-bar"><div class="dots"><span></span><span></span><span></span></div><div class="url">${esc(location.host)}/download</div><span>Your downloads</span></div>
          <div class="showcase-body">
            <div class="showcase-side"><span class="on">All products <small class="dim">${all.length}</small></span>${cats.slice(0, 5).map(c => `<span>${esc(c.name)} <small class="dim">${c.count}</small></span>`).join('')}</div>
            <div class="showcase-main">${(highlight.length ? highlight : []).slice(0, 6).map(p => `<a href="#/p/${esc(p.slug)}" class="card" style="pointer-events:auto"><div class="cover">${coverHtml(p)}</div><div class="card-body" style="padding:11px 12px"><h3 style="font-size:15px;margin:0 0 4px">${esc(p.title)}</h3><div style="display:flex;justify-content:space-between;align-items:center"><span class="meta">${formatOf(p)}</span>${priceHtml(p)}</div></div></a>`).join('') || '<div class="muted" style="grid-column:1/-1;padding:40px;text-align:center">Your products will appear here.</div>'}</div>
          </div>
        </div></div>
        <div class="trust">
          <div class="t-label">Everything you need to learn, build and ship.</div>
          <div class="t-items"><span class="t-item">${I.bolt}Instant delivery</span><span class="t-item">${I.infinity}Lifetime access</span><span class="t-item">${I.shield}Secure checkout</span><span class="t-item">${I.gift}Free resources</span></div>
        </div>
      </div>
    </section>

    ${cats.length ? `<section class="block"><div class="wrap">
      <div class="section-head reveal"><div class="left"><span class="label">Categories</span><h2>Find exactly what<br>you came for.</h2></div><p>Videos, templates, guides and toolkits — organised so you can get straight to the good stuff.</p></div>
      <div class="cat-grid">${cats.map((c, i) => `<a class="cat-card reveal" href="#/shop?cat=${esc(c.slug)}"><span class="n">${String(c.count).padStart(2, '0')}</span><div class="ico">${catIcons[i % catIcons.length]}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description || plural(c.count, 'product'))}</p></div></a>`).join('')}</div>
    </div></section>` : ''}

    <section class="block" style="padding-top:${cats.length ? 0 : 110}px"><div class="wrap">
      <div class="section-head reveal"><div class="left"><span class="label">${featured.length ? 'Featured' : 'Latest'}</span><h2>Made to help you<br>move faster.</h2></div><p>Hand-built products with everything included — download once, keep forever.</p></div>
      ${highlight.length ? `<div class="grid">${highlight.map(productCard).join('')}</div>` : `<div class="empty"><h3>No products yet</h3><p>${S.store.user?.isAdmin ? 'Add your first product from the <a href="#/admin/products" style="color:var(--accent-2)">dashboard</a>.' : 'Check back soon — new drops are on the way.'}</p></div>`}
      <div style="text-align:center;margin-top:34px"><a class="btn" href="#/shop">View all products ${I.arrow}</a></div>
    </div></section>

    <section class="block" style="padding-top:20px"><div class="wrap">
      <div class="section-head reveal"><div class="left"><span class="label">Delivery</span><h2>Pay once,<br>download instantly.</h2></div><p>Every purchase comes with a private download link — on screen right away and emailed to you to keep.</p></div>
      <div class="tabs-layout reveal">
        <div class="tab-list" id="tabs"><button class="on" data-t="0">Video downloads</button><button data-t="1">Files & bundles</button><button data-t="2">Free previews</button></div>
        <div class="tab-panel"><div class="tab-stage" id="tab-stage"></div><div class="tab-caption" id="tab-cap"></div></div>
      </div>
    </div></section>

    <section class="block" style="padding-top:40px"><div class="glow-bg"></div><div class="wrap" style="position:relative">
      <div class="section-head center reveal"><span class="label">How it works</span><h2>From checkout to<br>download in seconds.</h2></div>
      <div class="flow reveal">
        <div class="flow-step"><div class="flow-node"><span class="k">01</span>${I.search}</div><h4>Pick a product</h4><p>Browse by category, watch a free preview and see every file included.</p></div>
        <div class="flow-step"><div class="flow-node"><span class="k">02</span>${I.shield}</div><h4>Check out securely</h4><p>Pay by card, bank transfer or USSD through Paystack — or grab free products with just your email.</p></div>
        <div class="flow-step"><div class="flow-node"><span class="k">03</span>${I.bolt}</div><h4>Download instantly</h4><p>Your private download link appears the moment you pay — and lands in your inbox too.</p></div>
      </div>
    </div></section>

    ${free.length ? `<section class="block" style="padding-top:20px"><div class="wrap">
      <div class="section-head reveal"><div class="left"><span class="label">Free</span><h2>Start with something<br>on the house.</h2></div><p>No card, no account — just your name and email.</p></div>
      <div class="grid">${free.map(productCard).join('')}</div>
    </div></section>` : ''}

    ${faq.length ? `<section class="block" id="faq"><div class="wrap">
      <div class="section-head center reveal"><span class="label">Frequently asked</span><h2>Questions, answered.</h2></div>
      <div class="faq reveal">${faq.map(f => `<div class="faq-item"><button class="faq-q">${esc(f.q)}${I.plus}</button><div class="faq-a"><div><p>${esc(f.a)}</p></div></div></div>`).join('')}</div>
    </div></section>` : ''}

    <section class="cta"><div class="wrap reveal">
      <span class="label">Get started</span><h2>Ready to level up?</h2>
      <p>${esc(s.tagline)}</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="#/shop">Browse products ${I.arrow}</a><a class="btn" href="#/shop?price=free">Get free resources</a></div>
    </div></section>`);

    $$('.faq-q').forEach(b => b.addEventListener('click', () => b.parentElement.classList.toggle('open')));
    const sample = all.find(p => p.kinds.includes('video')) || all[0];
    const dlBtn = `<span class="btn btn-sm">${I.down} Download</span>`;
    const tabs = [
      { cap: ['Video Downloads', '<b>Keep them offline.</b> Download full-quality video files to watch on any device — or play them right on your download page.'],
        html: `<div class="mock"><div class="mock-video"><div class="play">${I.play.replace('<svg', '<svg width="20" height="20"')}</div><div class="bar"><i></i></div></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:13px;gap:10px"><span>${esc(sample?.title || 'Full walkthrough')} <small class="dim">· MP4 · 1080p</small></span>${dlBtn}</div></div>` },
      { cap: ['Files & Bundles', '<b>Everything included.</b> PDFs, ZIP bundles, templates and documents — download them whenever you need, as often as you like.'],
        html: `<div class="mock">${[['PDF', 'Workbook.pdf', '4.2 MB'], ['ZIP', 'Templates bundle.zip', '86 MB'], ['DOC', 'Checklist.docx', '210 KB'], ['MP4', 'Bonus walkthrough.mp4', '1.1 GB']].map(([k, n, z]) => `<div class="mock-row"><div class="fi">${k}</div><div class="grow">${n}<small>${z}</small></div><span class="dim">${I.down}</span></div>`).join('')}</div>` },
      { cap: ['Free Previews', '<b>Try before you buy.</b> Watch a sample clip or flip through a sample page right on the product page.'],
        html: `<div class="mock"><div class="mock-row"><div class="fi">MP4</div><div class="grow">Sample clip.mp4<small>Free preview</small></div><span class="tag-preview">Preview</span></div>
          <div class="mock-row"><div class="fi">PDF</div><div class="grow">Sample pages.pdf<small>Free preview</small></div><span class="tag-preview">Preview</span></div>
          <div class="mock-row"><div class="fi">ZIP</div><div class="grow">Full bundle.zip<small>Unlocks after purchase</small></div><span class="dim">${I.lock.replace('<svg', '<svg width="15" height="15"')}</span></div></div>` },
    ];
    const setTab = i => {
      $$('#tabs button').forEach((b, j) => b.classList.toggle('on', i === j));
      $('#tab-stage').innerHTML = tabs[i].html;
      $('#tab-cap').innerHTML = `<h4>${tabs[i].cap[0]}</h4><p>${tabs[i].cap[1]}</p>`;
    };
    $$('#tabs button').forEach(b => b.addEventListener('click', () => setTab(Number(b.dataset.t))));
    setTab(0);
  }

  async function shop(q) {
    const cat = q.get('cat') || '', price = q.get('price') || '', kind = q.get('kind') || '', sort = q.get('sort') || '', term = q.get('q') || '';
    const kinds = [['video', 'Videos'], ['pdf', 'PDFs & guides'], ['archive', 'ZIP bundles'], ['document', 'Documents & templates'], ['audio', 'Audio']];
    const catObj = S.store.categories.find(c => c.slug === cat);
    const kindName = kinds.find(k => k[0] === kind)?.[1];
    const title = catObj ? catObj.name : price === 'free' ? 'Free resources' : kindName || 'All products';
    const desc = catObj?.description || (price === 'free' ? 'Grab these with a free account — no card required.' : 'Videos, guides, templates and toolkits — everything in the store.');
    const active = price === 'free' ? 'free' : kind === 'video' ? 'videos' : 'shop';
    const link = (patch) => {
      const n = new URLSearchParams({ cat, price, kind, sort, q: term, ...patch });
      for (const [k, v] of [...n]) if (!v) n.delete(k);
      return '#/shop' + (n.toString() ? '?' + n : '');
    };
    shell(`<div class="page-top"><div class="aurora"><i></i></div><div class="wrap" style="position:relative">
        <div class="crumbs"><a href="#/">Home</a><span>/</span><span>Store</span></div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div></div>
      <div class="wrap page" style="padding-top:10px"><div class="shop-layout">
        <aside class="side-nav">
          <h6>Browse</h6>
          <a href="${link({ cat: '' })}" class="${!cat ? 'on' : ''}">Everything</a>
          ${S.store.categories.map(c => `<a href="${link({ cat: c.slug })}" class="${cat === c.slug ? 'on' : ''}">${esc(c.name)}<small>${c.count}</small></a>`).join('')}
          <h6>Format</h6>
          <a href="${link({ kind: '' })}" class="${!kind ? 'on' : ''}">All formats</a>
          ${kinds.map(([k, l]) => `<a href="${link({ kind: k })}" class="${kind === k ? 'on' : ''}">${l}</a>`).join('')}
        </aside>
        <div>
          <div class="toolbar">
            <form class="search" id="search">${I.search}<input class="input" name="q" placeholder="Search products…" value="${esc(term)}"></form>
            <div class="seg">${[['', 'All'], ['paid', 'Paid'], ['free', 'Free']].map(([v, l]) => `<button data-price="${v}" class="${price === v ? 'on' : ''}">${l}</button>`).join('')}</div>
            <select class="input" id="sort" style="width:auto;min-width:150px">${[['', 'Newest'], ['popular', 'Most popular'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low']].map(([v, l]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </div>
          <div id="results">${spinner()}</div>
        </div>
      </div></div>`, { active });
    $('#search').addEventListener('submit', e => { e.preventDefault(); location.hash = link({ q: e.target.q.value.trim() }); });
    $$('.seg button').forEach(b => b.addEventListener('click', () => (location.hash = link({ price: b.dataset.price }))));
    $('#sort').addEventListener('change', e => (location.hash = link({ sort: e.target.value })));
    const params = new URLSearchParams({ cat, price, kind, sort, q: term });
    const list = await api('/api/products?' + params);
    $('#results').innerHTML = list.length ? `<div class="muted" style="font-size:13px;margin-bottom:14px">${plural(list.length, 'product')}</div><div class="grid">${list.map(productCard).join('')}</div>`
      : `<div class="empty"><h3>Nothing here yet</h3><p>Try another category or clear your filters.</p><a class="btn btn-sm" href="#/shop">Clear filters</a></div>`;
    observeReveal();
  }

  async function product(slug) {
    let p;
    try { p = await api('/api/products/' + encodeURIComponent(slug)); }
    catch { return notFound(); }
    const kinds = [...new Set(p.fileList.map(f => f.kind))];
    const previews = p.fileList.filter(f => f.preview);
    const off = p.compare && p.compare > p.price ? Math.round((1 - p.price / p.compare) * 100) : 0;
    document.title = `${p.title} — ${S.store.settings.store_name}`;

    shell(`<div class="page-top" style="padding-bottom:20px"><div class="aurora"><i></i></div><div class="wrap" style="position:relative">
        <div class="crumbs"><a href="#/shop">Store</a>${p.category ? `<span>/</span><a href="#/shop?cat=${esc(p.category.slug)}">${esc(p.category.name)}</a>` : ''}</div>
        <h1>${esc(p.title)}</h1><p style="font-size:17px">${esc(p.subtitle)}</p></div></div>
      <div class="wrap page" style="padding-top:20px"><div class="product-layout">
        <div>
          <div class="product-hero-cover">${coverHtml(p, { title: false })}
            ${previews.length ? `<button class="btn btn-sm" data-preview="${previews[0].id}" style="position:absolute;left:16px;bottom:16px;z-index:3;background:rgba(10,10,10,.7);backdrop-filter:blur(8px)">${I.play.replace('<svg', '<svg width="13" height="13"')} ${previews[0].kind === 'video' ? 'Watch preview' : 'View sample'}</button>` : ''}</div>
          ${p.description ? `<div class="prose" style="margin-top:36px">${md(p.description)}</div>` : ''}
          ${p.fileList.length ? `<div class="box" style="margin-top:36px"><div class="box-head"><h3>What's included</h3><span class="muted" style="font-size:13px">${plural(p.fileList.length, 'file')} · ${size(p.totalSize)}</span></div>
            ${p.fileList.map(f => `<div class="file-row"><div class="file-ico ${f.kind}">${esc(extOf(f.name))}</div><div class="grow"><div class="nm">${esc(f.name)}</div><small>${size(f.size)}</small></div>
              ${f.preview ? `<button class="tag-preview" style="background:none;cursor:pointer" data-preview="${f.id}">Preview</button>` : `<span class="dim">${I.lock.replace('<svg', '<svg width="15" height="15"')}</span>`}</div>`).join('')}
          </div>` : ''}
        </div>
        <aside><div class="buy-card">
          <span class="label">${formatOf(p) === 'Download' ? 'Digital download' : formatOf(p) + ' download'}</span>
          <div class="big-price" id="price">${p.price ? `${money(p.price)}${off ? `<s>${money(p.compare)}</s><span class="off">-${off}%</span>` : ''}` : 'Free'}</div>
          <form id="buy-form" class="buy-form" novalidate>
            <input class="input" name="name" placeholder="Your name" autocomplete="name" required>
            <input class="input" name="email" type="email" placeholder="Your email" autocomplete="email" inputmode="email" required>
            <div class="error-msg" id="buy-err"></div>
            <button class="btn btn-primary btn-lg btn-block" id="buy">${p.price ? 'Buy now' : 'Get it free'} ${I.arrow}</button>
            <small class="dim" style="font-size:11.5px;text-align:center;line-height:1.5">By continuing you agree to our <a href="#/terms" style="text-decoration:underline">Terms</a>${p.price ? `, <a href="#/refunds" style="text-decoration:underline">Refund Policy</a>` : ''} and <a href="#/privacy" style="text-decoration:underline">Privacy Policy</a>.</small>
          </form>
          ${p.price ? `<button class="coupon-toggle" id="coupon-toggle">Have a discount code?</button><form class="coupon hidden" id="coupon-form"><input class="input" name="code" placeholder="CODE"><button class="btn btn-sm">Apply</button></form>` : ''}
          <ul class="includes">
            ${p.fileList.length ? `<li>${I.checkC}${plural(p.fileList.length, 'downloadable file')}${kinds.length ? ` (${kinds.map(k => kindLabel[k]).join(', ')})` : ''}</li>` : ''}
            <li>${I.checkC}Instant download link after checkout</li>
            <li>${I.checkC}No account needed — just your email</li>
            <li>${I.checkC}Free future updates to the files</li>
          </ul>
          ${S.store.payments === 'demo' && p.price ? '<div class="demo-note">Test mode: checkout is simulated — no real payment is taken.</div>' : ''}
        </div></aside>
        <div class="mobile-buy"><div><b>${esc(p.title)}</b><span>${p.price ? money(p.price) : 'Free'}</span></div><button class="btn btn-primary" id="mobile-buy">${p.price ? 'Buy now' : 'Get it free'}</button></div>
      </div></div>`, { active: 'shop' });

    $$('[data-preview]').forEach(b => b.addEventListener('click', () => previewFile(p.fileList.find(f => f.id === Number(b.dataset.preview)))));
    let coupon = '';
    $('#coupon-toggle')?.addEventListener('click', () => { $('#coupon-form').classList.remove('hidden'); $('#coupon-toggle').remove(); $('#coupon-form input').focus(); });
    $('#coupon-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const code = e.target.code.value.trim();
      try {
        const r = await api('/api/coupons/validate', { method: 'POST', body: { code, productId: p.id } });
        coupon = code;
        $('#price').innerHTML = r.price ? `${money(r.price)}<s>${money(r.original)}</s><span class="off">${esc(code.toUpperCase())}</span>` : `Free<s>${money(r.original)}</s>`;
        $('#buy').innerHTML = (r.price ? 'Buy now' : 'Get it free') + ' ' + I.arrow;
        toast('Discount applied');
      } catch (err) { toast(err.message, true); }
    });
    // Remember the buyer's name/email on this device so repeat purchases are one click.
    const form = $('#buy-form');
    try { const saved = JSON.parse(localStorage.getItem('cs_buyer') || '{}'); form.name.value = saved.name || ''; form.email.value = saved.email || ''; } catch {}
    form.addEventListener('submit', e => { e.preventDefault(); checkout(p, coupon); });
    $('#mobile-buy').addEventListener('click', () => {
      $('.buy-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => (form.name.value ? form.email : form.name).focus(), 400);
    });
    const io = new IntersectionObserver(([e]) => $('.mobile-buy')?.classList.toggle('show', !e.isIntersecting));
    io.observe($('.buy-card'));
  }

  // Inline viewer for a file: video/audio player, PDF/image frame, or nothing for other types.
  function fileUrl(f, token, inline) {
    const q = new URLSearchParams();
    if (inline) q.set('inline', '1');
    if (token) q.set('t', token);
    return `/api/files/${f.id}${q.toString() ? '?' + q : ''}`;
  }
  function viewerHtml(f, token) {
    const src = fileUrl(f, token, true);
    if (f.kind === 'video') return `<div class="player"><video src="${src}" controls autoplay playsinline></video></div>`;
    if (f.kind === 'audio') return `<audio src="${src}" controls autoplay style="width:100%"></audio>`;
    if (f.kind === 'pdf') return `<iframe class="pdf-frame" src="${src}"></iframe>`;
    if (f.kind === 'image') return `<img src="${src}" alt="" style="width:100%;border-radius:12px">`;
    return '';
  }
  function previewFile(f) {
    if (!f) return;
    const view = viewerHtml(f);
    modal(`<h3>${esc(f.name)}</h3><span class="tag-preview">Free preview</span>
      <div style="margin-top:16px">${view || `<p class="muted">This file type can't be previewed in the browser — <a href="${fileUrl(f)}" style="color:var(--accent-2)">download the sample</a>.</p>`}</div>
      <div class="actions"><button class="btn" data-close>Close</button></div>`, m => { m.style.maxWidth = '820px'; });
  }

  async function checkout(p, coupon) {
    const form = $('#buy-form'), err = $('#buy-err');
    const name = form.name.value.trim(), email = form.email.value.trim();
    err.textContent = '';
    if (!name) { err.textContent = 'Please enter your name.'; return form.name.focus(); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Please enter a valid email — your download link goes there.'; return form.email.focus(); }
    try { localStorage.setItem('cs_buyer', JSON.stringify({ name, email })); } catch {}
    const btn = $('#buy'), label = btn.innerHTML;
    btn.disabled = true; btn.textContent = p.price ? 'Opening secure checkout…' : 'Getting your files…';
    try {
      const r = await api('/api/checkout', { method: 'POST', body: { productId: p.id, coupon, name, email } });
      if (r.url) return void (location.href = r.url);
      if (r.demo) {
        modal(`<span class="label">Test checkout</span><h3 style="margin-top:14px">${esc(p.title)}</h3>
          <p class="muted" style="margin:0 0 18px">Paystack isn't connected yet, so this is a simulated payment. No money is charged.</p>
          <div class="box" style="padding:16px 18px;display:flex;justify-content:space-between"><span>Total</span><b>${money(r.amount)}</b></div>
          <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="pay">Complete test payment</button></div>`,
          (m, close) => {
            $('#pay', m).onclick = async () => {
              await api(`/api/checkout/demo/${r.token}`, { method: 'POST' });
              close(); location.hash = `#/download/${r.token}`;
            };
          });
        return;
      }
      if (r.token) location.hash = `#/download/${r.token}`;
    } catch (e) { err.textContent = e.message; }
    finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
  }

  // Owner sign-in only — buyers never need an account.
  function authPage(q) {
    const next = q.get('next') || '#/admin';
    app.innerHTML = nav() + `<div class="auth"><div class="aurora"><i></i></div><div class="grain"></div>
      <form class="auth-card" id="auth">
        <span class="label">Store owner</span>
        <h1>Sign in.</h1>
        <p>Manage your products, files and sales. Looking for something you bought? <a href="#/find" style="color:var(--accent-2)">Find my downloads</a>.</p>
        <label class="field"><span>Email</span><input class="input" name="email" type="email" required autocomplete="email"></label>
        <label class="field"><span>Password</span><input class="input" name="password" type="password" required autocomplete="current-password"></label>
        <div class="error-msg" id="err"></div>
        <button class="btn btn-primary btn-lg btn-block">Sign in ${I.arrow}</button>
      </form></div>`;
    wireChrome();
    $('#auth').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await api('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
        await loadStore(); toast('Signed in'); location.hash = next;
      } catch (err) { $('#err').textContent = err.message; }
    });
  }

  // The private page a buyer lands on after paying (and that their email links to).
  async function downloadPage(token, attempt = 0) {
    let p;
    try { p = await api('/api/order/' + encodeURIComponent(token)); }
    catch (e) {
      return shell(`<div class="wrap page" style="text-align:center;padding-top:120px"><span class="label">Download link</span><h1 style="margin:18px 0 12px">${esc(e.message)}</h1>
        <p class="muted">Lost your link? We can email it to you again.</p><a class="btn btn-primary" href="#/find" style="margin-top:20px">Find my downloads</a></div>`);
    }
    if (p.pending) {
      // Payment just finished and Paystack is still confirming (bank transfers can take a moment) — check again shortly.
      if (attempt === 0) shell(`<div class="wrap page" style="text-align:center;padding-top:120px"><div class="spinner" style="margin:0 auto 24px"></div><h1 style="font-size:40px">Confirming your payment…</h1><p class="muted">This usually takes a few seconds.</p></div>`);
      if (attempt < 20) return setTimeout(() => location.hash === `#/download/${token}` && downloadPage(token, attempt + 1), 2000);
      return shell(`<div class="wrap page" style="text-align:center;padding-top:120px"><h1 style="font-size:40px">Still waiting on payment.</h1><p class="muted">If you completed checkout, refresh this page in a minute. Your link will also be emailed to you.</p></div>`);
    }
    document.title = `${p.title} — ${S.store.settings.store_name}`;
    const viewable = f => ['video', 'audio', 'pdf', 'image'].includes(f.kind);
    const first = (p.buyer.name || '').split(' ')[0];

    shell(`<div class="page-top"><div class="aurora"><i></i></div><div class="wrap" style="position:relative;max-width:960px">
        <span class="label">${p.price ? 'Order confirmed' : 'All yours'}</span>
        <h1>Thanks${first ? ', ' + esc(first) : ''}! Your files are ready.</h1>
        <p>${esc(p.title)} — ${p.emailed ? `we've also emailed this link to <b style="color:var(--text);font-weight:500">${esc(p.buyer.email)}</b>.` : 'bookmark this page to come back to your files any time.'}</p></div></div>
      <div class="wrap page" style="padding-top:10px;max-width:960px">
        <div id="viewer" style="margin-bottom:22px"></div>
        ${p.downloads.length ? `<div class="box"><div class="box-head"><h3>Your files</h3><span class="muted" style="font-size:13px">${plural(p.downloads.length, 'file')} · ${size(p.totalSize)}</span></div>
          ${p.downloads.map(f => `<div class="file-row"><div class="file-ico ${f.kind}">${esc(extOf(f.name))}</div><div class="grow"><div class="nm">${esc(f.name)}</div><small>${size(f.size)}</small></div>
            ${viewable(f) ? `<button class="btn btn-sm btn-ghost" data-view="${f.id}">${f.kind === 'video' || f.kind === 'audio' ? 'Play' : 'View'}</button>` : ''}
            <a class="btn btn-sm btn-primary" href="${fileUrl(f, token)}" download>${I.down} Download</a></div>`).join('')}
        </div>` : '<div class="empty"><h3>Files coming soon</h3><p>The files for this product haven\'t been uploaded yet — this same link will work once they are.</p></div>'}
        <div class="box" style="margin-top:18px;padding:16px 20px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <span class="muted" style="font-size:13.5px">This private link is your access — keep it safe and don't share it.</span>
          <button class="btn btn-sm" id="copy-link">Copy link</button>
        </div>
        ${p.description ? `<div class="prose" style="margin-top:36px">${md(p.description)}</div>` : ''}
      </div>`);

    $('#copy-link').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href); toast('Link copied'); } catch { toast('Copy the address from your browser bar', true); }
    });
    $$('[data-view]').forEach(b => b.addEventListener('click', () => {
      const f = p.downloads.find(x => x.id === Number(b.dataset.view));
      $('#viewer').innerHTML = `<div class="box" style="padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin:0 4px 12px;gap:10px"><span style="font-size:14px">${esc(f.name)}</span><button class="btn btn-sm btn-ghost" id="close-viewer">Close</button></div>${viewerHtml(f, token)}</div>`;
      $('#close-viewer').onclick = () => ($('#viewer').innerHTML = '');
      $('#viewer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function findDownloads() {
    const canEmail = S.store.emails;
    shell(`<div class="auth" style="min-height:70vh"><div class="aurora"><i></i></div>
      <form class="auth-card" id="find">
        <span class="label">My downloads</span>
        <h1>Find your files.</h1>
        ${canEmail ? `<p>Enter the email you used at checkout and we'll send you your download links.</p>
          <label class="field"><span>Email</span><input class="input" name="email" type="email" required autocomplete="email"></label>
          <div class="error-msg" id="err"></div>
          <button class="btn btn-primary btn-lg btn-block">Email my links ${I.arrow}</button>`
          : `<p>Your download link was shown right after checkout — check your browser bookmarks or history for a page starting with <code>${esc(location.host)}/#/download/</code>.</p>
          <p style="margin:0">Still can't find it? Reply to your payment receipt and we'll send it over.</p>`}
      </form></div>`, { active: 'find' });
    $('#find').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await api('/api/resend-links', { method: 'POST', body: { email: e.target.email.value } });
        $('#find').innerHTML = `<span class="label">Check your inbox</span><h1>Sent.</h1><p>If that email has any purchases, the download links are on their way. Check spam if you don't see them in a minute.</p><a class="btn btn-block" href="#/shop">Back to the store</a>`;
      } catch (err) { $('#err').textContent = err.message; }
    });
  }

  function account() {
    if (!S.store.user) return (location.hash = '#/login?next=' + encodeURIComponent('#/account'));
    shell(`<div class="wrap page" style="max-width:560px"><span class="label">Owner account</span><h1 style="font-size:44px;margin:16px 0 8px">Settings</h1><p class="muted" style="margin:0 0 30px">${esc(S.store.user.email)}</p>
      <form class="panel" id="pw"><h3>Change password</h3>
        <label class="field"><span>Current password</span><input class="input" type="password" name="current" required></label>
        <label class="field"><span>New password</span><input class="input" type="password" name="next" minlength="8" required></label>
        <button class="btn btn-primary">Update password</button></form></div>`);
    $('#pw').addEventListener('submit', async e => {
      e.preventDefault();
      try { await api('/api/auth/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('Password updated'); }
      catch (err) { toast(err.message, true); }
    });
  }

  async function legalPage(page) {
    let doc;
    try { doc = await api('/api/legal/' + page); } catch { return notFound(); }
    document.title = `${doc.title} — ${S.store.settings.store_name}`;
    const others = [['terms', 'Terms of Sale'], ['privacy', 'Privacy Policy'], ['refunds', 'Refund Policy']].filter(([k]) => k !== page);
    shell(`<div class="wrap page" style="max-width:760px;padding-top:56px">
      <span class="label">Legal</span>
      <div class="prose" style="margin-top:6px">${md(doc.text)}</div>
      <div class="box" style="margin-top:36px;padding:16px 20px;display:flex;gap:18px;flex-wrap:wrap;font-size:14px">
        <span class="muted">Also see:</span>${others.map(([k, t]) => `<a href="#/${k}" style="color:var(--accent-2)">${t}</a>`).join('')}
      </div></div>`);
  }

  function notFound() {
    shell(`<div class="wrap page" style="text-align:center;padding-top:120px"><span class="label">404</span><h1 style="margin:18px 0 12px">Page not found.</h1><p class="muted">That product or page doesn't exist.</p><a class="btn btn-primary" href="#/shop" style="margin-top:20px">Back to the store</a></div>`);
  }

  // ---------- router ----------
  async function loadStore() { S.store = await api('/api/store'); }
  async function route() {
    const raw = location.hash.slice(1) || '/';
    const [pathPart, qs] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const q = new URLSearchParams(qs || '');
    document.title = S.store.settings.store_name;
    scrollTo(0, 0);
    try {
      switch (parts[0]) {
        case undefined: return await home();
        case 'shop': return await shop(q);
        case 'p': return await product(parts[1]);
        case 'login': return authPage(q);
        case 'download': return await downloadPage(parts[1]);
        case 'find': return findDownloads();
        case 'terms': case 'privacy': case 'refunds': return await legalPage(parts[0]);
        case 'account': return account();
        case 'admin': return await window.Admin.render(parts.slice(1), q);
        default: return notFound();
      }
    } catch (e) { console.error(e); toast(e.message || 'Something went wrong', true); }
  }

  window.Store = { api, upload, esc, money, size, plural, date, md, I, toast, modal, confirmDialog, coverHtml, loadStore, S, route, $, $$, kindLabel, extOf, spinner };
  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', async () => {
    try { await loadStore(); } catch { app.innerHTML = '<div class="wrap page"><h1>Store is offline.</h1></div>'; return; }
    if (location.search.includes('session_id')) history.replaceState(null, '', '/' + location.hash);
    route();
  });
})();
