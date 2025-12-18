import Link from "next/link";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ConfirmStartTryoutButton } from "@/components/confirm-start-tryout-button";

import {
  deleteTryoutBlueprint,
  deleteTryoutPackage,
  generateBlueprintProportional,
  updateTryoutPackage,
  upsertTryoutBlueprint,
  upsertTryoutPackage,
} from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ package?: string; error?: string }>;
};

type PackageRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  is_active: boolean;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type: "subject" | "topic" | "subtopic" | null;
};

type BlueprintRow = {
  id: string;
  category_id: string;
  question_count: number;
  category: Array<CategoryRow>;
};

type OptionRow = { id: string; label: string; group: string };

function buildCategoryOptions(all: CategoryRow[], root: CategoryRow): OptionRow[] {
  const childrenByParent = new Map<string, CategoryRow[]>();
  all.forEach((c) => {
    if (!c.parent_id) return;
    const arr = childrenByParent.get(c.parent_id) ?? [];
    arr.push(c);
    childrenByParent.set(c.parent_id, arr);
  });

  const sortByName = (a: CategoryRow, b: CategoryRow) => a.name.localeCompare(b.name);
  for (const arr of childrenByParent.values()) arr.sort(sortByName);

  const out: OptionRow[] = [];

  // allow selecting the root itself for "full" tryout
  out.push({
    id: root.id,
    label: `${root.name} (${root.slug}) [${root.type ?? "unknown"}]`,
    group: root.slug.toUpperCase(),
  });

  const walk = (parentId: string, pathNames: string[]) => {
    const kids = childrenByParent.get(parentId) ?? [];
    kids.forEach((c) => {
      const nextPath = [...pathNames, c.name];

      // allow topic + subtopic (so you can make tryout from a whole section)
      if (c.type === "topic" || c.type === "subtopic") {
        out.push({
          id: c.id,
          label: `${nextPath.join(" › ")} (${c.slug}) [${c.type}]`,
          group: root.slug.toUpperCase(),
        });
      }

      walk(c.id, nextPath);
    });
  };

  walk(root.id, [root.name]);
  return out;
}

function buildCategoryLabel(allById: Map<string, CategoryRow>, categoryId: string): string {
  const names: string[] = [];
  let cur: CategoryRow | undefined = allById.get(categoryId);
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parent_id ? allById.get(cur.parent_id) : undefined;
  }
  return names.join(" › ");
}

function getRootSlug(allById: Map<string, CategoryRow>, categoryId: string): string {
  let cur: CategoryRow | undefined = allById.get(categoryId);
  while (cur?.parent_id) {
    cur = allById.get(cur.parent_id);
  }
  return cur?.slug ?? "unknown";
}

