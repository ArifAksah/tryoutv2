import { getSupabaseServerClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

export type Topic = {
  id: string;
  name: string;
  description?: string;
  questionCount?: number;
  durationMinutes?: number;
};

export type ExamSection = {
  id: string;
  name: string;
  code: string;
  type: "SKD" | "SKB";
  description?: string;
  school?: string;
  topics: Topic[];
};

export type ExamStructureSource = "supabase" | "sample";

export type ExamStructureResult = {
  sections: ExamSection[];
  source: ExamStructureSource;
};

type SupabaseCategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type: string | null;
  duration_minutes?: number | null;
};

type SupabaseInstitutionRow = {
  id: string;
  code: string;
  name: string;
  logo_url?: string | null;
};

type SupabaseBlueprintRow = {
  institution_id: string;
  category_id: string;
  question_count: number;
  passing_grade?: number | null;
};

function toCode(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]+/g, "").trim();
  if (!clean) return value.toUpperCase();
  return clean.toUpperCase().slice(0, 12);
}

export const sampleExamSections: ExamSection[] = [
  {
    id: "twk",
    name: "Tes Wawasan Kebangsaan",
    code: "TWK",
    type: "SKD",
    description: "Landasan kebangsaan, konstitusi, dan wawasan kenegaraan.",
    topics: [
      {
        id: "twk-pancasila",
        name: "Pancasila & UUD 1945",
        description: "Pemahaman nilai, sejarah, dan penerapan konstitusi.",
      },
      {
        id: "twk-nkri",
        name: "NKRI & Bhinneka Tunggal Ika",
        description: "Persatuan, keutuhan wilayah, serta wawasan nusantara.",
      },
      {
        id: "twk-sejarah",
        name: "Sejarah Kebangsaan",
        description: "Pergerakan nasional dan dinamika kebijakan publik.",
      },
    ],
  },
  {
    id: "tiu",
    name: "Tes Intelegensi Umum",
    code: "TIU",
    type: "SKD",
    description: "Kemampuan logika, numerik, dan penalaran analitis.",
    topics: [
      {
        id: "tiu-deret",
        name: "Deret & Aritmetika",
        description: "Deret bilangan, aritmetika, dan perbandingan.",
      },
      {
        id: "tiu-silogisme",
        name: "Silogisme & Logika",
        description: "Pola logika, premis, dan kesimpulan valid.",
      },
      {
        id: "tiu-analogi",
        name: "Analogi Verbal & Spasial",
        description: "Padanan kata, bentuk, dan pola hubungan.",
      },
    ],
  },
  {
    id: "tkp",
    name: "Tes Karakteristik Pribadi",
    code: "TKP",
    type: "SKD",
    description: "Sikap pelayanan, manajerial, dan etika profesional.",
    topics: [
      {
        id: "tkp-layanan",
        name: "Pelayanan Publik",
        description: "Orientasi layanan, empati, dan solusi warga.",
      },
      {
        id: "tkp-profesional",
        name: "Profesionalisme & Integritas",
        description: "Etika kerja, kejujuran, dan tanggung jawab.",
      },
      {
        id: "tkp-manajerial",
        name: "Manajerial & Kepemimpinan",
        description: "Pengambilan keputusan, koordinasi, dan kolaborasi.",
      },
    ],
  },
  {
    id: "stis",
    name: "Politeknik Statistika STIS",
    code: "STIS",
    type: "SKB",
    description: "Konsentrasi statistika, matematika, dan pemodelan data.",
    school: "Politeknik Statistika STIS",
    topics: [
      {
        id: "stis-math",
        name: "Matematika Lanjut",
        description: "Aljabar linear, kalkulus, dan analisis numerik.",
        questionCount: 12,
        durationMinutes: 12,
      },
      {
        id: "stis-stat",
        name: "Statistika Dasar",
        description: "Distribusi, inferensi, dan regresi sederhana.",
        questionCount: 14,
        durationMinutes: 14,
      },
      {
        id: "stis-ro",
        name: "Riset Operasi",
        description: "Optimasi linier dan pemrograman dinamis.",
        questionCount: 8,
        durationMinutes: 10,
      },
    ],
  },
  {
    id: "stmkg",
    name: "STMKG (Meteorologi, Klimatologi, Geofisika)",
    code: "STMKG",
    type: "SKB",
    description: "Fokus atmosfer, klimatologi, dan geofisika terapan.",
    school: "STMKG",
    topics: [
      {
        id: "stmkg-met",
        name: "Meteorologi Dasar",
        description: "Dinamika atmosfer, siklon, dan sistem cuaca.",
        questionCount: 10,
        durationMinutes: 10,
      },
      {
        id: "stmkg-klim",
        name: "Klimatologi",
        description: "Pola iklim, ENSO, dan perubahan iklim.",
        questionCount: 9,
        durationMinutes: 9,
      },
      {
        id: "stmkg-fis",
        name: "Fisika Bumi",
        description: "Geofisika dasar dan penginderaan jauh.",
        questionCount: 8,
        durationMinutes: 9,
      },
    ],
  },
  {
    id: "stan",
    name: "PKN STAN",
    code: "STAN",
    type: "SKB",
    description: "Akuntansi pemerintahan, perpajakan, dan hukum fiskal.",
    school: "PKN STAN",
    topics: [
      {
        id: "stan-akuntansi",
        name: "Akuntansi Pemerintahan",
        description: "SAP, laporan keuangan, dan rekonsiliasi aset.",
        questionCount: 12,
        durationMinutes: 12,
      },
      {
        id: "stan-perpajakan",
        name: "Perpajakan",
        description: "PPN, PPh, dan administrasi perpajakan.",
        questionCount: 10,
        durationMinutes: 10,
      },
      {
        id: "stan-hukum",
        name: "Hukum Keuangan Negara",
        description: "Regulasi APBN, audit, dan tata kelola fiskal.",
        questionCount: 8,
        durationMinutes: 9,
      },
    ],
  },
  {
    id: "ipdn",
    name: "IPDN",
    code: "IPDN",
    type: "SKB",
    description: "Administrasi pemerintahan, otonomi daerah, dan kepamongprajaan.",
    school: "IPDN",
    topics: [
      {
        id: "ipdn-tatapemerintahan",
        name: "Tata Pemerintahan",
        description: "Hubungan pusat-daerah dan perundang-undangan.",
        questionCount: 10,
        durationMinutes: 9,
      },
      {
        id: "ipdn-manajemen",
        name: "Manajemen Publik",
        description: "Perencanaan, penganggaran, dan evaluasi kinerja.",
        questionCount: 9,
        durationMinutes: 9,
      },
      {
        id: "ipdn-kepemimpinan",
        name: "Kepemimpinan Lapangan",
        description: "Kepemimpinan taktis dan koordinasi lintas instansi.",
        questionCount: 8,
        durationMinutes: 8,
      },
    ],
  },
];

