# 🔧 Panduan Memperbaiki Error "SKD categories not found"

Jika Anda mendapatkan error **"SKD categories (twk/tiu/tkp) not found"** saat memulai tryout, berikut solusinya.

---

## 🎯 Penjelasan Masalah

Error ini terjadi karena **parent categories (`twk`, `tiu`, `tkp`) belum dibuat** di database. 

### Struktur yang Diharapkan:

```
skd (root)
├── twk (Tes Wawasan Kebangsaan)
│   ├── twk-pancasila
│   ├── twk-nasionalisme
│   ├── twk-pilar-negara
│   └── ... (sub-topics lainnya)
├── tiu (Tes Intelegensi Umum)
│   ├── tiu-numerik-deret
│   ├── tiu-verbal-analogi
│   ├── tiu-verbal-silogisme
│   └── ... (sub-topics lainnya)
└── tkp (Tes Karakteristik Pribadi)
    ├── tkp-pelayanan-publik
    ├── tkp-jejaring-kerja
    ├── tkp-profesionalisme
    └── ... (sub-topics lainnya)
```

### Yang Terjadi:

Kemungkinan Anda sudah import soal-soal dengan category seperti `tiu-numerik-deret`, `tkp-pelayanan-publik`, dll, tetapi **parent categories-nya (`twk`, `tiu`, `tkp`) belum dibuat**.

RPC function `start_skd_tryout` memerlukan categories dengan slug `twk`, `tiu`, dan `tkp` untuk bisa mengambil soal dari semua sub-categories mereka.

---

## ✅ Solusi (2 Cara)

### Cara 1: Menggunakan SQL Script (RECOMMENDED) 🚀

**Langkah:**

1. **Buka Supabase Dashboard**
   - Login ke https://app.supabase.com
   - Pilih project Anda
   - Klik **SQL Editor** di sidebar kiri

2. **Jalankan Fix Script**
   - Copy isi file `supabase/fix-skd-categories.sql`
   - Paste di SQL Editor
   - Klik tombol **"Run"** atau tekan `Ctrl+Enter`

3. **Verifikasi**
   Jika berhasil, Anda akan melihat output seperti:
   ```
   ✅ Categories structure fixed successfully!
   SKD ID: <uuid>
   TWK ID: <uuid> (X sub-categories)
   TIU ID: <uuid> (X sub-categories)
   TKP ID: <uuid> (X sub-categories)
   
   ✅ You can now start SKD tryouts!
   ```

4. **Test Tryout**
   - Refresh aplikasi Anda
   - Coba start tryout SKD
   - Seharusnya sudah bisa berjalan! ✅

---

### Cara 2: Menggunakan Admin Panel (Manual)

Jika Anda ingin membuat categories secara manual via UI:

1. **Buka Admin Panel**
   - http://localhost:3000/admin/categories

2. **Buat Root Category**
   - Klik **"+ Tambah Kategori"**
   - Isi form:
     - Name: `SKD (Seleksi Kompetensi Dasar)`
     - Slug: `skd`
     - Parent: (kosongkan)
     - Type: `subject`
   - Klik **"Simpan"**

3. **Buat Main Categories (TWK, TIU, TKP)**
   
   **TWK:**
   - Klik **"+ Tambah Kategori"**
   - Name: `TWK (Tes Wawasan Kebangsaan)`
   - Slug: `twk`
   - Parent: `SKD (Seleksi Kompetensi Dasar)`
   - Type: `topic`
   - Simpan
   
   **TIU:**
   - Klik **"+ Tambah Kategori"**
   - Name: `TIU (Tes Intelegensi Umum)`
   - Slug: `tiu`
   - Parent: `SKD (Seleksi Kompetensi Dasar)`
   - Type: `topic`
   - Simpan
   
   **TKP:**
   - Klik **"+ Tambah Kategori"**
   - Name: `TKP (Tes Karakteristik Pribadi)`
   - Slug: `tkp`
   - Parent: `SKD (Seleksi Kompetensi Dasar)`
   - Type: `topic`
   - Simpan

4. **Update Sub-Categories**
   - Cari semua categories dengan slug seperti `twk-*`, `tiu-*`, `tkp-*`
   - Edit satu per satu
   - Set Parent ke category yang sesuai:
     - `twk-*` → Parent: `TWK`
     - `tiu-*` → Parent: `TIU`
     - `tkp-*` → Parent: `TKP`
   - Set Type: `subtopic`

⚠️ **Catatan:** Cara manual ini memakan waktu jika sub-categories-nya banyak. Lebih baik gunakan **Cara 1 (SQL Script)**.

---

## 🧪 Testing

Setelah fix, test dengan cara:

### Test via RPC (SQL Editor)

