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

This project's `prisma/schema.prisma` targets **Postgres** by default so it
works out of the box on Vercel (or any serverless host). For local dev you
have two options:

**Option A — local Postgres** (matches production exactly):
```bash
cp .env.example .env
# edit .env: set DATABASE_URL to a local/hosted Postgres connection string
npx prisma generate
npx prisma migrate dev --name init
```

**Option B — quick local SQLite** (simpler for just trying it out, but you
must switch back to Postgres before deploying to Vercel):
```bash
cp .env.example .env
# edit .env: DATABASE_URL="file:dev.sqlite"
# edit prisma/schema.prisma: change provider = "postgresql" to "sqlite"
npx prisma generate
npx prisma migrate dev --name init
```

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

## Deploying to Vercel

This project is configured for Vercel out of the box (`@vercel/remix` preset
in `vite.config.js`, Postgres-based Prisma schema). Checklist:

1. **Create a Postgres database.** Easiest options: Vercel Postgres (from
   your Vercel project's **Storage** tab) or [Neon](https://neon.tech)
   (free tier). Copy its **pooled** connection string (Vercel Postgres
   calls it `POSTGRES_PRISMA_URL`; Neon's pooled host has `-pooler` in it).
2. **Set environment variables** in Vercel → Project → Settings →
   Environment Variables (your local `.env` file is never read in
   production — these must be added in the dashboard):
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` — from `shopify.app.toml` /
     Partner dashboard
   - `SHOPIFY_APP_URL` — your Vercel deployment URL, e.g.
     `https://your-app.vercel.app`
   - `SCOPES` — `read_orders`
   - `DATABASE_URL` — the pooled Postgres connection string from step 1
3. **Push/redeploy.** `npm run postinstall` (`prisma generate`) runs
   automatically during Vercel's build via the `postinstall` script.
4. **Run the migration against your production database** (one-time, from
   your own machine — point `DATABASE_URL` at the same pooled connection
   string first):
   ```bash
   npx prisma migrate deploy
   ```
5. **Update `shopify.app.toml`** — set `application_url` and the three
   `redirect_urls` to your real `https://your-app.vercel.app` domain, then
   run `npx shopify app deploy` to push the config (including the
   `orders/create` webhook subscription) to Shopify.

**If a deploy still crashes**, check Vercel's actual function logs — the
public "Function crashed" page never shows the real error. In the Vercel
dashboard: Deployments → (your deployment) → Functions → click the
function → Logs. That stack trace is what to debug from (or paste it back
here).

## Deploying elsewhere (Render / Railway / Fly.io)

These platforms run a persistent Node process, so SQLite works fine if you
prefer not to set up Postgres:

1. Switch `prisma/schema.prisma`'s `provider` back to `"sqlite"` if you
   want to keep using it, and set `DATABASE_URL="file:dev.sqlite"`.
2. Set the same `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_APP_URL`
   / `SCOPES` env vars in that platform's dashboard.
3. Use `npm run setup && npm run start` as the start command — `setup` runs
   Prisma migrations, `start` runs the built server via `remix-serve`.
4. Update `shopify.app.toml`'s `application_url` and `redirect_urls`, then
   `npx shopify app deploy`.

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