export async function fetchExamStructure(opts?: {
  mode?: "tryout" | "admin";
}): Promise<ExamStructureResult> {
  const mode = opts?.mode ?? "tryout";

  if (!hasSupabasePublicEnv()) {
    return { sections: sampleExamSections, source: "sample" } as const;
  }

  const supabase = await getSupabaseServerClient("read");

  /* 
     Dynamic Fetching: 
     Fetch all categories where parent_id is null.
     We treat 'skd' as SKD, and everything else as SKB (or generic sections).
  */
  const { data: roots, error: rootError } = await supabase
    .from("categories")
    .select("id, slug, name")
    .is("parent_id", null)
    .order("name");

  if (rootError || !roots?.length) {
    if (rootError) {
      console.warn("Supabase categories(root) error", rootError.message);
    }
    // If we fail to get dynamic data, fallback to sample ONLY if environment is not set properly,
    // but here we know environment is set, so it might just be empty DB.
    // If completely empty, sampleExamSections might be returned, or just empty list.
    // Preserving existing fallback behavior for now.
    return { sections: sampleExamSections, source: "sample" };
  }

  if (mode === "admin") {
    const normalized = await fetchCategoryBasedStructure(supabase, roots);
    return { sections: normalized, source: "supabase" };
  }

  // Separate roots
  const skdRoot = roots.find((r) => r.slug === "skd") ?? null;
  // All other roots are considered "SKB" or "Custom Sections"
  // We exclude SKD from this list to avoid duplication
  const otherRoots = roots.filter((r) => r.slug !== "skd");

  const skdSections = skdRoot
    ? await fetchCategoryBasedStructure(supabase, [skdRoot])
    : [];

  // For other roots, we also use the category-based structure.
  // The original code used `fetchSkbInstitutionStructure` which looked at `institutions` table.
  // User wants "Subject Categories" (from categories table) to be the source of truth for SKB now.
  // So we arguably should use `fetchCategoryBasedStructure` for these too, 
  // OR we keep the old logic if "institutions" table is still used? 
  // The user showed "SKB STMKG" in the CATEGORY table in the screenshot.
  // So we should definitely use `fetchCategoryBasedStructure` for `otherRoots`.

  const dynamicSkbSections = await fetchCategoryBasedStructure(supabase, otherRoots);

  // We can still try to fetch 'old style' institution SKBs if they exist and are NOT covered by the category roots?
  // But likely the user is migrating to everything-in-categories. 
  // For safety, let's append dynamicSkbSections. 
  // Note: `fetchSkbInstitutionStructure` logic is specific to `institutions` table + `exam_blueprints`.
  // If the user is moving to `categories` table for SKB, we should rely on that.
  // We will assume `otherRoots` covers the new SKB needs.

  return { sections: [...skdSections, ...dynamicSkbSections], source: "supabase" };
}

