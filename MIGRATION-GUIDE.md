# 🔄 Panduan Migrasi Database

Panduan lengkap untuk menjalankan SQL migrations di Supabase.

---

## ⚠️ PENTING: Jika Import Soal Error

Jika Anda mengalami error saat import soal seperti:
```
❌ Could not find the 'question_image_url' column of 'questions' in the schema cache
```

**Penyebab:** Migrasi database belum dijalankan.

**Solusi:** Jalankan semua SQL migrations di bawah ini secara berurutan.

---

## 📋 Daftar Migrations

Jalankan SQL migrations dalam urutan berikut:

### 1. ✅ Core Categories Schema
**File:** `supabase/migrate-to-categories-schema.sql`
**Deskripsi:** Schema dasar untuk hierarchical categories, questions, exam packages
**Wajib:** Ya

### 2. ✅ Institutions & Blueprints
**File:** `supabase/add-institutions-blueprints.sql`
**Deskripsi:** Schema untuk SKB institutions dan exam blueprints
**Wajib:** Ya (untuk SKB tryout)

### 3. ✅ SKB RPC Functions
**File:** `supabase/skb-blueprints-rpc.sql`
**Deskripsi:** Function untuk generate soal SKB berdasarkan blueprint
**Wajib:** Ya (untuk SKB tryout)

### 4. ✅ Real Tryout RPC Functions
**File:** `supabase/tryout-real-rpc.sql`
**Deskripsi:** Functions untuk start dan submit tryout real (SKD & SKB)
**Wajib:** Ya (untuk tryout real)

### 5. ✅ Practice Mode RPC Functions
**File:** `supabase/practice-mode-rpc.sql`
**Deskripsi:** Function untuk random question picking (practice mode)
**Wajib:** Ya (untuk practice mode)

### 6. ✅ Figural Questions Support
**File:** `supabase/add-figural-support.sql`
**Deskripsi:** Menambahkan kolom `question_image_url` dan type `figural`
**Wajib:** Ya (untuk soal figural dan fix import error)

---

## 🚀 Cara Menjalankan Migrations

### Step 1: Buka Supabase SQL Editor

