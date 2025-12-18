# 🚀 Panduan Membuat Section Tryout Baru (Fleksibel)

Setelah menjalankan fix `fix-skd-categories.sql`, **admin sudah bisa membuat section tryout baru dengan fleksibel via Admin Panel** tanpa perlu run SQL script lagi!

---

## ✅ Sistem Sudah Fleksibel!

**Script `fix-skd-categories.sql` hanya untuk one-time fix** struktur SKD yang sudah ada. Setelah itu:

- ✅ **Admin bisa buat category baru** via Admin Panel
- ✅ **Dashboard otomatis menampilkan** categories baru
- ✅ **Tryout otomatis bisa jalan** tanpa coding tambahan
- ✅ **Tidak perlu run SQL** untuk setiap section baru

---

## 🎯 Cara Membuat Section Tryout Baru

### Contoh: Membuat Tryout untuk "Polri"

**Langkah 1: Buat Parent Category**

1. Buka **Admin Panel** → **Kategori**  
   http://localhost:3000/admin/categories

2. Klik **"+ Tambah Kategori"**

3. Isi form:
   ```
   Name: Polri (Kepolisian)
   Slug: polri
   Parent: SKB
   Type: topic
   ```

4. Klik **"Simpan"**

**Langkah 2: Buat Sub-Categories (Topics)**

Buat beberapa sub-categories untuk topik-topik di Polri:

**Sub-category 1: Hukum Pidana**
```
Name: Hukum Pidana
Slug: polri-hukum-pidana
Parent: Polri (Kepolisian)
Type: subtopic
```

**Sub-category 2: Hukum Acara**
```
Name: Hukum Acara
Slug: polri-hukum-acara
Parent: Polri (Kepolisian)
Type: subtopic
```

**Sub-category 3: Tata Negara**
```
Name: Tata Negara
Slug: polri-tata-negara
Parent: Polri (Kepolisian)
Type: subtopic
```

**Langkah 3: Import Soal**

1. Siapkan file JSON dengan `category_slug` yang sesuai:
   ```json
   {
     "metadata": {
       "version": "1.0",
       "description": "Soal Polri - Hukum Pidana"
     },
     "questions": [
       {
         "category_slug": "polri-hukum-pidana",
         "question_text": "Apa yang dimaksud dengan asas legalitas?",
         "question_type": "multiple_choice",
         "options": [
           { "key": "A", "text": "..." },
           { "key": "B", "text": "..." }
         ],
         "answer_key": { "correct": "A", "score": 5 },
         "discussion": "..."
       }
     ]
   }
   ```

2. Import via **Admin Panel** → **Bank Soal** → **Import Soal**

**Langkah 4: Test Tryout**

1. Buka Dashboard: http://localhost:3000
2. Section **"Polri"** sudah otomatis muncul di section **SKB**!
3. Klik section Polri → Pilih mode **Tryout Real**
4. Tryout bisa langsung jalan! ✅

---

## 🏗️ Struktur yang Direkomendasikan

### SKD (Seleksi Kompetensi Dasar)

```
skd (root - sudah ada setelah fix)
├── twk (parent - sudah ada setelah fix)
│   ├── twk-pancasila (subtopic)
│   ├── twk-nasionalisme (subtopic)
│   └── ... (bisa tambah subtopic baru kapan saja)
├── tiu (parent - sudah ada setelah fix)
│   ├── tiu-numerik-deret (subtopic)
│   ├── tiu-verbal-analogi (subtopic)
│   └── ... (bisa tambah subtopic baru kapan saja)
└── tkp (parent - sudah ada setelah fix)
    ├── tkp-pelayanan-publik (subtopic)
    ├── tkp-jejaring-kerja (subtopic)
    └── ... (bisa tambah subtopic baru kapan saja)
```

### SKB (Seleksi Kompetensi Bidang)

```
skb (root - buat via Admin Panel)
├── polri (parent/topic - buat via Admin Panel)
│   ├── polri-hukum-pidana (subtopic)
│   ├── polri-hukum-acara (subtopic)
│   └── polri-tata-negara (subtopic)
├── stan (parent/topic - buat via Admin Panel)
│   ├── stan-akuntansi (subtopic)
│   ├── stan-ekonomi (subtopic)
│   └── stan-manajemen (subtopic)
├── stis (parent/topic - buat via Admin Panel)
│   ├── stis-matematika (subtopic)
│   ├── stis-statistika (subtopic)
│   └── stis-komputasi (subtopic)
└── ... (tambah sekolah kedinasan lain dengan mudah!)
```

---

## 🎨 Cara Kerja Otomatis

### Dashboard (Dinamis 100%)

File: `src/lib/exam-structure.ts`

```typescript
// Fetch sections dari database secara dinamis
export async function fetchExamStructure() {
  // 1. Cari root categories (skd, skb)
  const roots = await supabase
    .from("categories")
    .select("id, slug")
    .in("slug", ["skd", "skb"]);

  // 2. Cari semua children (parent_id = root.id)
  const sections = await supabase
    .from("categories")
    .select("*")
    .in("parent_id", rootIds);

  // 3. Cari semua sub-topics
  const topics = await supabase
    .from("categories")
    .select("*")
    .in("parent_id", sectionIds);

  // 4. Return structure → otomatis muncul di dashboard!
  return { sections, source: "supabase" };
}
```

**Artinya:**
- ✅ Buat category baru → **Otomatis muncul** di dashboard
- ✅ Buat sub-category → **Otomatis jadi topic**
- ✅ Import soal → **Otomatis bisa dimainkan**

### Tryout Runner (Universal)

File: `src/app/tryout/real/[id]/page.tsx`