async function fetchCategoryBasedStructure(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  roots: Array<{ id: string; slug: string }>
): Promise<ExamSection[]> {
  const rootById = new Map<string, "SKD" | "SKB">();
  roots.forEach((r) => {
    // If root slug is 'skd', it's SKD. Everything else is SKB.
    rootById.set(r.id, r.slug === "skd" ? "SKD" : "SKB");
  });

  const rootIds = roots.map((r) => r.id);
  let sectionCats: unknown[] | null = null;
  let sectionError: { message: string } | null = null;

  ({ data: sectionCats, error: sectionError } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, type, duration_minutes")
    .in("parent_id", rootIds)
    .eq("type", "topic") // Only get sections with type='topic' (TWK, TIU, TKP)
    .order("name", { ascending: true }));

  // Backward compatibility: if the migration adding categories.duration_minutes hasn't been applied yet.
  if (sectionError?.message?.includes("duration_minutes")) {
    console.warn(
      "Supabase categories.duration_minutes is missing. Run supabase/add-category-duration-minutes.sql on your database.",
      sectionError.message
    );

    ({ data: sectionCats, error: sectionError } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, type")
      .in("parent_id", rootIds)
      .eq("type", "topic")
      .order("name", { ascending: true }));
  }

  if (sectionError || !sectionCats?.length) {
    if (sectionError) {
      console.warn("Supabase categories(sections) error", sectionError.message);
    }
    return [];
  }

  const sectionIds = (sectionCats as SupabaseCategoryRow[]).map((c) => c.id);

  let topicCats: unknown[] | null = null;
  let topicError: { message: string } | null = null;

  ({ data: topicCats, error: topicError } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, type, duration_minutes")
    .in("parent_id", sectionIds)
    .eq("type", "subtopic") // Only get subtopics
    .order("name", { ascending: true }));

  if (topicError?.message?.includes("duration_minutes")) {
    console.warn(
      "Supabase categories.duration_minutes is missing. Run supabase/add-category-duration-minutes.sql on your database.",
      topicError.message
    );

    ({ data: topicCats, error: topicError } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, type")
      .in("parent_id", sectionIds)
      .eq("type", "subtopic")
      .order("name", { ascending: true }));
  }

  if (topicError) {
    console.warn("Supabase categories(subtopics) error", topicError.message);
  }

  // Get question counts for each section (recursive - includes all descendants)
  const questionCountMap = new Map<string, number>();
  for (const section of sectionCats as SupabaseCategoryRow[]) {
    const { data: count } = await supabase
      .rpc("count_questions_recursive", { category_id: section.id });
    questionCountMap.set(section.id, count || 0);
  }

  const topicMap = new Map<string, Topic[]>();
  (topicCats as SupabaseCategoryRow[] | null | undefined)?.forEach((row) => {
    if (!row.parent_id) return;
    const existing = topicMap.get(row.parent_id) ?? [];
    existing.push({
      id: row.slug,
      name: row.name,
      durationMinutes: row.duration_minutes ?? undefined,
    });
    topicMap.set(row.parent_id, existing);
  });

  return (sectionCats as SupabaseCategoryRow[]).map((row) => {
    const type = row.parent_id ? rootById.get(row.parent_id) ?? "SKD" : "SKD";
    const code = toCode(row.slug);
    const topics = topicMap.get(row.id) ?? [];
    const totalQuestions = questionCountMap.get(row.id) || 0;

    return {
      id: row.slug,
      name: row.name,
      code,
      type,
      description: totalQuestions > 0 ? `${totalQuestions} soal tersedia` : undefined,
      topics,
    };
  });
}

