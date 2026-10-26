/* Optional analytics: Plausible, Google Analytics 4 and the Meta Pixel, switched on by pasting their IDs in
   Store settings → Analytics. Only page views and store events (product viewed, checkout started, purchase,
   free download) are sent, never names, emails or phone numbers. */
(() => {
  const on = { plausible: false, ga: false, pixel: false };

  function load(src, attrs = {}) {
    const s = document.createElement('script');
    s.async = true; s.src = src;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    document.head.append(s);
  }

  function init(settings) {
    const domain = String(settings.plausible_domain || '').trim().toLowerCase();
    const ga = String(settings.ga_id || '').trim().toUpperCase();
    const pixel = String(settings.meta_pixel_id || '').trim();

    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      on.plausible = true;
      window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
      load('https://plausible.io/js/script.hash.revenue.js', { 'data-domain': domain }); // tracks #/ pages and revenue
    }
    if (/^G-[A-Z0-9]{4,}$/.test(ga)) {
      on.ga = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', ga, { send_page_view: false });
      load(`https://www.googletagmanager.com/gtag/js?id=${ga}`);
    }
    if (/^\d{5,20}$/.test(pixel)) {
      on.pixel = true;
      const f = (window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); });
      if (!window._fbq) window._fbq = f;
      f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
      load('https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', pixel);
    }
  }

  // Called on every route change (Plausible's hash script counts pages itself).
  function page() {
    const path = location.pathname + location.hash;
    if (on.ga) gtag('event', 'page_view', { page_location: location.href, page_path: path, page_title: document.title });
    if (on.pixel) fbq('track', 'PageView');
  }

  const units = c => c / 100;
  // event: 'view_product' | 'begin_checkout' | 'purchase' | 'free_download'
  function track(event, d = {}) {
    const currency = String(d.currency || '').toUpperCase(), value = units(d.amount || 0);
    const item = { item_id: d.slug, item_name: d.title, price: value, quantity: 1 };
    if (event === 'view_product') {
      if (on.ga) gtag('event', 'view_item', { currency, value, items: [item] });
      if (on.pixel) fbq('track', 'ViewContent', { content_ids: [d.slug], content_name: d.title, content_type: 'product', value, currency });
    } else if (event === 'begin_checkout') {
      if (on.ga) gtag('event', 'begin_checkout', { currency, value, items: [item] });
      if (on.pixel) fbq('track', 'InitiateCheckout', { content_ids: [d.slug], value, currency });
      if (on.plausible) plausible('Checkout', { props: { product: d.title } });
    } else if (event === 'purchase') {
      if (on.ga) gtag('event', 'purchase', { transaction_id: d.ref, currency, value, items: [item] });
      if (on.pixel) fbq('track', 'Purchase', { content_ids: [d.slug], content_type: 'product', value, currency }, { eventID: d.ref });
      if (on.plausible) plausible('Purchase', { revenue: { currency, amount: value }, props: { product: d.title } });
    } else if (event === 'free_download') {
      if (on.ga) gtag('event', 'generate_lead', { items: [item] });
      if (on.pixel) fbq('track', 'Lead', { content_name: d.title });
      if (on.plausible) plausible('Free download', { props: { product: d.title } });
    }
  }

  // Purchases are reported once per order, even if the buyer reopens their download page.
  function trackOnce(key, event, d) {
    try { if (localStorage.getItem('cs_tracked_' + key)) return; localStorage.setItem('cs_tracked_' + key, '1'); } catch {}
    track(event, d);
  }

  window.Analytics = { init, page, track, trackOnce };
})();
