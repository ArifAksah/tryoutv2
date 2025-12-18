"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import type { ExamSection } from "@/lib/exam-structure";
import Swal from "sweetalert2";

import type { AdminActionState } from "../actions";
import { uploadQuestionImage } from "../upload-actions";
import { MathText } from "@/components/math-text";

type QuestionFormInitial = {
  id: string;
  sectionId: string;
  topicId: string;
  questionText: string;
  questionType: "multiple_choice" | "scale_tkp" | "figural";
  choicesText: string;
  correctKey: string;
  correctScore: string;
  scoreMapText: string;
  discussion: string;
  questionImageUrl?: string;
};

type Props = {
  mode: "create" | "edit";
  sections: ExamSection[];
  initial: QuestionFormInitial;
  returnTo: string;
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
};

export function AdminQuestionForm({ mode, sections, initial, returnTo, action }: Props) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(action, {
    ok: false,
  });

  const initialSectionId = initial.sectionId || sections[0]?.id || "";
  const initialTopics = sections.find((s) => s.id === initialSectionId)?.topics ?? [];
  const initialTopicId =
    initialTopics.some((t) => t.id === initial.topicId) ? initial.topicId : initialTopics[0]?.id ?? "";

  const [sectionId, setSectionId] = useState(initialSectionId);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [questionType, setQuestionType] = useState<"multiple_choice" | "scale_tkp" | "figural">(
    initial.questionType
  );
  const [questionText, setQuestionText] = useState(initial.questionText);
  const [questionImageUrl, setQuestionImageUrl] = useState(initial.questionImageUrl || "");
  const [uploading, setUploading] = useState(false);

  const topics = useMemo(() => {
    return sections.find((s) => s.id === sectionId)?.topics ?? [];
  }, [sections, sectionId]);

  const effectiveTopicId = topics.some((t) => t.id === topicId) ? topicId : topics[0]?.id ?? "";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "questions");

      const result = await uploadQuestionImage(formData);

      if (result.success && result.url) {
        setQuestionImageUrl(result.url);
      } else {
        void Swal.fire({
          icon: "error",
          title: "Gagal",
          text: result.error || "Gagal upload gambar",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      void Swal.fire({
        icon: "error",
        title: "Gagal",
        text: "Gagal upload gambar",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <input type="hidden" name="return_to" value={returnTo} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">Section</span>
          <select
            name="section_id"
            value={sectionId}
            onChange={(e) => {
              const nextSectionId = e.target.value;
              setSectionId(nextSectionId);

              const nextTopics = sections.find((s) => s.id === nextSectionId)?.topics ?? [];
              setTopicId(nextTopics[0]?.id ?? "");
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.type} · {section.code} · {section.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">Topik</span>
          <select
            name="topic_id"
            value={effectiveTopicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          >
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === "edit" ? (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">ID Soal</span>
          <input type="hidden" name="id" value={initial.id} />
          <input
            value={initial.id}
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
          />
        </label>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-900">Tipe Soal</span>
        <select
          name="question_type"
          value={questionType}
          onChange={(e) =>
            setQuestionType(e.target.value as "multiple_choice" | "scale_tkp" | "figural")
          }
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
        >
          <option value="multiple_choice">Multiple Choice (TIU/TWK)</option>
          <option value="figural">Figural (dengan gambar)</option>
          <option value="scale_tkp">Skala TKP</option>
        </select>
        <p className="text-xs text-slate-500">
          {questionType === "figural"
            ? "Soal figural: Upload gambar soal dan/atau gambar per pilihan jawaban"
            : questionType === "scale_tkp"
              ? "Skala TKP: Setiap pilihan punya skor berbeda"
              : "Multiple Choice: Ada satu jawaban benar"}
        </p>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-900">Pertanyaan</span>
        <textarea
          name="question_text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          placeholder="Tulis pertanyaan di sini. Gunakan $rumus$ untuk math inline atau $$rumus$$ untuk display math."
          required
        />
        <p className="text-xs text-slate-500">
          💡 <strong>Math Support:</strong> Gunakan <code>$x^2 + 5$</code> untuk inline atau <code>$$\frac&lbrace;a&rbrace;&lbrace;b&rbrace;$$</code> untuk display. <a href="https://docs.factory.ai" target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">Lihat MATH-GUIDE.md</a>
        </p>
        {questionText && questionText.includes("$") && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
            <p className="mb-2 text-xs font-semibold text-sky-900">Preview dengan rumus:</p>
            <MathText text={questionText} className="text-sm text-slate-900" />
          </div>
        )}
      </label>

      {(questionType === "figural" || questionType === "multiple_choice") && (
        <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-sky-900">
              Gambar Soal {questionType === "figural" && "(Wajib)"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 file:mr-4 file:rounded-md file:border-0 file:bg-sky-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-200"
            />
            <p className="text-xs text-sky-700">
              Max 5MB. Format: JPG, PNG, GIF. {questionType === "figural" && "Wajib untuk soal figural."}
            </p>
          </label>

          <input type="hidden" name="question_image_url" value={questionImageUrl} />

          {questionImageUrl && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-sky-900">Preview:</p>
              <div className="relative h-64 w-full">
                <Image
                  src={questionImageUrl}
                  alt="Preview gambar soal"
                  fill
                  className="rounded-lg border border-sky-200 object-contain"
                />
                <button
                  type="button"
                  onClick={() => setQuestionImageUrl("")}
                  className="absolute right-2 top-2 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Hapus
                </button>
              </div>
              <p className="text-xs text-sky-700">{questionImageUrl}</p>
            </div>
          )}

          {uploading && (
            <div className="text-center text-sm text-sky-700">
              <span className="animate-pulse">Uploading...</span>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">Pilihan Jawaban</span>
          <textarea
            name="choices"
            defaultValue={initial.choicesText}
            rows={questionType === "figural" ? 12 : 8}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            placeholder={
              questionType === "figural"
                ? "A|Gambar A|https://example.com/a.jpg\nB|Gambar B|https://example.com/b.jpg\nC|Gambar C|https://example.com/c.jpg\nD|Gambar D|https://example.com/d.jpg"
                : "A. pilihan 1\nB. pilihan 2\nC. pilihan 3\nD. pilihan 4"
            }
            required
          />
          {questionType === "figural" ? (
            <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-semibold">Format Figural:</p>
              <p>
                <code className="rounded bg-amber-100 px-1">Key|Text|ImageURL</code>
              </p>
              <p>Contoh: <code className="rounded bg-amber-100 px-1">A|Gambar A|https://example.com/a.jpg</code></p>
              <p className="text-amber-700">
                Upload gambar dulu, copy URL, lalu paste di sini. Text opsional (bisa kosong).
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Satu baris = satu pilihan. Key akan otomatis menjadi A, B, C, D, ...
            </p>
          )}
        </label>

        <div className="space-y-4">
          {questionType === "multiple_choice" || questionType === "figural" ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-900">Kunci Jawaban</span>
                <input
                  name="correct_key"
                  defaultValue={initial.correctKey}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  placeholder="contoh: A"
                  required
                />
                <p className="text-xs text-slate-500">Isi dengan key pilihan (A/B/C/D...).</p>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-900">Skor Benar</span>
                <input
                  name="correct_score"
                  defaultValue={initial.correctScore}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  placeholder="contoh: 5"
                  inputMode="numeric"
                />
              </label>
            </>
          ) : questionType === "scale_tkp" ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">Skema Skor TKP (Skala 1-5)</span>
              <textarea
                name="score_map"
                defaultValue={initial.scoreMapText}
                rows={6}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                placeholder={"A=1\nB=2\nC=3\nD=4\nE=5"}
                required
              />
              <p className="text-xs text-slate-500">Format: satu baris per key (misal A=1). Gunakan skala 1-5, dimana 5=paling tepat, 1=kurang tepat. Tidak ada jawaban yang bernilai 0.</p>
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-900">Pembahasan (opsional)</span>
            <textarea
              name="discussion"
              defaultValue={initial.discussion}
              rows={6}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              placeholder="Penjelasan kenapa jawabannya benar"
            />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Tambah Soal"}
      </button>
    </form>
  );
}