async function fetchSkbInstitutionStructure(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>
): Promise<ExamSection[]> {
  const { data: institutions, error: instError } = await supabase
    .from("institutions")
    .select("id, code, name, logo_url")
    .order("name", { ascending: true });

  if (instError) {
    console.warn("Supabase institutions error", instError.message);
    return [];
  }

  const list = (institutions ?? []) as SupabaseInstitutionRow[];
  if (list.length === 0) return [];

  const institutionIds = list.map((i) => i.id);
  const { data: blueprints, error: blueprintError } = await supabase
    .from("exam_blueprints")
    .select("institution_id, category_id, question_count, passing_grade")
    .in("institution_id", institutionIds);

  if (blueprintError) {
    console.warn("Supabase exam_blueprints error", blueprintError.message);
  }

  const blueprintRows = (blueprints ?? []) as SupabaseBlueprintRow[];
  const categoryIds = Array.from(new Set(blueprintRows.map((b) => b.category_id)));

  const categoryById = new Map<string, { slug: string; name: string }>();
  if (categoryIds.length > 0) {
    const { data: cats, error: catError } = await supabase
      .from("categories")
      .select("id, slug, name")
      .in("id", categoryIds);

    if (catError) {
      console.warn("Supabase categories(blueprint categories) error", catError.message);
    }

    (cats as Array<{ id: string; slug: string; name: string }> | null | undefined)?.forEach((c) => {
      categoryById.set(c.id, { slug: c.slug, name: c.name });
    });
  }

  const blueprintsByInstitution = new Map<string, Topic[]>();
  blueprintRows.forEach((b) => {
    const cat = categoryById.get(b.category_id);
    const topicId = cat?.slug ?? b.category_id;
    const topicName = cat?.name ?? topicId;
    const existing = blueprintsByInstitution.get(b.institution_id) ?? [];
    existing.push({
      id: topicId,
      name: topicName,
      questionCount: b.question_count,
    });
    blueprintsByInstitution.set(b.institution_id, existing);
  });

  return list.map((inst) => {
    const id = inst.code.trim().toLowerCase();
    const topics = blueprintsByInstitution.get(inst.id) ?? [];

    return {
      id,
      name: inst.name,
      code: inst.code,
      type: "SKB",
      school: inst.code,
      topics,
    };
  });
}