```sql
-- Test start_skd_tryout
SELECT * FROM public.start_skd_tryout(
  p_duration_minutes := 100,
  p_take_tiu := 5,
  p_take_tkp := 5,
  p_take_twk := 5
);
```

Jika tidak error, berarti berhasil! ✅

### Test via UI

1. Buka aplikasi: http://localhost:3000
2. Klik **"Tryout Real SKD"**
3. Tryout seharusnya bisa start tanpa error

---

## 📊 Verifikasi Struktur Categories

Untuk cek struktur categories Anda:

```sql
-- Lihat hierarchy categories
WITH RECURSIVE tree AS (
  SELECT 
    id, slug, name, parent_id, type, 0 AS level,
    slug::text AS path
  FROM public.categories
  WHERE parent_id IS NULL

  UNION ALL

  SELECT 
    c.id, c.slug, c.name, c.parent_id, c.type, t.level + 1,
    t.path || ' > ' || c.slug
  FROM public.categories c
  JOIN tree t ON c.parent_id = t.id
)
SELECT 
  repeat('  ', level) || name AS category,
  slug,
  type,
  (SELECT count(*) FROM public.questions WHERE category_id = tree.id) AS question_count
FROM tree
WHERE path LIKE '%skd%'
ORDER BY path;
```

Output yang diharapkan:
```
SKD (Seleksi Kompetensi Dasar)          | skd                    | subject  | 0
  TWK (Tes Wawasan Kebangsaan)          | twk                    | topic    | 0
    Pancasila & UUD 1945                | twk-pancasila          | subtopic | 20
    Nasionalisme                        | twk-nasionalisme       | subtopic | 15
    ...
  TIU (Tes Intelegensi Umum)            | tiu                    | topic    | 0
    Deret Angka                         | tiu-numerik-deret      | subtopic | 20
    Analogi Verbal                      | tiu-verbal-analogi     | subtopic | 20
    ...
  TKP (Tes Karakteristik Pribadi)       | tkp                    | topic    | 0
    Pelayanan Publik                    | tkp-pelayanan-publik   | subtopic | 20
    Jejaring Kerja                      | tkp-jejaring-kerja     | subtopic | 15
    ...
```

---

## 🔍 Troubleshooting

### Problem: "Category 'xxx' already exists"

**Solution:** Tidak masalah! Script menggunakan `ON CONFLICT DO UPDATE`, jadi akan update data yang sudah ada tanpa error.

### Problem: "No sub-categories found after fix"

**Cause:** Mungkin sub-categories Anda tidak mengikuti naming pattern `twk-*`, `tiu-*`, `tkp-*`.

**Solution:**
1. Cek slug categories yang ada:
   ```sql
   SELECT slug, name, type FROM categories WHERE parent_id IS NULL;
   ```
2. Jika slug-nya beda (misalnya `deret`, `logika`), Anda perlu update manual:
   ```sql
   -- Contoh: set parent untuk category 'deret'
   UPDATE public.categories
   SET parent_id = (SELECT id FROM categories WHERE slug = 'tiu')
   WHERE slug = 'deret';
   ```

### Problem: "Still getting the same error after fix"

**Possible causes:**
1. Script belum dijalankan dengan benar
2. Database cache (refresh browser)
3. Ada issue di RPC function

**Solution:**
1. Restart dev server
2. Clear browser cache
3. Check logs di Supabase Dashboard → Logs

---

## 💡 Best Practices

### Import Workflow yang Benar:

```
1. Buat struktur categories (parent dulu!)
   - SKD (root)
     ├── TWK (parent)
     ├── TIU (parent)
     └── TKP (parent)

2. Buat sub-categories
   - twk-pancasila (child of TWK)
   - tiu-numerik-deret (child of TIU)
   - tkp-pelayanan-publik (child of TKP)
   - ...

3. Import soal
   - Soal dengan category_slug akan otomatis link ke category yang ada
```

### Gunakan Seed.sql untuk Fresh Install:

Jika Anda baru setup project, lebih baik jalankan `seed.sql` yang sudah lengkap:

```bash
# Di Supabase SQL Editor, jalankan file-file ini secara berurutan:
1. migrate-to-categories-schema.sql (create tables)
2. add-institutions-blueprints.sql (for SKB)
3. seed.sql (seed data lengkap)
4. tryout-real-rpc.sql (RPC functions)
```

---

## 📞 Support

Jika masih error setelah mengikuti guide ini:

1. ✅ Pastikan script sudah dijalankan dengan sukses (cek output di SQL Editor)
2. ✅ Restart dev server (`npm run dev`)
3. ✅ Cek logs di terminal dan browser console
4. ✅ Verifikasi struktur categories dengan query di atas

---

**Selamat mencoba! 🚀**

Jika fix berhasil, Anda bisa mulai tryout SKD dengan sempurna.
