# Grow Gently Books · books.growgently.in

Bookstore for autism-friendly bilingual (Hindi + English) children's ebooks.
Cloudflare Worker + D1 (database) + R2 (PDF/cover files) + Razorpay payments.
Everything deploys from GitHub Actions. **No terminal needed.**

---

## What's inside

| Path | What it is |
|---|---|
| `src/index.js` | Router: all public pages, checkout, verify, downloads, sitemap |
| `src/views.js` | Public page HTML (home, category, book detail, my-books…) |
| `src/admin.js` | Admin panel: categories tree, books, PDF/cover uploads, purchases |
| `src/styles.js` | The locked v7 design, served at `/styles.css` |
| `src/clientjs.js` | Hero slider + text-size + Hindi/English toggle |
| `src/util.js` | Helpers (escaping, HMAC, cookies, slugs) |
| `migrations/` | Database schema + starter categories + one free book |
| `.github/workflows/` | deploy, one-time setup, weekly DB backup |

---

## One-time setup (about 15 minutes)

### 1 · Create the GitHub repository
Create a new **private** repo (e.g. `growgently-books`) and upload this whole
folder (GitHub web editor: *Add file → Upload files*, drag the folder contents in).

### 2 · Add GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add these six:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with **Workers Scripts:Edit, D1:Edit, R2:Edit, Workers Routes:Edit** (same kind you use for Visual Schedules) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id |
| `ADMIN_PASSWORD` | The password you'll use at `/admin` — make it long |
| `SESSION_SECRET` | Any long random string (40+ characters) |
| `RAZORPAY_KEY_ID` | From Razorpay dashboard → API Keys (**start with test keys**) |
| `RAZORPAY_KEY_SECRET` | Same place |

### 3 · Create the database and file bucket
Actions tab → **Setup infrastructure** → Run workflow → step: **create-resources**.
Open the finished run's log: it prints the D1 **database_id**.

### 4 · Paste the database id
Edit `wrangler.jsonc` in the GitHub editor: replace `PASTE_DATABASE_ID_HERE`
with the id from step 3. Commit to `main`.

> If the deploy fails on the custom domain, temporarily delete the whole
> `"routes": [...]` block, commit again, and the site will run at
> `growgently-books.<your-subdomain>.workers.dev`. Re-add the routes block later.

Committing triggers **Deploy** automatically: migrations run, the Worker goes live.

### 5 · Push the runtime secrets
Actions → **Setup infrastructure** → Run workflow → step: **push-secrets**.
(This copies the four app secrets into the Worker. Payments and admin login
work after this.)

### 6 · Log in and publish
- Open `https://books.growgently.in/admin` → your `ADMIN_PASSWORD`.
- Starter categories (Language / Education / Social Stories with sub-levels)
  and one free book (*First 100 Words*) are already seeded.
- Add a book → save → upload its **English PDF** and **Hindi PDF** → tick
  **Show in home hero** for up to 5 featured books.

---

## Daily operations (the publish workflow)

**Add a new book** — Admin → Books → *Add a book*.
Fill titles (EN + HI), series, level, descriptions, price in ₹, YouTube
"how to use" link, pick a cover style → **Create** → upload the two PDFs
(and optionally a real cover image, which replaces the CSS cover).
The book is live the moment status is *Published* and at least one PDF exists.

**Add a category or level** — Admin → Categories. Any depth works:
top-level (Language), a level under it (WH Stories), or a subject under a
class (Education → Preschool → Math). Books can sit in several categories.

**See sales** — Admin → Purchases (payment IDs match your Razorpay dashboard).
Dashboard shows revenue, free downloads, and newsletter subscribers.

**Buyer lost their link?** — Send them to `/my-books`; entering their checkout
email mints fresh 72-hour download links. Nothing for you to do.

---

## How payments and downloads stay safe

- PDFs live in a **private R2 bucket** — there is no public URL to share.
- Downloads only happen through unguessable one-time-style tokens that
  **expire after 72 hours**; `/my-books` re-issues them from the buyer's email.
- Razorpay payments are **verified server-side** with an HMAC signature check
  before any token is created — a forged "payment success" gets nothing.
- Admin sessions are HMAC-signed, HttpOnly, Secure cookies (7 days).
- Every page sends security headers; `/admin` is `noindex` and robots-blocked.

## Razorpay: test → live

1. Keep **test keys** until everything works: pay with Razorpay's test cards,
   confirm the download arrives, check the purchase row in admin.
2. Complete Razorpay KYC/activation (Education category, as planned).
3. Replace the two Razorpay GitHub secrets with **live keys**, run
   **Setup infrastructure → push-secrets** again. Done — no code change.

## Backups

`Weekly D1 backup` runs every Sunday and stores a full SQL dump as a GitHub
artifact (kept 90 days). Run it manually before big changes. R2 files are
your PDFs — keep your own master copies as you already do for KDP.

## Good-practice notes

- **PDF size**: keep under ~50 MB per edition for comfortable mobile downloads
  (your 8×10" KDP exports are usually fine; compress images to ~150 dpi for
  the ebook edition if a file balloons).
- **Cover images**: JPG/WebP around 800×1000 px is plenty.
- **Slugs are URLs**: set them once, avoid renaming after sharing links.
- **Draft status** is your friend — build the listing, upload files, preview
  at `/book/slug` while logged in… then flip to Published.
- **Featured**: tick at most 5; the hero shows the 5 most recently updated.
- Emails collected at checkout are used only for delivery/re-download — say
  exactly that on the page (already written in the buy box).
