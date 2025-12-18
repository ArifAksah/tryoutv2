# 🎓 Aplikasi Tryout Sekolah Kedinasan

Aplikasi tryout berbasis web untuk persiapan ujian Sekolah Kedinasan (SKD & SKB) dengan fitur timer real-time, scoring otomatis, dan mode latihan per sub-topik.

![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0-38bdf8)

---

## ✨ Fitur Utama

### 🎯 Untuk User
- **Tryout Real dengan Timer**
  - SKD: TWK + TIU + TKP (110 soal, 100 menit)
  - SKB: Per sekolah kedinasan dengan blueprint custom
  - Auto-submit saat waktu habis atau semua soal dijawab
  - Scoring server-side untuk prevent cheating

- **Mode Latihan per Sub-Topik**
  - Latihan tanpa timer untuk pendalaman materi
  - Pilih sub-topik spesifik (e.g., Silogisme, Bilangan Deret)
  - Pilih jumlah soal (10, 20, 30, 50, atau semua)
  - Review langsung dengan pembahasan per soal

- **Dashboard Interaktif**
  - Statistik real-time
  - Quick access ke SKD dan SKB
  - Progress tracking

### 👨‍💼 Untuk Admin
- **Bank Soal Management**
  - CRUD soal dengan interface intuitif
  - Support 2 tipe soal:
    - Multiple Choice (pilihan ganda)
    - TKP Scale (skala penilaian)
  - Upload pembahasan untuk setiap soal

- **Kategori Hierarkis**
  - Struktur 3 tingkat: Subject → Topic → Subtopic
  - Self-referencing categories
  - Flexible dan scalable

- **Institutions & Blueprints**
  - Kelola sekolah kedinasan (STAN, STIS, IPDN, dll)
  - Buat blueprint komposisi soal per sekolah
  - Automatic question generation dari blueprint

- **Admin Dashboard**
  - Statistik lengkap (total soal, kategori, institutions)
  - Quick actions untuk manajemen cepat
  - Real-time data dari database

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Styling:** TailwindCSS
- **Deployment:** Vercel Ready

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ dan npm/yarn
- Akun Supabase
- Git

### 1. Clone Repository

```bash
git clone <repository-url>
cd tryout-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Buat file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Setup Database

Jalankan migration files di Supabase SQL Editor secara berurutan:

```sql
-- 1. Schema utama
supabase/migrate-to-categories-schema.sql

-- 2. Institutions & Blueprints
supabase/add-institutions-blueprints.sql

-- 3. RPC Functions
supabase/skb-blueprints-rpc.sql
supabase/tryout-real-rpc.sql
supabase/practice-mode-rpc.sql

-- 4. (Opsional) Seed data
supabase/seed.sql

-- 5. Reload schema
NOTIFY pgrst, 'reload schema';
```

### 5. Set Admin User

Di Supabase Dashboard → Authentication → Users → Pilih user → Edit User Metadata:

```json
{
  "role": "admin"
}
```

### 6. Run Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## 📁 Struktur Project

```
tryout-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Login/Register pages
│   │   ├── admin/             # Admin panel
│   │   │   ├── page.tsx      # Admin dashboard
│   │   │   ├── questions/    # Bank soal CRUD
│   │   │   ├── institutions/ # Kelola sekolah
│   │   │   └── blueprints/   # Kelola blueprint
│   │   ├── practice/          # Mode latihan
│   │   │   └── [slug]/       # Practice per sub-topik
│   │   ├── tryout/            # Tryout mode
│   │   │   └── real/         # Tryout dengan timer
│   │   ├── sections/          # Detail section
│   │   └── page.tsx          # User dashboard
│   ├── components/            # Reusable components
│   │   ├── exam-section-card.tsx
│   │   ├── practice-runner.tsx
│   │   ├── real-tryout-runner.tsx
│   │   ├── sidebar-shell.tsx
│   │   └── tryout-runner.tsx
│   └── lib/                   # Utilities & helpers
│       ├── auth.ts           # Authentication helpers
│       ├── exam-structure.ts # Fetch exam data
│       ├── questions.ts      # Fetch questions
│       └── supabase/         # Supabase clients
├── supabase/                  # SQL migrations & seeds
│   ├── migrate-to-categories-schema.sql
│   ├── add-institutions-blueprints.sql
│   ├── skb-blueprints-rpc.sql
│   ├── tryout-real-rpc.sql
│   ├── practice-mode-rpc.sql
│   └── seed.sql
├── ADMIN-GUIDE.md            # 📚 Panduan lengkap untuk admin
└── README.md                 # 📖 Project overview
```

---

## 📚 Dokumentasi

### Untuk Admin
Lihat **[ADMIN-GUIDE.md](./ADMIN-GUIDE.md)** untuk panduan lengkap:
- Setup database
- Mengelola bank soal
- Membuat kategori
- Setup institutions & blueprints
- Tips & best practices

### Untuk Developer
- **Database Schema:** Lihat `supabase/migrate-to-categories-schema.sql`
- **RPC Functions:** Lihat `supabase/*.rpc.sql`
- **API Routes:** Lihat `src/app/*/actions.ts`
- **Components:** Lihat `src/components/`

---

## 🗄️ Database Schema Overview

```
┌─────────────────────┐
│    categories       │  (Hierarkis: SKD/SKB → Topic → Subtopic)
├─────────────────────┤
│ id                  │
│ name                │
│ slug                │
│ parent_id ───┐      │
│ type         │      │
└──────────────┼──────┘
               │
         ┌─────┘
         │
