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

// One "your files are ready" email for one order. `key` makes repeats of the same send a no-op.
async function sendDownload({ to, store, name, title, url, key }) {
  if (!enabled) return null;
  const data = await post({
    from: FROM,
    to: [to],
    subject: `Your download: ${title}`,
    template: {
      id: TEMPLATE,
      variables: {
        STORE_NAME: esc(store),
        BUYER_NAME: esc(String(name || '').trim().split(/\s+/)[0] || 'there'),
        PRODUCT_TITLE: esc(title),
        DOWNLOAD_URL: esc(url),
      },
    },
  }, key);
  console.log(`Email sent to ${to} (${data.id})`);
  return data.id;
}

module.exports = { enabled, sendDownload };
