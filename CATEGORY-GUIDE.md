# 📂 Panduan Mengelola Kategori

Panduan lengkap untuk mengelola kategori soal dengan struktur hierarkis.

---

## 🎯 Overview

Sistem menggunakan **hierarchical categories** yang fleksibel:
- Admin punya **full control** untuk buat kategori apapun
- Tidak ada slug yang hardcoded
- Struktur parent-child unlimited depth
- Kategori digunakan untuk organize soal dan blueprints

---

## 🏗️ Struktur Kategori

### Hierarki Level

```
Level 1: Subject (Mata Ujian)
├── Level 2: Topic (Topik Besar)
│   └── Level 3: Subtopic (Sub Topik)
│       └── Level 4: Detail (Optional)
```

### Contoh Real

```
TWK (subject)
├── Pancasila (topic)
│   ├── Sejarah Pancasila (subtopic)
│   └── Nilai-nilai Pancasila (subtopic)
├── UUD 1945 (topic)
│   ├── Pembukaan (subtopic)
│   └── Pasal-pasal (subtopic)
└── Bhinneka Tunggal Ika (topic)

TIU (subject)
├── Verbal (topic)
│   ├── Silogisme (subtopic)
│   ├── Analogi (subtopic)
│   └── Antonim-Sinonim (subtopic)
├── Numerik (topic)
│   ├── Bilangan Deret (subtopic)
│   ├── Perbandingan (subtopic)
│   │   ├── Senilai (detail)
│   │   └── Tak Senilai (detail)
│   └── Aritmatika (subtopic)
└── Figural (topic)
    ├── Pola Gambar (subtopic)
    └── Rotasi Bentuk (subtopic)

TKP (subject)
├── Pelayanan Publik (topic)
│   ├── Integritas (subtopic)
│   ├── Kerjasama (subtopic)
│   └── Orientasi Pelayanan (subtopic)
└── Sosial Budaya (topic)
```

---

## ➕ Menambah Kategori

### Via Admin Panel

**Step 1: Buka Halaman Kategori**
```
http://localhost:3000/admin/categories
```

**Step 2: Klik "+ Tambah Kategori"**

**Step 3: Isi Form**

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Name** | ✅ | Nama kategori untuk display | Silogisme |
| **Slug** | ✅ | Identifier unik (alphanumeric + dash) | silogisme |
| **Parent** | ❌ | Parent category (kosong = root) | TIU |
| **Type** | ❌ | Level kategori | subtopic |

**Step 4: Klik "Simpan"**

---

## 📋 Field Details

### 1. Name (Display Name)

**Aturan:**
- ✅ Bebas, bisa huruf besar/kecil
- ✅ Bisa menggunakan spasi
- ✅ Bisa unicode (Indonesia, dll)
- ✅ Untuk display di UI

**Contoh:**
```
✅ "Silogisme"
✅ "Bilangan Deret"
✅ "Perbandingan Senilai & Tak Senilai"
✅ "Tes Intelegensia Umum (TIU)"
```

### 2. Slug (Technical ID)

**Aturan:**
- ✅ Lowercase letters (a-z)
- ✅ Numbers (0-9)
- ✅ Dash (-) untuk separator
- ❌ No spaces
- ❌ No special characters
- ❌ Must be unique di seluruh database

**Auto-generate:**
Form akan auto-generate slug dari name:
```
Name: "Bilangan Deret" → slug: "bilangan-deret"
Name: "TWK - Pancasila" → slug: "twk-pancasila"
```

**Bisa di-edit manual:**
```
✅ "silogisme"
✅ "bilangan-deret"
✅ "perbandingan-senilai"
✅ "twk-pancasila-nilai"
❌ "Silogisme" (uppercase)
❌ "bilangan deret" (space)
❌ "perbandingan_senilai" (underscore)
```

**💡 Best Practice:**
- Descriptive: `silogisme` > `s1`
- Concise: `bilangan-deret` > `bilangan-deret-aritmatika-progresif`
- Consistent: Gunakan pattern yang sama untuk kategori serupa

### 3. Parent (Hierarchical Structure)

**Kosong = Root Category:**
```
TWK (no parent)
TIU (no parent)
TKP (no parent)
```

**Dengan Parent:**
```
Silogisme (parent: TIU)
Bilangan Deret (parent: TIU)
Pancasila (parent: TWK)
```

**Unlimited Depth:**
```
TIU (no parent)
└── Numerik (parent: TIU)
    └── Perbandingan (parent: Numerik)
        ├── Senilai (parent: Perbandingan)
        └── Tak Senilai (parent: Perbandingan)
```

