// src/views.js — public HTML templates. Everything user-visible renders here.
import { esc, youtubeId } from './util.js';

/* ---------------- shared bits ---------------- */

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Sora:wght@400;600;700&family=Hind:wght@400;500;600&display=swap" rel="stylesheet">`;

export function layout({ title, body, extraHead = '', desc = '' }) {
  const d = desc || 'Autism-friendly bilingual Hindi-English books for children who learn differently. Calm stories, predictable structure, instant PDF download.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · Grow Gently Books</title>
<meta name="description" content="${esc(d)}">
<meta property="og:title" content="${esc(title)} · Grow Gently Books">
<meta property="og:description" content="${esc(d)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Grow Gently Books">
${FONTS}
<link rel="stylesheet" href="/styles.css">
${extraHead}
</head>
<body>
${utilBar()}
${header()}
<main>
${body}
</main>
${footer()}
<script src="/site.js"></script>
</body>
</html>`;
}

function utilBar() {
  return `<div class="util">
  <div class="wrap util-in">
    <div class="util-group" aria-label="Accessibility options">
      <span class="util-label">Text size</span>
      <button class="size-btn small on" id="sizeSmall" aria-label="Standard text">A</button>
      <button class="size-btn large" id="sizeLarge" aria-label="Larger text">A</button>
    </div>
    <div class="util-group" aria-label="Language">
      <button class="on" data-setlang="en" aria-label="English">English</button>
      <span class="util-sep" aria-hidden="true"></span>
      <button class="hi" data-setlang="hi" aria-label="Hindi" lang="hi">हिंदी</button>
    </div>
  </div>
</div>`;
}

function header() {
  return `<header>
  <div class="wrap nav">
    <div class="nav-left">
      <a class="browse-btn" href="/categories" style="text-decoration:none;">
        <span>Browse Category</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </a>
      <span class="nav-divider" aria-hidden="true"></span>
      <form class="search-box" action="/search" method="get">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" name="q" placeholder="Search books" aria-label="Search books">
      </form>
    </div>
    <a class="nav-logo" href="/">
      <b>grow<span>gently</span></b>
      <small>books</small>
    </a>
    <div class="nav-right">
      <a href="/my-books" class="avatar" aria-label="My books"></a>
      <a href="/my-books" class="menu-btn" style="text-decoration:none;">My Books</a>
    </div>
  </div>
</header>`;
}

function footer() {
  return `<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <b>grow<span>gently</span></b>
        <p>Bilingual books and learning resources for children who learn differently, made by a parent who's walked this path.</p>
      </div>
      <div>
        <h4>Shop</h4>
        <ul>
          <li><a href="/categories">All categories</a></li>
          <li><a href="/search?q=">All books</a></li>
        </ul>
      </div>
      <div>
        <h4>Support</h4>
        <ul>
          <li><a href="/my-books">My downloads</a></li>
          <li><a href="mailto:growgently.co@gmail.com">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Grow Gently</h4>
        <ul>
          <li><a href="https://growgently.in">growgently.in</a></li>
          <li><a href="https://visualschedule.app">Visual Schedules app</a></li>
          <li><a href="https://instagram.com/growgently_co">Instagram</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-base">
      <span>© ${new Date().getFullYear()} Grow Gently · growgently.in</span>
      <span>Secure payments with Razorpay · Instant PDF download</span>
    </div>
  </div>
</footer>`;
}

/* ---------------- cover rendering ---------------- */

const MOTIFS = {
  'cv-a': '<span class="motif m-sun" aria-hidden="true"></span><span class="motif m-hill" aria-hidden="true"></span>',
  'cv-b': '<span class="motif m-hill" aria-hidden="true"></span>',
  'cv-c': '<span class="motif m-tri" aria-hidden="true"></span>',
  'cv-d': '<span class="motif m-rings" aria-hidden="true"></span>',
};

export function coverHTML(book) {
  const tint = MOTIFS[book.tint] ? book.tint : 'cv-a';
  if (book.cover_key) {
    return `<span class="cover ${tint}" role="img" aria-label="Cover: ${esc(book.title_en)}">
      <img src="/cover/${book.id}" alt="">
    </span>`;
  }
  return `<span class="cover ${tint}" role="img" aria-label="Cover: ${esc(book.title_en)}">
    <span class="c-series">${esc(book.series || 'Grow Gently')}</span>
    <span class="c-title">${esc(book.title_en)}${book.title_hi ? `<span class="hi">${esc(book.title_hi)}</span>` : ''}</span>
    ${MOTIFS[tint]}
    <span class="c-foot">Grow Gently</span>
  </span>`;
}

/* ---------------- small helpers ---------------- */

function trunc(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function priceHTML(book) {
  return book.is_free
    ? `<span class="card-price free">Free</span>`
    : `<span class="card-price">₹${book.price_inr} <small>per edition</small></span>`;
}

function bookTags(book) {
  const t = [];
  if (book.level_label) t.push(esc(book.level_label));
  if (book.pdf_en_key) t.push('English');
  if (book.pdf_hi_key) t.push('Hindi');
  if (!book.pdf_en_key && !book.pdf_hi_key) t.push('Coming soon');
  if (book.youtube_url) t.push('Video guide');
  return t.map(x => `<span class="tag-lite">${x}</span>`).join('');
}

export function bookCard(book) {
  return `<a class="card" href="/book/${esc(book.slug)}">
    <span class="card-body">
      ${coverHTML(book)}
      <span class="card-info">
        <span class="card-title">${esc(book.title_en)}</span>
        ${book.title_hi ? `<span class="card-sub hi">${esc(book.title_hi)}</span>` : `<span class="card-sub">${esc(book.series)}</span>`}
        <span class="card-tags">${bookTags(book)}</span>
        <span class="card-desc">${esc(trunc(book.desc_en, 130))}</span>
      </span>
    </span>
    <span class="card-foot">
      ${priceHTML(book)}
      <span class="card-cta">${book.is_free ? 'Download' : 'Buy ebook'}</span>
    </span>
  </a>`;
}

/* ---------------- home ---------------- */

export function homePage({ featured, tree, latest, books, activeTab }) {
  const slides = featured.map((b, i) => `
      <article class="car-panel${i === 0 ? ' entering' : ''}" data-slide="${i}"${i === 0 ? '' : ' hidden'}>
        <div class="car-text">
          <p class="car-kicker">${esc(b.series || 'Grow Gently')}${b.is_free ? ' · Free' : b.level_label ? ' · ' + esc(b.level_label) : ''}</p>
          <h2 class="car-title">${esc(b.title_en)}${b.title_hi ? `<span class="hi">${esc(b.title_hi)}</span>` : ''}</h2>
          <div class="car-meta">
            ${b.level_label ? `<span class="tag">${esc(b.level_label)}</span>` : ''}
            ${b.pdf_en_key ? '<span class="tag">English</span>' : ''}
            ${b.pdf_hi_key ? '<span class="tag">Hindi</span>' : ''}
          </div>
          <p class="car-desc">${esc(trunc(b.desc_en, 150))}</p>
          <a class="btn${b.is_free ? ' btn-solid' : ''}" href="/book/${esc(b.slug)}">${b.is_free ? 'Download free' : 'See the book'}</a>
        </div>
        ${coverHTML(b)}
        <div class="car-spacer" aria-hidden="true"></div>
      </article>`).join('');

  const dots = featured.map((_, i) =>
    `<button${i === 0 ? ' class="on"' : ''} aria-label="Slide ${i + 1}" data-dot="${i}"></button>`).join('');

  const hero = featured.length ? `
  <div class="carousel" aria-label="Featured books">
    <button class="car-arrow prev" aria-label="Previous book">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>
    </button>
    <div class="car-track">${slides}
    </div>
    <div class="car-dots" role="tablist" aria-label="Choose featured book">${dots}</div>
    <button class="car-arrow next" aria-label="Next book">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6 6 6-6 6"/></svg>
    </button>
  </div>` : '';

  const sideCats = tree.map(top => `
    <li><a href="/category/${esc(top.slug)}"><span class="level-dot">${esc(top.name_en[0])}</span>${esc(top.name_en)}</a></li>
    ${top.children.map(c =>
      `<li><a href="/category/${esc(c.slug)}" style="padding-left:46px;font-size:13px;">${esc(c.name_en)}</a></li>`).join('')}
  `).join('');

  const sideNew = latest.map(b => `
    <li><a href="/book/${esc(b.slug)}">
      ${coverHTML(b)}
      <span class="sb-info"><b>${esc(b.title_en)}</b>
      ${b.is_free ? '<span class="free">Free download</span>' : `<span>${esc(b.series)} · ₹${b.price_inr}</span>`}</span>
    </a></li>`).join('');

  const tabs = [`<a href="/" class="${!activeTab ? 'on' : ''}">All</a>`]
    .concat(tree.map(t => `<a href="/category/${esc(t.slug)}">${esc(t.name_en)}</a>`))
    .join('');

  const cardsHTML = books.length
    ? `<div class="cards">${books.map(bookCard).join('')}</div>`
    : `<p class="empty-note">No books published yet. Add your first book in the admin panel.</p>`;

  return layout({
    title: 'Autism-friendly bilingual books',
    body: `
${hero}
<section class="shelf">
  <div class="wrap shelf-grid">
    <aside class="side-wrap">
      <div class="side-block">
        <h3 class="side-title">Browse categories</h3>
        <ul class="level-list">${sideCats}</ul>
      </div>
      <div class="side-block">
        <h3 class="side-title">New books</h3>
        <ul class="side-books">${sideNew}</ul>
      </div>
    </aside>
    <div>
      <div class="main-head">
        <h2 class="main-title">Popular by category</h2>
        <nav class="tabs" aria-label="Filter by category">${tabs}</nav>
      </div>
      ${cardsHTML}
    </div>
  </div>
</section>
${newsband()}`
  });
}

function newsband() {
  return `<section class="newsband">
  <div class="wrap inner">
    <h2>Subscribe to our newsletter
      <span class="hi">नई किताबें, महीने में एक बार</span>
    </h2>
    <form class="news-form" action="/api/subscribe" method="post">
      <input type="email" name="email" placeholder="Your email address" aria-label="Email address" required>
      <button class="btn" type="submit">Send</button>
    </form>
  </div>
</section>`;
}

/* ---------------- category page ---------------- */

export function categoryPage({ cat, children, crumbs, books }) {
  const chips = children.length
    ? `<div class="subcat-row">${children.map(c =>
        `<a href="/category/${esc(c.slug)}">${esc(c.name_en)}${c.name_hi ? ` · <span class="hi" lang="hi">${esc(c.name_hi)}</span>` : ''}</a>`).join('')}</div>`
    : '';

  const crumbHTML = crumbs.map(c => `<a href="/category/${esc(c.slug)}">${esc(c.name_en)}</a>`).join(' / ');

  return layout({
    title: cat.name_en,
    body: `
<div class="cat-hero">
  <div class="wrap">
    <p class="micro" style="margin-bottom:14px;"><a href="/" style="text-decoration:none;">Home</a> / ${crumbHTML}</p>
    <h1>${esc(cat.name_en)}${cat.name_hi ? `<span class="hi" lang="hi">${esc(cat.name_hi)}</span>` : ''}</h1>
    ${chips}
  </div>
</div>
<section class="shelf" style="padding-top:64px;">
  <div class="wrap">
    ${books.length
      ? `<div class="cards">${books.map(bookCard).join('')}</div>`
      : `<p class="empty-note">No books in this category yet. Check back soon.</p>`}
  </div>
</section>
${newsband()}`
  });
}

/* ---------------- all categories ---------------- */

export function categoriesPage({ tree }) {
  const blocks = tree.map(top => `
    <div class="side-block">
      <h3 class="side-title"><a href="/category/${esc(top.slug)}" style="text-decoration:none;">${esc(top.name_en)}${top.name_hi ? ` · <span class="hi" lang="hi">${esc(top.name_hi)}</span>` : ''}</a></h3>
      <ul class="level-list">
        ${top.children.map(c => `
          <li><a href="/category/${esc(c.slug)}"><span class="level-dot">${esc(c.name_en[0])}</span>${esc(c.name_en)}</a></li>
          ${c.children.map(g => `<li><a href="/category/${esc(g.slug)}" style="padding-left:46px;font-size:13px;">${esc(g.name_en)}</a></li>`).join('')}
        `).join('')}
      </ul>
    </div>`).join('');

  return layout({
    title: 'Browse categories',
    body: `
<section class="shelf" style="padding-top:72px;">
  <div class="wrap">
    <div class="main-head"><h1 class="main-title" style="font-size:34px;">Browse categories</h1></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px 56px;">
      ${blocks || '<p class="empty-note">No categories yet.</p>'}
    </div>
  </div>
</section>`
  });
}

/* ---------------- book detail ---------------- */

export function bookPage({ book, crumbs, related, razorpayReady }) {
  const enOk = !!book.pdf_en_key, hiOk = !!book.pdf_hi_key;
  const anyOk = enOk || hiOk;
  const yid = youtubeId(book.youtube_url);
  const crumbHTML = crumbs.map(c => `<a href="/category/${esc(c.slug)}">${esc(c.name_en)}</a>`).join(' / ');

  const editionOpt = (lang, label, ok, checked) => `
    <label class="edition-opt${ok ? '' : ' disabled'}">
      <input type="radio" name="edition" value="${lang}" ${ok ? '' : 'disabled'} ${checked ? 'checked' : ''}>
      <span>${label}${ok ? '' : ' · soon'}</span>
    </label>`;

  const buyBlock = anyOk ? `
    <fieldset class="bd-editions">
      <legend>Choose your edition</legend>
      <div class="edition-row">
        ${editionOpt('en', 'English', enOk, enOk)}
        ${editionOpt('hi', 'हिन्दी', hiOk, !enOk && hiOk)}
      </div>
    </fieldset>
    <label class="bd-email">
      <span>Email for your download link</span>
      <input type="email" id="buyerEmail" placeholder="you@example.com" autocomplete="email" required>
    </label>
    <div class="bd-actions">
      ${book.is_free
        ? `<button class="btn btn-solid" id="buyBtn" type="button">Download free</button>`
        : `<button class="btn btn-solid" id="buyBtn" type="button">Buy this edition · ₹${book.price_inr}</button>`}
    </div>
    <p class="bd-note">${book.is_free
      ? 'We only use your email to send you the download link and occasional new-book news.'
      : 'Secure payment with Razorpay. Your PDF download link appears right after payment and is also retrievable any time from My Books.'}</p>
    <div class="bd-result" id="buyResult" role="status"></div>`
    : `<p class="bd-note" style="font-size:14px;">The PDF for this book is being prepared. Subscribe below and we'll let you know the moment it's ready.</p>`;

  const script = anyOk ? `
<script>
(function(){
  var btn = document.getElementById('buyBtn');
  var out = document.getElementById('buyResult');
  if (!btn) return;
  function msg(html){ out.innerHTML = html; out.classList.add('show'); }
  btn.addEventListener('click', async function(){
    var email = (document.getElementById('buyerEmail').value || '').trim();
    var ed = document.querySelector('input[name="edition"]:checked');
    if (!ed) { msg('Please choose an edition.'); return; }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)) { msg('Please enter a valid email address.'); return; }
    btn.disabled = true;
    try {
      var res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ book_id: ${book.id}, edition: ed.value, email: email })
      });
      var data = await res.json();
      if (!res.ok) { msg(data.error || 'Something went wrong. Please try again.'); btn.disabled = false; return; }
      if (data.free) { location.href = data.redirect; return; }
      var rzp = new Razorpay({
        key: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: 'INR',
        name: 'Grow Gently Books',
        description: ${JSON.stringify(book.title_en)},
        prefill: { email: email },
        theme: { color: '#262B26' },
        handler: async function(resp){
          var v = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(resp)
          });
          var vd = await v.json();
          if (v.ok && vd.redirect) { location.href = vd.redirect; }
          else { msg(vd.error || 'Payment received but verification failed. Please contact us with your payment ID.'); }
        },
        modal: { ondismiss: function(){ btn.disabled = false; } }
      });
      rzp.on('payment.failed', function(){ msg('Payment failed. You have not been charged, please try again.'); btn.disabled = false; });
      rzp.open();
    } catch(e) {
      msg('Network error. Please try again.'); btn.disabled = false;
    }
  });
})();
</script>` : '';

  return layout({
    title: book.title_en,
    desc: (book.desc_en || '').slice(0, 155),
    extraHead: anyOk && !book.is_free ? '<script src="https://checkout.razorpay.com/v1/checkout.js"></script>' : '',
    body: `
