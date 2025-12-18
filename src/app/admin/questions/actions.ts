"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AdminActionState = {
  ok: boolean;
  error?: string;
};

type ParsedQuestionPayload = {
  id?: string;
  sectionSlug: string;
  topicSlug: string;
  questionText: string;
  questionType: "multiple_choice" | "scale_tkp" | "figural";
  choices: Array<{ key: string; text: string; image_url?: string }>;
  answerKey: Record<string, unknown>;
  discussion?: string;
  questionImageUrl?: string;
  returnTo: string;
};

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseChoicesTextarea(
  value: string,
  isFigural: boolean = false
): Array<{ key: string; text: string; image_url?: string }> {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  if (isFigural) {
    // Format: Key|Text|ImageURL (pipe-separated)
    return lines.map((line, idx) => {
      const parts = line.split("|").map((p) => p.trim());
      const key = parts[0] || alphabet[idx] || String(idx + 1);
      const text = parts[1] || "";
      const image_url = parts[2] || undefined;
      return { key: key.toUpperCase(), text, image_url };
    });
  }

  // Normal format: auto-assign keys
  const processed = lines.map((line) => line.replace(/^[A-Ja-j][\).:-]\s+/, ""));
  return processed.map((text, idx) => ({ key: alphabet[idx] ?? String(idx + 1), text }));
}

function parseScoreMap(value: string): { ok: true; value: Record<string, number> } | { ok: false; error: string } {
  const raw = value.trim();
  if (!raw) return { ok: false, error: "Skema skor TKP wajib diisi (contoh: A=1, B=3, C=5). Gunakan skala 1-5." };

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "Score map JSON harus berupa object (contoh: {\"A\":1,\"B\":3})." };
      }
      const result: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const key = String(k).trim().toUpperCase();
        const num = typeof v === "number" ? v : Number(String(v));
        if (!key) continue;
        if (!Number.isFinite(num)) {
          return { ok: false, error: `Nilai skor untuk '${key}' harus angka.` };
        }
        if (num < 1 || num > 5) {
          return { ok: false, error: `Skor TKP untuk '${key}' harus antara 1-5 (paling tepat=5, kurang tepat=1). Nilai: ${num}` };
        }
        result[key] = num;
      }
      if (Object.keys(result).length === 0) {
        return { ok: false, error: "Score map JSON kosong." };
      }
      return { ok: true, value: result };
    } catch {
      return { ok: false, error: "Score map JSON tidak valid." };
    }
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result: Record<string, number> = {};
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z0-9]+)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) {
      return { ok: false, error: `Format score map tidak valid: '${line}'. Pakai contoh: A=1` };
    }
    const key = match[1]!.toUpperCase();
    const num = Number(match[2]);
    if (!Number.isFinite(num)) {
      return { ok: false, error: `Nilai skor untuk '${key}' harus angka.` };
    }
    if (num < 1 || num > 5) {
      return { ok: false, error: `Skor TKP untuk '${key}' harus antara 1-5 (paling tepat=5, kurang tepat=1). Nilai: ${num}` };
    }
    result[key] = num;
  }

  if (Object.keys(result).length === 0) {
    return { ok: false, error: "Score map kosong." };
  }
  return { ok: true, value: result };
}

