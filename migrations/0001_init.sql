-- Grow Gently Books: initial schema

CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name_en   TEXT NOT NULL,
  name_hi   TEXT NOT NULL DEFAULT '',
  slug      TEXT NOT NULL UNIQUE,
  sort      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title_en    TEXT NOT NULL,
  title_hi    TEXT NOT NULL DEFAULT '',
  series      TEXT NOT NULL DEFAULT '',
  level_label TEXT NOT NULL DEFAULT '',
  desc_en     TEXT NOT NULL DEFAULT '',
  desc_hi     TEXT NOT NULL DEFAULT '',
  price_inr   INTEGER NOT NULL DEFAULT 0,
  is_free     INTEGER NOT NULL DEFAULT 0,
  featured    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published',
  youtube_url TEXT NOT NULL DEFAULT '',
  cover_key   TEXT NOT NULL DEFAULT '',
  pdf_en_key  TEXT NOT NULL DEFAULT '',
  pdf_hi_key  TEXT NOT NULL DEFAULT '',
  tint        TEXT NOT NULL DEFAULT 'cv-a',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS book_categories (
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, category_id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  rzp_order_id   TEXT UNIQUE,
  rzp_payment_id TEXT,
  email          TEXT NOT NULL DEFAULT '',
  book_id        INTEGER NOT NULL REFERENCES books(id),
  edition        TEXT NOT NULL DEFAULT 'en',
  amount_inr     INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'created',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS download_tokens (
  token       TEXT PRIMARY KEY,
  book_id     INTEGER NOT NULL REFERENCES books(id),
  edition     TEXT NOT NULL DEFAULT 'en',
  purchase_id INTEGER,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_bc_category ON book_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);
