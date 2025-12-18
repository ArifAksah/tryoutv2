# 📐 Panduan Menulis Rumus Matematika & Fisika

Panduan lengkap untuk menulis soal dengan rumus matematika dan fisika menggunakan LaTeX notation.

---

## 📋 Overview

Aplikasi ini mendukung **LaTeX math notation** menggunakan KaTeX untuk rendering rumus matematika dan fisika di soal, pilihan jawaban, dan pembahasan.

**Syntax:**
- **Inline math** (dalam teks): `$rumus$`
- **Display math** (blok terpisah): `$$rumus$$`

---

## 🚀 Quick Start

### Contoh Dasar

**Input:**
```
Jika $x = 2$ dan $y = 3$, maka $x + y = ?$
```

**Output:**
Jika *x* = 2 dan *y* = 3, maka *x* + *y* = ?

**Input Display Math:**
```
Rumus kuadrat:
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
dengan $a \neq 0$
```

**Output:**
Rumus kuadrat:

*x* = (-*b* ± √(*b*² - 4*ac*)) / 2*a*

dengan *a* ≠ 0

---

## 📝 Syntax LaTeX Umum

### 1. Operasi Dasar

| Math | LaTeX | Hasil |
|------|-------|-------|
| Penjumlahan | `$a + b$` | *a* + *b* |
| Pengurangan | `$a - b$` | *a* - *b* |
| Perkalian | `$a \times b$` atau `$a \cdot b$` | *a* × *b* atau *a* · *b* |
| Pembagian | `$a \div b$` atau `$\frac{a}{b}$` | *a* ÷ *b* atau *a*/*b* |
| Pangkat | `$x^2$` atau `$x^{10}$` | *x*² atau *x*¹⁰ |
| Akar kuadrat | `$\sqrt{x}$` | √*x* |
| Akar n | `$\sqrt[n]{x}$` | ⁿ√*x* |

### 2. Pecahan

```latex
$\frac{numerator}{denominator}$
```

**Contoh:**
```latex
$\frac{1}{2}$          → ½
$\frac{x + 1}{x - 1}$  → (x+1)/(x-1)
$\frac{a^2 + b^2}{c}$  → (a²+b²)/c
```

### 3. Pangkat & Indeks

```latex
$x^2$          → x²
$x^{10}$       → x¹⁰
$x_1$          → x₁
$x_{max}$      → xₘₐₓ
$x^2_i$        → xᵢ²
```

### 4. Akar

```latex
$\sqrt{x}$        → √x
$\sqrt{x + y}$    → √(x+y)
$\sqrt[3]{8}$     → ³√8
$\sqrt[n]{x}$     → ⁿ√x
```

### 5. Perbandingan

```latex
$a = b$       → a = b
$a \neq b$    → a ≠ b
$a < b$       → a < b
$a \leq b$    → a ≤ b
$a > b$       → a > b
$a \geq b$    → a ≥ b
$a \approx b$ → a ≈ b
```

### 6. Simbol Yunani

```latex
$\alpha$   → α    $\beta$    → β
$\gamma$   → γ    $\delta$   → δ
$\theta$   → θ    $\pi$      → π
$\lambda$  → λ    $\mu$      → μ
$\sigma$   → σ    $\omega$   → ω
$\Omega$   → Ω    $\Delta$   → Δ
```

### 7. Fungsi Matematika

```latex
$\sin(x)$        → sin(x)
$\cos(x)$        → cos(x)
$\tan(x)$        → tan(x)
$\log(x)$        → log(x)
$\ln(x)$         → ln(x)
$\lim_{x \to 0}$ → lim[x→0]
$\sum_{i=1}^{n}$ → Σ[i=1 to n]
$\int_{a}^{b}$   → ∫[a to b]
```

---

## 🧮 Contoh Soal Matematika

### Soal 1: Aljabar

**Question Text:**
```
Jika $x^2 - 5x + 6 = 0$, maka nilai $x$ yang memenuhi adalah...
```

**Options:**
```
A. $x = 1$ atau $x = 6$
B. $x = 2$ atau $x = 3$
C. $x = -2$ atau $x = -3$
D. $x = 5$ atau $x = 1$
```

**Discussion:**
```
Faktorkan: $(x - 2)(x - 3) = 0$
Jadi $x = 2$ atau $x = 3$
```

### Soal 2: Geometri

**Question Text:**
```
Luas lingkaran dengan jari-jari $r = 7$ cm adalah...
(gunakan $\pi = \frac{22}{7}$)
```

**Options:**
```
A. $44$ cm²
B. $88$ cm²
C. $154$ cm²
D. $308$ cm²
```

**Discussion:**
```
$$L = \pi r^2 = \frac{22}{7} \times 7^2 = \frac{22}{7} \times 49 = 154 \text{ cm}^2$$
```

### Soal 3: Trigonometri

**Question Text:**
```
Nilai dari $\sin(30°) + \cos(60°)$ adalah...
```

**Options:**
```
A. $0$
B. $\frac{1}{2}$
C. $1$
D. $\frac{3}{2}$
```

**Discussion:**
```
$$\sin(30°) = \frac{1}{2}, \quad \cos(60°) = \frac{1}{2}$$
$$\sin(30°) + \cos(60°) = \frac{1}{2} + \frac{1}{2} = 1$$
```

### Soal 4: Statistika

**Question Text:**
```
Rata-rata dari data: $2, 4, 6, 8, 10$ adalah...
```

**Options:**
```
A. $5$
B. $6$
C. $7$
D. $8$
```

**Discussion:**
```
$$\bar{x} = \frac{2 + 4 + 6 + 8 + 10}{5} = \frac{30}{5} = 6$$
```

---

## ⚛️ Contoh Soal Fisika

### Soal 1: Mekanika

**Question Text:**
```
Sebuah benda bermassa $m = 2$ kg bergerak dengan kecepatan $v = 5$ m/s. 
Energi kinetiknya adalah... (gunakan $E_k = \frac{1}{2}mv^2$)
```

**Options:**
```
A. $10$ J
B. $25$ J
C. $50$ J
D. $100$ J
```

**Discussion:**
```
$$E_k = \frac{1}{2}mv^2 = \frac{1}{2} \times 2 \times 5^2 = 1 \times 25 = 25 \text{ J}$$
```

### Soal 2: Listrik

**Question Text:**
```
Hambatan total dari dua resistor $R_1 = 10 \Omega$ dan $R_2 = 20 \Omega$ 
yang dipasang seri adalah...
```

**Options:**
```
A. $5 \Omega$
B. $15 \Omega$
C. $30 \Omega$
D. $200 \Omega$
```

**Discussion:**
```
Rangkaian seri: $R_{total} = R_1 + R_2$
$$R_{total} = 10 + 20 = 30 \Omega$$
```

### Soal 3: Relativitas

**Question Text:**
```
Menurut Einstein, hubungan energi dan massa adalah...
```

**Options:**
```
A. $E = mc$
B. $E = mc^2$
C. $E = \frac{1}{2}mc^2$
D. $E = 2mc^2$
```

**Discussion:**
```
Rumus terkenal Einstein:
$$E = mc^2$$
dengan $E$ = energi, $m$ = massa, $c$ = kecepatan cahaya
```

### Soal 4: Termodinamika

**Question Text:**
```
Tekanan gas ideal pada suhu tetap berbanding lurus dengan...
$$PV = nRT$$
```

**Options:**
```
A. Volume
B. Suhu
C. Jumlah mol
D. Konstanta gas
```

---

## 🎯 Tips & Best Practices

### 1. Inline vs Display Math

**Gunakan Inline ($...$) untuk:**
- Variabel dalam kalimat: "nilai $x = 5$"
- Persamaan pendek: "$a + b = c$"
- Unit: "$10$ m/s"

**Gunakan Display ($$...$$) untuk:**
- Rumus panjang atau penting
- Persamaan multi-line
- Rumus yang perlu penekanan

### 2. Formatting Tips

✅ **DO:**
```latex
$\frac{a + b}{c}$          → Pecahan jelas
$x^{10}$                   → Pangkat > 9 pakai kurung
$\sqrt{x + y}$             → Akar dengan ekspresi
$$E = mc^2$$               → Rumus penting di blok terpisah
```

❌ **DON'T:**
```latex
$a + b / c$                → Ambigu, pakai \frac
$x^10$                     → Bisa jadi x¹0 bukan x¹⁰
E = mc^2                   → Tanpa $ tidak ter-render
$ x=2 $                    → Spasi berlebihan
```

### 3. Readability

**Clear:**
```
Jika $x = 2$ dan $y = 3$, maka $x + y = 5$
```

**Confusing:**
```
Jika x = 2 dan y = 3, maka x + y = 5  (tidak ada math rendering)
```

### 4. Complex Formulas

**Break into parts:**
```
Rumus kuadrat:
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

dengan:
- $a$ = koefisien $x^2$
- $b$ = koefisien $x$  
- $c$ = konstanta
```

---

## 📤 Import JSON dengan Math

### Template

```json
{
  "category_slug": "aljabar",
  "question_text": "Jika $x^2 - 5x + 6 = 0$, maka nilai $x$ adalah...",
  "question_type": "multiple_choice",
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

**PENTING:** 
- Escape backslash ganda di JSON: `\\frac` → `\frac` (JSON parser handle otomatis)
- Atau gunakan raw string di text editor

---

## 🔧 Advanced LaTeX

### Matrices

```latex
$$\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}$$
```

### System of Equations

```latex
$$\begin{cases}
x + y = 5 \\
x - y = 1
\end{cases}$$
```

### Subscript & Superscript

```latex
$x_1^2 + x_2^2 + \cdots + x_n^2$
```

### Fractions in Fractions

```latex
$$\frac{1 + \frac{1}{x}}{1 - \frac{1}{x}}$$
```

### Greek Letters

```latex
$\alpha\beta\gamma\delta\epsilon\zeta\eta\theta$
$\lambda\mu\pi\sigma\phi\psi\omega$
```

---

## 🐛 Troubleshooting

### Problem: Math tidak ter-render

**Causes:**
- Lupa $ atau $$
- Syntax LaTeX salah
- Karakter special tidak di-escape

**Solution:**
```latex
❌ x^2 + 5           → Plain text
✅ $x^2 + 5$         → Rendered

❌ $\frac{a}{b       → Unclosed
✅ $\frac{a}{b}$     → Correct

❌ $x < 5$           → Might break HTML
✅ $x \lt 5$         → Safe
```

### Problem: Kompleks formula tidak muncul

**Solution:**
Break into smaller parts atau check syntax di [KaTeX Playground](https://katex.org/)

### Problem: JSON parse error

**Solution:**
```json
// ❌ Wrong (backslash issue)
"text": "$\frac{a}{b}$"

// ✅ Correct (escaped)
"text": "$\\frac{a}{b}$"

// atau gunakan raw string di editor
```

---

## 📚 Resources

- **KaTeX Documentation**: https://katex.org/docs/supported.html
- **KaTeX Playground**: https://katex.org/ (test formulas)
- **LaTeX Math Symbols**: https://oeis.org/wiki/List_of_LaTeX_mathematical_symbols
- **Detexify**: http://detexify.kirelabs.org/classify.html (draw symbol → get LaTeX)

---

## ✅ Checklist

Sebelum submit soal dengan math:

- [ ] Test formula di admin form preview
- [ ] Check display di tryout runner
- [ ] Verify di mobile view
- [ ] Test dengan different browsers
- [ ] Ensure formula in discussion also rendered
- [ ] Check JSON escape jika import

---

**Happy Math Typing! 📐✨**
