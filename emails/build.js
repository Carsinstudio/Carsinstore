// Builds the Carsinstore email templates (HTML + plain text) in one shared style:
// near-black page, orange-red glow behind a large thin serif heading, form-style rows,
// and the website's primary button. {{{VARS}}} are filled in by Resend at send time.
//   node emails/build.js            writes emails/dist (open the preview-*.html files to check the design)
//   node emails/publish.js <alias>  creates or updates that template in Resend and publishes it
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, 'dist');
fs.mkdirSync(out, { recursive: true });

const C = {
  page: '#080808', card: '#111111', line: '#2b2b2b', text: '#f1ede7', soft: '#c9c4bd', muted: '#8d8a85', dim: '#66635f',
  accent: '#e5573d', accent2: '#f2805a',
};
const SANS = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Newsreader,Georgia,'Times New Roman',serif";

// The website's .btn-primary: orange gradient, soft glow, 10px corners, white 600 text with an arrow.
function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${C.accent}" style="border-radius:10px;background-color:${C.accent};background-image:linear-gradient(180deg,#ee6a4c 0%,#d9472e 100%);border:1px solid #f0896f;box-shadow:0 8px 30px -8px rgba(229,87,61,0.7),inset 0 1px 0 rgba(255,255,255,0.25);">
      <a href="${href}" target="_blank" style="display:inline-block;padding:15px 26px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">${label}&nbsp;&nbsp;&rarr;</a>
    </td></tr></table>`;
}

// Form-style detail rows: small grey label above the value, thin line underneath (like the reference's fields).
function rows(items) {
  return items.map(([label, value]) => `<tr><td style="padding:0 0 16px 0;">
      <div style="font-family:${SANS};font-size:11px;line-height:1.4;color:${C.muted};padding-bottom:6px;">${label}</div>
      <div style="font-family:${SANS};font-size:15px;line-height:1.5;color:${C.text};padding-bottom:10px;border-bottom:1px solid ${C.line};">${value}</div>
    </td></tr>`).join('');
}

// Five tappable stars; each opens the buyer's download page with that rating already picked.
function starRow(hrefBase) {
  const star = n => `<td align="center" style="padding:0 3px;"><a href="${hrefBase}${n}" target="_blank" title="${n} star${n > 1 ? 's' : ''}" style="display:block;width:46px;height:46px;line-height:44px;border-radius:10px;border:1px solid ${C.line};background-color:#171717;font-family:Arial,sans-serif;font-size:24px;color:${C.accent2};text-decoration:none;">&#9733;</a></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-left:-3px;"><tr>${[1, 2, 3, 4, 5].map(star).join('')}</tr></table>
    <div style="padding-top:8px;font-family:${SANS};font-size:11px;color:${C.muted};">Tap a star: 1 is poor, 5 is great.</div>`;
}

function layout({ preheader, label, heading, sub, details = [], cta, note, secondary, minimal = false, before = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>{{{STORE_NAME}}}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap" rel="stylesheet">
<style>
  @media (max-width:600px){ .px{padding-left:24px!important;padding-right:24px!important} .h1{font-size:36px!important} }
  a{color:${C.accent2}}
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background-color:${C.page};">
<tr><td align="center" style="padding:36px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
    <!-- hero with the glow -->
    <tr><td bgcolor="${C.card}" class="px" style="padding:30px 40px 44px 40px;border-radius:18px 18px 0 0;background-color:${C.card};background-image:radial-gradient(ellipse 85% 72% at 24% 44%,rgba(236,98,48,0.95) 0%,rgba(206,68,38,0.6) 28%,rgba(120,38,24,0.2) 52%,rgba(17,17,17,0) 70%);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:${SANS};font-size:13px;font-weight:500;color:${C.text};letter-spacing:0.2px;">{{{STORE_NAME}}}.</td>
          <td align="right">${minimal ? '' : `<a href="{{{SITE_URL}}}" target="_blank" style="font-family:${SANS};font-size:12px;color:${C.soft};text-decoration:none;">Visit store</a>`}</td>
        </tr>
        <tr><td colspan="2" style="padding-top:78px;font-family:${SANS};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#f6c9a8;">${label}</td></tr>
        <tr><td colspan="2" class="h1" style="padding-top:12px;font-family:${SERIF};font-size:44px;font-weight:300;line-height:1.08;letter-spacing:-0.5px;color:${C.text};">${heading}</td></tr>
        ${sub ? `<tr><td colspan="2" style="padding-top:16px;font-family:${SANS};font-size:15px;line-height:1.6;color:#e8dcd2;max-width:420px;">${sub}</td></tr>` : ''}
      </table>
    </td></tr>
    <!-- details, button, note -->
    <tr><td bgcolor="${C.card}" class="px" style="padding:34px 40px 38px 40px;background-color:${C.card};border-radius:0 0 18px 18px;">
      ${before ? `<div style="padding-bottom:26px;">${before}</div>` : ''}
      ${details.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows(details)}</table>` : ''}
      ${cta ? `<div style="padding-top:${details.length ? 14 : 0}px;">${button(cta.href, cta.label)}</div>` : ''}
      ${secondary ? `<div style="padding-top:18px;font-family:${SANS};font-size:13px;color:${C.muted};">${secondary}</div>` : ''}
      ${note ? `<div style="padding-top:26px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">${note}</div>` : ''}
    </td></tr>
    <!-- footer -->
    <tr><td class="px" style="padding:26px 40px 0 40px;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.dim};">
      Questions? Just reply to this email, or write to <a href="mailto:{{{SUPPORT_EMAIL}}}" style="color:${C.soft};text-decoration:none;">{{{SUPPORT_EMAIL}}}</a>.<br>
      ${minimal ? '' : `<a href="{{{SITE_URL}}}/terms" target="_blank" style="color:${C.dim};text-decoration:underline;">Terms</a>&nbsp;&middot;&nbsp;<a href="{{{SITE_URL}}}/refunds" target="_blank" style="color:${C.dim};text-decoration:underline;">Refund policy</a>&nbsp;&middot;&nbsp;<a href="{{{SITE_URL}}}/privacy" target="_blank" style="color:${C.dim};text-decoration:underline;">Privacy</a><br>`}
      &copy; {{{STORE_NAME}}}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}

