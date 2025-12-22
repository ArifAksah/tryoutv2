import type { ReactNode } from "react";

import { SidebarShell } from "@/components/sidebar-shell";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireUser("/admin");
  const user = await getCurrentUser();
  const admin = await isAdminUser();

  return (
    <SidebarShell
      brandLabel="Admin Panel"
      brandHref="/admin"
      title="Admin"
      roleLabel={admin ? "Admin" : "User"}
      userEmail={user?.email}
      nav={[
        {
          href: admin ? "/admin" : "/admin/forbidden",
          label: "Dashboard",
          description: "Statistik",
        },
        {
          href: admin ? "/admin/questions" : "/admin/forbidden",
          label: "Bank Soal",
          description: "Kelola soal",
          variant: "primary",
        },
        {
          href: admin ? "/admin/categories" : "/admin/forbidden",
          label: "Kategori",
          description: "Section & Topic",
        },
        {
          href: admin ? "/admin/institutions" : "/admin/forbidden",
          label: "Institutions",
          description: "Kelola sekolah",
        },
        {
          href: admin ? "/admin/blueprints" : "/admin/forbidden",
          label: "Blueprints",
          description: "Komposisi soal",
        },
        {
          href: admin ? "/admin/tryouts" : "/admin/forbidden",
          label: "Tryout Akbar",
          description: "Paket tryout custom",
        },
        {
          href: admin ? "/admin/plans" : "/admin/forbidden",
          label: "Paket Berlangganan",
          description: "Kelola harga & fitur",
        },
        {
          href: admin ? "/admin/subscriptions" : "/admin/forbidden",
          label: "Langganan User",
          description: "Approve/Reject",
        },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review jawaban" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review jawaban" },
        { href: "/", label: "User Dashboard", description: "Kembali ke user" },
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" },
      ]}
    >
      {children}
    </SidebarShell>
  );
}
