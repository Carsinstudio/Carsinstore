// Starting drafts for the store's legal pages. The owner edits them in Store settings → Legal & contact;
// these are only used until a page is edited. {{STORE}}, {{EMAIL}}, {{WEBSITE}}, {{LOCATION}} and {{UPDATED}}
// are filled in when the page is shown. They describe how this store actually works (guest checkout,
// Paystack, Resend, digital downloads) but are not legal advice.

const terms = `## Terms of Sale

These terms apply when you buy or download a product from {{STORE}} at {{WEBSITE}}. By completing a purchase or claiming a free product, you agree to them.

### What you are buying
Our products are digital downloads, such as videos, PDFs, templates, ZIP files and documents. Nothing is shipped. Each product page lists the files included.

### Delivery
After payment, you are taken to a private download page, and the same link is emailed to the address you entered. The link is for you only. You can download your files as often as you need from that link.

### Your licence
When you buy a product, you get a personal, non-transferable licence to use it for your own projects, including client work, unless the product page says otherwise. You may not:
- resell, share, give away or publish the files (or edited versions of them) as they are;
- share your download link with others;
- claim the products as your own work.

All products remain the intellectual property of {{STORE}}.

### Prices and payment
Prices are shown in the store's currency and include any applicable charges shown at checkout. Payments are processed securely by Paystack. We never see or store your card details.

### Refunds
Refunds are covered by our [Refund Policy](#/refunds).

### Product changes
We may update products to improve them. Updates are free for existing buyers through the same download link.

### Limitation of liability
Products are provided as described. To the extent allowed by law, {{STORE}} is not liable for indirect or consequential losses arising from the use of our products, and our total liability for any purchase is limited to the amount you paid for it.

### Governing law
These terms are governed by the laws of the Federal Republic of Nigeria.

### Contact
Questions about these terms: {{EMAIL}}

_Last updated: {{UPDATED}}_
`;

const privacy = `## Privacy Policy

This policy explains what personal information {{STORE}} ({{WEBSITE}}) collects, why, and your rights. We follow the Nigeria Data Protection Act 2023.

### What we collect
- **Your name and email address**, when you buy or claim a product. We use them to deliver your files, send your download link and receipt, and help you if something goes wrong. If you start a checkout but don't finish paying, we may send you **one** reminder email about it.
- **Your phone number**, only if the checkout asks for it and you provide it. We use it to contact you about your order.
- **Order details**: what you bought, the price and the date.
- **Payment information** is collected and processed by **Paystack**, not by us. We receive confirmation that you paid, but never your card or bank details.

We do not require you to create an account or set a password.

### Who we share it with
We share only what is needed to run the store:
- **Paystack**: payment processing.
- **Resend**: sending your download and receipt emails.
- **Our hosting provider**: the servers that run this website.
- **Analytics tools**, if this store uses them, to understand visits in aggregate.

We do not sell your personal information.

### Cookies and your device
We use a cookie only to keep the store owner signed in to the dashboard. To make repeat purchases quicker, your name and email may be remembered in your own browser (local storage). If you arrive through a partner's referral link, that partner's code is also remembered in your browser for 30 days, so they can be credited if you buy — they never see your personal details. You can clear this at any time in your browser settings.

### How long we keep it
We keep order records so you can re-download your purchases and so we can meet tax and accounting obligations. You can ask us to delete your details at any time; we keep only what the law requires.

### Your rights
You can ask to see, correct or delete the personal information we hold about you, or object to how we use it. Email {{EMAIL}} and we will respond within a reasonable time.

### Contact
{{STORE}}, {{LOCATION}}: {{EMAIL}}

_Last updated: {{UPDATED}}_
`;

const refunds = `## Refund Policy

Because our products are digital files that are delivered instantly and can't be returned, **all sales are final once a product has been delivered**. We do refund in these cases:

- **You were charged twice** for the same product.
- **A file is broken or doesn't open**, and we can't fix it for you within 3 business days.
- **The product is significantly different** from its description on the product page.
- **You paid but never received access**, and we can't resolve it.

### How to ask
Email {{EMAIL}} within **7 days** of purchase with:
- the email address you used at checkout;
- the product name;
- what went wrong (a screenshot helps).

We usually reply within 1–2 business days. Often we can fix the problem by sending a working file.

### How refunds are paid
Approved refunds go back to your original payment method through Paystack. Depending on your bank, they can take a few working days to appear. Once a refund is issued, access to the product's files is removed.

### Free products
Free products are offered as they are and don't qualify for refunds.

_Last updated: {{UPDATED}}_
`;

const LEGAL_PAGES = {
  terms: { title: 'Terms of Sale', key: 'legal_terms', text: terms },
  privacy: { title: 'Privacy Policy', key: 'legal_privacy', text: privacy },
  refunds: { title: 'Refund Policy', key: 'legal_refunds', text: refunds },
};

module.exports = { LEGAL_PAGES };