<section class="bd">
  <div class="wrap bd-grid">
    <div class="bd-cover-zone">${coverHTML(book)}</div>
    <div>
      <p class="bd-crumbs"><a href="/">Home</a>${crumbHTML ? ' / ' + crumbHTML : ''}</p>
      <h1 class="bd-title">${esc(book.title_en)}${book.title_hi ? `<span class="hi" lang="hi">${esc(book.title_hi)}</span>` : ''}</h1>
      <div class="bd-meta">
        ${book.series ? `<span class="tag">${esc(book.series)}</span>` : ''}
        ${book.level_label ? `<span class="tag">${esc(book.level_label)}</span>` : ''}
        ${yid ? '<span class="tag">Video guide</span>' : ''}
      </div>
      <p class="bd-desc">${esc(book.desc_en)}</p>
      ${book.desc_hi ? `<p class="bd-desc hi" lang="hi">${esc(book.desc_hi)}</p>` : ''}
      <p class="bd-price">${book.is_free ? '<em>Free</em>' : `₹${book.price_inr} <small>per edition</small>`}</p>
      ${buyBlock}
      ${yid ? `
      <div class="bd-video">
        <h2>See how to use this book</h2>
        <div class="video-frame">
          <iframe src="https://www.youtube-nocookie.com/embed/${esc(yid)}" title="How to use ${esc(book.title_en)}"
            allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>` : ''}
    </div>
  </div>
