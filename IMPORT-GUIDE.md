# 📤 Panduan Import Soal dari JSON

Panduan lengkap untuk melakukan bulk import soal menggunakan file JSON.

---

## 📋 Overview

Fitur import soal memungkinkan admin untuk menambahkan banyak soal sekaligus tanpa perlu input manual satu per satu. Berguna untuk:
- ✅ Migrasi data dari sistem lain
- ✅ Bulk upload soal baru
- ✅ Backup dan restore bank soal
- ✅ Kolaborasi dengan tim pembuat soal

---

## 📁 Template JSON

Download template: **[import-questions-template.json](./templates/import-questions-template.json)**

### Struktur Dasar

```json
{
  "metadata": {
    "version": "1.0",
    "description": "Deskripsi file import",
    "instructions": "Instruksi penggunaan"
  },
  "questions": [
    // Array of questions
  ]
}
```

### Format Question Object

#### 1. Multiple Choice Question

```json
{
  "category_slug": "bilangan-deret",
  "question_text": "Berapa hasil dari 2 + 2?",
  "question_type": "multiple_choice",
  "question_image_url": null,
  "options": [
    { "key": "A", "text": "3" },
    { "key": "B", "text": "4" },
    { "key": "C", "text": "5" },
    { "key": "D", "text": "6" }
  ],
  "answer_key": {
    "correct": "B",
    "score": 5
  },
  "discussion": "2 + 2 = 4 (penjumlahan dasar)"
}
```

**Fields:**
- `category_slug` (required): Slug kategori tujuan (harus sudah ada di database)
- `question_text` (required): Teks pertanyaan
- `question_type` (required): `"multiple_choice"`, `"figural"`, atau `"scale_tkp"`
- `question_image_url` (optional): URL gambar soal (null jika tidak ada)
- `options` (required): Array pilihan jawaban
  - `key`: A, B, C, D, E, dst
  - `text`: Teks pilihan
  - `image_url` (optional): URL gambar untuk figural
- `answer_key` (required):
  - `correct`: Key jawaban benar
  - `score`: Skor untuk jawaban benar
- `discussion` (optional): Pembahasan

#### 2. Figural Question (dengan Gambar)

```json
{
  "category_slug": "pola-gambar",
  "question_text": "Gambar manakah yang melanjutkan pola?",
  "question_type": "figural",
  "question_image_url": "https://example.com/question.jpg",
  "options": [
    { 
      "key": "A", 
      "text": "Pilihan A",
      "image_url": "https://example.com/option-a.jpg"
    },
    { 
      "key": "B", 
      "text": "Pilihan B",
      "image_url": "https://example.com/option-b.jpg"
    }
  ],
  "answer_key": {
    "correct": "A",
    "score": 5
  },
  "discussion": "Pola rotasi 90 derajat"
}
```

**Catatan untuk Figural:**
- `question_image_url` **WAJIB** (tidak boleh null)
- `image_url` di options **RECOMMENDED**
- Upload gambar dulu ke Supabase Storage, lalu copy URL

#### 3. Math Question (Matematika/Fisika)

```json
{
  "category_slug": "aljabar",
  "question_text": "Jika $x^2 - 5x + 6 = 0$, maka nilai $x$ yang memenuhi adalah...",
  "question_type": "multiple_choice",
  "question_image_url": null,
  "options": [
    { "key": "A", "text": "$x = 1$ atau $x = 6$" },
    { "key": "B", "text": "$x = 2$ atau $x = 3$" },
    { "key": "C", "text": "$x = -2$ atau $x = -3$" },
    { "key": "D", "text": "$x = 5$ atau $x = 1$" }
  ],
  "answer_key": {
    "correct": "B",
    "score": 5
  },
  "discussion": "Faktorkan: $(x - 2)(x - 3) = 0$. Jadi $x = 2$ atau $x = 3$"
}
```

