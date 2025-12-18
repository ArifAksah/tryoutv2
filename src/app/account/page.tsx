import { SidebarShell } from "@/components/sidebar-shell";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const me = await requireUser("/account");
  const user = await getCurrentUser();
  const admin = await isAdminUser();
  const supabase = await getSupabaseServerClient("read");

  const sp = await searchParams;
  const success = sp.success === "1";
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : "";

  const { data } = await supabase
    .from("user_profiles")
    .select("id, username, display_name")
    .eq("id", me.id)
    .maybeSingle();

  const profile = (data ?? null) as null | { id: string; username: string | null; display_name: string | null };

  return (
    <SidebarShell
      title="Akun"
      roleLabel={admin ? "Role: admin" : "Role: user"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Kembali" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
        ...(admin ? [{ href: "/admin", label: "Admin", description: "Kelola", variant: "primary" as const }] : []),
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" as const },
      ]}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile</p>
          <h1 className="text-2xl font-bold text-slate-900">Pengaturan Akun</h1>
          <p className="text-sm text-slate-600">Atur nama yang tampil di leaderboard.</p>
        </div>

        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Profil berhasil disimpan.
          </div>
        ) : null}

        {errorMsg ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMsg}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <form action={updateProfile} className="grid gap-4 md:max-w-xl">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Display name</span>
              <input
                name="display_name"
                defaultValue={profile?.display_name ?? ""}
                placeholder="contoh: Dika / Budi"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              />
              <p className="text-xs text-slate-500">Nama ini yang ditampilkan di leaderboard.</p>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Username</span>
              <input
                name="username"
                defaultValue={profile?.username ?? ""}
                placeholder="contoh: dika_01"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              />
              <p className="text-xs text-slate-500">Format: 3-20 karakter, huruf kecil/angka/underscore. Harus unik.</p>
            </label>

            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Simpan
            </button>
          </form>
        </div>
      </div>
    </SidebarShell>
  );
}