</section>
${related.length ? `
<section class="shelf" style="padding-top:0;">
  <div class="wrap">
    <div class="main-head"><h2 class="main-title">You may also like</h2></div>
    <div class="cards">${related.map(bookCard).join('')}</div>
  </div>
</section>` : ''}
${script}`
  });
}

/* ---------------- search ---------------- */

export function searchPage({ q, books }) {
  return layout({
    title: q ? `Search: ${q}` : 'All books',
    body: `
<section class="shelf" style="padding-top:72px;">
  <div class="wrap">
    <div class="main-head">
      <h1 class="main-title" style="font-size:30px;">${q ? `Results for "${esc(q)}"` : 'All books'}</h1>
    </div>
    ${books.length
      ? `<div class="cards">${books.map(bookCard).join('')}</div>`
      : `<p class="empty-note">Nothing found${q ? ` for "${esc(q)}"` : ''}. Try a different word, or <a href="/categories">browse categories</a>.</p>`}
  </div>
</section>`
  });
}

/* ---------------- thanks / download ---------------- */

export function thanksPage({ book, token, edition, expiresAt }) {
  return layout({
    title: 'Your book is ready',
    body: `
<section class="mb">
  <h1>Your book is ready 🌱</h1>
  <p><b>${esc(book.title_en)}</b> · ${edition === 'hi' ? 'Hindi edition' : 'English edition'}</p>
  <p>Your download link works until <b>${esc(new Date(expiresAt).toDateString())}</b>.
  You can get a fresh link any time from <a href="/my-books">My Books</a> using the same email.</p>
  <p><a class="btn btn-solid" href="/download/${esc(token)}">Download PDF</a></p>
  <p style="margin-top:26px;font-size:13px;color:var(--ink-soft);">Tip: save the PDF to your device or print it. If anything goes wrong, email growgently.co@gmail.com with your payment details.</p>