const footerText = `\n\nQuestions? Reply to this email or write to {{{SUPPORT_EMAIL}}}.\nTerms: {{{SITE_URL}}}/terms · Refunds: {{{SITE_URL}}}/refunds\n{{{STORE_NAME}}}\n`;
const keepLink = "Keep this email. The button works any time, on any device. Please don't share it, because it's your personal access to the files.";

const templates = {
  // Paid order: the payment confirmation + receipt + download button.
  'payment-receipt': {
    name: 'Payment receipt (to buyer)',
    subject: 'Receipt: {{{PRODUCT_TITLE}}} · {{{AMOUNT}}}',
    vars: ['STORE_NAME:string:Carsinstore', 'BUYER_NAME:string:there', 'PRODUCT_TITLE:string', 'AMOUNT:string', 'ORDER_DATE:string', 'ORDER_REF:string', 'DOWNLOAD_URL:string', 'SITE_URL:string', 'SUPPORT_EMAIL:string'],
    html: layout({
      preheader: 'Payment received. Your files are ready to download.',
      label: 'Payment received',
      heading: 'Thank you,<br>{{{BUYER_NAME}}}.',
      sub: 'Your payment went through and your files are ready.',
      details: [['Product', '{{{PRODUCT_TITLE}}}'], ['Amount paid', '{{{AMOUNT}}}'], ['Date', '{{{ORDER_DATE}}}'], ['Order reference', '{{{ORDER_REF}}}']],
      cta: { href: '{{{DOWNLOAD_URL}}}', label: 'Download your files' },
      note: keepLink,
    }),
    text: `Thank you, {{{BUYER_NAME}}}.\nYour payment went through and your files are ready.\n\nProduct: {{{PRODUCT_TITLE}}}\nAmount paid: {{{AMOUNT}}}\nDate: {{{ORDER_DATE}}}\nOrder reference: {{{ORDER_REF}}}\n\nDownload your files:\n{{{DOWNLOAD_URL}}}\n\n${keepLink}\n${footerText}`,
  },
  // Free product: a welcome to the store with the download.
  'free-welcome': {
    name: 'Welcome + free download (to buyer)',
    subject: 'Welcome to {{{STORE_NAME}}}: your free {{{PRODUCT_TITLE}}}',
    vars: ['STORE_NAME:string:Carsinstore', 'BUYER_NAME:string:there', 'PRODUCT_TITLE:string', 'DOWNLOAD_URL:string', 'SITE_URL:string', 'SUPPORT_EMAIL:string'],
    html: layout({
      preheader: 'Your free download is ready.',
      label: 'Welcome',
      heading: 'Welcome,<br>{{{BUYER_NAME}}}.',
      sub: 'Glad you’re here. Your free copy of <strong style="font-weight:600;color:#ffffff;">{{{PRODUCT_TITLE}}}</strong> is ready to download.',
      cta: { href: '{{{DOWNLOAD_URL}}}', label: 'Get your free download' },
      secondary: 'Looking for more? <a href="{{{SITE_URL}}}/shop" target="_blank" style="color:#f2805a;text-decoration:none;">Browse the store &rarr;</a>',
      note: keepLink,
    }),
    text: `Welcome, {{{BUYER_NAME}}}.\nGlad you're here. Your free copy of {{{PRODUCT_TITLE}}} is ready to download:\n{{{DOWNLOAD_URL}}}\n\nLooking for more? {{{SITE_URL}}}/shop\n\n${keepLink}\n${footerText}`,
  },
  // Gifts you send from the dashboard, and "Find my downloads" re-sends.
  'download-ready': {
    name: 'Download ready (to buyer)',
    subject: 'Your download: {{{PRODUCT_TITLE}}}',
    vars: ['STORE_NAME:string:Carsinstore', 'BUYER_NAME:string:there', 'PRODUCT_TITLE:string:your product', 'DOWNLOAD_URL:string', 'SITE_URL:string', 'SUPPORT_EMAIL:string'],
    html: layout({
      preheader: 'Here’s your download link.',
      label: 'Your files',
      heading: 'Here you go,<br>{{{BUYER_NAME}}}.',
      sub: 'Your files for <strong style="font-weight:600;color:#ffffff;">{{{PRODUCT_TITLE}}}</strong> are ready.',
      cta: { href: '{{{DOWNLOAD_URL}}}', label: 'Download your files' },
      note: keepLink,
    }),
    text: `Here you go, {{{BUYER_NAME}}}.\nYour files for {{{PRODUCT_TITLE}}} are ready:\n{{{DOWNLOAD_URL}}}\n\n${keepLink}\n${footerText}`,
  },
  // A notice about the buyer's own unfinished Paystack payment. Written and laid out as a transactional
  // message (one link, an order reference, no promotional wording) so Gmail files it in Primary, not Promotions.
  'checkout-reminder': {
    name: 'Checkout reminder (to buyer)',
    subject: "Your checkout for {{{PRODUCT_TITLE}}} didn't go through",
    vars: ['STORE_NAME:string:Carsinstore', 'BUYER_NAME:string:there', 'PRODUCT_TITLE:string', 'AMOUNT:string', 'ORDER_REF:string', 'PRODUCT_URL:string', 'SITE_URL:string', 'SUPPORT_EMAIL:string'],
    html: layout({
      minimal: true,
      preheader: "Your payment for {{{PRODUCT_TITLE}}} wasn't completed, and no money was taken.",
      label: 'Checkout not completed',
      heading: 'Your payment didn’t<br>go through.',
      sub: 'Hi {{{BUYER_NAME}}}, your payment for <strong style="font-weight:600;color:#ffffff;">{{{PRODUCT_TITLE}}}</strong> wasn’t completed, so no money was taken and your order is still open.',
      details: [['Product', '{{{PRODUCT_TITLE}}}'], ['Amount', '{{{AMOUNT}}}'], ['Order reference', '{{{ORDER_REF}}}']],
      cta: { href: '{{{PRODUCT_URL}}}', label: 'Finish checkout' },
      note: 'If you had trouble paying, reply to this email and we’ll help you complete it. This is the only reminder we’ll send about this order.',
    }),
    text: `Hi {{{BUYER_NAME}}},

Your payment for {{{PRODUCT_TITLE}}} wasn't completed, so no money was taken and your order is still open.

Product: {{{PRODUCT_TITLE}}}
Amount: {{{AMOUNT}}}
Order reference: {{{ORDER_REF}}}

Finish checkout:
{{{PRODUCT_URL}}}

If you had trouble paying, reply to this email and we'll help you complete it. This is the only reminder we'll send about this order.

{{{STORE_NAME}}}
`,
  },
  // A few days after a purchase or free download: one email asking for a rating. Laid out like the
  // checkout notice (no store links or promo wording) so it reads as a message about their own order.
  'review-request': {
    name: 'Review request (to buyer)',
    subject: 'How was {{{PRODUCT_TITLE}}}?',
    vars: ['STORE_NAME:string:Carsinstore', 'BUYER_NAME:string:there', 'PRODUCT_TITLE:string:your download', 'RATE_URL:string', 'DOWNLOAD_URL:string', 'SITE_URL:string', 'SUPPORT_EMAIL:string'],
    html: layout({
      minimal: true,
      preheader: 'A quick rating helps other buyers decide. It takes ten seconds.',
      label: 'Your download',
      heading: 'How was it,<br>{{{BUYER_NAME}}}?',
      sub: 'You got <strong style="font-weight:600;color:#ffffff;">{{{PRODUCT_TITLE}}}</strong> a few days ago. How would you rate it?',
      before: starRow('{{{RATE_URL}}}'),
      cta: { href: '{{{RATE_URL}}}', label: 'Write a short review' },
      secondary: 'Need the files again? <a href="{{{DOWNLOAD_URL}}}" target="_blank" style="color:#f2805a;text-decoration:none;">Open your downloads &rarr;</a>',
      note: 'Your first name shows with your review, never your email. Something not right with the product? Reply to this email and we’ll sort it out. This is the only time we’ll ask.',
    }),
    text: `Hi {{{BUYER_NAME}}},

You got {{{PRODUCT_TITLE}}} a few days ago. How would you rate it?

Rate it and leave a short review here:
{{{RATE_URL}}}

Need the files again? {{{DOWNLOAD_URL}}}

Your first name shows with your review, never your email. Something not right with the product? Reply to this email and we'll sort it out. This is the only time we'll ask.

{{{STORE_NAME}}}
`,
  },
  // To you (the owner) for each sale: same look, kept short.
  'sale-alert': {
    name: 'Sale alert (to owner)',
    subject: '{{{ORDER_TYPE}}}: {{{AMOUNT}}} · {{{PRODUCT_TITLE}}}',
    vars: ['ORDER_TYPE:string:New sale', 'AMOUNT:string', 'PRODUCT_TITLE:string', 'BUYER_NAME:string:Not given', 'BUYER_EMAIL:string:Not given', 'BUYER_PHONE:string:Not given', 'DASHBOARD_URL:string', 'STORE_NAME:string:Carsinstore', 'SITE_URL:string', 'SUPPORT_EMAIL:string'],
    html: layout({
      preheader: '{{{ORDER_TYPE}}}: {{{AMOUNT}}}',
      label: '{{{ORDER_TYPE}}}',
      heading: '{{{AMOUNT}}}',
      sub: '{{{PRODUCT_TITLE}}}',
      details: [['Buyer', '{{{BUYER_NAME}}}'], ['Email', '{{{BUYER_EMAIL}}}'], ['Phone', '{{{BUYER_PHONE}}}']],
      cta: { href: '{{{DASHBOARD_URL}}}', label: 'Open orders' },
      note: 'Reply to this email to write to the buyer. Turn these alerts off in Store settings → Notifications.',
    }),
    text: `{{{ORDER_TYPE}}}: {{{AMOUNT}}}\n{{{PRODUCT_TITLE}}}\n\nBuyer: {{{BUYER_NAME}}}\nEmail: {{{BUYER_EMAIL}}}\nPhone: {{{BUYER_PHONE}}}\n\nOpen orders: {{{DASHBOARD_URL}}}\n\nReply to write to the buyer. Turn alerts off in Store settings > Notifications.\n`,
  },
};

