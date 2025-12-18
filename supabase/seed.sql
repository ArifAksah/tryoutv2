-- Seed (new schema): categories + questions + institutions + exam_blueprints
--
-- Run order (recommended):
--   1) migrate-to-categories-schema.sql
--   2) add-institutions-blueprints.sql
--   3) skb-blueprints-rpc.sql

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.categories') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.categories. Run migrate-to-categories-schema.sql first.';
  END IF;
  IF to_regclass('public.questions') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.questions. Run migrate-to-categories-schema.sql first.';
  END IF;
  IF to_regclass('public.institutions') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.institutions. Run add-institutions-blueprints.sql first.';
  END IF;
  IF to_regclass('public.exam_blueprints') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.exam_blueprints. Run add-institutions-blueprints.sql first.';
  END IF;
END $$;

-- Root categories
INSERT INTO public.categories (slug, name, type)
VALUES
  ('skd', 'SKD', 'subject'),
  ('skb', 'SKB', 'subject')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  updated_at = now();

-- SKD structure: TWK/TIU/TKP -> subtopics
WITH skd AS (
  SELECT id FROM public.categories WHERE slug = 'skd' LIMIT 1
)
INSERT INTO public.categories (slug, name, parent_id, type)
VALUES
  ('twk', 'Tes Wawasan Kebangsaan', (SELECT id FROM skd), 'topic'),
  ('tiu', 'Tes Intelegensi Umum', (SELECT id FROM skd), 'topic'),
  ('tkp', 'Tes Karakteristik Pribadi', (SELECT id FROM skd), 'topic')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  updated_at = now();

WITH
  twk AS (SELECT id FROM public.categories WHERE slug = 'twk' LIMIT 1),
  tiu AS (SELECT id FROM public.categories WHERE slug = 'tiu' LIMIT 1),
  tkp AS (SELECT id FROM public.categories WHERE slug = 'tkp' LIMIT 1)
INSERT INTO public.categories (slug, name, parent_id, type)
VALUES
  ('twk-pancasila', 'Pancasila & UUD 1945', (SELECT id FROM twk), 'subtopic'),
  ('twk-konstitusi', 'Konstitusi & Tata Negara', (SELECT id FROM twk), 'subtopic'),
  ('tiu-deret', 'Deret Angka', (SELECT id FROM tiu), 'subtopic'),
  ('tiu-logika', 'Logika & Silogisme', (SELECT id FROM tiu), 'subtopic'),
  ('tkp-pelayanan', 'Pelayanan Publik', (SELECT id FROM tkp), 'subtopic'),
  ('tkp-jejaring', 'Jejaring Kerja', (SELECT id FROM tkp), 'subtopic')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  updated_at = now();

-- SKB reusable categories (do NOT create per-school categories)
WITH skb AS (
  SELECT id FROM public.categories WHERE slug = 'skb' LIMIT 1
)
INSERT INTO public.categories (slug, name, parent_id, type)
VALUES
  ('ekonomi', 'Ekonomi', (SELECT id FROM skb), 'topic'),
  ('matematika', 'Matematika', (SELECT id FROM skb), 'topic'),
  ('inggris', 'Bahasa Inggris', (SELECT id FROM skb), 'topic')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  updated_at = now();

WITH
  ekonomi AS (SELECT id FROM public.categories WHERE slug = 'ekonomi' LIMIT 1),
  matematika AS (SELECT id FROM public.categories WHERE slug = 'matematika' LIMIT 1),
  inggris AS (SELECT id FROM public.categories WHERE slug = 'inggris' LIMIT 1)
INSERT INTO public.categories (slug, name, parent_id, type)
VALUES
  ('ekonomi-makro', 'Ekonomi Makro', (SELECT id FROM ekonomi), 'subtopic'),
  ('ekonomi-mikro', 'Ekonomi Mikro', (SELECT id FROM ekonomi), 'subtopic'),
  ('matematika-aljabar', 'Aljabar', (SELECT id FROM matematika), 'subtopic'),
  ('matematika-statistika', 'Statistika Dasar', (SELECT id FROM matematika), 'subtopic'),
  ('inggris-grammar', 'Grammar', (SELECT id FROM inggris), 'subtopic'),
  ('inggris-reading', 'Reading', (SELECT id FROM inggris), 'subtopic')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  updated_at = now();

