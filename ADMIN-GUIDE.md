# 📚 Panduan Admin - Aplikasi Tryout Sekolah Kedinasan

Panduan lengkap untuk admin dalam mengelola soal, kategori, institutions, dan tryout.

---

## 📋 Daftar Isi

1. [Setup Database](#setup-database)
2. [Struktur Database](#struktur-database)
3. [Akses Admin Panel](#akses-admin-panel)
4. [Mengelola Bank Soal](#mengelola-bank-soal)
5. [Mengelola Kategori](#mengelola-kategori)
6. [Mengelola Institutions & Blueprints](#mengelola-institutions--blueprints)
7. [Tips & Best Practices](#tips--best-practices)

---

## 🚀 Setup Database

### 1. Jalankan Migration Files

Jalankan file SQL berikut secara berurutan di **Supabase SQL Editor**:

#### a. Schema Utama
```sql
-- File: supabase/migrate-to-categories-schema.sql
-- Membuat tabel: categories, questions, exam_packages, user_exam_sessions, user_answers
```

#### b. Institutions & Blueprints
```sql
-- File: supabase/add-institutions-blueprints.sql
-- Membuat tabel: institutions, exam_blueprints
```

#### c. RPC Functions
```sql
-- File: supabase/skb-blueprints-rpc.sql
-- Function untuk generate soal SKB berdasarkan blueprint

-- File: supabase/tryout-real-rpc.sql
-- Function untuk tryout real dengan timer

-- File: supabase/practice-mode-rpc.sql
-- Function untuk mode latihan
```

#### d. Seed Data (Opsional)
```sql
-- File: supabase/seed.sql
-- Data sample untuk testing
```

### 2. Reload Schema PostgREST

Setelah menjalankan semua SQL, reload schema:

```sql
NOTIFY pgrst, 'reload schema';
```

### 3. Set Admin Role

Update user menjadi admin di Supabase Dashboard:

1. Buka **Authentication** → **Users**
2. Pilih user yang akan dijadikan admin
3. Buka **User Metadata** dan tambahkan:
   ```json
   {
     "role": "admin"
   }
   ```

---

## 🗄️ Struktur Database

### Tabel Utama

#### **categories** - Kategori Hierarkis (SKD/SKB)
```sql
id          uuid PRIMARY KEY
legacy_id   text UNIQUE
name        text NOT NULL              -- Nama kategori (e.g., "TIU", "Bilangan Deret")
slug        text UNIQUE                -- URL-friendly (e.g., "tiu", "bilangan-deret")
parent_id   uuid → categories(id)      -- Parent category (null = root)
type        category_type              -- 'subject', 'topic', 'subtopic'
```

**Struktur Hierarki:**
```
SKD
├── TWK (Tes Wawasan Kebangsaan)
│   ├── Pancasila
│   ├── UUD 1945
│   └── Bhinneka Tunggal Ika
├── TIU (Tes Intelegensi Umum)
│   ├── Bilangan Deret
│   ├── Silogisme
│   └── Analogi
└── TKP (Tes Karakteristik Pribadi)
    ├── Integritas
    └── Kerjasama

SKB
├── Ekonomi
│   ├── Mikroekonomi
│   └── Makroekonomi
└── Matematika
    ├── Aljabar
    └── Geometri
```

#### **questions** - Bank Soal
```sql
id              uuid PRIMARY KEY
category_id     uuid → categories(id)       -- Kategori soal
question_text   text NOT NULL               -- Teks soal
question_type   question_type               -- 'multiple_choice' atau 'scale_tkp'
options         jsonb                       -- Array pilihan jawaban
answer_key      jsonb                       -- Kunci jawaban
discussion      text                        -- Pembahasan (opsional)
```

**Format options (Multiple Choice):**
```json
[
  { "key": "A", "text": "Pilihan A" },
  { "key": "B", "text": "Pilihan B" },
  { "key": "C", "text": "Pilihan C" },
  { "key": "D", "text": "Pilihan D" },
  { "key": "E", "text": "Pilihan E" }
]
```

**Format answer_key (Multiple Choice):**
```json
{
  "correct": "A",
  "score": 5
}
```

**Format options (TKP - Scale):**
```json
[
  { "key": "A", "text": "Sangat tidak setuju" },
  { "key": "B", "text": "Tidak setuju" },
  { "key": "C", "text": "Netral" },
  { "key": "D", "text": "Setuju" },
  { "key": "E", "text": "Sangat setuju" }
]
```

**Format answer_key (TKP - Scale):**
```json
{
  "A": 1,
  "B": 2,
  "C": 3,
  "D": 4,
  "E": 5
}
```

#### **institutions** - Sekolah Kedinasan
```sql
id        uuid PRIMARY KEY
code      text UNIQUE              -- Kode (e.g., "STAN", "STIS")
name      text NOT NULL            -- Nama lengkap
logo_url  text                     -- URL logo (opsional)
```

#### **exam_blueprints** - Resep Komposisi Soal SKB
```sql
id              uuid PRIMARY KEY
institution_id  uuid → institutions(id)
category_id     uuid → categories(id)      -- Kategori yang diambil
question_count  int NOT NULL               -- Jumlah soal
passing_grade   numeric                    -- Nilai minimum lulus
```

**Contoh Blueprint STAN:**
| Institution | Category | Question Count |
|-------------|----------|----------------|
| STAN        | Ekonomi  | 40             |
| STAN        | Inggris  | 20             |

---

## 🔐 Akses Admin Panel

### Login sebagai Admin

1. Buka aplikasi: `http://localhost:3000`
2. Login dengan akun yang sudah di-set sebagai admin
3. Klik **"Admin"** di sidebar atau navigasi
4. Dashboard admin akan menampilkan statistik:
   - Total Soal
   - Total Kategori
   - Total Sekolah/Instansi
   - Total Blueprints

---

## 📝 Mengelola Bank Soal

### Menambah Soal Baru

1. **Masuk Admin Panel** → **Bank Soal**
2. Klik **"Tambah Soal"**
3. Isi form:
   - **Section (Kategori Induk):** Pilih TWK/TIU/TKP atau kategori SKB
   - **Topic (Sub-kategori):** Pilih sub-topik spesifik
   - **Pertanyaan:** Tulis teks soal
   - **Tipe Soal:**
     - **Multiple Choice:** Pilihan ganda biasa (ada jawaban benar)
     - **Figural:** Soal dengan gambar (untuk pola, analogi visual)
     - **TKP Scale:** Skala penilaian (semua jawaban punya skor)

#### Untuk Multiple Choice:

4. **Pilihan Jawaban:** Tambah 4-5 pilihan (A, B, C, D, E)
5. **Jawaban Benar:** Pilih jawaban yang benar
6. **Skor:** Tentukan skor untuk jawaban benar (default: 5)
7. **Pembahasan:** (Opsional) Tulis penjelasan jawaban

**Contoh Soal Multiple Choice:**
```
Pertanyaan: Berapa hasil dari 2 + 2?
Tipe: Multiple Choice
Pilihan:
  A. 3
  B. 4   ← Benar
  C. 5
  D. 6
  E. 7
Skor: 5
Pembahasan: 2 + 2 = 4 (operasi penjumlahan dasar)
```

#### Untuk TKP Scale:

4. **Pilihan Jawaban:** Tambah pilihan skala (biasanya 5 opsi A-E)
5. **Score Map:** Tentukan skor untuk setiap pilihan (WAJIB skala 1-5, tidak boleh 0)
   - Untuk pernyataan positif: A=1, B=2, C=3, D=4, E=5
   - Untuk pernyataan negatif: A=5, B=4, C=3, D=2, E=1
   - Semua opsi harus memiliki skor antara 1-5 (likert scale)

**Contoh Soal TKP:**
```
Pertanyaan: Saya selalu berusaha menyelesaikan pekerjaan tepat waktu
Tipe: TKP Scale
Pilihan & Skor:
  A. Sangat tidak setuju → 1
  B. Tidak setuju → 2
  C. Netral → 3
  D. Setuju → 4
  E. Sangat setuju → 5
```

#### Untuk Figural (Soal dengan Gambar):

4. **Upload Gambar Soal**: Klik "Choose File" → pilih gambar → tunggu upload
5. **Pilihan Jawaban**: Gunakan format `Key|Text|ImageURL`
   ```
   A|Gambar A|https://your-supabase-url/storage/.../option-a.jpg
   B|Gambar B|https://your-supabase-url/storage/.../option-b.jpg
   C|Gambar C|https://your-supabase-url/storage/.../option-c.jpg
   D|Gambar D|https://your-supabase-url/storage/.../option-d.jpg
   ```
6. **Jawaban Benar**: Pilih key yang benar
7. **Skor**: Tentukan skor (default: 5)
8. **Pembahasan**: Tulis penjelasan yang mendeskripsikan visual

**Contoh Soal Figural:**
```
Pertanyaan: Gambar manakah yang melanjutkan pola di atas?
Tipe: Figural
Gambar Soal: [Upload gambar pola: ■ □ ■ □ ■ ?]
Pilihan:
  A|Kotak hitam|https://.../black-square.jpg
  B|Kotak putih|https://.../white-square.jpg   ← Benar
  C|Lingkaran|https://.../circle.jpg
  D|Segitiga|https://.../triangle.jpg
Pembahasan: Pola alternating hitam-putih, selanjutnya putih
```

**Setup Supabase Storage:**
1. Buka Supabase Dashboard → Storage
2. Create bucket: `question-images` (public)
3. Upload gambar ke folder `questions/` atau `options/`
4. Copy public URL dan paste ke form

📖 **[Lihat FIGURAL-GUIDE.md](./FIGURAL-GUIDE.md) untuk panduan lengkap soal figural**

#### Untuk Soal Matematika & Fisika (dengan Rumus):

✨ **BARU**: Support LaTeX Math Notation!

**Inline Math:**
```
Jika $x = 2$ dan $y = 3$, maka $x + y = ?$
```

**Display Math:**
```
Rumus kuadrat:
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
```

**Contoh Soal:**
```
Pertanyaan: Energi kinetik $E_k = \frac{1}{2}mv^2$. Jika $m = 2$ kg dan $v = 5$ m/s, maka...
Pilihan:
  A. $10$ J
  B. $25$ J   ← Benar
  C. $50$ J
  D. $100$ J
Pembahasan: $$E_k = \frac{1}{2} \times 2 \times 5^2 = 25 \text{ J}$$
```

**Fitur:**
- ✅ Live preview di admin form
- ✅ Auto-render di tryout runner
- ✅ Support semua LaTeX math symbols
- ✅ Inline ($...$) dan display ($$...$$) math
- ✅ Rumus di soal, pilihan, dan pembahasan

📐 **[Lihat MATH-GUIDE.md](./MATH-GUIDE.md) untuk syntax lengkap, contoh soal, dan tips**

### Mengedit Soal

1. **Bank Soal** → Cari soal yang ingin diedit
2. Klik **"Edit"** pada soal tersebut
3. Update field yang diperlukan
4. Klik **"Simpan"**

### Menghapus Soal

1. **Bank Soal** → Cari soal yang ingin dihapus
2. Klik **"Hapus"**
3. Konfirmasi penghapusan

⚠️ **Warning:** Soal yang sudah digunakan dalam tryout akan tetap terhapus.

### Import Soal dari JSON (Bulk Upload)

✨ **BARU**: Untuk menambahkan banyak soal sekaligus!

1. **Admin Panel** → **Bank Soal** → **📤 Import JSON**
2. Download template: `templates/import-questions-template.json`
3. Isi template dengan soal-soal Anda
4. Upload file JSON
5. Klik **"Validasi File"** → Cek preview dan errors
6. Jika OK, klik **"Import Soal"**

**Keuntungan:**
- ✅ Upload 50-100 soal sekaligus
- ✅ Validasi otomatis sebelum import
- ✅ Error reporting per baris
- ✅ Preview soal sebelum commit
- ✅ Cocok untuk migrasi dari sistem lain

📖 **[Lihat IMPORT-GUIDE.md](./IMPORT-GUIDE.md) untuk panduan lengkap format JSON dan troubleshooting**

---

## 📁 Mengelola Kategori

✨ **BARU**: Sekarang ada UI Admin untuk mengelola kategori!

### Menambah Kategori via Admin Panel (Recommended)

1. **Admin Panel** → **Kategori**
2. Klik **"+ Tambah Kategori"**
3. Isi form:
   - **Nama Kategori**: Nama yang tampil (e.g., "TWK", "Bilangan Deret")
   - **Slug**: URL-friendly, lowercase (e.g., "twk", "bilangan-deret")
   - **Parent**: Pilih parent jika ini sub-kategori (kosongkan untuk root)
   - **Tipe**: Subject (root), Topic (level 2), atau Subtopic (level 3)
4. Klik **"Tambah Kategori"**

**Contoh Penggunaan:**

1. **Buat Subject (Root):**
   ```
   Nama: Fisika
   Slug: fisika
   Parent: -- Root Category (No Parent) --
   Tipe: Subject
   ```

2. **Buat Topic (Child):**
   ```
   Nama: Mekanika
   Slug: mekanika
   Parent: Fisika (subject)
   Tipe: Topic
   ```

3. **Buat Subtopic (Grandchild):**
   ```
   Nama: Kinematika
   Slug: kinematika
   Parent: Mekanika (topic)
   Tipe: Subtopic
   ```

**Fitur Admin UI:**
- ✅ Hierarki visual dengan indentasi
- ✅ Jumlah soal per kategori
- ✅ Tambah sub-kategori langsung (tombol "+ Sub")
- ✅ Edit kategori
- ✅ Hapus kategori (dengan konfirmasi)
- ✅ Auto-generate slug dari nama
- ✅ Validasi slug unique

### Menambah Kategori via SQL (Alternative)

#### 1. Kategori Root (Subject)
```sql
INSERT INTO public.categories (name, slug, parent_id, type)
VALUES ('Fisika', 'fisika', NULL, 'subject');
```

#### 2. Kategori Child (Topic)
```sql
-- Ambil ID parent terlebih dahulu
SELECT id FROM public.categories WHERE slug = 'fisika';

-- Insert child category (ganti <parent_id> dengan UUID yang didapat)
INSERT INTO public.categories (name, slug, parent_id, type)
VALUES ('Mekanika', 'mekanika', '<parent_id>', 'topic');
```

#### 3. Sub-Kategori (Subtopic)
```sql
-- Ambil ID parent
SELECT id FROM public.categories WHERE slug = 'mekanika';

-- Insert subtopic (ganti <parent_id> dengan UUID yang didapat)
INSERT INTO public.categories (name, slug, parent_id, type)
VALUES ('Kinematika', 'kinematika', '<parent_id>', 'subtopic');
```

### Struktur Kategori SKD (Standard)

Aplikasi ini sudah menyediakan struktur SKD standar:

**TWK (Tes Wawasan Kebangsaan):**
- Pancasila
- UUD 1945
- Bhinneka Tunggal Ika
- NKRI

**TIU (Tes Intelegensi Umum):**
- Bilangan Deret
- Silogisme
- Analogi
- Hubungan Kata
- Pemecahan Masalah

**TKP (Tes Karakteristik Pribadi):**
- Integritas
- Kerjasama
- Komunikasi
- Kepemimpinan
- Adaptasi

### Tips Kategori:

- **Slug:** Harus unik, lowercase, gunakan dash (-)
- **Parent:** Root category punya `parent_id = NULL`
- **Type:** Gunakan `subject` → `topic` → `subtopic` untuk hierarki 3 tingkat

---

## 🏫 Mengelola Institutions & Blueprints

### Menambah Institution (Sekolah Kedinasan)

1. **Admin Panel** → **Institutions**
2. Klik **"Tambah Institution"**
3. Isi form:
   - **Code:** Kode singkat (uppercase, e.g., "STAN", "STIS", "IPDN")
   - **Name:** Nama lengkap (e.g., "Sekolah Tinggi Akuntansi Negara")
   - **Logo URL:** (Opsional) URL logo sekolah
4. Klik **"Simpan"**

**Contoh:**
```
Code: STAN
Name: Sekolah Tinggi Akuntansi Negara
Logo URL: https://example.com/logo-stan.png
```

### Membuat Blueprint Tryout SKB

Blueprint menentukan komposisi soal untuk setiap sekolah.

1. **Admin Panel** → **Blueprints**
2. Pilih **Institution** (sekolah target)
3. Klik **"Tambah Blueprint"**
4. Isi form:
   - **Category:** Pilih kategori soal (e.g., Ekonomi, Matematika, Inggris)
   - **Question Count:** Jumlah soal yang akan diambil dari kategori ini
   - **Passing Grade:** (Opsional) Nilai minimum untuk lulus
5. Klik **"Simpan"**

**Contoh Blueprint STAN:**
| Category | Question Count | Passing Grade |
|----------|----------------|---------------|
| Ekonomi  | 40             | 60            |
| Inggris  | 20             | 50            |
| **Total**| **60 soal**    | -             |

**Contoh Blueprint STIS:**
| Category   | Question Count | Passing Grade |
|------------|----------------|---------------|
| Matematika | 50             | 70            |
| Inggris    | 10             | 50            |
| **Total**  | **60 soal**    | -             |

### Cara Kerja Blueprint:

1. User memilih tryout SKB (misal: STAN)
2. System query blueprint STAN → ambil 40 soal Ekonomi + 20 soal Inggris
3. Soal dipilih **secara random** dari bank soal kategori terkait
4. User kerjakan tryout dengan timer
5. Scoring otomatis di server-side

---

## 🎯 Jenis Tryout dalam Aplikasi

### 1. **Tryout Real (Timer)**
- **Akses:** Dashboard → Pilih section → "Tryout Real ⏱️"
- **Fitur:**
  - Timer countdown (SKD: 100 menit, SKB: 60 menit)
  - Auto-submit saat waktu habis
  - Auto-submit saat semua soal dijawab
  - Scoring server-side (anti-cheat)
- **SKD:** Gabungan TWK (30 soal) + TIU (35 soal) + TKP (45 soal) = 110 soal
- **SKB:** Sesuai blueprint institution

### 2. **Latihan per Sub-Topik (Practice Mode)**
- **Akses:** Dashboard → Pilih section → "Latihan per Sub-Topik 📚" → Pilih sub-topik
- **Fitur:**
  - Tanpa timer (bebas kerjakan)
  - Pilih jumlah soal (10, 20, 30, 50, atau semua)
  - Langsung lihat hasil & pembahasan setelah submit
  - Review jawaban benar/salah per soal
- **Use Case:** Belajar mendalam untuk topik tertentu (misal: hanya Silogisme, atau Bilangan Deret)

### 3. **Tryout Biasa (Legacy)**
- **Akses:** Section detail → Pilih topic → Answer questions
- **Fitur:**
  - Tanpa timer
  - Pilih topic manual
  - Lihat hasil setelah submit

---

## 💡 Tips & Best Practices

### 1. Struktur Bank Soal

**✅ DO:**
- Buat kategori dari umum ke spesifik (subject → topic → subtopic)
- Gunakan slug yang konsisten dan mudah dibaca
- Tambahkan pembahasan untuk soal sulit
- Gunakan skor konsisten (e.g., semua MC = 5 poin)

**❌ DON'T:**
- Jangan duplikasi slug
- Jangan buat kategori terlalu dalam (max 3 level)
- Jangan lupa set category_id untuk setiap soal

### 2. Membuat Soal Berkualitas

**Multiple Choice:**
- Buat distractor (pilihan salah) yang masuk akal
- Hindari kata "selalu", "tidak pernah" di pilihan
- Jawaban benar jangan selalu di posisi yang sama
- Panjang pilihan sebaiknya seimbang

**TKP Scale:**
- **WAJIB gunakan skala 1-5** (tidak ada nilai 0)
- Skala likert: 5=paling tepat, 1=kurang tepat
- Pernyataan positif: A=1 (sangat tidak setuju) → E=5 (sangat setuju)
- Pernyataan negatif: A=5 (sangat tidak setuju) → E=1 (sangat setuju)
- Tidak ada jawaban salah, semua opsi harus memiliki skor antara 1-5

### 3. Blueprint Institution

**Rekomendasi:**
- Total soal SKB: 40-60 soal
- Durasi: 60-90 menit
- Komposisi: 60% materi utama, 40% materi pendukung
- Contoh STAN: 60% Ekonomi, 40% Inggris
- Contoh STIS: 70% Matematika, 30% Inggris

### 4. Maintenance Rutin

**Mingguan:**
- Review soal yang sering salah dijawab
- Update pembahasan jika ada feedback user
- Tambah soal baru untuk variasi

**Bulanan:**
- Audit kategori yang kurang soal
- Update blueprint sesuai kebutuhan
- Backup database

### 5. Testing

**Sebelum Launch:**
- Test setiap jenis soal (MC & TKP)
- Test tryout real dengan timer penuh
- Test practice mode per sub-topik
- Pastikan scoring accurate
- Test dengan user role biasa (non-admin)

---

## 📊 Monitoring & Analytics

### Cek Statistik via SQL

#### Total Soal per Kategori
```sql
SELECT 
  c.name AS category,
  COUNT(q.id) AS total_questions
FROM categories c
LEFT JOIN questions q ON q.category_id = c.id
GROUP BY c.id, c.name
ORDER BY total_questions DESC;
```

#### Soal Tanpa Pembahasan
```sql
SELECT 
  c.name AS category,
  q.question_text,
  q.id
FROM questions q
JOIN categories c ON c.id = q.category_id
WHERE q.discussion IS NULL OR q.discussion = '';
```

#### Blueprint Coverage
```sql
SELECT 
  i.name AS institution,
  c.name AS category,
  eb.question_count,
  COUNT(q.id) AS available_questions
FROM exam_blueprints eb
JOIN institutions i ON i.id = eb.institution_id
JOIN categories c ON c.id = eb.category_id
LEFT JOIN questions q ON q.category_id = c.id
GROUP BY i.id, i.name, c.name, eb.question_count
HAVING COUNT(q.id) < eb.question_count;
```

---

## 🐛 Troubleshooting

### Problem: Tryout Real Error "Function not found"

**Solution:**
1. Pastikan file `tryout-real-rpc.sql` sudah dijalankan
2. Jalankan: `NOTIFY pgrst, 'reload schema';`
3. Refresh browser

### Problem: Practice Mode Error "Function pick_random_questions not found"

**Solution:**
1. Jalankan file `practice-mode-rpc.sql`
2. Jalankan: `NOTIFY pgrst, 'reload schema';`
3. Refresh browser

### Problem: SKB Tryout tidak muncul soal

**Solution:**
1. Cek apakah institution sudah dibuat
2. Cek apakah blueprint sudah dibuat untuk institution tersebut
3. Cek apakah ada soal di kategori yang di-set di blueprint
4. Query debug:
```sql
-- Cek blueprint
SELECT * FROM exam_blueprints WHERE institution_id = '<institution_uuid>';

-- Cek soal di kategori
SELECT COUNT(*) FROM questions WHERE category_id = '<category_uuid>';
```

### Problem: Scoring tidak akurat

**Solution:**
1. Cek format `answer_key` di database
2. Multiple Choice harus punya `{"correct": "A", "score": 5}`
3. TKP harus punya `{"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}` (skor 1-5, tidak boleh 0)
4. Pastikan key jawaban uppercase (A, B, C, D, E)
5. Untuk TKP, setiap opsi harus memiliki skor antara 1-5

---

## 📞 Support

Jika ada pertanyaan atau masalah:

1. Cek dokumentasi ini terlebih dahulu
2. Cek file SQL migration untuk struktur detail
3. Lihat kode di `/src/app/admin/` untuk referensi UI
4. Gunakan Supabase SQL Editor untuk query debugging

---

## 🎓 Quick Start Checklist

- [ ] Jalankan semua migration SQL
- [ ] Jalankan `NOTIFY pgrst, 'reload schema';`
- [ ] Set admin role untuk user
- [ ] Login ke admin panel
- [ ] Buat/verifikasi kategori SKD (TWK, TIU, TKP)
- [ ] Tambah minimal 10 soal per kategori
- [ ] Test tryout real SKD
- [ ] Buat institution (e.g., STAN)
- [ ] Buat blueprint untuk institution
- [ ] Tambah soal untuk kategori blueprint (e.g., Ekonomi)
- [ ] Test tryout real SKB
- [ ] Test practice mode per sub-topik
- [ ] ✅ Aplikasi siap digunakan!

---

**Version:** 1.0.0  
**Last Updated:** 2025-12-16  
**Tech Stack:** Next.js 16 + Supabase + PostgreSQL
