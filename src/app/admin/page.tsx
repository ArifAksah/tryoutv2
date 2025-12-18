import { redirect } from "next/navigation";
import Link from "next/link";

import { isAdminUser, requireUser, getCurrentUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  await searchParams;
  await requireUser("/admin");
  const user = await getCurrentUser();
  const admin = await isAdminUser();

  if (!admin) {
    redirect("/admin/forbidden");
  }

  const supabase = await getSupabaseServerClient("read");

  const [questionsCount, categoriesCount, institutionsCount, blueprintsCount] = await Promise.all([
    supabase.from("questions").select("*", { count: "exact", head: true }),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase.from("institutions").select("*", { count: "exact", head: true }),
    supabase.from("exam_blueprints").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    {
      label: "Total Soal",
      value: questionsCount.count ?? 0,
      href: "/admin/questions",
      color: "sky",
      icon: "📝",
    },
    {
      label: "Kategori",
      value: categoriesCount.count ?? 0,
      href: "/admin/questions",
      color: "purple",
      icon: "📁",
    },
    {
      label: "Sekolah/Instansi",
      value: institutionsCount.count ?? 0,
      href: "/admin/institutions",
      color: "emerald",
      icon: "🏫",
    },
    {
      label: "Blueprints",
      value: blueprintsCount.count ?? 0,
      href: "/admin/blueprints",
      color: "amber",
      icon: "📋",
    },
  ];

  const quickLinks = [
    {
      title: "Bank Soal",
      description: "Kelola semua soal SKD dan SKB",
      href: "/admin/questions",
      color: "sky",
    },
    {
      title: "Institutions",
      description: "Kelola sekolah kedinasan",
      href: "/admin/institutions",
      color: "emerald",
    },
    {
      title: "Blueprints",
      description: "Atur komposisi soal per sekolah",
      href: "/admin/blueprints",
      color: "purple",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-600">Selamat datang, {user?.email?.split("@")[0] || "Admin"}!</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-slate-600">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              </div>
              <div className="text-4xl">{stat.icon}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.title}
              href={link.href}
              className={`group rounded-lg border-2 border-${link.color}-200 bg-${link.color}-50 p-6 transition hover:border-${link.color}-300 hover:shadow-md`}
            >
              <h3 className="text-lg font-bold text-slate-900">{link.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{link.description}</p>
              <div className="mt-4 text-sm font-semibold text-slate-900 group-hover:underline">
                Buka →
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-bold text-slate-900">💡 Tips</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>• Gunakan <strong>Bank Soal</strong> untuk menambah atau mengedit soal SKD dan SKB</li>
          <li>• <strong>Institutions</strong> digunakan untuk mengelola data sekolah kedinasan</li>
          <li>• <strong>Blueprints</strong> mengatur berapa banyak soal per kategori untuk setiap sekolah</li>
        </ul>
      </div>
    </div>
  );
}
