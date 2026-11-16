// Sends download-link emails through Resend (https://resend.com). Optional:
// without RESEND_API_KEY the store still works, and buyers get their link on screen.
// The email's design and wording live in the Resend dashboard (Templates → "Download ready"),
// so they can be edited there without touching code.
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM;
const TEMPLATE = process.env.RESEND_TEMPLATE || 'download-ready';
const enabled = !!(KEY && FROM);
const API = process.env.RESEND_API_URL || 'https://api.resend.com'; // overridable for tests

// Template variables are inserted unescaped ({{{VAR}}}), so anything a buyer typed must be escaped here.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Retries network errors, 429 and 5xx with backoff (respecting retry-after); other 4xx fail immediately.
async function post(body, idempotencyKey) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${API}/emails`, {
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
// `raw` names variables the caller has already made safe HTML; `headers` adds email headers (e.g. List-Unsubscribe).
async function sendTemplate({ template, to, subject, variables, key, replyTo, raw = [], headers }) {
  if (!enabled) return null;
  const escaped = Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, raw.includes(k) ? String(v ?? '') : esc(v)]));
  const data = await post({ from: FROM, to: [to], subject, template: { id: template, variables: escaped }, ...(replyTo ? { reply_to: replyTo } : {}), ...(headers ? { headers } : {}) }, key);
  console.log(`Email "${template}" sent to ${to} (${data.id})`);
  return data.id;
}

const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'there';

// Emails to buyers. All share one look (edit them in Resend → Templates) and get the store's
// address and support email for the footer links.
//   kind 'receipt': paid order, payment confirmation with amount, date and reference
//   kind 'welcome': free product, welcome to the store
//   kind 'files':   gifts from the dashboard and "Find my downloads" re-sends
function sendDownload({ kind = 'files', to, store, name, title, url, amount, date, ref, siteUrl, support, key, replyTo }) {
  const common = { STORE_NAME: store, BUYER_NAME: firstName(name), PRODUCT_TITLE: title, DOWNLOAD_URL: url, SITE_URL: siteUrl, SUPPORT_EMAIL: support };
  if (kind === 'receipt') {
    return sendTemplate({ template: 'payment-receipt', to, key, replyTo, subject: `Receipt: ${title} · ${amount}`,
      variables: { ...common, AMOUNT: amount, ORDER_DATE: date, ORDER_REF: ref } });
  }
  if (kind === 'welcome') {
    return sendTemplate({ template: 'free-welcome', to, key, replyTo, subject: `Welcome to ${store}: your free ${title}`, variables: common });
  }
  return sendTemplate({ template: TEMPLATE, to, key, replyTo, subject: `Your download: ${title}`, variables: common });
}

// "New sale": to the store owner. Uses the "sale-alert" template.
function sendSaleAlert({ to, store, type, amount, title, buyer, email, phone, dashboardUrl, siteUrl, support, key }) {
  return sendTemplate({
    template: process.env.RESEND_ALERT_TEMPLATE || 'sale-alert', to, key, replyTo: email,
    subject: `${type}: ${amount} · ${title}`,
    variables: { ORDER_TYPE: type, AMOUNT: amount, PRODUCT_TITLE: title, BUYER_NAME: buyer || 'Not given', BUYER_EMAIL: email || 'Not given', BUYER_PHONE: phone || 'Not given', DASHBOARD_URL: dashboardUrl, STORE_NAME: store, SITE_URL: siteUrl, SUPPORT_EMAIL: support },
  });
}

// Checkout reminder: to a buyer whose payment did not complete. Uses the "checkout-reminder" template.
// Worded as a plain notice about their own payment (not a sales nudge) so it lands in the main inbox.
function sendCheckoutReminder({ to, store, name, title, amount, ref, url, siteUrl, support, key, replyTo }) {
  return sendTemplate({
    template: process.env.RESEND_REMINDER_TEMPLATE || 'checkout-reminder', to, key, replyTo,
    subject: `Your checkout for ${title} didn't go through`,
    variables: { STORE_NAME: store, BUYER_NAME: firstName(name), PRODUCT_TITLE: title, AMOUNT: amount, ORDER_REF: ref, PRODUCT_URL: url, SITE_URL: siteUrl, SUPPORT_EMAIL: support },
  });
}

// "How was it?": to a buyer a few days after they got a product. Uses the "review-request" template.
// RATE_URL ends in "?rate=" so each star in the email can add its number.
function sendReviewRequest({ to, store, name, title, rateUrl, url, siteUrl, support, key, replyTo }) {
  return sendTemplate({
    template: process.env.RESEND_REVIEW_TEMPLATE || 'review-request', to, key, replyTo,
    subject: `How was ${title}?`,
    variables: { STORE_NAME: store, BUYER_NAME: firstName(name), PRODUCT_TITLE: title, RATE_URL: rateUrl, DOWNLOAD_URL: url, SITE_URL: siteUrl, SUPPORT_EMAIL: support },
  });
}

