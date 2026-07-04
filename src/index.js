// src/index.js — Cloudflare Worker entry point for books.growgently.in
import { CSS } from './styles.js';
import { SITE_JS } from './clientjs.js';
import {
  esc, json, page, redirect, hmacHex, timingSafeEqual,
  isValidEmail, nowPlusHours,
} from './util.js';
import * as V from './views.js';
import { handleAdmin } from './admin.js';

const TOKEN_HOURS = 72;

/* ---------------- data helpers ---------------- */

async function categoryTree(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM categories ORDER BY sort, name_en').all();
  const cats = results || [];
  const byId = new Map(cats.map(c => [c.id, { ...c, children: [] }]));
  const roots = [];
  for (const c of byId.values()) {
    if (c.parent_id && byId.has(c.parent_id)) byId.get(c.parent_id).children.push(c);
    else roots.push(c);
  }
  return { roots, byId };
}

function descendantIds(byId, rootId) {
  const out = [rootId];
  const walk = (id) => {
    for (const c of byId.values()) if (c.parent_id === id) { out.push(c.id); walk(c.id); }
  };
  walk(rootId);
  return out;
}

function crumbsFor(byId, catId) {
  const chain = [];
  let cur = byId.get(catId);
  while (cur) { chain.unshift(cur); cur = cur.parent_id ? byId.get(cur.parent_id) : null; }
  return chain;
}

