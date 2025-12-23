import Link from "next/link";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { deleteBlueprint, upsertBlueprint } from "./actions";
import { BlueprintTargetSelect } from "./_components/blueprint-target-select";
import { BlueprintCategorySelect } from "./_components/blueprint-category-select";
import { BlueprintSchemaEditor } from "./_components/blueprint-schema-editor";

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
  category_id: string;
  question_count: number;
  passing_grade: number | null;
  category: Array<{ id: string; slug: string; name: string }>;
};

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
};

function buildCategoryTree(all: CategoryRow[], rootId: string): CategoryNode | null {
  const byId = new Map<string, CategoryNode>();

  // 1. Initialize nodes
  all.forEach(c => {
    byId.set(c.id, { id: c.id, name: c.name, slug: c.slug, children: [] });
  });

  // 2. Build Hierarchy
  // We need to find the specific root node first.
  const rootNode = byId.get(rootId);
  if (!rootNode) return null;

  // We only care about descendants of the root.
  // Brute force: Iterate all, if parent is in map, add to parent.
  // But we need to limit to the subtree of rootId.
  // Optimization: Build global tree then extract subtree.

  const nodes = Array.from(byId.values());
  nodes.forEach(n => {
    const raw = all.find(c => c.id === n.id);
    if (raw?.parent_id) {
      const parent = byId.get(raw.parent_id);
      if (parent) {
        parent.children.push(n);
      }
    }
  });

  // 3. Sort children
  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(n => sortNodes(n.children));
  };

  sortNodes([rootNode]); // Sort recursively starting from root
  return rootNode;
}

function buildTreeOptions(all: CategoryRow[], rootId: string) {
  // Legacy flat builder for the dropdown
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

  // 1. Fetch Institutions
  const { data: institutionsData, error: instError } = await supabase
    .from("institutions")
    .select("id, code, name")
    .order("name", { ascending: true });

  const institutions = (institutionsData ?? []) as InstitutionRow[];

  // 2. Fetch Roots (Subjects)
  const { data: allRoots } = await supabase
    .from("categories")
    .select("id, name, slug")
    .is("parent_id", null)
    .order("name", { ascending: true });

  const roots = (allRoots ?? []) as { id: string; name: string; slug: string }[];

  // Resolve Selected Institution (Target)
  const selectedInstitution =
    institutions.find((i) => i.id === institutionParam) ?? institutions[0] ?? null;

  // 3. Determine Category Tree Root
  const skbRoot = roots.find(r => r.slug === "skb");
  let targetRootId = skbRoot?.id;
  let targetRootName = "SKB (Default)";

  if (selectedInstitution) {
    const matchingRoot = roots.find(r => r.slug.toLowerCase() === selectedInstitution.code.toLowerCase());
    if (matchingRoot) {
      targetRootId = matchingRoot.id;
      targetRootName = matchingRoot.name;
    }
  }

  // 4. Identify Available Subjects
  const activeCodes = new Set(institutions.map(i => i.code.toLowerCase()));
  const availableSubjects = roots.filter(r => !activeCodes.has(r.slug.toLowerCase()) && r.slug !== 'skb');

  // 5. Fetch Categories
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id");

  // Tree Options for Dropdown
  const categoryOptions = targetRootId && allCategories
    ? buildTreeOptions(allCategories as CategoryRow[], targetRootId)
    : [];

  // Full Tree for Editor
  const categoryTree = targetRootId && allCategories
    ? buildCategoryTree(allCategories as CategoryRow[], targetRootId)
    : null;

  // 6. Fetch Existing Blueprints
  const { data: blueprintsData, error: blueprintError } = selectedInstitution
    ? await supabase
      .from("exam_blueprints")
      .select("id, question_count, passing_grade, category:categories(id, slug, name)")
      .eq("institution_id", selectedInstitution.id)
      .order("inserted_at", { ascending: true })
    : { data: [], error: null };

  const blueprints = (blueprintsData ?? []) as unknown as BlueprintRow[];

  // Map blueprints for the editor
  const blueprintsMap: Record<string, { count: number; passing: number | null }> = {};
  blueprints.forEach(b => {
    // The category relation might be an array or object depending on join, handled in type.
    // Assuming array based on previous code.
    const catId = Array.isArray(b.category) ? b.category[0]?.id : (b.category as any)?.id;
    if (catId) {
      blueprintsMap[catId] = { count: b.question_count, passing: b.passing_grade };
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-2xl font-bold text-slate-900">Blueprints (Exam Configuration)</h1>
        <p className="text-sm text-slate-700">
          Konfigurasi blueprint per Tipe Ujian atau Institusi.
          <br />
          <span className="text-xs text-slate-500">
            Mode Kategori: <span className="font-semibold text-sky-600">{targetRootName}</span>
          </span>
        </p>
      </div>

      {instError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Supabase institutions error: {instError.message}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Pilih Target</p>
            <p className="text-xs text-slate-500">Cari institusi atau aktifkan subject baru.</p>
          </div>

          <div className="flex flex-col gap-3 md:items-end w-full md:w-auto">
            <div className="w-full md:w-[300px]">
              <BlueprintTargetSelect
                institutions={institutions}
                availableSubjects={availableSubjects}
                selectedId={selectedInstitution?.id ?? ""}
              />
            </div>
          </div>
        </div>
      </section>

      {selectedInstitution ? (
        <>
          {/* BULK SCHEMA EDITOR */}
          {categoryTree ? (
            <section>
              <BlueprintSchemaEditor
                institutionId={selectedInstitution.id}
                rootCategory={categoryTree}
                initialBlueprints={blueprintsMap} // Use server-derived map
              />
            </section>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Tidak dapat memuat tree kategori untuk {targetRootName}.
            </div>
          )}

          {/* EXPANDABLE MANUAL FORM */}
          <details className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-3 font-semibold text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-inset">
              <span>Advanced: Tambah Manual Satu-per-Satu</span>
              <span className="ml-2 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-slate-200 p-5">
              <p className="mb-4 text-xs text-slate-500">
                Gunakan form ini jika ingin menambahkan kategori yang tidak tersedia di editor skema (jarang terjadi).
              </p>
              <form action={upsertBlueprint} className="grid gap-4 md:grid-cols-4">
                <input type="hidden" name="institution_id" value={selectedInstitution.id} />

                <label className="block space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kategori</span>
                  <BlueprintCategorySelect options={categoryOptions.map(o => ({ id: o.id, label: o.label }))} />
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
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Passing Grade</span>
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
            </div>
          </details>
        </>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Silakan pilih Target Ujian di atas.
        </div>
      )}

      {blueprintError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Supabase exam_blueprints error: {blueprintError.message}
        </div>
      ) : null}

      {/* Existing list view for explicit confirmation */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white opacity-80">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Blueprint aktif (Read Only List)</p>
            <p className="text-xs text-slate-500">{blueprints.length} item. (Edit menggunakan Schema Editor di atas)</p>
          </div>
        </div>

        {blueprints.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-700">
            Belum ada blueprint untuk target ini.
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