┌────────▼────────────┐
│    questions        │  (Bank soal)
├─────────────────────┤
│ id                  │
│ category_id ────────┼─┐
│ question_text       │ │
│ question_type       │ │
│ options (jsonb)     │ │
│ answer_key (jsonb)  │ │
│ discussion          │ │
└─────────────────────┘ │
                        │
┌───────────────────────┘
│
│  ┌─────────────────────┐        ┌──────────────────┐
└──┤  exam_blueprints    ├────────┤  institutions    │
   ├─────────────────────┤        ├──────────────────┤
   │ institution_id      │        │ id               │
   │ category_id         │        │ code (STAN/STIS) │
   │ question_count      │        │ name             │
   │ passing_grade       │        │ logo_url         │
   └─────────────────────┘        └──────────────────┘
```

---

## 🎯 Use Cases

### SKD (Seleksi Kompetensi Dasar)
Ujian standar untuk semua sekolah kedinasan:
- **TWK:** Tes Wawasan Kebangsaan (30 soal)
- **TIU:** Tes Intelegensi Umum (35 soal)
- **TKP:** Tes Karakteristik Pribadi (45 soal)

**Total:** 110 soal, 100 menit

### SKB (Seleksi Kompetensi Bidang)
Ujian spesifik per sekolah kedinasan:
- **STAN:** Ekonomi + Bahasa Inggris
- **STIS:** Matematika + Bahasa Inggris
- **IPDN:** Custom per formasi

Blueprint mengatur komposisi soal per sekolah.

---

## 🔒 Security Features

- ✅ Row Level Security (RLS) di Supabase
- ✅ Server-side scoring untuk prevent cheating
- ✅ Authentication required untuk akses
- ✅ Admin role-based access control
- ✅ SECURITY DEFINER pada RPC functions
- ✅ Cookie-based session management

---

## 🧪 Testing

### Run Linter
```bash
npm run lint
```

### Run Type Check
```bash
npx tsc --noEmit
```

### Build Production
```bash
npm run build
```

---

## 📊 Monitoring

### Query Statistik via SQL

**Total soal per kategori:**
```sql
SELECT 
  c.name, 
  COUNT(q.id) as total 
FROM categories c 
LEFT JOIN questions q ON q.category_id = c.id 
GROUP BY c.name;
```

**Blueprint coverage:**
```sql
SELECT 
  i.name as institution,
  c.name as category,
  eb.question_count as needed,
  COUNT(q.id) as available
FROM exam_blueprints eb
JOIN institutions i ON i.id = eb.institution_id
JOIN categories c ON c.id = eb.category_id
LEFT JOIN questions q ON q.category_id = c.id
GROUP BY i.name, c.name, eb.question_count;
```

---

## 🚧 Roadmap

- [ ] Export hasil tryout ke PDF
- [ ] History tryout per user
- [ ] Leaderboard global
- [ ] Analisis kekuatan & kelemahan per topik
- [ ] Diskusi & forum
- [ ] Push notification reminder
- [ ] Mobile app (React Native)

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 👨‍💻 Developer

Dikembangkan dengan ❤️ menggunakan Next.js dan Supabase

---

## 📞 Support

Untuk pertanyaan atau issue:
- 📚 Baca [ADMIN-GUIDE.md](./ADMIN-GUIDE.md)
- 🐛 Buka GitHub Issues
- 📧 Hubungi maintainer

---

**Happy Coding! 🚀**
