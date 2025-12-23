"use client";

import { useActionState, useState } from "react";
import type { AdminActionState } from "../../questions/actions";
import { SearchableSelect } from "./searchable-select";

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type: "subject" | "topic" | "subtopic" | null;
};

type CategoryFormInitial = {
  id: string;
  name: string;
  slug: string;
  parentId: string;
  type: "subject" | "topic" | "subtopic";
  durationMinutes: string;
};

type Props = {
  mode: "create" | "edit";
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  categories: Category[];
  initial: CategoryFormInitial;
};

export function CategoryForm({ mode, action, categories, initial }: Props) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(action, {
    ok: false,
  });

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [parentId, setParentId] = useState(initial.parentId || "");

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug from name
    if (mode === "create" || !initial.slug) {
      const autoSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(autoSlug);
    }
  };

  // Filter out current category and its descendants for parent selection
  const availableParents = categories.filter((cat) => cat.id !== initial.id);

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      {state.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      {mode === "edit" && <input type="hidden" name="id" value={initial.id} />}

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-900">Nama Kategori *</span>
        <input
          name="name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          placeholder="e.g., TWK, TIU, Bilangan Deret"
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-900">Slug (URL-friendly) *</span>
        <input
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          placeholder="e.g., twk, tiu, bilangan-deret"
          pattern="[a-z0-9-]+"
          required
        />
        <p className="text-xs text-slate-500">
          Lowercase, hanya huruf, angka, dan dash (-). Harus unik.
        </p>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-900">Parent (Opsional)</span>
        <input type="hidden" name="parent_id" value={parentId} />
        <SearchableSelect
          options={availableParents.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type
          }))}
          value={parentId}
          onChange={setParentId}
          placeholder="Cari parent category..."
          emptyLabel="-- Root Category (No Parent) --"
        />
        <p className="text-xs text-slate-500">
          Pilih parent jika ini adalah sub-kategori.
        </p>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-900">Tipe *</span>
        <select
          name="type"
          defaultValue={initial.type}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          required
        >
          <option value="subject">Subject (Level 1 - Root)</option>
          <option value="topic">Topic (Level 2)</option>
          <option value="subtopic">Subtopic (Level 3)</option>
        </select>
        <p className="text-xs text-slate-500">
          Subject = TWK/TIU/TKP, Topic = Pancasila/Silogisme, Subtopic = Detail
        </p>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-900">Durasi Tryout (menit) (Opsional)</span>
        <input
          name="duration_minutes"
          type="number"
          min={1}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          placeholder="mis: 30"
        />
        <p className="text-xs text-slate-500">
          Jika diisi, timer tryout untuk kategori ini akan mengikuti nilai ini (berlaku untuk section/topik/sub-topik).
        </p>
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Tambah Kategori"}
        </button>
        <a
          href="/admin/categories"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Batal
        </a>
      </div>
    </form>
  );
}
