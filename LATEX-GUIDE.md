# 📐 Panduan LaTeX untuk Soal Matematika

Sistem ini mendukung rendering rumus matematika menggunakan **LaTeX** dengan library KaTeX.

## 🎯 Format LaTeX

### 1. **Inline Math** (di dalam teks)
Gunakan single dollar sign `$...$`

```json
{
  "question_text": "Jika $x = 3$ dan $y = 5$, maka nilai dari $x^2 + y^2$ adalah..."
}
```

**Hasil:** Jika *x = 3* dan *y = 5*, maka nilai dari *x² + y²* adalah...

### 2. **Display Math** (rumus besar, di baris sendiri)
Gunakan double dollar sign `$$...$$`

```json
{
  "question_text": "Bentuk sederhana dari $$\\frac{x^2 - 9}{x + 3}$$ adalah..."
}
```

**Hasil:** Bentuk sederhana dari
```
x² - 9
------
x + 3
```
adalah...

### 3. **Mixed** (kombinasi inline dan display)
```json
{
  "discussion": "Rumus luas lingkaran: $$L = \\pi r^2$$ dengan $r$ adalah jari-jari."
}
```

## 📝 Contoh LaTeX Umum

### Operasi Dasar
```latex
$x + y$           → x + y
$x - y$           → x - y
$x \times y$      → x × y
$x \div y$        → x ÷ y
$\frac{a}{b}$     → a/b (pecahan)
```

### Pangkat & Akar
```latex
$x^2$             → x²
$x^{10}$          → x¹⁰
$\sqrt{x}$        → √x
$\sqrt[3]{x}$     → ³√x
```

### Persamaan
```latex
$x^2 + 2x + 1 = 0$
$$ax^2 + bx + c = 0$$
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
```

### Trigonometri
```latex
$\sin(x)$, $\cos(x)$, $\tan(x)$
$\sin^2(x) + \cos^2(x) = 1$
```

### Simbol Matematika
```latex
$\pi$             → π
$\alpha$          → α
$\theta$          → θ
$\leq$            → ≤
$\geq$            → ≥
$\neq$            → ≠
$\approx$         → ≈
$\infty$          → ∞
```

### Simbol Logika
```latex
$\land$           → ∧ (AND)
$\lor$            → ∨ (OR)
$\neg$            → ¬ (NOT)
$\Rightarrow$     → ⇒ (implies)
$\Leftrightarrow$ → ⇔ (iff)
```

### Himpunan
```latex
$\cup$            → ∪ (union)
$\cap$            → ∩ (intersection)
$\in$             → ∈ (element of)
$\subset$         → ⊂ (subset)
$\emptyset$       → ∅ (empty set)
```

## 📦 Format JSON dengan LaTeX

### Soal Multiple Choice
```json
{
  "category_slug": "aljabar",
  "question_text": "Jika $x = 3$, maka $x^2 + 2x$ adalah...",
  "question_type": "multiple_choice",
  "options": [
    { "key": "A", "text": "$15$" },
    { "key": "B", "text": "$12$" },
    { "key": "C", "text": "$9$" },
    { "key": "D", "text": "$6$" }
  ],
  "answer_key": {
    "correct": "A",
    "score": 5
  },
  "discussion": "Substitusi: $x^2 + 2x = 3^2 + 2(3) = 9 + 6 = 15$"
}
```

### Soal dengan Rumus Display
```json
{
  "question_text": "Luas lingkaran dengan rumus $$L = \\pi r^2$$ dimana $r = 7$ cm adalah...",
  "options": [
    { "key": "A", "text": "$154 \\text{ cm}^2$" },
    { "key": "B", "text": "$49 \\text{ cm}^2$" }
  ]
}
```

## ⚠️ Tips Penting

### 1. **Escape Backslash di JSON**
LaTeX menggunakan `\`, tapi di JSON harus di-escape menjadi `\\`

❌ **Salah:**
```json
"question_text": "Nilai \frac{1}{2} adalah..."
```

✅ **Benar:**
```json
"question_text": "Nilai $\\frac{1}{2}$ adalah..."
```

### 2. **Spasi dalam LaTeX**
Gunakan `\ ` untuk spasi, atau `\text{...}` untuk teks biasa

```latex
$x\ \text{adalah variabel}$
```

### 3. **Teks dalam Rumus**
Gunakan `\text{...}` untuk teks normal dalam rumus

```latex
$5 \text{ cm}^2$           → 5 cm²
$x \text{ meter per detik}$ → x meter per detik
```

### 4. **Kurung Besar**
Untuk pecahan dengan kurung besar, gunakan `\left` dan `\right`

```latex
$$\left(\frac{a}{b}\right)^2$$
```

## 🎨 Contoh Lengkap

File contoh: `data import/tiu-matematika-latex-example.json`

```json
[
  {
    "category_slug": "aljabar",
    "question_text": "Jika $x = 3$ dan $y = 5$, maka nilai dari $x^2 + y^2$ adalah...",
    "question_type": "multiple_choice",
    "options": [
      { "key": "A", "text": "$34$" },
      { "key": "B", "text": "$25$" }
    ],
    "answer_key": {
      "correct": "A",
      "score": 5
    },
    "discussion": "Substitusi: $x^2 + y^2 = 3^2 + 5^2 = 9 + 25 = 34$"
  }
]
```

## 🚀 Cara Import

1. Buat file JSON dengan format di atas
2. Masuk **Admin Panel** → **Bank Soal** → **Import JSON**
3. Upload file
4. Rumus LaTeX otomatis ter-render di tryout!

## 📚 Referensi

- **KaTeX Docs**: https://katex.org/docs/supported.html
- **LaTeX Math Symbols**: https://oeis.org/wiki/List_of_LaTeX_mathematical_symbols
- **Online LaTeX Editor**: https://www.codecogs.com/latex/eqneditor.php

---

**Note:** Sistem menggunakan KaTeX untuk rendering yang lebih cepat dari MathJax. Mayoritas LaTeX math commands didukung.