-- Questions: use legacy_id to make seed idempotent
WITH
  c_twk_pancasila AS (SELECT id FROM public.categories WHERE slug='twk-pancasila' LIMIT 1),
  c_twk_konstitusi AS (SELECT id FROM public.categories WHERE slug='twk-konstitusi' LIMIT 1),
  c_tiu_deret AS (SELECT id FROM public.categories WHERE slug='tiu-deret' LIMIT 1),
  c_tiu_logika AS (SELECT id FROM public.categories WHERE slug='tiu-logika' LIMIT 1),
  c_tkp_pelayanan AS (SELECT id FROM public.categories WHERE slug='tkp-pelayanan' LIMIT 1),
  c_tkp_jejaring AS (SELECT id FROM public.categories WHERE slug='tkp-jejaring' LIMIT 1),
  c_eko_makro AS (SELECT id FROM public.categories WHERE slug='ekonomi-makro' LIMIT 1),
  c_eko_mikro AS (SELECT id FROM public.categories WHERE slug='ekonomi-mikro' LIMIT 1),
  c_math_alg AS (SELECT id FROM public.categories WHERE slug='matematika-aljabar' LIMIT 1),
  c_math_stat AS (SELECT id FROM public.categories WHERE slug='matematika-statistika' LIMIT 1),
  c_en_grammar AS (SELECT id FROM public.categories WHERE slug='inggris-grammar' LIMIT 1),
  c_en_reading AS (SELECT id FROM public.categories WHERE slug='inggris-reading' LIMIT 1)
INSERT INTO public.questions (
  legacy_id, category_id, question_text, question_type, options, answer_key, discussion
)
VALUES
  (
    'seed:skd:twk:1', (SELECT id FROM c_twk_pancasila),
    'Nilai Pancasila yang menekankan persatuan bangsa adalah sila ke-',
    'multiple_choice',
    '[{"key":"A","text":"Pertama"},{"key":"B","text":"Kedua"},{"key":"C","text":"Ketiga"},{"key":"D","text":"Keempat"}]'::jsonb,
    '{"correct":"C","score":5}'::jsonb,
    'Sila ketiga Pancasila berbunyi Persatuan Indonesia.'
  ),
  (
    'seed:skd:twk:2', (SELECT id FROM c_twk_konstitusi),
    'Lembaga yang berwenang menguji UU terhadap UUD 1945 adalah',
    'multiple_choice',
    '[{"key":"A","text":"Mahkamah Agung"},{"key":"B","text":"Mahkamah Konstitusi"},{"key":"C","text":"DPR"},{"key":"D","text":"BPK"}]'::jsonb,
    '{"correct":"B","score":5}'::jsonb,
    'MK berwenang menguji UU terhadap UUD (judicial review).' 
  ),
  (
    'seed:skd:tiu:1', (SELECT id FROM c_tiu_deret),
    'Deret: 3, 6, 12, 24, ... suku berikutnya adalah',
    'multiple_choice',
    '[{"key":"A","text":"30"},{"key":"B","text":"36"},{"key":"C","text":"42"},{"key":"D","text":"48"}]'::jsonb,
    '{"correct":"D","score":5}'::jsonb,
    'Pola dikali 2, sehingga 24×2=48.'
  ),
  (
    'seed:skd:tiu:2', (SELECT id FROM c_tiu_logika),
    'Semua A adalah B. Tidak ada B yang C. Maka:',
    'multiple_choice',
    '[{"key":"A","text":"Semua A adalah C"},{"key":"B","text":"Tidak ada A yang C"},{"key":"C","text":"Sebagian A adalah C"},{"key":"D","text":"Sebagian C adalah A"}]'::jsonb,
    '{"correct":"B","score":5}'::jsonb,
    'Jika A ⊆ B dan B ∩ C = ∅ maka A ∩ C = ∅.'
  ),
  (
    'seed:skd:tkp:1', (SELECT id FROM c_tkp_pelayanan),
    'Warga kesulitan mengisi formulir online. Sikap terbaik Anda:',
    'scale_tkp',
    '[{"key":"A","text":"Menyuruh kembali besok"},{"key":"B","text":"Memberi panduan lalu pergi"},{"key":"C","text":"Membantu langsung dan memberi contoh"},{"key":"D","text":"Meminta menunggu tanpa kepastian"}]'::jsonb,
    '{"A":1,"B":2,"C":5,"D":0}'::jsonb,
    'TKP menilai prioritas pelayanan dan empati.'
  ),
  (
    'seed:skd:tkp:2', (SELECT id FROM c_tkp_jejaring),
    'Anda perlu koordinasi lintas tim untuk tugas mendesak. Tindakan terbaik:',
    'scale_tkp',
    '[{"key":"A","text":"Kerjakan sendiri agar cepat"},{"key":"B","text":"Minta bantuan tapi tanpa info jelas"},{"key":"C","text":"Koordinasi, bagi tugas, dan pastikan update"},{"key":"D","text":"Tunda sampai rapat berikutnya"}]'::jsonb,
    '{"A":2,"B":3,"C":5,"D":1}'::jsonb,
    'Jejaring kerja menekankan kolaborasi dan komunikasi.'
  ),

  (
    'seed:skb:ekonomi:1', (SELECT id FROM c_eko_makro),
    'Inflasi adalah',
    'multiple_choice',
    '[{"key":"A","text":"Kenaikan harga umum secara terus-menerus"},{"key":"B","text":"Penurunan harga umum secara terus-menerus"},{"key":"C","text":"Kenaikan produksi"},{"key":"D","text":"Kenaikan nilai tukar"}]'::jsonb,
    '{"correct":"A","score":5}'::jsonb,
    'Definisi inflasi: kenaikan tingkat harga umum secara berkelanjutan.'
  ),
  (
    'seed:skb:ekonomi:2', (SELECT id FROM c_eko_mikro),
    'Hukum permintaan menyatakan bahwa jika harga naik, maka jumlah diminta cenderung',
    'multiple_choice',
    '[{"key":"A","text":"Naik"},{"key":"B","text":"Turun"},{"key":"C","text":"Tetap"},{"key":"D","text":"Tidak dapat ditentukan"}]'::jsonb,
    '{"correct":"B","score":5}'::jsonb,
    'Ceteris paribus, harga naik → quantity demanded turun.'
  ),
  (
    'seed:skb:matematika:1', (SELECT id FROM c_math_alg),
    'Jika 2x + 3 = 11, maka x =',
    'multiple_choice',
    '[{"key":"A","text":"2"},{"key":"B","text":"3"},{"key":"C","text":"4"},{"key":"D","text":"5"}]'::jsonb,
    '{"correct":"C","score":5}'::jsonb,
    '2x=8 → x=4.'
  ),
  (
    'seed:skb:matematika:2', (SELECT id FROM c_math_stat),
    'Mean dari data 2, 4, 6, 8 adalah',
    'multiple_choice',
    '[{"key":"A","text":"4"},{"key":"B","text":"5"},{"key":"C","text":"6"},{"key":"D","text":"7"}]'::jsonb,
    '{"correct":"B","score":5}'::jsonb,
    '(2+4+6+8)/4 = 5.'
  ),
  (
    'seed:skb:inggris:1', (SELECT id FROM c_en_grammar),
    'Choose the correct sentence:',
    'multiple_choice',
    '[{"key":"A","text":"He go to school every day."},{"key":"B","text":"He goes to school every day."},{"key":"C","text":"He going to school every day."},{"key":"D","text":"He gone to school every day."}]'::jsonb,
    '{"correct":"B","score":5}'::jsonb,
    'Simple present untuk he/she/it memakai -s/-es.'
  ),
  (
    'seed:skb:inggris:2', (SELECT id FROM c_en_reading),
    'Main idea of a paragraph is',
    'multiple_choice',
    '[{"key":"A","text":"The smallest detail"},{"key":"B","text":"The central point"},{"key":"C","text":"A random fact"},{"key":"D","text":"A title only"}]'::jsonb,
    '{"correct":"B","score":5}'::jsonb,
    'Main idea = gagasan utama (pusat pembahasan).' 
  )