export default async function TryoutsAdminPage({ searchParams }: Props) {
  await requireAdminUser("/admin/tryouts");
  const { package: packageParam, error: errorParam } = await searchParams;

  const supabase = await getSupabaseServerClient("read");

  const { data: packagesData } = await supabase
    .from("exam_packages")
    .select("id, slug, title, description, duration_minutes, is_active")
    .not("slug", "is", null)
    .order("inserted_at", { ascending: false });

  const packages = (packagesData ?? []) as PackageRow[];
  const selectedPackage = packages.find((p) => p.id === packageParam) ?? packages[0] ?? null;

  const { data: roots } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, type")
    .in("slug", ["skd", "skb"]);

  const skdRoot = (roots ?? []).find((r) => r.slug === "skd") ?? null;
  const skbRoot = (roots ?? []).find((r) => r.slug === "skb") ?? null;

  const rootIds = [skdRoot?.id, skbRoot?.id].filter(Boolean) as string[];

  const { data: allCategories } = rootIds.length
    ? await supabase.from("categories").select("id, name, slug, parent_id, type")
    : { data: [] as unknown[] };

  const categories = (allCategories ?? []) as CategoryRow[];
  const categoryOptions: OptionRow[] = [
    ...(skdRoot ? buildCategoryOptions(categories, skdRoot as unknown as CategoryRow) : []),
    ...(skbRoot ? buildCategoryOptions(categories, skbRoot as unknown as CategoryRow) : []),
  ];
  const categoriesById = new Map(categories.map((c) => [c.id, c] as const));

  const generatorCandidates = categories
    .filter((c) => c.type === "subject" || c.type === "topic")
    .map((c) => ({
      id: c.id,
      group: getRootSlug(categoriesById, c.id).toUpperCase(),
      label: `${buildCategoryLabel(categoriesById, c.id)} (${c.slug}) [${c.type}]`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const { data: blueprintData } = selectedPackage
    ? await supabase
        .from("exam_package_blueprints")
        .select("id, category_id, question_count, category:categories(id, name, slug, parent_id, type)")
        .eq("package_id", selectedPackage.id)
        .order("inserted_at", { ascending: true })
    : { data: [] as unknown[] };

  const blueprints = (blueprintData ?? []) as unknown as BlueprintRow[];
  const totalSoal = blueprints.reduce((sum, b) => sum + (b.question_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-2xl font-bold text-slate-900">Tryout Akbar (Custom Package)</h1>
        <p className="text-sm text-slate-700">
          Buat lebih dari satu tryout SKD (misalnya: <span className="font-semibold">tryout-akbar-skd-1</span>) dengan
          komposisi soal per sub-topik.
        </p>
      </div>

      {errorParam ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorParam}
        </div>
      ) : null}

      {!skdRoot ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Root kategori <span className="font-semibold">skd</span> belum ada. Buat dulu di tabel categories.
        </div>
      ) : null}

      {!skbRoot ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Root kategori <span className="font-semibold">skb</span> belum ada. (Opsional) Jika ingin bikin tryout full SKB,
          buat dulu root kategori skb.
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Buat Tryout Baru</h2>
        <p className="mt-1 text-xs text-slate-500">Slug dipakai untuk URL: /tryout/real/&lt;slug&gt;</p>

        <form action={upsertTryoutPackage} className="mt-4 grid gap-4 md:grid-cols-5">
          <label className="block space-y-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slug</span>
            <input
              name="slug"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              placeholder="tryout-akbar-skd-1"
              required
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Judul</span>
            <input
              name="title"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              placeholder="Tryout Akbar SKD 1"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Durasi (menit)</span>
            <input
              name="duration_minutes"
              type="number"
              min={1}
              defaultValue={100}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            />
          </label>

          <label className="flex items-center gap-2 md:col-span-5">
            <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
            <span className="text-sm text-slate-700">Aktif</span>
          </label>

          <label className="block space-y-2 md:col-span-5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deskripsi (opsional)</span>
            <input
              name="description"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              placeholder="Contoh: Paket tryout akbar SKD batch 1"
            />
          </label>

          <div className="md:col-span-5">
            <button
              type="submit"
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Simpan
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Daftar Tryout</p>
            <p className="text-xs text-slate-500">{packages.length} item</p>
          </div>
        </div>

        {packages.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-700">Belum ada tryout custom.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {packages.map((pkg) => (
              <div key={pkg.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_220px_140px]">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{pkg.title}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold">{pkg.slug}</span> · {pkg.duration_minutes ?? 0} menit ·{" "}
                    {pkg.is_active ? "aktif" : "nonaktif"}
                  </p>
                  {pkg.description ? <p className="text-xs text-slate-600">{pkg.description}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/admin/tryouts?package=${encodeURIComponent(pkg.id)}`}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                        selectedPackage?.id === pkg.id
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Kelola blueprint
                    </Link>
                    <ConfirmStartTryoutButton
                      href={`/tryout/real/${encodeURIComponent(pkg.slug)}`}
                      durationMinutes={pkg.duration_minutes}
                      title={`Mulai Tryout: ${pkg.title}?`}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Coba mulai
                    </ConfirmStartTryoutButton>
                  </div>
                </div>

                <form action={updateTryoutPackage} className="grid gap-3">
                  <input type="hidden" name="id" value={pkg.id} />
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slug</span>
                    <input
                      name="slug"
                      defaultValue={pkg.slug}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                      required
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Judul</span>
                    <input
                      name="title"
                      defaultValue={pkg.title}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                      required
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Durasi</span>
                    <input
                      name="duration_minutes"
                      type="number"
                      min={1}
                      defaultValue={pkg.duration_minutes ?? 100}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input name="is_active" type="checkbox" defaultChecked={pkg.is_active} className="h-4 w-4" />
                    <span className="text-sm text-slate-700">Aktif</span>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deskripsi</span>
                    <input
                      name="description"
                      defaultValue={pkg.description ?? ""}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                  >
                    Update
                  </button>
                </form>

                <div>
                  <form action={deleteTryoutPackage}>
                    <input type="hidden" name="id" value={pkg.id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Hapus
                    </button>
                    <p className="mt-2 text-xs text-slate-500">Menghapus tryout akan menghapus blueprint (cascade).</p>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedPackage ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Blueprint Tryout</h2>
              <p className="mt-1 text-xs text-slate-500">
                Paket: <span className="font-semibold">{selectedPackage.title}</span> · Total soal: {totalSoal}
              </p>
            </div>
            <ConfirmStartTryoutButton
              href={`/tryout/real/${encodeURIComponent(selectedPackage.slug)}`}
              durationMinutes={selectedPackage.duration_minutes}
              title={`Mulai Tryout: ${selectedPackage.title}?`}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Mulai Tryout
            </ConfirmStartTryoutButton>
          </div>

          <form action={upsertTryoutBlueprint} className="mt-4 grid gap-4 md:grid-cols-4">
            <input type="hidden" name="package_id" value={selectedPackage.id} />

            <label className="block space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kategori (Section / Sub-topik)</span>
              <select
                name="category_id"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                required
                disabled={!skdRoot && !skbRoot}
              >
                {Array.from(new Set(categoryOptions.map((o) => o.group))).map((group) => (
                  <optgroup key={group} label={group}>
                    {categoryOptions
                      .filter((o) => o.group === group)
                      .map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Jumlah Soal</span>
              <input
                name="question_count"
                type="number"
                min={1}
                defaultValue={10}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                required
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
              >
                Simpan
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Auto-generate blueprint (Proporsional)</p>
            <p className="mt-1 text-xs text-slate-600">
              Masukkan total soal, lalu sistem akan membagi proporsional berdasarkan stok soal tiap child kategori.
              Ini akan <span className="font-semibold">mengganti</span> blueprint yang sudah ada.
            </p>

            <form action={generateBlueprintProportional} className="mt-4 grid gap-3 md:grid-cols-4">
              <input type="hidden" name="package_id" value={selectedPackage.id} />

              <label className="block space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ambil dari kategori</span>
                <select
                  name="parent_category_id"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  required
                >
                  {Array.from(new Set(generatorCandidates.map((o) => o.group))).map((group) => (
                    <optgroup key={group} label={group}>
                      {generatorCandidates
                        .filter((o) => o.group === group)
                        .map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mode distribusi</span>
                <select
                  name="distribution_mode"
                  defaultValue="stock"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  required
                >
                  <option value="stock">Stok-based (berdasarkan jumlah soal tersedia)</option>
                  <option value="ratio">Ratio-based (SKD preset 30:35:45, selain itu rata)</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total soal</span>
                <input
                  name="total_questions"
                  type="number"
                  min={1}
                  defaultValue={100}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  required
                />
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Komposisi Soal</p>
              <p className="text-xs text-slate-500">{blueprints.length} item</p>
            </div>

            {blueprints.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-700">Belum ada blueprint.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {blueprints.map((b) => {
                  const categoryId = b.category_id;
                  const cat = b.category?.[0] ?? categoriesById.get(categoryId);
                  const resolvedLabel = cat ? buildCategoryLabel(categoriesById, cat.id) : "";
                  const label = resolvedLabel || cat?.name || "(unknown)";
                  const slugLabel = cat?.slug ? ` (${cat.slug})` : "";
                  return (
                    <div key={b.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {label}
                          {slugLabel}
                        </p>
                        <p className="text-xs text-slate-500">{b.question_count} soal</p>
                      </div>

                      <form action={deleteTryoutBlueprint} className="md:text-right">
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="package_id" value={selectedPackage.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Hapus
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
