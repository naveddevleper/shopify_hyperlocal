# HyperLocal Mailer — Shopify App

A custom (single-store) Shopify app. Every time an order is placed, Shopify
calls this app's webhook **immediately**. If the order:

1. has the tag **HyperLocal** (configurable), **and**
2. has the delivery method **HyperLocal (Prepaid)** (configurable),

...the app sends a notification email using an HTML template you can edit
any time from inside Shopify admin. The recipient email is also editable
there — no redeploy needed to change either.

Built with Shopify's official Remix app stack: Remix + Polaris + App Bridge
for the embedded admin UI, Prisma/SQLite for storage, Nodemailer/SMTP for
sending.

## What's inside

```
app/
  routes/
    app.jsx                     embedded admin layout (nav)
    app._index.jsx               dashboard: setup status + recent mail log
    app.settings.jsx             ⭐ recipient email, matching rule, SMTP, template editor
    webhooks.orders.create.jsx   ⭐ fires on every new order - the core logic
    webhooks.app.uninstalled.jsx cleans up data on uninstall
    auth.$.jsx, auth.login/      standard Shopify OAuth routes
  utils/
    orderMatch.server.js         ⭐ the tag + delivery-method matching rule
    mailer.server.js             ⭐ builds template data & sends via SMTP
    template.server.js           {{variable}} substitution engine
    defaultTemplate.server.js    starter HTML email template
  shopify.server.js              Shopify app/auth/session config
  db.server.js                   Prisma client
prisma/schema.prisma             Session, Settings, MailLog tables
shopify.app.toml                 app config + webhook subscriptions
```

The ⭐ files are the ones implementing exactly what you asked for; everything
else is the scaffolding Shopify requires to host an embedded admin page.

## How the matching works

`app/utils/orderMatch.server.js` checks the live webhook payload directly
(no extra API call needed):

- **Tag**: order.tags (comma-separated string) must contain `HyperLocal`
- **Delivery method**: one of order.shipping_lines[].title (or `.code`)
  must equal `HyperLocal (Prepaid)`

Both comparisons are case-insensitive and whitespace-trimmed, and both
strings are editable on the Settings page (`matchTag`,
`matchShippingMethod`) in case your shipping method's exact name ever
changes in Shopify.

## Prerequisites

- Node.js 18.20+ or 20.10+
- A free [Shopify Partner account](https://partners.shopify.com)
- A Shopify dev store (or your live store, since this is a single-store
  custom app)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) — installed
  automatically via `npx` when you run `npm run dev`, no separate install
  needed
- An SMTP mailbox to send from. For Gmail: enable 2-Step Verification, then
  create an **App Password** (Google Account → Security → App passwords) —
  don't use your normal Gmail password, it won't work with SMTP. Outlook
  and any custom-domain mailbox work the same way (host/port/user/pass).

## Setup

```bash
npm install
```

### 1. Create the app in your Partner Dashboard

```bash
npx shopify app config link
```

This walks you through creating a new app (choose **Custom app**, distributed
to your one store) and writes the real `client_id` and URLs into
`shopify.app.toml` for you — you can ignore the placeholder values already in
that file.

### 2. Set up the database

```bash
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
```

SQLite is fine for a single store. The migration creates `dev.sqlite` plus
the `Session`, `Settings`, and `MailLog` tables.

### 3. Run it

```bash
npm run dev
```

This starts the Shopify CLI, opens a tunnel, and prints a URL to install the
app on your store. Open it, click **Install**, and you'll land on the
**Settings** page inside Shopify admin.

### 4. Configure Settings (inside Shopify admin)

On the Settings page, fill in:
- **Recipient email** — who gets notified
- **Required order tag** / **Required delivery method** — defaults already
  match your brief, change only if needed
- **SMTP host/port/username/password** — your mailbox's SMTP details
- **Subject / Body template** — edit freely; the list of `{{placeholders}}`
  is shown right below the editor

Click **Save & send test email** to confirm SMTP works before relying on it.

### 5. Test with a real order

Create a test order in your store with:
- Tag: `HyperLocal`
- Shipping method named (or coded) exactly `HyperLocal (Prepaid)` — you'll
  need a shipping rate with that name set up in **Settings → Shipping and
  delivery**, or apply it via a draft order / custom checkout flow

Within seconds of the order landing, the email should arrive. The
**Home** page inside the app shows a log of every match (sent, failed, or
skipped) so you can confirm it fired.

## Going to production

1. **Host it somewhere persistent.** Any Node host works (Render, Railway,
   Fly.io, a VPS). Set `npm run setup && npm run start` as the start command
   — `setup` runs Prisma migrations, `start` runs the built server.
2. **Use Postgres instead of SQLite** if your host's filesystem is
   ephemeral (most are) — change `DATABASE_URL` and `datasource.provider`
   in `prisma/schema.prisma` to `"postgresql"`.
3. **Deploy app config**: `npx shopify app deploy` pushes
   `shopify.app.toml` (including the webhook subscription) to Shopify, and
   `npx shopify app config push` updates URLs after you point
   `application_url` at your real production domain.
4. Update `shopify.app.toml`'s `application_url` and `redirect_urls` to your
   real domain before deploying.

## Reliability notes

- Shopify retries `orders/create` webhook deliveries with backoff (up to
  48 hours) if your endpoint returns a non-2xx response. The webhook
  handler intentionally returns `500` only when sending genuinely failed
  (e.g. SMTP server down) — so a transient outage on your mail server
  won't silently drop a notification, Shopify will keep retrying.
- Every match attempt — sent, failed, or skipped (e.g. settings not filled
  in yet) — is written to the `MailLog` table and shown on the dashboard.
- `authenticate.webhook()` verifies Shopify's HMAC signature on every
  request, so the endpoint can't be triggered by arbitrary POST requests
  from the internet.

## Security notes

- Never commit `.env` (already in `.gitignore`) — it holds your Shopify API
  secret.
- The SMTP password field on the Settings page is always rendered blank;
  leaving it blank on save keeps the previously stored password rather than
  wiping it.
- If you ever rotate the SMTP password, you only need to update it on the
  Settings page — no redeploy required.