```typescript
// Jika slug = "skd" (special case untuk full SKD)
if (slug === "skd") {
  await supabase.rpc("start_skd_tryout", {
    p_duration_minutes: 100,
    p_take_tiu: 35,
    p_take_tkp: 45,
    p_take_twk: 30,
  });
}
// Untuk slug LAINNYA (universal!)
else {
  await supabase.rpc("start_category_tryout", {
    category_slug: slug,  // ← Slug apapun bisa!
    p_duration_minutes: 30,
    p_take: 30,
  });
}
```

**Artinya:**
- ✅ Tryout `twk` → `start_category_tryout` dengan slug `twk`
- ✅ Tryout `polri` → `start_category_tryout` dengan slug `polri`
- ✅ Tryout `stan` → `start_category_tryout` dengan slug `stan`
- ✅ **Slug apapun bisa**, selama category-nya ada di database!

### RPC Function (Recursive)

File: `supabase/tryout-real-rpc.sql`

```sql
-- Ambil soal dari category + semua children-nya (recursive!)
WITH RECURSIVE tree AS (
  SELECT category_id AS id
  UNION ALL
  SELECT c.id
  FROM public.categories c
  JOIN tree t ON c.parent_id = t.id
),
pool AS (
  SELECT q.* 
  FROM public.questions q
  WHERE q.category_id IN (SELECT id FROM tree)
)
SELECT * FROM pool ORDER BY random() LIMIT p_take;
```

**Artinya:**
- ✅ Tryout `polri` → Ambil soal dari `polri` **dan semua sub-categories-nya**
- ✅ Tryout `twk` → Ambil soal dari `twk` **dan semua sub-categories-nya**
- ✅ **Recursive search** → Struktur hierarchy berapa level pun bisa!

---

## 💡 Contoh Use Cases

### Use Case 1: Tambah Sekolah Kedinasan Baru

**Scenario:** Ingin tambah tryout untuk **"STIN (Sekolah Tinggi Intelijen Negara)"**

**Langkah:**
1. Admin Panel → Kategori → Tambah:
   ```
   Name: STIN
   Slug: stin
   Parent: SKB
   Type: topic
   ```

2. Tambah sub-categories:
   ```
   stin-intelijen-dasar (subtopic)
   stin-analisis-strategis (subtopic)
   stin-geopolitik (subtopic)
   ```

3. Import soal dengan `category_slug: "stin-intelijen-dasar"`, dst.

4. **Done!** Tryout STIN otomatis muncul di dashboard dan bisa dimainkan.

### Use Case 2: Tambah Sub-Topik Baru di SKD

**Scenario:** Ingin tambah topik **"TWK - Anti Korupsi"**

**Langkah:**
1. Admin Panel → Kategori → Tambah:
   ```
   Name: Anti Korupsi
   Slug: twk-anti-korupsi
   Parent: TWK (Tes Wawasan Kebangsaan)
   Type: subtopic
   ```

2. Import soal dengan `category_slug: "twk-anti-korupsi"`

3. **Done!** Sub-topik otomatis muncul di practice mode dan tryout TWK.

### Use Case 3: Tryout Multi-Level

**Scenario:** Struktur kategori berlevel:

```
polri (topic)
├── hukum (subtopic)
│   ├── hukum-pidana (sub-subtopic)
│   └── hukum-perdata (sub-subtopic)
└── tata-negara (subtopic)
```

**Cara:**
1. Buat `polri` (parent: SKB, type: topic)
2. Buat `hukum` (parent: polri, type: subtopic)
3. Buat `hukum-pidana` (parent: hukum, type: subtopic)
4. Buat `hukum-perdata` (parent: hukum, type: subtopic)
5. Import soal ke masing-masing category

**Hasil:**
- Tryout `polri` → Ambil soal dari **semua level** (recursive!)
- Tryout `hukum` → Ambil soal dari `hukum-pidana` + `hukum-perdata`
- Tryout `hukum-pidana` → Ambil soal dari `hukum-pidana` saja

**Sistem mendukung hierarchy unlimited!** 🚀

---

## 🔧 Troubleshooting

### Problem: "Category baru tidak muncul di dashboard"

**Solution:**
1. Refresh browser (clear cache)
2. Pastikan category memiliki **parent** yang benar:
   - SKD sections → parent: `skd`
   - SKB sections → parent: `skb`
3. Pastikan **type** sudah benar:
   - Section/School → `topic`
   - Sub-topic → `subtopic`

### Problem: "Tryout tidak ada soal"

**Solution:**
1. Pastikan sudah **import soal** dengan `category_slug` yang sesuai
2. Cek jumlah soal via Admin Panel → Bank Soal
3. Soal harus ada di category tersebut **atau children-nya** (recursive)

### Problem: "Tryout error 'Category not found'"

**Solution:**
1. Pastikan **slug** di URL sesuai dengan slug di database
2. Cek typo di slug (huruf kecil semua, pakai dash `-`)
3. Verifikasi category exist via Admin Panel

---

## ✨ Kesimpulan

**Setelah menjalankan `fix-skd-categories.sql`:**

- ✅ **Struktur SKD** (twk/tiu/tkp) sudah fix dan bisa jalan
- ✅ **Admin punya full control** untuk buat section baru
- ✅ **Tidak perlu SQL script** lagi untuk setiap perubahan
- ✅ **Sistem 100% dinamis** dari database
- ✅ **Hierarchy unlimited** (multi-level categories)
- ✅ **Dashboard otomatis update** saat ada category baru

**Workflow Admin:**
```
1. Buat category via Admin Panel
2. Import soal via Admin Panel
3. Done! Tryout otomatis bisa jalan
```

**Tidak perlu:**
- ❌ Edit kode
- ❌ Run SQL script
- ❌ Restart server
- ❌ Deploy ulang

**Admin bisa kelola semua via UI!** 🎉

---

**Happy Creating! 🚀**
