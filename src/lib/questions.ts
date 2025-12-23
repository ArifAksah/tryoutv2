import { getSupabaseServerClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

export type Choice = {
  key: string;
  text: string;
};

export type QuestionType = "multiple_choice" | "scale_tkp";

export type AnswerKey = Record<string, unknown>;

export type Question = {
  id: string;
  sectionId: string;
  topicId: string;
  questionText: string;
  questionType: QuestionType;
  choices: Choice[];
  answerKey: AnswerKey;
  discussion?: string;
};

export type QuestionResult = {
  questions: Question[];
  source: "supabase" | "sample";
};

const sampleQuestions: Question[] = [
  {
    id: "q-twk-1",
    sectionId: "twk",
    topicId: "twk-pancasila",
    questionText: "Nilai Pancasila yang menekankan persatuan bangsa adalah sila ke-",
    questionType: "multiple_choice",
    choices: [
      { key: "A", text: "Pertama" },
      { key: "B", text: "Kedua" },
      { key: "C", text: "Ketiga" },
      { key: "D", text: "Keempat" },
    ],
    answerKey: { correct: "C", score: 5 },
    discussion: "Sila ketiga Pancasila berbunyi Persatuan Indonesia.",
  },
  {
    id: "q-twk-2",
    sectionId: "twk",
    topicId: "twk-nkri",
    questionText: "Lambang Bhinneka Tunggal Ika diambil dari kitab?",
    questionType: "multiple_choice",
    choices: [
      { key: "A", text: "Sutasoma" },
      { key: "B", text: "Arjunawiwaha" },
      { key: "C", text: "Negarakertagama" },
      { key: "D", text: "Bhagavad Gita" },
    ],
    answerKey: { correct: "A", score: 5 },
    discussion: "Frasa Bhinneka Tunggal Ika berasal dari Kakawin Sutasoma.",
  },
  {
    id: "q-tiu-1",
    sectionId: "tiu",
    topicId: "tiu-deret",
    questionText: "Deret: 2, 6, 18, 54, ... suku berikutnya?",
    questionType: "multiple_choice",
    choices: [
      { key: "A", text: "108" },
      { key: "B", text: "162" },
      { key: "C", text: "216" },
      { key: "D", text: "324" },
    ],
    answerKey: { correct: "B", score: 5 },
    discussion: "Pola kali 3: 2×3=6, 6×3=18, 18×3=54, 54×3=162.",
  },
  {
    id: "q-tiu-2",
    sectionId: "tiu",
    topicId: "tiu-silogisme",
    questionText: "Semua A adalah B. Beberapa B adalah C. Maka:",
    questionType: "multiple_choice",
    choices: [
      { key: "A", text: "Semua A pasti C" },
      { key: "B", text: "Sebagian A mungkin C" },
      { key: "C", text: "Tidak ada A yang C" },
      { key: "D", text: "Semua C adalah A" },
    ],
    answerKey: { correct: "B", score: 5 },
    discussion: "Dari premis, A subset B, sebagian B overlap C, maka sebagian A mungkin C.",
  },
  {
    id: "q-tkp-1",
    sectionId: "tkp",
    topicId: "tkp-layanan",
    questionText: "Anda melihat warga kesulitan mengisi formulir online. Sikap terbaik:",
    questionType: "scale_tkp",
    choices: [
      { key: "A", text: "Mengarahkan ke panduan tertulis saja" },
      { key: "B", text: "Meminta menunggu karena antrean panjang" },
      { key: "C", text: "Membantu langsung dan memberi contoh pengisian" },
      { key: "D", text: "Menyuruh kembali esok hari" },
      { key: "E", text: "Memberitahu nomor telepon helpdesk" },
    ],
    answerKey: { A: 2, B: 1, C: 5, D: 1, E: 3 },
    discussion: "Orientasi layanan publik mengutamakan bantuan langsung dan edukasi (C=5). Pilihan D dan B kurang tepat karena tidak membantu (skor 1).",
  },
  {
    id: "q-stis-1",
    sectionId: "stis",
    topicId: "stis-stat",
    questionText: "Mean dari data 2, 4, 6, 8 adalah?",
    questionType: "multiple_choice",
    choices: [
      { key: "A", text: "4" },
      { key: "B", text: "5" },
      { key: "C", text: "6" },
      { key: "D", text: "7" },
    ],
    answerKey: { correct: "B", score: 5 },
    discussion: "Rata-rata = (2+4+6+8)/4 = 5.",
  },
  {
    id: "q-stmkg-1",
    sectionId: "stmkg",
    topicId: "stmkg-met",
    questionText: "Alat untuk mengukur tekanan udara adalah",
    questionType: "multiple_choice",
    choices: [
      { key: "A", text: "Anemometer" },
      { key: "B", text: "Barometer" },
      { key: "C", text: "Higrometer" },
      { key: "D", text: "Termometer" },
    ],
    answerKey: { correct: "B", score: 5 },
    discussion: "Barometer mengukur tekanan udara.",
  },
  {
    id: "q-stan-1",
    sectionId: "stan",
    topicId: "stan-perpajakan",
    questionText: "PPN di Indonesia umumnya dikenakan dengan tarif",
    questionType: "multiple_choice",
    choices: [
      { key: "A", text: "5%" },
      { key: "B", text: "8%" },
      { key: "C", text: "11%" },
      { key: "D", text: "15%" },
    ],
    answerKey: { correct: "C", score: 5 },
    discussion: "Tarif PPN standar saat ini adalah 11%.",
  },
  {
    id: "q-ipdn-1",
    sectionId: "ipdn",
    topicId: "ipdn-tatapemerintahan",
    questionText: "Otonomi daerah diatur dalam UU Nomor",
    questionType: "multiple_choice",
    choices: [
      { key: "A", text: "22/1999" },
      { key: "B", text: "32/2004" },
      { key: "C", text: "23/2014" },
      { key: "D", text: "11/2020" },
    ],
    answerKey: { correct: "C", score: 5 },
    discussion: "UU 23/2014 menjadi dasar terbaru otonomi daerah.",
  },
];

export async function fetchQuestionsForSection(sectionId: string): Promise<QuestionResult> {
  if (!hasSupabasePublicEnv()) {
    const fallback = sampleQuestions.filter((q) => q.sectionId === sectionId);
    return { questions: fallback, source: "sample" } as const;
  }

  const supabase = await getSupabaseServerClient("read");

  // 1) SKD (and generic category-based sections): sectionId is a category.slug

  const { data: sectionCat, error: sectionError } = await supabase
    .from("categories")
    .select("id, slug")
    .eq("slug", sectionId)
    .maybeSingle();

  if (!sectionError && sectionCat) {
    // Fetch direct sub-topics (Level 1) - these are likely the tabs in the UI
    const { data: subcats, error: subcatError } = await supabase
      .from("categories")
      .select("id, slug")
      .eq("parent_id", sectionCat.id)
      .order("name", { ascending: true });

    if (subcatError) {
      console.warn("Supabase categories(subtopics) error", subcatError.message);
    }

    // Map to track which "Main Topic" (L1 Slug) each category belongs to.
    // This allows questions in sub-sub-topics to appear under their L1 Parent.
    const categoryIdToSlug = new Map<string, string>();

    // Questions in the Root Section itself map to the Section Slug
    categoryIdToSlug.set(sectionCat.id, sectionId);

    // Initialize list of all IDs to fetch questions for
    const allCategoryIds = [sectionCat.id];

    // Initialize recursion frontier with L1 IDs
    let currentLevelIds: string[] = [];

    // Process L1 keys
    if (subcats && subcats.length > 0) {
      for (const sub of subcats) {
        categoryIdToSlug.set(sub.id, sub.slug); // L1 maps to itself
        allCategoryIds.push(sub.id);
        currentLevelIds.push(sub.id);
      }
    }

    // Loop to fetch descendants level by level (safety cap at 5 levels)
    // We start fetching children of L1, then children of L2, etc.
    for (let i = 0; i < 5; i++) {
      if (currentLevelIds.length === 0) break;

      const { data: children, error: childrenError } = await supabase
        .from("categories")
        .select("id, slug, parent_id")
        .in("parent_id", currentLevelIds);

      if (childrenError) {
        console.warn("Supabase categories(recursive) error", childrenError.message);
        break;
      }

      if (!children || children.length === 0) break;

      const nextLevelIds: string[] = [];

      for (const child of children) {
        // Propagate the ancestral slug from the parent
        // If parent has a mapped slug, child inherits it.
        // If parent is somehow missing, fallback to child's own slug.
        const parentSlug = child.parent_id ? categoryIdToSlug.get(child.parent_id) : undefined;
        const resolvedSlug = parentSlug ?? child.slug;

        categoryIdToSlug.set(child.id, resolvedSlug);

        allCategoryIds.push(child.id);
        nextLevelIds.push(child.id);
      }

      // Prepare for next iteration
      currentLevelIds = nextLevelIds;
    }

    const { data, error } = await supabase
      .from("questions")
      .select("id, category_id, question_text, question_type, options, answer_key, discussion")
      .in("category_id", allCategoryIds)
      .order("inserted_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.warn("Supabase questions error", error.message);
      const fallback = sampleQuestions.filter((q) => q.sectionId === sectionId);
      return { questions: fallback, source: "sample" } as const;
    }

    if (!data || data.length === 0) {
      return { questions: [], source: "supabase" } as const;
    }

    const questions: Question[] = data.map((row) => {
      const choices = normalizeChoices(row.options);
      // Use the mapped ancestor slug for the topicId
      const topicSlug =
        typeof row.category_id === "string" ? categoryIdToSlug.get(row.category_id) ?? sectionId : sectionId;

      return {
        id: row.id,
        sectionId,
        topicId: topicSlug,
        questionText: row.question_text,
        questionType: row.question_type === "scale_tkp" ? "scale_tkp" : "multiple_choice",
        choices,
        answerKey: (row.answer_key ?? {}) as AnswerKey,
        discussion: row.discussion ?? undefined,
      };
    });

    return { questions, source: "supabase" } as const;
  }

  if (sectionError) {
    console.warn("Supabase categories(section) error", sectionError.message);
  }

  // 2) SKB (institution-based): sectionId is institutions.code lowercased
  const institutionCode = sectionId.trim().toUpperCase();
  const { data: rows, error: rpcError } = await supabase.rpc("generate_institution_questions", {
    institution_code: institutionCode,
  });

  if (rpcError) {
    console.warn("Supabase generate_institution_questions error", rpcError.message);
    const fallback = sampleQuestions.filter((q) => q.sectionId === sectionId);
    return { questions: fallback, source: "sample" } as const;
  }

  type GeneratedInstitutionRow = {
    id: string;
    topic_slug: string;
    question_text: string;
    question_type: string;
    options: unknown;
    answer_key: unknown;
    discussion: string | null;
  };

  const questions: Question[] = ((rows ?? []) as GeneratedInstitutionRow[]).map((row) => {
    return {
      id: row.id,
      sectionId,
      topicId: row.topic_slug,
      questionText: row.question_text,
      questionType: row.question_type === "scale_tkp" ? "scale_tkp" : "multiple_choice",
      choices: normalizeChoices(row.options),
      answerKey: (row.answer_key ?? {}) as AnswerKey,
      discussion: row.discussion ?? undefined,
    };
  });

  return { questions, source: "supabase" } as const;
}

function normalizeChoices(value: unknown): Choice[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as { key?: unknown; id?: unknown; text?: unknown };
        const rawKey = typeof obj.key === "string" ? obj.key : typeof obj.id === "string" ? obj.id : undefined;
        if (typeof rawKey !== "string" || typeof obj.text !== "string") return null;
        return { key: rawKey.toUpperCase(), text: obj.text } satisfies Choice;
      })
      .filter((item): item is Choice => item !== null);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeChoices(parsed);
    } catch {
      return [];
    }
  }

  return [];
}