1. Login ke [Supabase Dashboard](https://app.supabase.com/)
2. Pilih project Anda
3. Klik **"SQL Editor"** di sidebar kiri
4. Klik **"New query"**

### Step 2: Copy & Paste SQL

1. Buka file SQL migration (misal: `supabase/add-figural-support.sql`)
2. Copy seluruh isi file
3. Paste ke SQL Editor
4. Klik **"Run"** (atau tekan Ctrl+Enter)

### Step 3: Verifikasi

Cek apakah migrasi berhasil:
```sql
-- Cek kolom baru
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'questions' 
  AND column_name LIKE '%image%';

-- Should return:
-- question_image_url | text
-- question_image_alt | text
```

### Step 4: Ulangi untuk Semua Migrations

Jalankan semua file SQL migrations secara berurutan (1-6).

---

## 🔧 Fix Specific Errors

### Error: "question_image_url column not found"

**Solution:** Run `supabase/add-figural-support.sql`

```sql
-- Quick fix: Run this SQL
BEGIN;

ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS question_image_url text,
  ADD COLUMN IF NOT EXISTS question_image_alt text;

COMMIT;
```

### Error: "function start_skd_tryout does not exist"

**Solution:** Run `supabase/tryout-real-rpc.sql`

### Error: "table institutions does not exist"

**Solution:** Run `supabase/add-institutions-blueprints.sql`

### Error: "type question_type enum does not have value figural"

**Solution:** Run this SQL:
```sql
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'figural';
```

---

## 📝 Manual Migration (Quick Fix)

Jika Anda hanya perlu fix import error secepat mungkin, jalankan SQL ini:

```sql
-- Quick fix untuk import soal
BEGIN;

-- 1. Add figural type to enum (if not exists)
DO $$
BEGIN
  ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'figural';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add image columns (if not exists)
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS question_image_url text,
  ADD COLUMN IF NOT EXISTS question_image_alt text;

COMMIT;

-- 3. Verify
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'questions' 
  AND column_name LIKE '%image%';
```

Copy SQL di atas → Paste ke Supabase SQL Editor → Run

**Setelah run SQL ini, import soal Anda seharusnya berhasil!** ✅

---

## 🔍 Troubleshooting

### Problem: Migration gagal dengan error "duplicate column"

**Cause:** Kolom sudah ada (migration sudah pernah dijalankan)

**Solution:** 
- Skip migration tersebut, atau
- Gunakan `ADD COLUMN IF NOT EXISTS` (sudah ada di migration files)

### Problem: Migration gagal dengan error "permission denied"

**Cause:** User tidak punya permission untuk ALTER TABLE

**Solution:**
- Pastikan Anda login sebagai project owner
- Atau gunakan service_role key di SQL Editor

### Problem: Schema cache not updated

**Cause:** Supabase client cache belum refresh

**Solution:**
1. **Restart development server**: Stop dan start ulang `npm run dev`
2. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
3. **Re-deploy**: Deploy ulang aplikasi jika di production

### Problem: Import masih error setelah run migration

**Solution:**
1. Verify kolom sudah ada:
   ```sql
   \d questions
   ```
2. Restart dev server
3. Clear browser cache
4. Coba import lagi

---

## ✅ Verification Checklist

Setelah run semua migrations, cek:

### Database Structure
```sql
-- Cek tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should include:
-- ✅ categories
-- ✅ questions
-- ✅ exam_packages
-- ✅ exam_questions
-- ✅ institutions
-- ✅ exam_blueprints
-- ✅ tryout_sessions
-- ✅ tryout_session_questions
```

### Columns
```sql
-- Cek kolom questions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'questions'
ORDER BY column_name;

-- Should include:
-- ✅ question_image_url (text)
-- ✅ question_image_alt (text)
```

### Enums
```sql
-- Cek enum types
SELECT e.enumlabel 
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'question_type';

-- Should include:
-- ✅ multiple_choice
-- ✅ scale_tkp
-- ✅ figural
```

### Functions
```sql
-- Cek RPC functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Should include:
-- ✅ start_skd_tryout
-- ✅ start_category_tryout
-- ✅ start_institution_tryout
-- ✅ submit_tryout_session
-- ✅ pick_random_questions
-- ✅ generate_institution_questions
```

---

## 🎯 Best Practices

### 1. Backup Before Migration

```sql
-- Backup important tables
CREATE TABLE questions_backup AS SELECT * FROM questions;
CREATE TABLE categories_backup AS SELECT * FROM categories;
```

### 2. Run Migrations in Transaction

```sql
BEGIN;
  -- Your migration SQL here
  ALTER TABLE ...
COMMIT; -- or ROLLBACK if error
```

### 3. Test After Migration

1. ✅ Import 1-2 test questions
2. ✅ Create test tryout
3. ✅ Test practice mode
4. ✅ Verify data integrity

### 4. Document Changes

Keep track of which migrations you've run:
```
✅ migrate-to-categories-schema.sql - 2025-01-15
✅ add-institutions-blueprints.sql - 2025-01-15
✅ add-figural-support.sql - 2025-01-16
```

---

## 📞 Support

Jika masih mengalami masalah:

1. 📖 Baca error message dengan teliti
2. 🔍 Cek verification queries di atas
3. 🧪 Test dengan data minimal dulu
4. 💾 Restore dari backup jika perlu

---

## 🔄 Rolling Back Migrations

Jika perlu rollback migration:

```sql
BEGIN;

-- Rollback figural support
ALTER TABLE public.questions 
  DROP COLUMN IF EXISTS question_image_url,
  DROP COLUMN IF EXISTS question_image_alt;

-- Note: Cannot remove enum values easily in PostgreSQL
-- Need to recreate the enum type

COMMIT;
```

**Warning:** Rollback akan menghapus data di kolom tersebut!

---

## 📚 Additional Resources

- **Supabase Migrations Docs**: https://supabase.com/docs/guides/cli/managing-environments
- **PostgreSQL ALTER TABLE**: https://www.postgresql.org/docs/current/sql-altertable.html
- **PostgreSQL Enums**: https://www.postgresql.org/docs/current/datatype-enum.html

---

**Selamat melakukan migrasi! 🚀**