// "Reset your password": to the store owner, with a one-time link. Uses the "password-reset" template.
function sendPasswordReset({ to, store, name, url, siteUrl, support, key }) {
  return sendTemplate({
    template: process.env.RESEND_RESET_TEMPLATE || 'password-reset', to, key,
    subject: `Reset your ${store} password`,
    variables: { STORE_NAME: store, BUYER_NAME: firstName(name), RESET_URL: url, SITE_URL: siteUrl, SUPPORT_EMAIL: support },
  });
}

// "New in the store": a product announcement to past buyers. Uses the "product-announcement" template.
// The message is the owner's own words: escaped here, with line breaks kept. Every email carries a one-click
// unsubscribe (the List-Unsubscribe headers Gmail and Yahoo ask bulk senders for) and a link in the footer.
function sendAnnouncement({ to, store, name, title, message, price, coverUrl, productUrl, unsubscribeUrl, unsubscribePost, siteUrl, support, subject, key, replyTo }) {
  return sendTemplate({
    template: process.env.RESEND_ANNOUNCE_TEMPLATE || 'product-announcement', to, key, replyTo, subject,
    raw: ['MESSAGE'],
    headers: { 'List-Unsubscribe': `<${unsubscribePost}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    variables: { STORE_NAME: store, BUYER_NAME: firstName(name), PRODUCT_TITLE: title, MESSAGE: esc(message).replace(/\r?\n/g, '<br>'), PRICE: price,
      COVER_URL: coverUrl, PRODUCT_URL: productUrl, UNSUBSCRIBE_URL: unsubscribeUrl, SITE_URL: siteUrl, SUPPORT_EMAIL: support },
  });
}

// Emails the server fills in itself from emails/build.js and sends as finished HTML, so they need no template in
// Resend. All carry the one-click unsubscribe headers. MESSAGE is plain text: escaped, with line breaks kept.
let built;
async function sendInline({ alias, to, subject, vars, message, unsubscribePost, key, replyTo }) {
  if (!enabled) return null;
  built ||= require('./emails/build').templates;
  const t = built[alias];
  const fill = (s, msg, safe) => s.replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => (k === 'MESSAGE' ? msg : safe(vars[k] ?? '')));
  let html = fill(t.html, esc(message).replace(/\r?\n/g, '<br>'), esc);
  if (!vars.IMAGE_URL) html = html.replace(/<!--IMG-->[\s\S]*?<!--\/IMG-->/g, '');
  const text = fill(t.text, String(message), String);
  const data = await post({
    from: FROM, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}),
    ...(unsubscribePost ? { headers: { 'List-Unsubscribe': `<${unsubscribePost}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
  }, key);
  console.log(`Email "${alias}" sent to ${to} (${data.id})`);
  return data.id;
}

// "Picked for you": an automatic product suggestion. Same look and unsubscribe link as announcements.
function sendPick({ to, store, name, title, message, price, coverUrl, productUrl, unsubscribeUrl, unsubscribePost, siteUrl, support, key, replyTo }) {
  return sendInline({ alias: 'product-pick', to, subject: `Picked for you: ${title}`, message, unsubscribePost, key, replyTo,
    vars: { STORE_NAME: store, BUYER_NAME: firstName(name), PRODUCT_TITLE: title, PRICE: price, COVER_URL: coverUrl, PRODUCT_URL: productUrl,
      UNSUBSCRIBE_URL: unsubscribeUrl, SITE_URL: siteUrl, SUPPORT_EMAIL: support } });
}

// Store-wide email (a sale, news) written by the owner in the dashboard.
function sendBroadcast({ to, store, name, subject, label, heading, message, imageUrl, ctaUrl, ctaLabel, unsubscribeUrl, unsubscribePost, siteUrl, support, key, replyTo }) {
  return sendInline({ alias: 'store-news', to, subject, message, unsubscribePost, key, replyTo,
    vars: { STORE_NAME: store, BUYER_NAME: firstName(name), LABEL: label, HEADING: heading, IMAGE_URL: imageUrl, CTA_URL: ctaUrl, CTA_LABEL: ctaLabel,
      UNSUBSCRIBE_URL: unsubscribeUrl, SITE_URL: siteUrl, SUPPORT_EMAIL: support } });
}

// A short note to the owner (e.g. "next week's social posts are ready"), in the store-news look. No unsubscribe.
function sendOwnerNote({ to, store, label, heading, message, ctaUrl, ctaLabel, settingsUrl, siteUrl, support, key }) {
  return sendInline({ alias: 'store-news', to, subject: heading, message, key,
    vars: { STORE_NAME: store, BUYER_NAME: 'there', LABEL: label, HEADING: heading, IMAGE_URL: '', CTA_URL: ctaUrl, CTA_LABEL: ctaLabel,
      UNSUBSCRIBE_URL: settingsUrl, SITE_URL: siteUrl, SUPPORT_EMAIL: support } });
}

module.exports = { enabled, sendPick, sendBroadcast, sendOwnerNote, sendAnnouncement, sendDownload, sendSaleAlert, sendCheckoutReminder, sendReviewRequest, sendPasswordReset };