const manifest = {};
for (const [alias, t] of Object.entries(templates)) {
  fs.writeFileSync(path.join(out, `${alias}.html`), t.html);
  fs.writeFileSync(path.join(out, `${alias}.txt`), t.text);
  manifest[alias] = { name: t.name, subject: t.subject, vars: t.vars };
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Preview page with sample values, for checking the design in a browser.
const sample = {
  STORE_NAME: 'Carsinstore', BUYER_NAME: 'Francis', PRODUCT_TITLE: 'Creator Systems Video Pack', AMOUNT: '₦25,000', ORDER_DATE: '27 October 2026',
  ORDER_REF: 'CS-7F3A91', DOWNLOAD_URL: '#', PRODUCT_URL: '#', SITE_URL: 'https://carsin.store', SUPPORT_EMAIL: 'carsindesign@gmail.com',
  ORDER_TYPE: 'New sale', BUYER_EMAIL: 'buyer@example.com', BUYER_PHONE: '0803 123 4567', DASHBOARD_URL: '#', RATE_URL: '#',
};
const fill = s => s.replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => sample[k] ?? k);
for (const alias of Object.keys(templates)) fs.writeFileSync(path.join(out, `preview-${alias}.html`), fill(templates[alias].html));
console.log('built', Object.keys(templates).join(', '));