</section>`
  });
}

/* ---------------- my books ---------------- */

export function myBooksPage({ email, items, message }) {
  const list = items.map(it => `
    <div class="mb-item">
      <div><b>${esc(it.title_en)}</b>
        <small>${it.edition === 'hi' ? 'Hindi edition' : 'English edition'} · ${esc(it.created_at.slice(0, 10))}</small>
      </div>
      <a class="btn" href="/download/${esc(it.token)}">Download</a>
    </div>`).join('');

  return layout({
    title: 'My Books',
    body: `
<section class="mb">
  <h1>My Books</h1>
  <p>Enter the email you used at checkout and we'll list your books with fresh download links.</p>
  <form method="post" action="/my-books">
    <input type="email" name="email" placeholder="you@example.com" value="${esc(email || '')}" required>
    <button class="btn btn-solid" type="submit">Find my books</button>
  </form>
  ${message ? `<p style="margin-top:24px;color:var(--ink-mid);">${esc(message)}</p>` : ''}
  ${items.length ? `<div class="mb-list">${list}</div>` : ''}
</section>`
  });
}

/* ---------------- simple message page ---------------- */

export function messagePage({ title, text, backHref = '/', backLabel = 'Back to books' }) {
  return layout({
    title,
    body: `
<section class="mb">
  <h1>${esc(title)}</h1>
  <p>${esc(text)}</p>
  <p><a class="btn" href="${esc(backHref)}">${esc(backLabel)}</a></p>
</section>`
  });
}
