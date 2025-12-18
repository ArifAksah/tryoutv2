"use server";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ImportQuestion = {
  category_slug: string;
  question_text: string;
  question_type: "multiple_choice" | "figural" | "scale_tkp";
  question_image_url?: string | null;
  options: Array<{ key: string; text: string; image_url?: string }>;
  answer_key: Record<string, unknown>;
  discussion?: string | null;
};

type ValidationResult = {
  valid: boolean;
  totalQuestions: number;
  errors: string[];
  warnings: string[];
  preview: Array<{
    category_slug: string;
    question_text: string;
    question_type: string;
  }>;
};

type ImportResult = {
  success: boolean;
  message: string;
  imported: number;
  failed: number;
  errors: Array<{ line: number; error: string }>;
};

export async function validateImportFile(formData: FormData): Promise<ValidationResult> {
  await requireAdminUser("/admin/questions/import");

  const content = String(formData.get("content") || "");

  try {
    const data = JSON.parse(content);

    if (!data.questions || !Array.isArray(data.questions)) {
      return {
        valid: false,
        totalQuestions: 0,
        errors: ["File JSON harus memiliki property 'questions' berupa array"],
        warnings: [],
        preview: [],
      };
    }

    const questions: ImportQuestion[] = data.questions;
    const errors: string[] = [];
    const warnings: string[] = [];
    const supabase = await getSupabaseServerClient("read");

    // Fetch all category slugs
    const { data: categories } = await supabase.from("categories").select("slug");
    const validSlugs = new Set(categories?.map((c) => c.slug) || []);

    questions.forEach((q, idx) => {
      const line = idx + 1;

      // Required fields
      if (!q.category_slug) errors.push(`Baris ${line}: category_slug wajib diisi`);
      if (!q.question_text) errors.push(`Baris ${line}: question_text wajib diisi`);
      if (!q.question_type) errors.push(`Baris ${line}: question_type wajib diisi`);

      // Validate question type
      if (!["multiple_choice", "figural", "scale_tkp"].includes(q.question_type)) {
        errors.push(`Baris ${line}: question_type harus multiple_choice, figural, atau scale_tkp`);
      }

      // Validate category exists
      if (q.category_slug && !validSlugs.has(q.category_slug)) {
        errors.push(`Baris ${line}: Category '${q.category_slug}' tidak ditemukan`);
      }

      // Validate options
      if (!q.options || !Array.isArray(q.options)) {
        errors.push(`Baris ${line}: options harus berupa array`);
      } else {
        if (q.options.length < 2) errors.push(`Baris ${line}: Minimal 2 pilihan`);
        if (q.options.length > 10) errors.push(`Baris ${line}: Maksimal 10 pilihan`);

        const keys = q.options.map((o) => o.key?.toUpperCase());
        if (new Set(keys).size !== keys.length) {
          errors.push(`Baris ${line}: Key pilihan tidak boleh duplikat`);
        }
      }

      // Validate figural
      if (q.question_type === "figural" && !q.question_image_url) {
        errors.push(`Baris ${line}: Soal figural wajib ada question_image_url`);
      }

      // Validate answer key
      if (!q.answer_key) {
        errors.push(`Baris ${line}: answer_key wajib diisi`);
      } else {
        if (q.question_type === "multiple_choice" || q.question_type === "figural") {
          const correct = String(q.answer_key.correct || "").toUpperCase();
          if (!correct) {
            errors.push(`Baris ${line}: answer_key.correct wajib diisi untuk MC/figural`);
          } else {
            const keys = q.options?.map((o) => o.key?.toUpperCase()) || [];
            if (!keys.includes(correct)) {
              errors.push(`Baris ${line}: answer_key.correct '${correct}' tidak ada di options`);
            }
          }
        } else if (q.question_type === "scale_tkp") {
          const keys = q.options?.map((o) => o.key?.toUpperCase()) || [];
          for (const key of keys) {
            if (!(key in q.answer_key)) {
              errors.push(`Baris ${line}: answer_key harus ada score untuk key '${key}'`);
            } else {
              const score = q.answer_key[key];
              const scoreNum = typeof score === "number" ? score : Number(score);
              if (!Number.isFinite(scoreNum) || scoreNum < 1 || scoreNum > 5) {
                errors.push(`Baris ${line}: Skor TKP untuk '${key}' harus antara 1-5 (paling tepat=5, kurang tepat=1). Nilai: ${score}`);
              }
            }
          }
        }
      }

      // Warnings
      if (!q.discussion) warnings.push(`Baris ${line}: Pembahasan kosong (opsional)`);
    });

    const valid = errors.length === 0;

    return {
      valid,
      totalQuestions: questions.length,
      errors,
      warnings,
      preview: questions.map((q) => ({
        category_slug: q.category_slug,
        question_text: q.question_text,
        question_type: q.question_type,
      })),
    };
  } catch (error) {
    return {
      valid: false,
      totalQuestions: 0,
      errors: [`Gagal parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`],
      warnings: [],
      preview: [],
    };
  }
}

export async function importQuestions(formData: FormData): Promise<ImportResult> {
  await requireAdminUser("/admin/questions/import");

  const content = String(formData.get("content") || "");

  try {
    const data = JSON.parse(content);
    const questions: ImportQuestion[] = data.questions || [];

    const supabase = await getSupabaseServerClient("write");

    // Get category ID map
    const { data: categories } = await supabase.from("categories").select("id, slug");
    const slugToId = new Map(categories?.map((c) => [c.slug, c.id]) || []);

    let imported = 0;
    let failed = 0;
    const errors: Array<{ line: number; error: string }> = [];

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx]!;
      const line = idx + 1;

      try {
        const categoryId = slugToId.get(q.category_slug);
        if (!categoryId) {
          failed++;
          errors.push({ line, error: `Category '${q.category_slug}' not found` });
          continue;
        }

        // Build insert data dynamically for backward compatibility
        const insertData: Record<string, unknown> = {
          category_id: categoryId,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          answer_key: q.answer_key,
          discussion: q.discussion || null,
        };

        // Only include image fields if they exist in schema (for backward compatibility)
        if (q.question_image_url !== undefined) {
          insertData.question_image_url = q.question_image_url || null;
        }

        const { error } = await supabase.from("questions").insert(insertData);

        if (error) {
          failed++;
          errors.push({ line, error: error.message });
        } else {
          imported++;
        }
      } catch (err) {
        failed++;
        errors.push({
          line,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return {
      success: imported > 0,
      message: `Import selesai. ${imported} soal berhasil, ${failed} gagal.`,
      imported,
      failed,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      message: `Gagal import: ${error instanceof Error ? error.message : "Unknown error"}`,
      imported: 0,
      failed: 0,
      errors: [],
    };
  }
}
