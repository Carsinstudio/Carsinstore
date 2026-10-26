# Carsinstore

Your own storefront for selling digital downloads: videos, PDFs, ZIPs, documents, templates and audio. Products can be paid or free, and they're grouped into categories.

## What's included

**For visitors**
- Homepage with featured products, categories, free resources, FAQ
- Store page with category, format (videos, PDFs, ZIPs, documents, audio) and free/paid filters, plus search and sorting
- Product pages with description, a list of included files, free previews (a sample clip or sample pages), and discount codes
- **No accounts.** The buy box asks for just a name and email, then goes straight to Paystack checkout (card, bank transfer, USSD, and more, depending on what you enable in Paystack). Free products skip payment.
- After paying, the buyer lands on a **private download page** where they can download every file, or play videos and open PDFs in the browser. The link is unique to that order. If email is set up (below), it's also emailed to them.
- **Find my downloads**: a buyer who lost their link enters their email and gets their links sent again (needs email set up).
- Downloads are protected: files only open through a paid order's private link, except ones you mark as a free preview

**For you (`/#/admin`)**
- Overview: revenue, sales, customers, a 30-day chart, top products, recent activity
- Products: set price and "compare at" price; publish or draft; feature on the homepage; add a cover image
- Drag-and-drop uploads with a progress bar (up to 4 GB per file by default). You can rename files, reorder them, and turn on **Free preview** for any file.
- Orders show each buyer's name and email, with **Copy link** (to send someone their download link yourself) and **Email link** buttons
- Give a product to anyone for free: enter their name and email, and you get a link to send them
- Categories, discount codes (percent or amount, max uses, expiry), orders (CSV export, revoke access), customers (CSV export)
- Manually give a customer access to a product (useful for gifts and giveaways)
- Store settings: name, announcement bar, homepage hero text, FAQ, social links, currency

## Run it

Requires **Node.js 22.5+** (it uses Node's built-in SQLite, so there's no database to install).

```bash
npm install
cp .env.example .env
npm run seed      # optional: sample products so the store isn't empty
npm start
```

Open http://localhost:3000, then go to **http://localhost:3000/#/admin**. The first visit asks you to create the **owner account**. Only that account can manage the store.

The sample products are placeholders. Delete them from the dashboard once you've added your own.

## Taking real payments (Paystack)

1. Create a Paystack account at https://paystack.com. You can test right away; going live needs your business documents approved.
2. In Paystack go to **Settings → API Keys & Webhooks** and copy the **secret key** into `.env`:
   `PAYSTACK_SECRET_KEY=sk_test_...` (switch to `sk_live_...` once your account is approved)
3. Set `BASE_URL` to your real domain, e.g. `https://carsinstore.com`
4. On the same Paystack page, set the **Webhook URL** to `https://YOUR-DOMAIN/api/paystack/webhook`
5. Set `DEMO_CHECKOUT=false` and restart

Prices are charged in the store currency (Settings → Currency, Naira by default). Paystack amounts are in kobo, so a ₦25,000 product is sent to Paystack as 2,500,000. The store handles that conversion for you.

How a sale is confirmed: after paying, Paystack sends the buyer back to the store, which double-checks the payment with Paystack (status, amount and currency) before unlocking the files. The webhook is a backup for buyers who close the tab before being redirected, and for bank transfers that confirm a few seconds late.

To test, use a `sk_test_` key and Paystack's test card: **4084 0840 8408 4081**, any future expiry date, CVV **408**.

Without a Paystack key and with `DEMO_CHECKOUT=true`, checkout is **simulated** so you can click through the whole flow without Paystack at all. Turn this off before going live.

## Emailing download links (recommended)

Without email, buyers still get their download page right after checkout, but if they close it they'll need you to send the link (Orders → Copy link). To email it automatically:

1. Sign up at https://resend.com (the free tier covers 3,000 emails a month) and verify your domain
2. Add to `.env`:
   `RESEND_API_KEY=re_...`
   `EMAIL_FROM=Carsinstore <downloads@yourdomain.com>`
3. Restart the server

Buyers then get a "Your files are ready" email after every purchase or free download, and **Find my downloads** works.

**Current setup:** emails are sent from `downloads@mail.carsin.store` (domain verified in Resend, DNS at Namecheap). The `.env` key is a send-only key limited to that domain. The email's wording and design live in Resend → **Templates → "Download ready"** (alias `download-ready`), so you can edit them there without touching code. Keep its four variables: `STORE_NAME`, `BUYER_NAME`, `PRODUCT_TITLE` and `DOWNLOAD_URL`. Each order sends exactly one delivery email, and "Find my downloads" and the dashboard's **Email link** button send a fresh copy.

**Sale alerts:** the owner gets a "New sale" email (Resend template "Sale alert (to owner)", alias sale-alert) for every paid order, and optionally for free downloads. Turn them on or off and choose the address in Store settings → Notifications. Replying to an alert emails the buyer, and buyers replying to their download email reach the support email.

## Backups and moving the store

Store settings → **Backup & move** downloads the whole store (products, files, covers, settings, owner account) as one `.tar.gz` file. Restore it on another computer or host from the same panel.

- Leave **Include orders & buyers** off when moving a catalog to a new site: test orders stay behind.
- Turn it on for a complete safety copy.
- A restore replaces everything and signs everyone out. Sign in again with the owner account from the backup.
- The data from before a restore is kept in `storage/.before-restore`.

From the command line: `node backup.js export [--with-orders] [file.tar.gz]`, and `node backup.js import <file.tar.gz>` (stop the server first).

Backup files contain your owner account and (with orders) buyer details, so never commit them to Git; `*.tar.gz` is ignored for that reason.

## Hosting

This is a normal Node server that stores uploaded files on disk, so host it somewhere with a **persistent disk**, for example:
- **Railway** or **Render**: add a volume and set `DATA_DIR` to its mount path
- **A VPS** (DigitalOcean, Hetzner, Lightsail): run with `pm2` behind Nginx or Caddy for HTTPS

Serverless hosts like Vercel or Netlify won't work as-is, because uploads need a persistent disk.

Everything (database plus uploaded files) lives in `storage/` (or `DATA_DIR`). **Back up that folder.**

If you upload very large videos, raise your reverse proxy's body size limit too (e.g. Nginx `client_max_body_size 5G;`).

## Files

| File | What it does |
|---|---|
| `server.js` | API, guest checkout, private download links, admin |
| `mailer.js` | Download-link emails (Resend) |
| `db.js` | Database tables and default settings |
| `seed.js` | Sample products (uses the short clips in `seed-assets/`) |
| `public/app.js` | Storefront, buy box and download pages |
| `public/admin.js` | Owner dashboard |
| `public/styles.css` | The design |
