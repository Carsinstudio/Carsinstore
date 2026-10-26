// Sends download-link emails through Resend (https://resend.com). Optional:
// without RESEND_API_KEY the store still works — buyers get their link on screen.
// The email's design and wording live in the Resend dashboard (Templates → "Download ready"),
// so they can be edited there without touching code.
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM;
const TEMPLATE = process.env.RESEND_TEMPLATE || 'download-ready';
const enabled = !!(KEY && FROM);

// Template variables are inserted unescaped ({{{VAR}}}), so anything a buyer typed must be escaped here.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Retries network errors, 429 and 5xx with backoff (respecting retry-after); other 4xx fail immediately.
async function post(body, idempotencyKey) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(500 * 2 ** attempt);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 3) throw new Error(`Resend ${res.status}: ${data.message || JSON.stringify(data)}`);
    const after = Number(res.headers.get('retry-after'));
    await sleep(after > 0 ? after * 1000 : 500 * 2 ** attempt);
  }
}

// Sends one email from a published Resend template. `key` makes repeats of the same send a no-op.
async function sendTemplate({ template, to, subject, variables, key, replyTo }) {
  if (!enabled) return null;
  const escaped = Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, esc(v)]));
  const data = await post({ from: FROM, to: [to], subject, template: { id: template, variables: escaped }, ...(replyTo ? { reply_to: replyTo } : {}) }, key);
  console.log(`Email "${template}" sent to ${to} (${data.id})`);
  return data.id;
}

// "Your files are ready" — to the buyer, once per order.
function sendDownload({ to, store, name, title, url, key, replyTo }) {
  return sendTemplate({
    template: TEMPLATE, to, key, replyTo,
    subject: `Your download: ${title}`,
    variables: { STORE_NAME: store, BUYER_NAME: String(name || '').trim().split(/\s+/)[0] || 'there', PRODUCT_TITLE: title, DOWNLOAD_URL: url },
  });
}

// "New sale" — to the store owner. Uses the "sale-alert" template.
function sendSaleAlert({ to, store, type, amount, title, buyer, email, phone, dashboardUrl, key }) {
  return sendTemplate({
    template: process.env.RESEND_ALERT_TEMPLATE || 'sale-alert', to, key, replyTo: email,
    subject: `${type}: ${amount} · ${title}`,
    variables: { ORDER_TYPE: type, AMOUNT: amount, PRODUCT_TITLE: title, BUYER_NAME: buyer || '—', BUYER_EMAIL: email || '—', BUYER_PHONE: phone || '—', DASHBOARD_URL: dashboardUrl, STORE_NAME: store },
  });
}

// "Still want …?" — to a buyer whose payment didn't complete. Uses the "checkout-reminder" template.
function sendCheckoutReminder({ to, store, name, title, amount, url, key, replyTo }) {
  return sendTemplate({
    template: process.env.RESEND_REMINDER_TEMPLATE || 'checkout-reminder', to, key, replyTo,
    subject: `Still want ${title}?`,
    variables: { STORE_NAME: store, BUYER_NAME: String(name || '').trim().split(/\s+/)[0] || 'there', PRODUCT_TITLE: title, AMOUNT: amount, PRODUCT_URL: url },
  });
}

module.exports = { enabled, sendDownload, sendSaleAlert, sendCheckoutReminder };
