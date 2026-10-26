// Sends download-link emails through Resend (https://resend.com). Optional:
// without RESEND_API_KEY the store still works — buyers get their link on screen.
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM;
const enabled = !!(KEY && FROM);

async function send({ to, subject, html }) {
  if (!enabled) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function downloadEmail({ store, name, items }) {
  const first = String(name || '').split(' ')[0];
  return `<!doctype html><html><body style="margin:0;background:#0b0b0b;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#eeece8">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border:1px solid #262626;border-radius:16px;padding:32px">
      <tr><td style="font-size:15px;font-weight:600;padding-bottom:24px">${esc(store)}</td></tr>
      <tr><td style="font-family:Georgia,serif;font-size:28px;line-height:1.2;padding-bottom:12px">Thanks${first ? `, ${esc(first)}` : ''}! Your files are ready.</td></tr>
      <tr><td style="font-size:14px;color:#a3a09a;padding-bottom:24px">Use the button below to download. The link is yours to keep — save this email to come back any time.</td></tr>
      ${items.map(i => `<tr><td style="padding:14px 0;border-top:1px solid #262626">
        <div style="font-size:15px;padding-bottom:12px">${esc(i.title)}</div>
        <a href="${esc(i.url)}" style="display:inline-block;background:#e5573d;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px">Download your files</a>
      </td></tr>`).join('')}
      <tr><td style="font-size:12px;color:#6b6863;padding-top:20px">Please don't share your link — it gives access to your purchase.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

module.exports = { enabled, send, downloadEmail };
