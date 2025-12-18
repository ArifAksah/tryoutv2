# 📸 Panduan Soal Figural (dengan Gambar)

Panduan lengkap untuk membuat dan mengelola soal figural yang membutuhkan gambar.

---

## 📋 Apa itu Soal Figural?

Soal figural adalah jenis soal yang menggunakan gambar/visualisasi, umum digunakan dalam:
- **TIU**: Soal pola gambar, analogi gambar, seri gambar
- **TWK**: Soal dengan ilustrasi visual (lambang, peta, diagram)

---

## 🚀 Setup

### 1. Jalankan Migration SQL

```sql
-- File: supabase/add-figural-support.sql
-- Menambahkan tipe 'figural' ke enum question_type
-- Menambahkan kolom question_image_url dan question_image_alt
```

### 2. Setup Supabase Storage

Di Supabase Dashboard:

1. Buka **Storage**
2. Create new bucket: `question-images`
3. Set bucket sebagai **Public**
4. Set policies:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'question-images');

-- Allow public to read images
CREATE POLICY "Public can read images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'question-images');

-- Allow authenticated users to delete own uploads
CREATE POLICY "Authenticated users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'question-images');
```

### 3. Reload Schema

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 📝 Cara Membuat Soal Figural

### Metode 1: Upload via Admin Panel (Recommended)

#### Step 1: Buat Soal Baru

1. **Admin Panel** → **Bank Soal** → **Tambah Soal**
2. Pilih **Section** dan **Topik**
3. **Tipe Soal**: Pilih **"Figural (dengan gambar)"**

#### Step 2: Upload Gambar Soal

4. **Pertanyaan**: Tulis pertanyaan (e.g., "Gambar manakah yang melanjutkan pola?")
5. **Gambar Soal**: Klik **Choose File** → pilih gambar → tunggu upload selesai
6. Preview gambar akan muncul
7. ✅ URL gambar otomatis tersimpan

#### Step 3: Upload Gambar Pilihan Jawaban

8. **Pilihan Jawaban**: Gunakan format khusus figural:
   ```
   A|Gambar A|https://your-supabase-url/storage/v1/object/public/question-images/options/image-a.jpg
   B|Gambar B|https://your-supabase-url/storage/v1/object/public/question-images/options/image-b.jpg
   C|Gambar C|https://your-supabase-url/storage/v1/object/public/question-images/options/image-c.jpg
   D|Gambar D|https://your-supabase-url/storage/v1/object/public/question-images/options/image-d.jpg
   ```

   **Format:**
   - `Key|Text|ImageURL`
   - Key: A, B, C, D (auto-assigned jika kosong)
   - Text: Label text (boleh kosong)
   - ImageURL: URL gambar dari Supabase Storage

#### Step 4: Set Jawaban Benar

9. **Kunci Jawaban**: Pilih key yang benar (misal: `C`)
10. **Skor Benar**: Tentukan skor (default: 5)
11. **Pembahasan**: (Opsional) Tulis penjelasan

#### Step 5: Simpan

12. Klik **"Tambah Soal"**

---

### Metode 2: Manual via SQL

#### Step 1: Upload Gambar ke Storage

Upload gambar ke Supabase Storage bucket `question-images`:

```javascript
// Via Supabase Client (JavaScript)
const { data, error } = await supabase.storage
  .from('question-images')
  .upload('questions/pattern-01.jpg', file);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('question-images')
  .getPublicUrl('questions/pattern-01.jpg');