ON CONFLICT (legacy_id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  question_text = EXCLUDED.question_text,
  question_type = EXCLUDED.question_type,
  options = EXCLUDED.options,
  answer_key = EXCLUDED.answer_key,
  discussion = EXCLUDED.discussion,
  updated_at = now();

-- Institutions
INSERT INTO public.institutions (code, name)
VALUES
  ('STAN', 'Politeknik Keuangan Negara STAN'),
  ('STIS', 'Politeknik Statistika STIS')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();

-- Blueprints (STAN: ekonomi + inggris, STIS: matematika + inggris)
WITH
  inst_stan AS (SELECT id FROM public.institutions WHERE code='STAN' LIMIT 1),
  inst_stis AS (SELECT id FROM public.institutions WHERE code='STIS' LIMIT 1),
  cat_ekonomi AS (SELECT id FROM public.categories WHERE slug='ekonomi' LIMIT 1),
  cat_matematika AS (SELECT id FROM public.categories WHERE slug='matematika' LIMIT 1),
  cat_inggris AS (SELECT id FROM public.categories WHERE slug='inggris' LIMIT 1)
INSERT INTO public.exam_blueprints (institution_id, category_id, question_count, passing_grade)
VALUES
  ((SELECT id FROM inst_stan), (SELECT id FROM cat_ekonomi), 2, NULL),
  ((SELECT id FROM inst_stan), (SELECT id FROM cat_inggris), 2, NULL),
  ((SELECT id FROM inst_stis), (SELECT id FROM cat_matematika), 2, NULL),
  ((SELECT id FROM inst_stis), (SELECT id FROM cat_inggris), 2, NULL)
ON CONFLICT (institution_id, category_id) DO UPDATE SET
  question_count = EXCLUDED.question_count,
  passing_grade = EXCLUDED.passing_grade,
  updated_at = now();

COMMIT;