function parseQuestionPayload(formData: FormData): ParsedQuestionPayload | { error: string } {
  const id = getString(formData, "id");
  const sectionSlug = getString(formData, "section_id");
  const topicSlug = getString(formData, "topic_id");
  const questionText = getString(formData, "question_text");
  const questionTypeRaw = getString(formData, "question_type");
  const choicesText = String(formData.get("choices") ?? "");
  const discussion = getString(formData, "discussion");
  const questionImageUrl = getString(formData, "question_image_url") || undefined;
  const returnTo = getString(formData, "return_to") || "/admin/questions";

  if (!sectionSlug) return { error: "Section wajib dipilih." };
  if (!topicSlug) return { error: "Topik wajib dipilih." };
  if (!questionText) return { error: "Pertanyaan wajib diisi." };

  const questionType =
    questionTypeRaw === "scale_tkp"
      ? "scale_tkp"
      : questionTypeRaw === "figural"
        ? "figural"
        : "multiple_choice";

  // Validate figural type
  if (questionType === "figural" && !questionImageUrl) {
    return { error: "Gambar soal wajib untuk tipe figural." };
  }

  const choices = parseChoicesTextarea(choicesText, questionType === "figural");
  if (choices.length < 2) {
    return { error: "Minimal 2 pilihan jawaban." };
  }
  if (choices.length > 10) {
    return { error: "Maksimal 10 pilihan jawaban." };
  }

  const allowedKeys = new Set(choices.map((c) => c.key.toUpperCase()));

  let answerKey: Record<string, unknown> = {};
  if (questionType === "multiple_choice" || questionType === "figural") {
    const correct = getString(formData, "correct_key").toUpperCase();
    const scoreRaw = getString(formData, "correct_score");
    const score = scoreRaw ? Number(scoreRaw) : 5;

    if (!correct) {
      return { error: "Kunci jawaban wajib diisi (contoh: A)." };
    }
    if (!allowedKeys.has(correct)) {
      return { error: `Kunci '${correct}' tidak ada di pilihan. (pilihan: ${[...allowedKeys].join(", ")})` };
    }
    if (!Number.isFinite(score) || score <= 0) {
      return { error: "Skor jawaban benar harus angka > 0." };
    }

    answerKey = { correct, score };
  } else if (questionType === "scale_tkp") {
    const scoreMapText = getString(formData, "score_map");
    const parsedMap = parseScoreMap(scoreMapText);
    if (!parsedMap.ok) return { error: parsedMap.error };

    for (const key of Object.keys(parsedMap.value)) {
      if (!allowedKeys.has(key.toUpperCase())) {
        return { error: `Key '${key}' di score map tidak ada di pilihan (pilihan: ${[...allowedKeys].join(", ")}).` };
      }
    }
    answerKey = parsedMap.value;
  }

  return {
    id: id || undefined,
    sectionSlug,
    topicSlug,
    questionText,
    questionType,
    choices,
    answerKey,
    discussion: discussion || undefined,
    questionImageUrl,
    returnTo,
  };
}

export async function createQuestion(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminUser("/admin/questions/new");

  const parsed = parseQuestionPayload(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const supabase = await getSupabaseServerClient("write");

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", parsed.topicSlug)
    .maybeSingle();

  if (categoryError || !category) {
    return { ok: false, error: categoryError?.message || "Kategori tidak ditemukan." };
  }

  const { error } = await supabase.from("questions").insert({
    category_id: category.id,
    question_text: parsed.questionText,
    question_type: parsed.questionType,
    options: parsed.choices,
    answer_key: parsed.answerKey,
    discussion: parsed.discussion ?? null,
    question_image_url: parsed.questionImageUrl ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect(parsed.returnTo);
}

export async function updateQuestion(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminUser("/admin/questions");

  const parsed = parseQuestionPayload(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  if (!parsed.id) return { ok: false, error: "ID soal tidak valid." };

  const supabase = await getSupabaseServerClient("write");

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", parsed.topicSlug)
    .maybeSingle();

  if (categoryError || !category) {
    return { ok: false, error: categoryError?.message || "Kategori tidak ditemukan." };
  }

  const { error } = await supabase
    .from("questions")
    .update({
      category_id: category.id,
      question_text: parsed.questionText,
      question_type: parsed.questionType,
      options: parsed.choices,
      answer_key: parsed.answerKey,
      discussion: parsed.discussion ?? null,
      question_image_url: parsed.questionImageUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/questions");
  redirect(parsed.returnTo);
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/questions");

  const id = getString(formData, "id");
  const returnTo = getString(formData, "return_to") || "/admin/questions";

  if (!id) {
    redirect(returnTo);
  }

  const supabase = await getSupabaseServerClient("write");
  await supabase.from("questions").delete().eq("id", id);

  revalidatePath("/admin/questions");
  redirect(returnTo);
}
