-- Starter categories (safe to edit or delete in admin later)
INSERT OR IGNORE INTO categories (id, parent_id, name_en, name_hi, slug, sort) VALUES
  (1, NULL, 'Language',       'भाषा',              'language',       1),
  (2, NULL, 'Education',      'शिक्षा',             'education',      2),
  (3, NULL, 'Social Stories', 'सामाजिक कहानियाँ',   'social-stories', 3),
  (10, 1, 'One Word',      'एक शब्द',      'one-word',      1),
  (11, 1, 'Phrases',       'वाक्यांश',      'phrases',       2),
  (12, 1, 'WH Stories',    'WH कहानियाँ',  'wh-stories',    3),
  (13, 1, 'Why Reasoning', 'क्यों तर्क',    'why-reasoning', 4),
  (20, 2, 'Preschool', 'प्रीस्कूल', 'preschool', 1),
  (21, 2, 'Nursery',   'नर्सरी',   'nursery',   2),
  (22, 2, 'Grade 1',   'कक्षा 1',  'grade-1',   3),
  (30, 20, 'Hindi',   'हिन्दी',  'preschool-hindi',   1),
  (31, 20, 'English', 'अंग्रेज़ी', 'preschool-english', 2),
  (32, 20, 'Math',    'गणित',   'preschool-math',    3);

INSERT OR IGNORE INTO books
  (id, slug, title_en, title_hi, series, level_label, desc_en, desc_hi,
   price_inr, is_free, featured, status, youtube_url, tint)
VALUES
  (1, 'first-100-words', 'First 100 Words', 'पहले 100 शब्द', 'Early Words', 'One Word',
   'Five describing sentences per everyday object build early vocabulary without overwhelm. Print-ready 8x10 inch PDF.',
   'हर रोज़मर्रा की वस्तु के लिए पाँच वर्णन वाक्य, बिना दबाव के शुरुआती शब्दावली बनाते हैं।',
   0, 1, 1, 'published', '', 'cv-d');

INSERT OR IGNORE INTO book_categories (book_id, category_id) VALUES (1, 10);