**Catatan untuk Math:**
- Gunakan `$rumus$` untuk inline math
- Gunakan `$$rumus$$` untuk display math
- Escape backslash di JSON: `\\frac` untuk `\frac`
- 📐 **[Lihat MATH-GUIDE.md](./MATH-GUIDE.md) untuk syntax LaTeX lengkap**

#### 4. TKP Scale Question

```json
{
  "category_slug": "integritas",
  "question_text": "Saya selalu jujur dalam situasi apapun",
  "question_type": "scale_tkp",
  "question_image_url": null,
  "options": [
    { "key": "A", "text": "Sangat tidak setuju" },
    { "key": "B", "text": "Tidak setuju" },
    { "key": "C", "text": "Netral" },
    { "key": "D", "text": "Setuju" },
    { "key": "E", "text": "Sangat setuju" }
  ],
  "answer_key": {
    "A": 1,
    "B": 2,
    "C": 3,
    "D": 4,
    "E": 5
  },
  "discussion": "Pernyataan positif, skor tinggi untuk setuju"
}
```

**Catatan untuk TKP:**
- `answer_key` berupa map: `{ "A": skor, "B": skor, ... }`
- **Skor harus antara 1-5** (skala likert): 5=paling tepat, 1=kurang tepat
- Tidak ada jawaban yang bernilai 0 (semua opsi harus memiliki skor 1-5)
- Untuk pernyataan negatif, reverse skor (A=5, B=4, C=3, D=2, E=1)
- Untuk pernyataan positif, gunakan skor normal (A=1, B=2, C=3, D=4, E=5)

---

## 🚀 Cara Import Soal

### Step 1: Siapkan Data

1. **Download template**: `import-questions-template.json`
2. **Edit template**: Isi dengan soal-soal Anda
3. **Validasi JSON**: Pastikan format valid (gunakan JSONLint.com)

### Step 2: Pastikan Kategori Sudah Ada