```

#### Step 2: Insert via SQL

```sql
INSERT INTO public.questions (
  category_id,
  question_text,
  question_type,
  question_image_url,
  options,
  answer_key,
  discussion
) VALUES (
  '<category_uuid>',
  'Gambar manakah yang melanjutkan pola di atas?',
  'figural',
  'https://your-supabase-url/storage/v1/object/public/question-images/questions/pattern-01.jpg',
  '[
    {"key": "A", "text": "Pilihan A", "image_url": "https://.../option-a.jpg"},
    {"key": "B", "text": "Pilihan B", "image_url": "https://.../option-b.jpg"},
    {"key": "C", "text": "Pilihan C", "image_url": "https://.../option-c.jpg"},
    {"key": "D", "text": "Pilihan D", "image_url": "https://.../option-d.jpg"}
  ]'::jsonb,
  '{"correct": "C", "score": 5}'::jsonb,
  'Pola menunjukkan rotasi 90 derajat searah jarum jam setiap step.'
);
```

---

## 🎨 Format Data

### Schema Database

```sql
questions
├── question_image_url  text        -- URL gambar soal (wajib untuk figural)
├── question_image_alt  text        -- Alt text (optional)
├── question_type       enum        -- 'figural'
├── options             jsonb       -- Array pilihan dengan image_url
└── answer_key          jsonb       -- {"correct": "A", "score": 5}
```

### Format options (JSONB)

```json
[
  {
    "key": "A",
    "text": "Pilihan A",
    "image_url": "https://example.com/option-a.jpg",
    "image_alt": "Deskripsi gambar A"
  },
  {
    "key": "B",
    "text": "Pilihan B",
    "image_url": "https://example.com/option-b.jpg",
    "image_alt": "Deskripsi gambar B"
  }
]
```

**Field options:**
- `key`: **Required** - Key jawaban (A, B, C, D, ...)
- `text`: **Optional** - Label text untuk pilihan
- `image_url`: **Optional** - URL gambar pilihan (wajib untuk figural)
- `image_alt`: **Optional** - Alt text untuk accessibility

### Format answer_key (JSONB)

```json
{
  "correct": "C",
  "score": 5
}
```

Sama dengan multiple choice biasa.

---

## 🖼️ Best Practices Upload Gambar

### 1. Ukuran Gambar

- **Max file size**: 5MB
- **Recommended**: 500KB - 1MB per gambar
- **Format**: JPG, PNG, GIF

### 2. Dimensi

- **Gambar soal**: 800x600px atau rasio 4:3
- **Gambar pilihan**: 400x300px (uniform untuk semua pilihan)
- **Resolution**: 72-150 DPI

### 3. Optimasi

Sebelum upload, compress gambar:
- **Tools**: TinyPNG, ImageOptim, Squoosh
- **Target**: < 200KB per gambar pilihan

### 4. Naming Convention

```
questions/
  ├── tiu-pola-01.jpg
  ├── tiu-pola-02.jpg
  ├── twk-lambang-01.jpg
  └── ...

options/
  ├── tiu-pola-01-a.jpg
  ├── tiu-pola-01-b.jpg
  ├── tiu-pola-01-c.jpg
  ├── tiu-pola-01-d.jpg
  └── ...
