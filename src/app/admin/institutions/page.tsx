import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { deleteInstitution, updateInstitution, upsertInstitution } from "./actions";

export const dynamic = "force-dynamic";

type InstitutionRow = {
  id: string;
  code: string;
  name: string;
  logo_url: string | null;
};

export default async function InstitutionsAdminPage() {
  await requireAdminUser("/admin/institutions");

  const supabase = await getSupabaseServerClient("read");
  const { data, error } = await supabase
    .from("institutions")
    .select("id, code, name, logo_url")
    .order("name", { ascending: true });

  const institutions = (data ?? []) as InstitutionRow[];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-2xl font-bold text-slate-900">Institutions (Sekolah/Formasi)</h1>
        <p className="text-sm text-slate-700">
          Data ini dipakai untuk SKB. Komposisi soalnya diatur lewat menu Blueprints.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Supabase error: {error.message}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Tambah / Update Institution</h2>
        <p className="mt-1 text-xs text-slate-500">Upsert berdasarkan kode (mis: STAN, STIS).</p>

        <form action={upsertInstitution} className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Code</span>
            <input
              name="code"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              placeholder="STAN"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</span>
            <input
              name="name"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              placeholder="Politeknik Keuangan Negara STAN"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Logo URL (opsional)</span>
            <input
              name="logo_url"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              placeholder="https://..."
            />
          </label>

          <div className="md:col-span-3">
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
            <p className="text-sm font-semibold text-slate-900">Daftar institutions</p>
            <p className="text-xs text-slate-500">{institutions.length} item</p>
          </div>
        </div>

        {institutions.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-700">Belum ada data institution.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {institutions.map((inst) => (
              <div key={inst.id} className="grid gap-3 px-5 py-4 md:grid-cols-[160px_1fr_220px_140px]">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{inst.code}</p>
                  <p className="text-xs text-slate-500">{inst.id}</p>
                </div>

                <form action={updateInstitution} className="grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={inst.id} />
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</span>
                    <input
                      name="name"
                      defaultValue={inst.name}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                      required
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Logo URL</span>
                    <input
                      name="logo_url"
                      defaultValue={inst.logo_url ?? ""}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="rounded-lg border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                    >
                      Update
                    </button>
                  </div>
                </form>

                <div className="md:col-span-1">
                  <form action={deleteInstitution}>
                    <input type="hidden" name="id" value={inst.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Hapus
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Menghapus institution akan menghapus blueprint terkait (cascade).
                    </p>
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
