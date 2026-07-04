// src/admin.js — password-protected admin panel at /admin
import { esc, slugify, page, redirect, getCookie, hmacHex, timingSafeEqual } from './util.js';

const COOKIE = 'ggb_admin';
const SESSION_HOURS = 24 * 7;

/* ---------------- session ---------------- */

async function makeSession(env) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const sig = await hmacHex(env.SESSION_SECRET, 'admin:' + exp);
  return `${exp}.${sig}`;
}

async function checkSession(request, env) {
  const val = getCookie(request, COOKIE);
  if (!val) return false;
  const i = val.indexOf('.');
  if (i < 1) return false;
  const exp = val.slice(0, i), sig = val.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expect = await hmacHex(env.SESSION_SECRET, 'admin:' + exp);
  return timingSafeEqual(sig, expect);
}

/* ---------------- layout ---------------- */

function admLayout({ title, body, active = '', msg = '' }) {
  const nav = [
    ['/admin', 'Dashboard', 'dash'],
    ['/admin/books', 'Books', 'books'],
    ['/admin/categories', 'Categories', 'cats'],
    ['/admin/purchases', 'Purchases', 'buys'],
  ].map(([href, label, key]) =>
    `<a href="${href}" class="${active === key ? 'on' : ''}">${label}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · Admin · Grow Gently Books</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Sora:wght@400;600;700&family=Hind:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<meta name="robots" content="noindex">
</head><body>
<div class="adm">
  <div class="adm-top">
    <h1>${esc(title)}</h1>
    <nav class="adm-nav">${nav}
      <form method="post" action="/admin/logout" style="display:inline;"><button class="btn" style="padding:8px 16px;">Log out</button></form>
    </nav>
  </div>
  ${msg ? `<div class="adm-msg">${esc(msg)}</div>` : ''}
  ${body}
</div>
</body></html>`;
}

/* ---------------- db helpers ---------------- */

async function allCats(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM categories ORDER BY parent_id IS NOT NULL, parent_id, sort, name_en').all();
  return results || [];
}

function flatTree(cats) {
  // returns [{cat, depth}] in tree order
  const byParent = new Map();
  for (const c of cats) {
    const k = c.parent_id || 0;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(c);
  }
  const out = [];
  const walk = (pid, depth) => {
    for (const c of (byParent.get(pid) || [])) {
      out.push({ cat: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(0, 0);
  return out;
}

/* ---------------- pages ---------------- */

function loginPage(error = '') {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin login · Grow Gently Books</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Sora:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<meta name="robots" content="noindex">
</head><body>
<div class="adm-login">
  <div class="adm-form">
    <h2>Grow Gently admin</h2>
    ${error ? `<div class="adm-msg">${esc(error)}</div>` : ''}
    <form method="post" action="/admin/login">
      <div class="row one"><label>Password<input type="password" name="password" autofocus required></label></div>
      <div class="adm-actions"><button class="btn btn-solid" type="submit">Log in</button></div>
    </form>
  </div>
</div>
</body></html>`;
}

async function dashboard(env, msg) {
  const books = await env.DB.prepare("SELECT COUNT(*) n FROM books").first();
  const cats = await env.DB.prepare("SELECT COUNT(*) n FROM categories").first();
  const paid = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount_inr),0) s FROM purchases WHERE status='paid'").first();
  const free = await env.DB.prepare("SELECT COUNT(*) n FROM purchases WHERE status='free'").first();
  const subs = await env.DB.prepare("SELECT COUNT(*) n FROM subscribers").first();
  const { results: recent } = await env.DB.prepare(
    `SELECT p.*, b.title_en FROM purchases p JOIN books b ON b.id=p.book_id
     ORDER BY p.id DESC LIMIT 10`).all();

  const rows = (recent || []).map(r => `
    <tr><td>${esc(r.created_at)}</td><td>${esc(r.title_en)} (${r.edition})</td>
    <td>${esc(r.email)}</td><td>${r.status === 'free' ? '<span class="pill-mut">free</span>'
      : r.status === 'paid' ? `<span class="pill-ok">₹${r.amount_inr}</span>` : `<span class="pill-mut">${esc(r.status)}</span>`}</td></tr>`).join('');

  return admLayout({
    title: 'Dashboard', active: 'dash', msg,
    body: `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:36px;">
  ${[['Books', books.n], ['Categories', cats.n], ['Paid orders', paid.n], ['Revenue', '₹' + paid.s], ['Free downloads', free.n], ['Subscribers', subs.n]]
    .map(([l, v]) => `<div class="adm-form" style="margin:0;padding:20px;"><div class="micro">${l}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:600;margin-top:6px;">${v}</div></div>`).join('')}
</div>
<h2 style="font-family:'Cormorant Garamond',serif;font-size:24px;margin-bottom:16px;">Recent activity</h2>
<table class="adm-table">
  <tr><th>When</th><th>Book</th><th>Email</th><th>Status</th></tr>
  ${rows || '<tr><td colspan="4">No purchases yet.</td></tr>'}
</table>`
  });
}

async function categoriesPage(env, msg) {
  const cats = await allCats(env);
  const tree = flatTree(cats);
  const parentOpts = (selected) => `<option value="">— top level —</option>` +
    tree.map(({ cat, depth }) =>
      `<option value="${cat.id}" ${selected === cat.id ? 'selected' : ''}>${'&nbsp;'.repeat(depth * 4)}${esc(cat.name_en)}</option>`).join('');

  const rows = tree.map(({ cat, depth }) => `
    <tr>
      <td class="${depth ? 'indent' : ''}">${'&nbsp;'.repeat(depth * 6)}${depth ? '↳ ' : ''}<b>${esc(cat.name_en)}</b>
        ${cat.name_hi ? ` <span class="hi" lang="hi">${esc(cat.name_hi)}</span>` : ''}</td>
      <td><code>${esc(cat.slug)}</code></td>
      <td>${cat.sort}</td>
      <td style="white-space:nowrap;">
        <a href="/admin/categories/${cat.id}" class="pill-mut">edit</a> &nbsp;
        <form method="post" action="/admin/categories/${cat.id}/delete" style="display:inline;"
          onsubmit="return confirm('Delete ${esc(cat.name_en)}? Books stay, only the category link is removed.');">
          <button class="pill-mut" style="background:none;border:none;cursor:pointer;color:#A3522F;">delete</button>
        </form>
      </td>
    </tr>`).join('');

  return admLayout({
    title: 'Categories', active: 'cats', msg,
    body: `
<table class="adm-table">
  <tr><th>Name</th><th>Slug</th><th>Sort</th><th></th></tr>
  ${rows || '<tr><td colspan="4">No categories yet.</td></tr>'}
</table>
<div class="adm-form">
  <h2>Add a category</h2>
  <form method="post" action="/admin/categories">
    <div class="row">
      <label>Name (English)<input type="text" name="name_en" required></label>
      <label>Name (Hindi)<input type="text" name="name_hi" class="hi"></label>
    </div>
    <div class="row">
      <label>Parent${''}<select name="parent_id">${parentOpts(null)}</select></label>
      <label>Sort order<input type="number" name="sort" value="0"></label>
    </div>
    <div class="row one">
      <label>Slug (leave empty to auto-generate)<input type="text" name="slug" placeholder="auto"></label>
    </div>
    <div class="adm-actions"><button class="btn btn-solid" type="submit">Add category</button></div>
  </form>
</div>`
  });
}

async function categoryEditPage(env, id, msg) {
  const cat = await env.DB.prepare('SELECT * FROM categories WHERE id=?').bind(id).first();
  if (!cat) return null;
  const cats = await allCats(env);
  const tree = flatTree(cats).filter(t => t.cat.id !== cat.id); // can't be its own parent
  const parentOpts = `<option value="">— top level —</option>` +
    tree.map(({ cat: c, depth }) =>
      `<option value="${c.id}" ${cat.parent_id === c.id ? 'selected' : ''}>${'&nbsp;'.repeat(depth * 4)}${esc(c.name_en)}</option>`).join('');

  return admLayout({
    title: `Edit: ${cat.name_en}`, active: 'cats', msg,
    body: `
<div class="adm-form" style="margin-top:0;">
  <form method="post" action="/admin/categories/${cat.id}">
    <div class="row">
      <label>Name (English)<input type="text" name="name_en" value="${esc(cat.name_en)}" required></label>
      <label>Name (Hindi)<input type="text" name="name_hi" class="hi" value="${esc(cat.name_hi)}"></label>
    </div>
    <div class="row">
      <label>Parent<select name="parent_id">${parentOpts}</select></label>
      <label>Sort order<input type="number" name="sort" value="${cat.sort}"></label>
    </div>
    <div class="row one">
      <label>Slug<input type="text" name="slug" value="${esc(cat.slug)}" required></label>
    </div>
    <div class="adm-actions">
      <button class="btn btn-solid" type="submit">Save</button>
      <a class="btn" href="/admin/categories">Back</a>
    </div>
  </form>
</div>`
  });
}

async function booksList(env, msg) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM books ORDER BY featured DESC, updated_at DESC').all();
  const rows = (results || []).map(b => `
    <tr>
      <td><a href="/admin/books/${b.id}"><b>${esc(b.title_en)}</b></a>
        ${b.title_hi ? ` <span class="hi" lang="hi">${esc(b.title_hi)}</span>` : ''}<br>
        <span class="pill-mut">${esc(b.series || '')} ${esc(b.level_label || '')}</span></td>
      <td>${b.is_free ? '<span class="pill-ok">Free</span>' : '₹' + b.price_inr}</td>
      <td>${b.pdf_en_key ? '<span class="pill-ok">EN ✓</span>' : '<span class="pill-mut">EN —</span>'}
          ${b.pdf_hi_key ? '<span class="pill-ok">HI ✓</span>' : '<span class="pill-mut">HI —</span>'}</td>
      <td>${b.featured ? '<span class="pill-ok">Hero</span>' : ''}</td>
      <td>${b.status === 'published' ? '<span class="pill-ok">live</span>' : '<span class="pill-mut">draft</span>'}</td>
      <td><a class="pill-mut" href="/book/${esc(b.slug)}" target="_blank">view →</a></td>
    </tr>`).join('');

  return admLayout({
    title: 'Books', active: 'books', msg,
    body: `
<div class="adm-actions" style="margin:0 0 22px;">
  <a class="btn btn-solid" href="/admin/books/new">+ Add a book</a>
</div>
<table class="adm-table">
  <tr><th>Title</th><th>Price</th><th>PDFs</th><th>Featured</th><th>Status</th><th></th></tr>
  ${rows || '<tr><td colspan="6">No books yet. Add your first one!</td></tr>'}
</table>`
  });
}

async function bookForm(env, book, msg) {
  const isNew = !book;
  const b = book || {
    title_en: '', title_hi: '', slug: '', series: '', level_label: '',
    desc_en: '', desc_hi: '', price_inr: 149, is_free: 0, featured: 0,
    status: 'published', youtube_url: '', tint: 'cv-a',
    pdf_en_key: '', pdf_hi_key: '', cover_key: '', id: 0,
  };
  const cats = await allCats(env);
  const tree = flatTree(cats);
  let selected = new Set();
  if (!isNew) {
    const { results } = await env.DB.prepare(
      'SELECT category_id FROM book_categories WHERE book_id=?').bind(b.id).all();
    selected = new Set((results || []).map(r => r.category_id));
  }
  const catChecks = tree.map(({ cat, depth }) => `
    <label class="adm-check" style="margin-left:${depth * 22}px;">
      <input type="checkbox" name="cats" value="${cat.id}" ${selected.has(cat.id) ? 'checked' : ''}>
      ${esc(cat.name_en)}${cat.name_hi ? ` <span class="hi" lang="hi">(${esc(cat.name_hi)})</span>` : ''}
    </label>`).join('');

  const tintOpts = ['cv-a', 'cv-b', 'cv-c', 'cv-d'].map(t =>
    `<option value="${t}" ${b.tint === t ? 'selected' : ''}>${t.slice(3).toUpperCase()} · ${
      { a: 'sun + hill', b: 'hill', c: 'triangle', d: 'rings' }[t.slice(3)]}</option>`).join('');

  const uploads = isNew ? `<p class="pill-mut" style="display:block;margin-top:8px;">Save the book first, then upload its PDF files and cover here.</p>` : `
    <div class="row">
      <label>English PDF ${b.pdf_en_key ? '<span class="pill-ok">uploaded ✓</span>' : '<span class="pill-mut">not yet</span>'}
        <input type="file" name="pdf_en" accept="application/pdf"></label>
      <label>Hindi PDF ${b.pdf_hi_key ? '<span class="pill-ok">uploaded ✓</span>' : '<span class="pill-mut">not yet</span>'}
        <input type="file" name="pdf_hi" accept="application/pdf"></label>
    </div>
    <div class="row one">
      <label>Cover image (optional, replaces the CSS cover) ${b.cover_key ? '<span class="pill-ok">uploaded ✓</span>' : ''}
        <input type="file" name="cover" accept="image/png,image/jpeg,image/webp"></label>
    </div>`;

  return admLayout({
    title: isNew ? 'Add a book' : `Edit: ${b.title_en}`, active: 'books', msg,
    body: `
<div class="adm-form" style="margin-top:0;">
  <form method="post" action="${isNew ? '/admin/books' : '/admin/books/' + b.id}" enctype="multipart/form-data">
    <div class="row">
      <label>Title (English)<input type="text" name="title_en" value="${esc(b.title_en)}" required></label>
      <label>Title (Hindi)<input type="text" name="title_hi" class="hi" value="${esc(b.title_hi)}"></label>
    </div>
    <div class="row">
      <label>Series (e.g. WH Series)<input type="text" name="series" value="${esc(b.series)}"></label>
      <label>Level label (e.g. Foundation)<input type="text" name="level_label" value="${esc(b.level_label)}"></label>
    </div>
    <div class="row one">
      <label>Slug (URL)<input type="text" name="slug" value="${esc(b.slug)}" placeholder="auto from title"></label>
    </div>
    <div class="row one">
      <label>Description (English)<textarea name="desc_en">${esc(b.desc_en)}</textarea></label>
    </div>
    <div class="row one">
      <label>Description (Hindi)<textarea name="desc_hi" class="hi">${esc(b.desc_hi)}</textarea></label>
    </div>
    <div class="row">
      <label>Price in ₹ (per edition)<input type="number" name="price_inr" value="${b.price_inr}" min="0"></label>
      <label>YouTube "how to use" URL<input type="text" name="youtube_url" value="${esc(b.youtube_url)}" placeholder="https://youtube.com/watch?v=..."></label>
    </div>
    <div class="row">
      <label>Cover style<select name="tint">${tintOpts}</select></label>
      <label>Status<select name="status">
        <option value="published" ${b.status === 'published' ? 'selected' : ''}>Published</option>
        <option value="draft" ${b.status === 'draft' ? 'selected' : ''}>Draft (hidden)</option>
      </select></label>
    </div>
    <div class="row">
      <label class="adm-check" style="margin-top:24px;"><input type="checkbox" name="is_free" ${b.is_free ? 'checked' : ''}> Free download</label>
      <label class="adm-check" style="margin-top:24px;"><input type="checkbox" name="featured" ${b.featured ? 'checked' : ''}> Show in home hero (max 5 shown)</label>
    </div>
    <div class="row one">
      <label>Categories</label>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">${catChecks || '<span class="pill-mut">Create categories first.</span>'}</div>
    </div>
    ${uploads}
    <div class="adm-actions">
      <button class="btn btn-solid" type="submit">${isNew ? 'Create book' : 'Save changes'}</button>
      <a class="btn" href="/admin/books">Back</a>
      ${isNew ? '' : `</form>
      <form method="post" action="/admin/books/${b.id}/delete"
        onsubmit="return confirm('Delete this book permanently? Purchases keep working is NOT guaranteed after deletion.');">
        <button class="btn btn-danger" type="submit">Delete book</button>`}
    </form>
    </div>
</div>`
  });
}

async function purchasesPage(env, msg) {
  const { results } = await env.DB.prepare(
    `SELECT p.*, b.title_en FROM purchases p LEFT JOIN books b ON b.id=p.book_id
     ORDER BY p.id DESC LIMIT 200`).all();
  const rows = (results || []).map(r => `
    <tr><td>${esc(r.created_at)}</td><td>${esc(r.title_en || '(deleted book)')}</td>
    <td>${r.edition}</td><td>${esc(r.email)}</td>
    <td>${r.status === 'paid' ? `<span class="pill-ok">paid ₹${r.amount_inr}</span>`
      : `<span class="pill-mut">${esc(r.status)}</span>`}</td>
    <td class="pill-mut">${esc(r.rzp_payment_id || '')}</td></tr>`).join('');

  return admLayout({
    title: 'Purchases', active: 'buys', msg,
    body: `<table class="adm-table">
  <tr><th>When</th><th>Book</th><th>Ed.</th><th>Email</th><th>Status</th><th>Payment ID</th></tr>
  ${rows || '<tr><td colspan="6">No purchases yet.</td></tr>'}
</table>`
  });
}

/* ---------------- form handlers ---------------- */

async function saveCategory(env, form, id = null) {
  const name_en = String(form.get('name_en') || '').trim();
  if (!name_en) throw new Error('Name is required');
  const name_hi = String(form.get('name_hi') || '').trim();
  let slug = slugify(String(form.get('slug') || '') || name_en);
  const parent_id = form.get('parent_id') ? Number(form.get('parent_id')) : null;
  const sort = Number(form.get('sort') || 0);
  if (id) {
    await env.DB.prepare(
      'UPDATE categories SET name_en=?, name_hi=?, slug=?, parent_id=?, sort=? WHERE id=?')
      .bind(name_en, name_hi, slug, parent_id, sort, id).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO categories (name_en, name_hi, slug, parent_id, sort) VALUES (?,?,?,?,?)')
      .bind(name_en, name_hi, slug, parent_id, sort).run();
  }
}

async function saveBook(env, form, existing = null) {
  const title_en = String(form.get('title_en') || '').trim();
  if (!title_en) throw new Error('English title is required');
  const fields = {
    title_en,
    title_hi: String(form.get('title_hi') || '').trim(),
    slug: slugify(String(form.get('slug') || '') || title_en),
    series: String(form.get('series') || '').trim(),
    level_label: String(form.get('level_label') || '').trim(),
    desc_en: String(form.get('desc_en') || '').trim(),
    desc_hi: String(form.get('desc_hi') || '').trim(),
    price_inr: Math.max(0, Math.round(Number(form.get('price_inr') || 0))),
    is_free: form.get('is_free') ? 1 : 0,
    featured: form.get('featured') ? 1 : 0,
    status: form.get('status') === 'draft' ? 'draft' : 'published',
    youtube_url: String(form.get('youtube_url') || '').trim(),
    tint: ['cv-a', 'cv-b', 'cv-c', 'cv-d'].includes(form.get('tint')) ? form.get('tint') : 'cv-a',
  };

  let bookId;
  if (existing) {
    bookId = existing.id;
    await env.DB.prepare(
      `UPDATE books SET title_en=?, title_hi=?, slug=?, series=?, level_label=?, desc_en=?, desc_hi=?,
       price_inr=?, is_free=?, featured=?, status=?, youtube_url=?, tint=?, updated_at=datetime('now') WHERE id=?`)
      .bind(fields.title_en, fields.title_hi, fields.slug, fields.series, fields.level_label,
        fields.desc_en, fields.desc_hi, fields.price_inr, fields.is_free, fields.featured,
        fields.status, fields.youtube_url, fields.tint, bookId).run();
  } else {
    const r = await env.DB.prepare(
      `INSERT INTO books (title_en, title_hi, slug, series, level_label, desc_en, desc_hi,
        price_inr, is_free, featured, status, youtube_url, tint) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(fields.title_en, fields.title_hi, fields.slug, fields.series, fields.level_label,
        fields.desc_en, fields.desc_hi, fields.price_inr, fields.is_free, fields.featured,
        fields.status, fields.youtube_url, fields.tint).run();
    bookId = r.meta.last_row_id;
  }

  // categories
  await env.DB.prepare('DELETE FROM book_categories WHERE book_id=?').bind(bookId).run();
  const catIds = form.getAll('cats').map(Number).filter(Boolean);
  for (const cid of catIds) {
    await env.DB.prepare('INSERT OR IGNORE INTO book_categories (book_id, category_id) VALUES (?,?)')
      .bind(bookId, cid).run();
  }

  // file uploads (edit only)
  if (existing) {
    const putFile = async (field, key, contentType) => {
      const f = form.get(field);
      if (f && typeof f === 'object' && f.size > 0) {
        await env.FILES.put(key, f, { httpMetadata: { contentType: f.type || contentType } });
        return { key, size: f.size };
      }
      return null;
    };
    const en = await putFile('pdf_en', `books/${bookId}/en.pdf`, 'application/pdf');
    if (en) await env.DB.prepare('UPDATE books SET pdf_en_key=? WHERE id=?').bind(en.key, bookId).run();
    const hi = await putFile('pdf_hi', `books/${bookId}/hi.pdf`, 'application/pdf');
    if (hi) await env.DB.prepare('UPDATE books SET pdf_hi_key=? WHERE id=?').bind(hi.key, bookId).run();
    const cv = form.get('cover');
    if (cv && typeof cv === 'object' && cv.size > 0) {
      const ext = (cv.type === 'image/png') ? 'png' : (cv.type === 'image/webp') ? 'webp' : 'jpg';
      const key = `books/${bookId}/cover.${ext}`;
      await env.FILES.put(key, cv, { httpMetadata: { contentType: cv.type || 'image/jpeg' } });
      await env.DB.prepare('UPDATE books SET cover_key=? WHERE id=?').bind(key, bookId).run();
    }
  }
  return bookId;
}

/* ---------------- router ---------------- */

export async function handleAdmin(request, env, url) {
  const p = url.pathname;
  const method = request.method;

  // login (no session needed)
  if (p === '/admin/login') {
    if (method === 'POST') {
      const form = await request.formData();
      const pw = String(form.get('password') || '');
      if (env.ADMIN_PASSWORD && timingSafeEqual(pw, env.ADMIN_PASSWORD)) {
        const session = await makeSession(env);
        return redirect('/admin', {
          'set-cookie': `${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`,
        });
      }
      return page(loginPage('Wrong password. Try again.'), 401);
    }
    return page(loginPage());
  }

  // everything else requires session
  if (!(await checkSession(request, env))) return redirect('/admin/login');

  if (p === '/admin/logout' && method === 'POST') {
    return redirect('/admin/login', {
      'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    });
  }

  const msg = url.searchParams.get('msg') || '';

  // dashboard
  if (p === '/admin') return page(await dashboard(env, msg));

  // ----- categories -----
  if (p === '/admin/categories') {
    if (method === 'POST') {
      try { await saveCategory(env, await request.formData()); }
      catch (e) { return redirect('/admin/categories?msg=' + encodeURIComponent(e.message)); }
      return redirect('/admin/categories?msg=' + encodeURIComponent('Category added.'));
    }
    return page(await categoriesPage(env, msg));
  }
  let m = p.match(/^\/admin\/categories\/(\d+)$/);
  if (m) {
    const id = Number(m[1]);
    if (method === 'POST') {
      try { await saveCategory(env, await request.formData(), id); }
      catch (e) { return redirect(`/admin/categories/${id}?msg=` + encodeURIComponent(e.message)); }
      return redirect('/admin/categories?msg=' + encodeURIComponent('Saved.'));
    }
    const html = await categoryEditPage(env, id, msg);
    return html ? page(html) : redirect('/admin/categories');
  }
  m = p.match(/^\/admin\/categories\/(\d+)\/delete$/);
  if (m && method === 'POST') {
    const id = Number(m[1]);
    const child = await env.DB.prepare('SELECT COUNT(*) n FROM categories WHERE parent_id=?').bind(id).first();
    if (child.n > 0) {
      return redirect('/admin/categories?msg=' + encodeURIComponent('Delete or move its sub-categories first.'));
    }
    await env.DB.prepare('DELETE FROM book_categories WHERE category_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run();
    return redirect('/admin/categories?msg=' + encodeURIComponent('Deleted.'));
  }

  // ----- books -----
  if (p === '/admin/books') {
    if (method === 'POST') {
      let id;
      try { id = await saveBook(env, await request.formData()); }
      catch (e) { return redirect('/admin/books/new?msg=' + encodeURIComponent(e.message)); }
      return redirect(`/admin/books/${id}?msg=` + encodeURIComponent('Book created. Now upload its PDF files below.'));
    }
    return page(await booksList(env, msg));
  }
  if (p === '/admin/books/new') return page(await bookForm(env, null, msg));

  m = p.match(/^\/admin\/books\/(\d+)$/);
  if (m) {
    const id = Number(m[1]);
    const book = await env.DB.prepare('SELECT * FROM books WHERE id=?').bind(id).first();
    if (!book) return redirect('/admin/books');
    if (method === 'POST') {
      try { await saveBook(env, await request.formData(), book); }
      catch (e) { return redirect(`/admin/books/${id}?msg=` + encodeURIComponent(e.message)); }
      return redirect(`/admin/books/${id}?msg=` + encodeURIComponent('Saved.'));
    }
    return page(await bookForm(env, book, msg));
  }
  m = p.match(/^\/admin\/books\/(\d+)\/delete$/);
  if (m && method === 'POST') {
    const id = Number(m[1]);
    await env.DB.prepare('DELETE FROM book_categories WHERE book_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM books WHERE id=?').bind(id).run();
    return redirect('/admin/books?msg=' + encodeURIComponent('Book deleted.'));
  }

  // ----- purchases -----
  if (p === '/admin/purchases') return page(await purchasesPage(env, msg));

  return redirect('/admin');
}
