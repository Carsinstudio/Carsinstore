# Carsinstore

Your own storefront for selling digital downloads: videos, PDFs, ZIPs, documents, templates and audio. Products can be paid or free, and they're grouped into categories.

## What's included

**For visitors**
- Homepage with featured products, categories, free resources, FAQ
- Store page with category, format (videos, PDFs, ZIPs, documents, audio) and free/paid filters, plus search and sorting
- A sales page for every product: square cover images (1080×1080) buyers swipe through, a short description (also the text in link previews on WhatsApp, Instagram and X), the full description (headings, bullets, bold, links), buyer reviews, the list of included files, free previews and a closing buy button.
- **No accounts.** The buy box asks for just a name and email, then goes straight to Paystack checkout (card, bank transfer, USSD, and more, depending on what you enable in Paystack). Free products skip payment.
- After paying, the buyer lands on a **private download page** where they can download every file, or play videos and open PDFs in the browser. The link is unique to that order. If email is set up (below), it's also emailed to them.
- **Find my downloads**: a buyer who lost their link enters their email and gets their links sent again (needs email set up).
- Downloads are protected: files only open through a paid order's private link, except ones you mark as a free preview

**For you (`/#/admin`)**
- Overview: revenue, sales, customers, a 30-day chart, top products, recent activity
- Products: set price and "compare at" price; put a product in several categories; feature on the homepage. Every edit saves as a draft, and visitors only see it after you press **Publish** (you get the link to share). Product list actions: Edit, View, Copy link, Publish, Unpublish, Delete (with confirmation).
- Covers: up to 4 images or short videos (under 60 MB) per product, in 1:1, 4:3, 3:4 or 16:9. Drag them to reorder, or drop files straight onto the panel. The first is the main one for cards and link previews.
- Buyer ratings and reviews: buyers rate 1 to 5 stars and can write a review from their download page; you can hide or delete any. "You might also like" shows up to 4 products you pick (or others from the same categories) on the product page and the download page.
- Drag-and-drop uploads with a progress bar per file (up to 4 GB each by default). Keep editing, or move to another dashboard page, while they upload. You can rename files and reorder them.
- **Free preview** for videos, audio, images and PDFs: visitors can view it on the product page but not download it. For a PDF they only get the first few pages (you choose 1 to 10), cut on the server, so the full file never leaves the store until someone buys.
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

**Current setup:** emails are sent from downloads@mail.carsin.store (domain verified in Resend, DNS at Namecheap). The .env key is a send-only key limited to that domain. All emails share one look (dark, orange-red glow, serif heading, the website's orange button), and their wording and design live in Resend → **Templates**:

| Template (alias) | Sent when |
|---|---|
| Payment receipt (payment-receipt) | a paid order completes: amount, date, reference CS-…, download button |
| Welcome + free download (free-welcome) | someone claims a free product |
| Download ready (download-ready) | you gift a product, or a buyer uses Find my downloads / you click Email link |
| Checkout reminder (checkout-reminder) | a Paystack checkout is left unpaid (once) |
| Review request (review-request) | a few days after a purchase or free download (once per order; skipped if they already reviewed; at most one a day per person). Each star opens their download page with that rating picked. Turn it off or change the delay in Store settings → Checkout |
| Sale alert (sale-alert) | to you, for each sale |

Keep each template's {{{VARIABLES}}} when editing. Each order sends its first email exactly once. Buyer emails never contain referral or affiliate links.

**Logo files** live in `public/brand`: `logo-horizontal.svg` (navbar, footer, dashboard), `logo-mark.svg`, and `public/favicon.svg` (a square version of the mark). PNG copies for places that can't use SVG (iPhone home-screen icon, the default link-preview image `share.png`, and the email header logo) are made from the SVGs with `node emails/render-brand.js`. The email logo loads from the live site, so it shows in emails once carsin.store is up.

The designs are built by `emails/build.js` (open `emails/dist/preview-*.html` to check them). To change one and push it to Resend, edit `build.js`, then run `node emails/build.js` and `node emails/publish.js <alias>`. Publishing needs the Resend CLI signed in with a full-access key (`npx resend-cli@latest login`), because the store's own key can only send.

**Sale alerts:** the owner gets a "New sale" email (Resend template "Sale alert (to owner)", alias sale-alert) for every paid order, and optionally for free downloads. Turn them on or off and choose the address in Store settings → Notifications. Replying to an alert emails the buyer, and buyers replying to their download email reach the support email.

## Selling features (Store settings → Checkout, and the Affiliates page)

- **Phone number:** off, optional or required at checkout. It's saved with the buyer, shown in Orders and Customers, included in CSV exports, and passed to Paystack.
- **Abandoned checkout reminders:** a buyer who opens Paystack but doesn't pay gets one "Still want it?" email (Resend template `checkout-reminder`) after about an hour, within 48 hours. Each order is checked with Paystack first, so late bank transfers are unlocked instead of reminded, and nobody is reminded about something they've since bought.
- **Affiliates:** add partners with a commission % on the Affiliates page. Their link is `carsin.store/?ref=CODE`, and `?ref=CODE` works on any product link too. A referral counts if the buyer pays within 30 days, and self-referrals don't count. Commission is locked in at the time of sale. You pay partners yourself, then click **Record payout**. Each partner gets a private stats page showing their sales and earnings, without buyer details.
- **Extra currencies:** tick a currency (e.g. USD) under "Also sell in", then set that price on each product. Buyers see a currency switch on the product page. Percent-off codes work in any currency; fixed-amount codes only in the store currency. Your Paystack account must be enabled for each currency.

## Analytics (Store settings → Analytics)

Optional. Paste a **Plausible** domain, a **Google Analytics 4** Measurement ID (`G-…`) and/or a **Meta Pixel** ID to switch each one on.

- **What's reported:** page views, product viewed, checkout started, purchase (amount and currency, once per order) and free download. Names, emails and phone numbers are never sent.
- **What's not counted:** your own visits while signed in, and partner stats pages.
- **Meta Pixel:** needed for Instagram and Facebook ads to optimise for purchases.

## Security

- **Owner sign-in:** 5 wrong passwords for an email (or 20 from one IP) lock sign-in for 15 minutes. Responses don't reveal whether an email is the owner's.
- **Rate limits:** checkout (20 per 10 min per visitor), discount codes (30 per 10 min), "Find my downloads" (3 per hour per email, 10 per visitor) and the download and partner pages.
- **Headers:** the store can't be embedded in other sites; standard security headers are set.
- **Behind a proxy:** when hosting behind one (Railway, Render, Nginx), set `TRUST_PROXY=1` so limits apply per visitor instead of to everyone at once.

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