**Admin Panel → Kategori** (http://localhost:3000/admin/categories)

Cek apakah kategori yang akan digunakan sudah ada:
- ✅ Jika sudah ada → Catat slug-nya
- ❌ Jika belum ada → Buat dulu

**Cara Buat Kategori Baru:**
```
1. Klik "+ Tambah Kategori"
2. Isi form:
   - Name: Silogisme (bebas, untuk display)
   - Slug: silogisme (alphanumeric + dash, untuk import)
   - Parent: TIU (optional, untuk hierarchy)
   - Type: subtopic (subject/topic/subtopic)
3. Klik "Simpan"
```

**Lihat Semua Slug via SQL:**
```sql
-- Cek kategori yang tersedia
SELECT slug, name, type FROM categories ORDER BY name;

-- Output example:
-- analogi              | Analogi              | subtopic
-- bilangan-deret       | Bilangan Deret       | subtopic
-- integritas           | Integritas           | subtopic
-- logika               | Logika               | subtopic
-- pancasila            | Pancasila            | subtopic
-- silogisme            | Silogisme            | subtopic
```

**💡 Tips:**
- Slug harus **lowercase**
- Gunakan **dash** untuk spasi (mis: `bilangan-deret`)
- Slug harus **unik** di seluruh database
- Slug tidak bisa diubah setelah ada soal (untuk konsistensi)

**PENTING**: Semua `category_slug` dalam JSON harus sudah exist di database!

**⚠️ Admin Punya Full Control:**
- ✅ Buat kategori dengan slug apapun (tidak hardcoded)
- ✅ Edit/hapus kategori via Admin Panel
- ✅ Struktur hierarki bebas (parent-child)
- ✅ Tambah kategori baru kapan saja

### Step 3: Upload File

1. **Admin Panel** → **Bank Soal** → **Import Soal**
2. Klik **"Choose File"** → Pilih file JSON
3. Klik **"Validasi File"** → Cek preview dan errors
4. Jika OK, klik **"Import Soal"**
5. Tunggu proses selesai

### Step 4: Verifikasi

1. Check **Bank Soal** → Soal sudah muncul
2. Test tryout dengan soal baru
3. Verify pembahasan dan jawaban benar

---

## ✅ Validations

Import akan **REJECT** file jika:

❌ JSON tidak valid (syntax error)
❌ Field required kosong
❌ `category_slug` tidak ditemukan di database
❌ `question_type` tidak valid
❌ `options` kurang dari 2 atau lebih dari 10
❌ `answer_key.correct` tidak ada di options (untuk MC)
❌ Figural tanpa `question_image_url`
❌ TKP tanpa score map lengkap

Import akan **WARNING** tapi tetap proceed:

⚠️ `discussion` kosong (optional)
⚠️ `question_image_url` null untuk non-figural

---

## 💡 Best Practices

### 1. Batch Size

Recommended: **50-100 soal per file**
- Lebih cepat upload
- Mudah debug jika error
- Tidak overload database

### 2. Naming Convention

```
import-skd-twk-2025-01-15.json
import-skd-tiu-bilangan-deret.json
import-skb-stan-ekonomi.json
```

### 3. Pre-Upload Checklist

- [ ] JSON valid (cek di JSONLint)
- [ ] Semua category_slug exist
- [ ] Image URLs accessible (untuk figural)
- [ ] Answer keys correct
- [ ] Pembahasan meaningful
- [ ] No duplicate questions

### 4. Image URLs

Untuk soal figural:
1. Upload gambar ke Supabase Storage terlebih dahulu
2. Copy public URL
3. Paste ke JSON file
4. Test URL di browser (pastikan accessible)

### 5. Backup Before Import

```sql
-- Backup existing questions (optional)
COPY (SELECT * FROM questions) TO '/path/backup-questions.csv' CSV HEADER;
```

---

## 🐛 Troubleshooting

### Problem: "Could not find the 'question_image_url' column"

**Full Error:**
```
❌ Could not find the 'question_image_url' column of 'questions' in the schema cache
```

**Cause:** Database migration belum dijalankan. Kolom `question_image_url` belum ada di tabel `questions`.

**Solution:**
1. **Quick Fix** - Run SQL ini di Supabase SQL Editor:
   ```sql
   ALTER TABLE public.questions 
     ADD COLUMN IF NOT EXISTS question_image_url text,
     ADD COLUMN IF NOT EXISTS question_image_alt text;
   ```

2. **Complete Fix** - Run semua migrations:
   - Buka [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)
   - Jalankan file `supabase/add-figural-support.sql`
   - Restart dev server

3. **Verify:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'questions' AND column_name LIKE '%image%';
   ```

**Setelah run SQL, import soal Anda akan berhasil!** ✅

📖 **[Lihat MIGRATION-GUIDE.md untuk panduan lengkap menjalankan migrasi database](./MIGRATION-GUIDE.md)**

---

### Problem: "Category not found: xxx"

**Solution:**
```sql
-- Cek category slug
SELECT slug, name FROM categories WHERE slug = 'xxx';

-- Jika tidak ada, buat dulu
-- Admin Panel → Kategori → + Tambah Kategori
```

### Problem: "Invalid JSON format"

**Solution:**
- Gunakan [JSONLint.com](https://jsonlint.com/) untuk validate
- Check trailing commas (tidak boleh ada)
- Check quotes (harus double quotes `"`, bukan single `'`)

### Problem: "Question type must be multiple_choice, figural, or scale_tkp"

**Solution:**
```json
// ❌ Wrong
"question_type": "mc"

// ✅ Correct
"question_type": "multiple_choice"
```

### Problem: "Figural question requires question_image_url"

**Solution:**
```json
// ❌ Wrong (figural tanpa image)
{
  "question_type": "figural",
  "question_image_url": null
}

// ✅ Correct
{
  "question_type": "figural",
  "question_image_url": "https://example.com/image.jpg"
}
```

### Problem: "Options must have at least 2 choices"

**Solution:**
Minimum 2 pilihan, maksimum 10 pilihan per soal.

---

## 📊 Import Report

Setelah import, Anda akan melihat report:

```
✅ Import Berhasil!

Total diproses: 50 soal
Berhasil: 48 soal
Gagal: 2 soal

Errors:
- Baris 15: Category 'xyz' not found
- Baris 32: Answer key 'F' not in options

Waktu: 2.5 detik
```

---

## 🔄 Export Soal (Backup)

Untuk export soal ke JSON (backup):

```sql
-- Export all questions
SELECT json_agg(
  json_build_object(
    'category_slug', c.slug,
    'question_text', q.question_text,
    'question_type', q.question_type,
    'question_image_url', q.question_image_url,
    'options', q.options,
    'answer_key', q.answer_key,
    'discussion', q.discussion
  )
)
FROM questions q
JOIN categories c ON c.id = q.category_id;
```

Copy hasil ke file JSON → Gunakan untuk import di server lain atau backup.

---

## 🎯 Kebebasan Admin

**Admin Punya Full Control untuk Kategori:**

✅ **Buat slug apapun** (tidak hardcoded)
✅ **Struktur hierarki bebas** (parent-child unlimited)
✅ **Edit/hapus kategori** via Admin Panel
✅ **Tambah kategori baru** kapan saja sebelum import

**Contoh Kategori yang Bisa Dibuat:**

```
Admin Panel → Kategori → + Tambah Kategori

Contoh slug yang valid:
✅ silogisme
✅ logika
✅ bilangan-deret
✅ perbandingan-senilai
✅ perbandingan-tak-senilai
✅ analogi
✅ antonim-sinonim
✅ pola-gambar
✅ integritas
✅ kerjasama

Tidak ada batasan! Admin bebas buat slug custom.
```

**Workflow:**
```
1. Admin buat kategori dulu (dengan slug custom)
2. Admin catat slug yang dibuat
3. Admin import soal dengan category_slug tersebut
4. Validation check slug exists
5. Import success!
```

📂 **[Lihat CATEGORY-GUIDE.md untuk panduan lengkap mengelola kategori](./CATEGORY-GUIDE.md)**

---

## 📝 Contoh Use Cases

### Use Case 1: Migrasi dari Excel

1. Export Excel → CSV
2. Convert CSV → JSON (gunakan tool online atau script)
3. Adjust format sesuai template
4. Import

### Use Case 2: Kolaborasi Tim

1. Tim membuat soal di Google Sheets (shared)
2. Export → JSON dengan script
3. Review → Import
4. Semua soal langsung masuk

### Use Case 3: Update Bulk

1. Export existing questions → JSON
2. Edit di text editor (find & replace)
3. Delete old questions
4. Re-import

---

## 🎯 Advanced Tips

### 1. Auto-generate dari Script

```javascript
// Node.js script untuk generate JSON
const questions = [];

for (let i = 1; i <= 100; i++) {
  questions.push({
    category_slug: "bilangan-deret",
    question_text: `Soal ${i}: ...`,
    question_type: "multiple_choice",
    // ...
  });
}

const output = {
  metadata: { version: "1.0" },
  questions: questions
};

fs.writeFileSync("import.json", JSON.stringify(output, null, 2));
```

### 2. Validate Before Import

```javascript
// Validation script
const data = JSON.parse(fs.readFileSync("import.json"));

data.questions.forEach((q, idx) => {
  if (!q.category_slug) console.error(`Row ${idx}: Missing category_slug`);
  if (!q.question_text) console.error(`Row ${idx}: Missing question_text`);
  // ... more validations
});
```

### 3. Batch Import Multiple Files

```bash
# Upload multiple files
for file in import-*.json; do
  echo "Importing $file..."
  # Call import API or upload via UI
done
```

---

## 📞 Support

Jika ada masalah saat import:
1. 📖 Baca error message dengan teliti
2. 🔍 Cek IMPORT-GUIDE.md dan ADMIN-GUIDE.md
3. 🧪 Test dengan 1-2 soal dulu (small batch)
4. 💾 Backup database sebelum import besar

---

**Happy Importing! 📤✨**