**💡 Tips:**
- Root category untuk mata ujian utama (TWK, TIU, TKP)
- Level 2 untuk topik besar (Verbal, Numerik, Pancasila)
- Level 3+ untuk detail subtopik

### 4. Type (Category Level)

**Options:**
- `subject` - Mata ujian utama (TWK, TIU, TKP)
- `topic` - Topik besar (Verbal, Numerik, Pancasila)
- `subtopic` - Sub topik detail (Silogisme, Bilangan Deret)

**Optional:**
- Boleh null/kosong
- Hanya untuk organizing/filtering
- Tidak affect functionality

---

## ✏️ Mengedit Kategori

**Step 1: Admin Panel → Kategori**

**Step 2: Klik "Edit" pada kategori yang mau diubah**

**Step 3: Edit field (kecuali slug)**

**⚠️ Warning:**
- Slug **tidak bisa diubah** jika sudah ada soal menggunakan kategori tersebut
- Ubah Name/Parent/Type aman
- Hapus parent = move to root

---

## 🗑️ Menghapus Kategori

**Step 1: Admin Panel → Kategori**

**Step 2: Klik "Hapus" pada kategori**

**Step 3: Konfirmasi**

**⚠️ Warning:**
- Kategori dengan soal **tidak bisa dihapus**
- Hapus soal dulu, baru hapus kategori
- Child categories tidak ikut terhapus (menjadi orphan)

**Safe Delete:**
```sql
-- Cek kategori yang aman dihapus (tidak ada soal)
SELECT c.id, c.name, c.slug, COUNT(q.id) as question_count
FROM categories c
LEFT JOIN questions q ON q.category_id = c.id
GROUP BY c.id, c.name, c.slug
HAVING COUNT(q.id) = 0;
```

---

## 🔄 Workflow dengan Import Soal

### Skenario 1: Import Soal Silogisme

**Step 1: Cek Kategori**
```
Admin Panel → Kategori
Search: "Silogisme"
```

**Jika Belum Ada:**
```
1. Klik "+ Tambah Kategori"
2. Name: Silogisme
3. Slug: silogisme
4. Parent: TIU
5. Type: subtopic
6. Save ✅
```

**Step 2: Import Soal**
```json
{
  "category_slug": "silogisme",  // ← Use slug yang baru dibuat
  "question_text": "Semua A adalah B...",
  ...
}
```

**Step 3: Validation**
```
✅ category_slug "silogisme" found
✅ Import success
```

### Skenario 2: Bulk Import Multi Kategori

**Step 1: Buat Semua Kategori Dulu**
```
1. Silogisme (slug: silogisme)
2. Analogi (slug: analogi)
3. Bilangan Deret (slug: bilangan-deret)
4. Perbandingan Senilai (slug: perbandingan-senilai)
```

**Step 2: Prepare Import JSON**
```json
{
  "questions": [
    { "category_slug": "silogisme", ... },
    { "category_slug": "silogisme", ... },
    { "category_slug": "analogi", ... },
    { "category_slug": "bilangan-deret", ... }
  ]
}
```

**Step 3: Import Sekaligus**
```
✅ All categories exist
✅ Import 50 questions
```

---

## 📊 View Kategori dengan Soal

### Via Admin Panel

**Kategori Page:**
```
http://localhost:3000/admin/categories

Display:
TIU
  Silogisme (20 soal)
  Analogi (15 soal)
  Bilangan Deret (30 soal)

TWK
  Pancasila (25 soal)
```

### Via SQL

```sql
-- Kategori dengan jumlah soal
SELECT 
  c.name,
  c.slug,
  c.type,
  COUNT(q.id) as question_count
FROM categories c
LEFT JOIN questions q ON q.category_id = c.id
GROUP BY c.id, c.name, c.slug, c.type
ORDER BY c.name;
```

---

## 🎯 Best Practices

### 1. Naming Convention

**Consistent Style:**
```
✅ Good:
- TWK > Pancasila > Sejarah
- TIU > Verbal > Silogisme
- TKP > Integritas > Kejujuran

❌ Bad (inconsistent):
- twk > PANCASILA > sejarah
- TIU - Verbal / Silogisme
```

**Descriptive Names:**
```
✅ "Bilangan Deret"
❌ "BD"
❌ "Deret"
```

### 2. Slug Convention

