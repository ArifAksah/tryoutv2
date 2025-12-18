import Link from "next/link";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { deleteBlueprint, upsertBlueprint } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ institution?: string }>;
};

type InstitutionRow = {
  id: string;
  code: string;
  name: string;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

type BlueprintRow = {
  id: string;
  question_count: number;
  passing_grade: number | null;
  category: Array<{ id: string; slug: string; name: string }>;
};

function buildTreeOptions(all: CategoryRow[], rootId: string) {
  const childrenByParent = new Map<string, CategoryRow[]>();
  all.forEach((c) => {
    if (!c.parent_id) return;
    const arr = childrenByParent.get(c.parent_id) ?? [];
    arr.push(c);
    childrenByParent.set(c.parent_id, arr);
  });

  const sortByName = (a: CategoryRow, b: CategoryRow) => a.name.localeCompare(b.name);
  for (const arr of childrenByParent.values()) arr.sort(sortByName);

  const out: Array<{ id: string; label: string }> = [];
  const walk = (parent: string, depth: number) => {
    const kids = childrenByParent.get(parent) ?? [];
    kids.forEach((c) => {
      const indent = depth === 0 ? "" : `${"— ".repeat(depth)}`;
      out.push({ id: c.id, label: `${indent}${c.name} (${c.slug})` });
      walk(c.id, depth + 1);
    });
  };

  walk(rootId, 0);
  return out;
}

export default async function BlueprintsAdminPage({ searchParams }: Props) {
  await requireAdminUser("/admin/blueprints");
  const { institution: institutionParam } = await searchParams;

  const supabase = await getSupabaseServerClient("read");

  const { data: institutionsData, error: instError } = await supabase
    .from("institutions")
    .select("id, code, name")
    .order("name", { ascending: true });

  const institutions = (institutionsData ?? []) as InstitutionRow[];
  const selectedInstitution =
    institutions.find((i) => i.id === institutionParam) ?? institutions[0] ?? null;

  const { data: skbRoot } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "skb")
    .maybeSingle();

  const { data: allCategories } = skbRoot
    ? await supabase
        .from("categories")
        .select("id, name, slug, parent_id")
        .order("name", { ascending: true })
    : { data: [] as unknown[] };

  const categoryOptions = skbRoot
    ? buildTreeOptions((allCategories ?? []) as CategoryRow[], skbRoot.id)
    : [];

  const { data: blueprintsData, error: blueprintError } = selectedInstitution
    ? await supabase
        .from("exam_blueprints")
        .select("id, question_count, passing_grade, category:categories(id, slug, name)")
        .eq("institution_id", selectedInstitution.id)
        .order("inserted_at", { ascending: true })
    : { data: [], error: null };

  const blueprints = (blueprintsData ?? []) as unknown as BlueprintRow[];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-2xl font-bold text-slate-900">Blueprints (Resep SKB)</h1>
        <p className="text-sm text-slate-700">
          Untuk institution tertentu, tentukan kategori mana diambil dan jumlah soal.
        </p>
      </div>

      {instError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Supabase institutions error: {instError.message}
        </div>
      ) : null}

      {!skbRoot ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Root kategori <span className="font-semibold">skb</span> belum ada. Buat dulu di tabel categories.
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Pilih institution</p>
            <p className="text-xs text-slate-500">Blueprint akan ditampilkan sesuai institution.</p>
          </div>

          <form>
            <select
              name="institution"
              defaultValue={selectedInstitution?.id ?? ""}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} · {i.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="ml-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Tampilkan
            </button>
            <Link
              href="/admin/institutions"
              className="ml-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kelola institutions
            </Link>
          </form>
        </div>
      </section>

      {selectedInstitution ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Tambah / Update Blueprint</h2>
          <p className="mt-1 text-xs text-slate-500">
            Institution: <span className="font-semibold text-slate-700">{selectedInstitution.code}</span>
          </p>

          <form action={upsertBlueprint} className="mt-4 grid gap-4 md:grid-cols-4">
            <input type="hidden" name="institution_id" value={selectedInstitution.id} />

            <label className="block space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kategori</span>
              <select
                name="category_id"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                required
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Jumlah Soal</span>
              <input
                name="question_count"
                type="number"
                min={1}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                defaultValue={10}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Passing Grade (opsional)</span>
              <input
                name="passing_grade"
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                placeholder="mis: 60"
              />
            </label>

            <div className="md:col-span-4">
              <button
                type="submit"
                className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Simpan blueprint
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Belum ada institution. Tambahkan dulu di menu Institutions.
        </div>
      )}

      {blueprintError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Supabase exam_blueprints error: {blueprintError.message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Blueprint aktif</p>
            <p className="text-xs text-slate-500">{blueprints.length} item</p>
          </div>
        </div>

        {blueprints.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-700">
            Belum ada blueprint untuk institution ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {blueprints.map((b) => (
              <div key={b.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_140px_140px_140px]">
                <div>
                  {(() => {
                    const category = Array.isArray(b.category) ? b.category[0] : null;
                    return (
                      <>
                        <p className="text-sm font-semibold text-slate-900">{category?.name ?? "(kategori?)"}</p>
                        <p className="text-xs text-slate-500">{category?.slug ?? "-"}</p>
                      </>
                    );
                  })()}
                </div>
                <div className="text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Jumlah</p>
                  <p className="font-semibold">{b.question_count}</p>
                </div>
                <div className="text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Passing</p>
                  <p className="font-semibold">{b.passing_grade ?? "-"}</p>
                </div>
                <div className="flex justify-end">
                  <form action={deleteBlueprint}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="institution_id" value={selectedInstitution?.id ?? ""} />
                    <button
                      type="submit"
                      className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Hapus
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