async function publishedBooks(env, { limit = 60 } = {}) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM books WHERE status='published' ORDER BY updated_at DESC LIMIT ?`).bind(limit).all();
  return results || [];
}

async function newToken(env, purchaseId, bookId, edition) {
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const expires = nowPlusHours(TOKEN_HOURS);
  await env.DB.prepare(
    'INSERT INTO download_tokens (token, book_id, edition, purchase_id, expires_at) VALUES (?,?,?,?,?)')
    .bind(token, bookId, edition, purchaseId, expires).run();
  return { token, expires };
}

/* ---------------- razorpay ---------------- */

async function razorpayCreateOrder(env, amountPaise, receipt) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Razorpay order failed: ' + t.slice(0, 200));
  }
  return res.json();
}

/* ---------------- public routes ---------------- */

async function handlePublic(request, env, url) {
  const p = url.pathname;
  const method = request.method;

  if (p === '/styles.css') {
    return new Response(CSS, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  if (p === '/site.js') {
    return new Response(SITE_JS, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }

  if (p === '/robots.txt') {
    return new Response(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /download/
Disallow: /thanks/
Sitemap: ${url.origin}/sitemap.xml
`, { headers: { 'content-type': 'text/plain' } });
  }

  if (p === '/sitemap.xml') {
    const { results: cats } = await env.DB.prepare('SELECT slug FROM categories').all();
    const { results: books } = await env.DB.prepare(
      "SELECT slug, updated_at FROM books WHERE status='published'").all();
    const urls = [
      `<url><loc>${url.origin}/</loc></url>`,
      `<url><loc>${url.origin}/categories</loc></url>`,
      ...(cats || []).map(c => `<url><loc>${url.origin}/category/${esc(c.slug)}</loc></url>`),
      ...(books || []).map(b => `<url><loc>${url.origin}/book/${esc(b.slug)}</loc><lastmod>${esc(String(b.updated_at).slice(0, 10))}</lastmod></url>`),
    ].join('\n');
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
      { headers: { 'content-type': 'application/xml' } });
  }

  /* ---- home ---- */
  if (p === '/') {
    const { roots } = await categoryTree(env);
    const { results: featured } = await env.DB.prepare(
      `SELECT * FROM books WHERE status='published' AND featured=1 ORDER BY updated_at DESC LIMIT 5`).all();
    let hero = featured || [];
    if (!hero.length) {
      hero = (await publishedBooks(env, { limit: 3 }));
    }
    const books = await publishedBooks(env, { limit: 30 });
    const latest = books.slice(0, 4);
    return page(V.homePage({ featured: hero, tree: roots, latest, books, activeTab: '' }));
  }

  /* ---- category ---- */
  let m = p.match(/^\/category\/([a-z0-9\u0900-\u097F-]+)$/);
  if (m) {
    const cat = await env.DB.prepare('SELECT * FROM categories WHERE slug=?').bind(m[1]).first();
    if (!cat) return page(V.messagePage({ title: 'Not found', text: 'That category does not exist.' }), 404);
    const { byId } = await categoryTree(env);
    const ids = descendantIds(byId, cat.id);
    const qs = ids.map(() => '?').join(',');
    const { results: books } = await env.DB.prepare(
      `SELECT DISTINCT b.* FROM books b JOIN book_categories bc ON bc.book_id=b.id
       WHERE b.status='published' AND bc.category_id IN (${qs}) ORDER BY b.updated_at DESC`)
      .bind(...ids).all();
    const node = byId.get(cat.id);
    return page(V.categoryPage({
      cat, children: node ? node.children : [], crumbs: crumbsFor(byId, cat.id), books: books || [],
    }));
  }

  /* ---- all categories ---- */
  if (p === '/categories') {
    const { roots } = await categoryTree(env);
    return page(V.categoriesPage({ tree: roots }));
  }

  /* ---- book detail ---- */
  m = p.match(/^\/book\/([a-z0-9\u0900-\u097F-]+)$/);
  if (m) {
    const book = await env.DB.prepare(
      "SELECT * FROM books WHERE slug=? AND status='published'").bind(m[1]).first();
    if (!book) return page(V.messagePage({ title: 'Not found', text: 'That book does not exist (or is not published yet).' }), 404);
    const { byId } = await categoryTree(env);
    const firstCat = await env.DB.prepare(
      'SELECT category_id FROM book_categories WHERE book_id=? LIMIT 1').bind(book.id).first();
    const crumbs = firstCat ? crumbsFor(byId, firstCat.category_id) : [];
    let related = [];
    if (firstCat) {
      const { results } = await env.DB.prepare(
        `SELECT DISTINCT b.* FROM books b JOIN book_categories bc ON bc.book_id=b.id
         WHERE b.status='published' AND bc.category_id=? AND b.id!=? ORDER BY b.updated_at DESC LIMIT 4`)
        .bind(firstCat.category_id, book.id).all();
      related = results || [];
    }
    return page(V.bookPage({ book, crumbs, related }));
  }

  /* ---- cover image ---- */
  m = p.match(/^\/cover\/(\d+)$/);
  if (m) {
    const book = await env.DB.prepare('SELECT cover_key FROM books WHERE id=?').bind(Number(m[1])).first();
    if (!book || !book.cover_key) return new Response('Not found', { status: 404 });
    const obj = await env.FILES.get(book.cover_key);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, {
      headers: {
        'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
        'cache-control': 'public, max-age=86400',
      },
    });
  }

  /* ---- search ---- */
  if (p === '/search') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    let books;
    if (q) {
      const like = `%${q}%`;
      const { results } = await env.DB.prepare(
        `SELECT * FROM books WHERE status='published' AND
         (title_en LIKE ? OR title_hi LIKE ? OR series LIKE ? OR level_label LIKE ?)
         ORDER BY updated_at DESC LIMIT 40`).bind(like, like, like, like).all();
      books = results || [];
    } else {
      books = await publishedBooks(env, { limit: 60 });
    }
    return page(V.searchPage({ q, books }));
  }

  /* ---- checkout ---- */
  if (p === '/api/checkout' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
    const bookId = Number(body.book_id);
    const edition = body.edition === 'hi' ? 'hi' : 'en';
    const email = String(body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) return json({ error: 'Please enter a valid email.' }, 400);

    const book = await env.DB.prepare(
      "SELECT * FROM books WHERE id=? AND status='published'").bind(bookId).first();
    if (!book) return json({ error: 'Book not found.' }, 404);
    const fileKey = edition === 'hi' ? book.pdf_hi_key : book.pdf_en_key;
    if (!fileKey) return json({ error: 'This edition is not available yet.' }, 400);

    if (book.is_free) {
      const r = await env.DB.prepare(
        `INSERT INTO purchases (email, book_id, edition, amount_inr, status) VALUES (?,?,?,0,'free')`)
        .bind(email, bookId, edition).run();
      const { token } = await newToken(env, r.meta.last_row_id, bookId, edition);
      return json({ free: true, redirect: `/thanks/${token}` });
    }

    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return json({ error: 'Payments are not configured yet. Please try again later.' }, 503);
    }
    const amountPaise = book.price_inr * 100;
    const ins = await env.DB.prepare(
      `INSERT INTO purchases (email, book_id, edition, amount_inr, status) VALUES (?,?,?,?, 'created')`)
      .bind(email, bookId, edition, book.price_inr).run();
    const purchaseId = ins.meta.last_row_id;

    let order;
    try { order = await razorpayCreateOrder(env, amountPaise, `ggb_${purchaseId}`); }
    catch (e) { return json({ error: 'Could not start payment. Please try again.' }, 502); }

    await env.DB.prepare('UPDATE purchases SET rzp_order_id=? WHERE id=?')
      .bind(order.id, purchaseId).run();

    return json({ key_id: env.RAZORPAY_KEY_ID, order_id: order.id, amount: amountPaise });
  }

  /* ---- verify payment ---- */
  if (p === '/api/verify' && method === 'POST') {
    let b;
    try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
    const orderId = String(b.razorpay_order_id || '');
    const paymentId = String(b.razorpay_payment_id || '');
    const signature = String(b.razorpay_signature || '');
    if (!orderId || !paymentId || !signature) return json({ error: 'Missing payment fields.' }, 400);

    const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
    if (!timingSafeEqual(expected, signature)) return json({ error: 'Signature mismatch.' }, 400);

    const purchase = await env.DB.prepare(
      'SELECT * FROM purchases WHERE rzp_order_id=?').bind(orderId).first();
    if (!purchase) return json({ error: 'Order not found.' }, 404);

    await env.DB.prepare(
      "UPDATE purchases SET status='paid', rzp_payment_id=? WHERE id=?")
      .bind(paymentId, purchase.id).run();
    const { token } = await newToken(env, purchase.id, purchase.book_id, purchase.edition);
    return json({ redirect: `/thanks/${token}` });
  }

  /* ---- thanks ---- */
  m = p.match(/^\/thanks\/([A-Za-z0-9]+)$/);
  if (m) {
    const t = await env.DB.prepare(
      `SELECT dt.*, b.title_en, b.slug FROM download_tokens dt JOIN books b ON b.id=dt.book_id
       WHERE dt.token=?`).bind(m[1]).first();
    if (!t) return page(V.messagePage({ title: 'Link not found', text: 'This download link does not exist. Use My Books to get a fresh one.' , backHref: '/my-books', backLabel: 'Go to My Books'}), 404);
    return page(V.thanksPage({
      book: { title_en: t.title_en }, token: t.token, edition: t.edition, expiresAt: t.expires_at,
    }));
  }

  /* ---- download ---- */
  m = p.match(/^\/download\/([A-Za-z0-9]+)$/);
  if (m) {
    const t = await env.DB.prepare(
      `SELECT dt.*, b.slug, b.pdf_en_key, b.pdf_hi_key FROM download_tokens dt
       JOIN books b ON b.id=dt.book_id WHERE dt.token=?`).bind(m[1]).first();
    if (!t) return page(V.messagePage({ title: 'Link not found', text: 'This download link does not exist. Use My Books to get a fresh one.', backHref: '/my-books', backLabel: 'Go to My Books' }), 404);
    if (new Date(t.expires_at).getTime() < Date.now()) {
      return page(V.messagePage({ title: 'Link expired', text: 'This link has expired. Get a fresh one from My Books with the email you used at checkout.', backHref: '/my-books', backLabel: 'Go to My Books' }), 410);
    }
    const key = t.edition === 'hi' ? t.pdf_hi_key : t.pdf_en_key;
    if (!key) return page(V.messagePage({ title: 'File missing', text: 'The file for this edition is being re-uploaded. Please email growgently.co@gmail.com.' }), 404);
    const obj = await env.FILES.get(key);
    if (!obj) return page(V.messagePage({ title: 'File missing', text: 'The file for this edition is being re-uploaded. Please email growgently.co@gmail.com.' }), 404);
    return new Response(obj.body, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${t.slug}-${t.edition}.pdf"`,
        'cache-control': 'private, no-store',
      },
    });
  }

  /* ---- my books ---- */
  if (p === '/my-books') {
    if (method === 'POST') {
      const form = await request.formData();
      const email = String(form.get('email') || '').trim().toLowerCase();
      if (!isValidEmail(email)) {
        return page(V.myBooksPage({ email, items: [], message: 'Please enter a valid email address.' }));
      }
      const { results } = await env.DB.prepare(
        `SELECT p.*, b.title_en FROM purchases p JOIN books b ON b.id=p.book_id
         WHERE p.email=? AND p.status IN ('paid','free') ORDER BY p.id DESC LIMIT 50`)
        .bind(email).all();
      const items = [];
      for (const r of (results || [])) {
        const { token } = await newToken(env, r.id, r.book_id, r.edition);
        items.push({ title_en: r.title_en, edition: r.edition, created_at: r.created_at, token });
      }
      return page(V.myBooksPage({
        email, items,
        message: items.length ? `Found ${items.length} book${items.length > 1 ? 's' : ''}. Links are valid for ${TOKEN_HOURS} hours.` : 'No purchases found for that email.',
      }));
    }
    return page(V.myBooksPage({ email: '', items: [], message: '' }));
  }

  /* ---- newsletter ---- */
  if (p === '/api/subscribe' && method === 'POST') {
    const form = await request.formData();
    const email = String(form.get('email') || '').trim().toLowerCase();
    if (isValidEmail(email)) {
      await env.DB.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').bind(email).run();
    }
    return page(V.messagePage({
      title: 'Thank you 🌱',
      text: 'You are on the list. One quiet email when new books arrive, no noise ever.',
    }));
  }

  return page(V.messagePage({ title: 'Page not found', text: 'That page does not exist.' }), 404);
}

/* ---------------- entry ---------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      let res;
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        res = await handleAdmin(request, env, url);
      } else {
        res = await handlePublic(request, env, url);
      }
      // security headers on HTML responses
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        res = new Response(res.body, res);
        res.headers.set('x-content-type-options', 'nosniff');
        res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
        res.headers.set('x-frame-options', 'SAMEORIGIN');
        res.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
      }
      return res;
    } catch (e) {
      console.error(e && e.stack || e);
      return page(V.messagePage({
        title: 'Something went wrong',
        text: 'A temporary error occurred. Please try again in a moment.',
      }), 500);
    }
  },
};