```

### 5. Accessibility

Selalu provide `alt` text untuk screen readers:
```json
{
  "key": "A",
  "text": "Pilihan A",
  "image_url": "https://.../pattern-a.jpg",
  "image_alt": "Segitiga biru menghadap atas dengan lingkaran merah di dalamnya"
}
```

---

## 💡 Contoh Soal Figural

### Contoh 1: Pola Gambar (TIU)

**Soal:**
```
Gambar manakah yang melanjutkan pola berikut?
```

**Gambar Soal:**
```
[Gambar menunjukkan: ■ □ ■ □ ■ ? ]
```

**Pilihan:**
- A: ■ (kotak hitam)
- B: □ (kotak putih)
- C: ● (lingkaran hitam)
- D: ○ (lingkaran putih)

**Jawaban:** B (pola alternating hitam-putih, selanjutnya putih)

**Data di Database:**
```json
{
  "question_text": "Gambar manakah yang melanjutkan pola di atas?",
  "question_type": "figural",
  "question_image_url": "https://.../pattern-sequence.jpg",
  "options": [
    {"key": "A", "text": "Kotak hitam", "image_url": "https://.../black-square.jpg"},
    {"key": "B", "text": "Kotak putih", "image_url": "https://.../white-square.jpg"},
    {"key": "C", "text": "Lingkaran hitam", "image_url": "https://.../black-circle.jpg"},
    {"key": "D", "text": "Lingkaran putih", "image_url": "https://.../white-circle.jpg"}
  ],
  "answer_key": {"correct": "B", "score": 5}
}
```

### Contoh 2: Analogi Gambar (TIU)

**Soal:**
```
Jika [Gambar A] berhubungan dengan [Gambar B],
maka [Gambar C] berhubungan dengan...
```

**Gambar Soal:**
```
[Diagram showing: A→B, C→?]
```

**Pilihan:**
- A: Gambar transformasi 1
- B: Gambar transformasi 2
- C: Gambar transformasi 3
- D: Gambar transformasi 4

### Contoh 3: Lambang/Logo (TWK)

**Soal:**
```
Lambang di bawah ini adalah lambang dari...
```

**Gambar Soal:**
```
[Gambar menunjukkan lambang Garuda Pancasila]
```

**Pilihan (tanpa gambar, hanya text):**
- A: Kementerian Dalam Negeri
- B: Republik Indonesia
- C: Tentara Nasional Indonesia
- D: Kepolisian Republik Indonesia

**Jawaban:** B

**Data:**
```json
{
  "question_text": "Lambang di atas adalah lambang dari...",
  "question_type": "figural",
  "question_image_url": "https://.../garuda-pancasila.jpg",
  "options": [
    {"key": "A", "text": "Kementerian Dalam Negeri"},
    {"key": "B", "text": "Republik Indonesia"},
    {"key": "C", "text": "Tentara Nasional Indonesia"},
    {"key": "D", "text": "Kepolisian Republik Indonesia"}
  ],
  "answer_key": {"correct": "B", "score": 5}
}
```

---

## 🔍 Display Gambar di UI

Gambar akan otomatis ditampilkan di:
- ✅ **Tryout Runner** (user interface)
- ✅ **Real Tryout** (timer mode)
- ✅ **Practice Mode** (latihan)
- ✅ **Admin Preview** (saat edit/create)

**Layout:**
1. Gambar soal ditampilkan di atas pertanyaan
2. Gambar pilihan ditampilkan sebagai thumbnail di samping text
3. Responsive: gambar auto-resize di mobile

---

## 🐛 Troubleshooting

### Problem: Gambar tidak muncul

**Causes:**
1. URL gambar salah/expired
2. Bucket storage tidak public
3. CORS policy belum diset

**Solution:**
```sql
-- Cek bucket policy
SELECT * FROM storage.buckets WHERE name = 'question-images';

-- Pastikan bucket public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'question-images';
```

### Problem: Upload failed

**Causes:**
1. File terlalu besar (>5MB)
2. Format file tidak didukung
3. Permission denied

**Solution:**
- Compress gambar sebelum upload
- Gunakan format JPG/PNG
- Cek user authentication

### Problem: Gambar broken di production

**Causes:**
- Environment variable berbeda
- URL hardcoded

**Solution:**
- Gunakan `NEXT_PUBLIC_SUPABASE_URL` dari env
- Store relative path, build full URL di runtime

---

## 📊 Performance Tips

### 1. Lazy Loading
Gambar di-load on-demand, tidak semua sekaligus

### 2. Image Optimization
Next.js Image component sudah auto-optimize:
```tsx
<Image 
  src={imageUrl} 
  alt={imageAlt}
  width={400}
  height={300}
  loading="lazy"
/>
```

### 3. CDN Caching
Supabase Storage sudah provide CDN caching

### 4. Thumbnail Generation
Untuk preview list, generate thumbnail:
```sql
-- Store thumbnail URL separately
ALTER TABLE questions ADD COLUMN question_image_thumb_url text;
```

---

## 📋 Checklist Soal Figural

Sebelum publish soal figural:

- [ ] Gambar soal sudah diupload dan URL valid
- [ ] Gambar pilihan (jika ada) sudah diupload
- [ ] All image URLs accessible (test buka di browser)
- [ ] Image dimensions consistent antar pilihan
- [ ] Alt text provided untuk accessibility
- [ ] File size < 1MB per gambar
- [ ] Jawaban benar sudah di-set dengan benar
- [ ] Pembahasan mencakup penjelasan visual
- [ ] Test tampilan di tryout runner
- [ ] Test di mobile device

---

## 🔗 Resources

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Image Optimization Tools](https://tinypng.com)
- [Accessibility Guidelines](https://www.w3.org/WAI/tutorials/images/)

---

**Happy Creating Figural Questions! 🎨📚**