**Lowercase + Dash:**
```
✅ "bilangan-deret"
✅ "perbandingan-senilai"
✅ "twk-pancasila"

❌ "Bilangan_Deret"
❌ "perbandinganSenilai"
❌ "twk pancasila"
```

### 3. Hierarchy Depth

**Recommended:**
```
Level 1: Subject (TWK, TIU, TKP)
Level 2: Topic (Pancasila, Verbal, Integritas)
Level 3: Subtopic (Sejarah, Silogisme, Kejujuran)
[Stop here for most cases]
```

**Optional Level 4:**
```
Only if really needed:
TIU > Numerik > Perbandingan > Senilai
TIU > Numerik > Perbandingan > Tak Senilai
```

**Avoid:**
```
❌ Too deep (5+ levels)
❌ Too flat (no hierarchy)
```

### 4. Pre-Planning

**Before Import:**
```
1. ✅ Plan category structure
2. ✅ Create all categories first
3. ✅ List all slugs to use
4. ✅ Prepare import JSON with correct slugs
5. ✅ Import questions
```

**Don't:**
```
❌ Create categories ad-hoc during import
❌ Use inconsistent slug patterns
❌ Create duplicate categories
```

---

## 🔍 Troubleshooting

### Problem: "Category not found" saat import

**Check:**
```sql
-- Verify slug exists
SELECT id, name, slug FROM categories WHERE slug = 'silogisme';
```

**Solution:**
1. Buat kategori dengan slug tersebut
2. Or update JSON dengan slug yang exist

### Problem: Kategori tidak bisa dihapus

**Check:**
```sql
-- Check if category has questions
SELECT COUNT(*) FROM questions WHERE category_id = 'category-id-here';
```

**Solution:**
1. Delete atau move questions ke kategori lain
2. Then delete category

### Problem: Duplicate slug

**Error:**
```
ERROR: duplicate key value violates unique constraint "categories_slug_key"
```

**Solution:**
- Slug must be unique
- Use different slug: `silogisme-2`, `silogisme-lanjut`, etc.

### Problem: Child category menjadi orphan

**Scenario:**
```
Parent deleted → Child's parent_id still points to deleted parent
```

**Fix:**
```sql
-- Find orphan categories
SELECT * FROM categories 
WHERE parent_id NOT IN (SELECT id FROM categories);

-- Fix: Set to root (null parent)
UPDATE categories 
SET parent_id = NULL 
WHERE parent_id NOT IN (SELECT id FROM categories);
```

---

## 🎓 Examples

### Example 1: Setup TIU Categories

```
1. Create root:
   - Name: TIU
   - Slug: tiu
   - Parent: (none)
   - Type: subject

2. Create topics:
   - Name: Verbal, Slug: verbal, Parent: TIU, Type: topic
   - Name: Numerik, Slug: numerik, Parent: TIU, Type: topic
   - Name: Figural, Slug: figural, Parent: TIU, Type: topic

3. Create subtopics (Verbal):
   - Name: Silogisme, Slug: silogisme, Parent: Verbal, Type: subtopic
   - Name: Analogi, Slug: analogi, Parent: Verbal, Type: subtopic

4. Create subtopics (Numerik):
   - Name: Bilangan Deret, Slug: bilangan-deret, Parent: Numerik, Type: subtopic
   - Name: Perbandingan, Slug: perbandingan, Parent: Numerik, Type: subtopic
```

**Result:**
```
TIU
├── Verbal
│   ├── Silogisme
│   └── Analogi
├── Numerik
│   ├── Bilangan Deret
│   └── Perbandingan
└── Figural
```

### Example 2: Setup TWK Categories

```
1. Root: TWK (slug: twk, type: subject)
2. Topics:
   - Pancasila (slug: pancasila, parent: TWK)
   - UUD 1945 (slug: uud-1945, parent: TWK)
   - Bhinneka Tunggal Ika (slug: bhinneka, parent: TWK)
```

### Example 3: Flat Structure (No Hierarchy)

```
If you prefer flat (no parent-child):
- Silogisme (slug: silogisme, parent: null)
- Bilangan Deret (slug: bilangan-deret, parent: null)
- Pancasila (slug: pancasila, parent: null)
- Integritas (slug: integritas, parent: null)

✅ Still works! Hierarchy is optional.
```

---

## 📖 Resources

- **Admin Panel**: http://localhost:3000/admin/categories
- **IMPORT-GUIDE.md**: Cara import soal dengan slug
- **ADMIN-GUIDE.md**: Complete admin guide

---

**Admin punya full control! Tidak ada slug yang hardcoded.** 🎉
