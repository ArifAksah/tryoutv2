import Link from "next/link";
import { ExamSectionCard } from "@/components/exam-section-card";
import { SidebarShell } from "@/components/sidebar-shell";
import { fetchExamStructure } from "@/lib/exam-structure";
import { fetchQuestionsForSection } from "@/lib/questions";
import { TryoutRunner } from "@/components/tryout-runner";
import { ConfirmStartTryoutButton } from "@/components/confirm-start-tryout-button";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SectionPage({ params }: Props) {
  const { id } = await params;
  await requireUser(`/sections/${id}`);
  const user = await getCurrentUser();
  const admin = await isAdminUser();
  const { sections, source } = await fetchExamStructure();
  const section = sections.find((item) => item.id === id);
  const { questions, source: questionSource } = await fetchQuestionsForSection(id);

  if (!section) {
    return (
      <SidebarShell
        title="Detail modul"
        roleLabel={admin ? "Role: admin" : "Role: user"}
        userEmail={user?.email}
        nav={[
          { href: "/", label: "Dashboard", description: "Kembali ke daftar modul" },
          { href: "/account", label: "Akun", description: "Profil" },
          { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
          { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
          { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
          { href: "/admin", label: "Admin", description: "Bank soal & data", variant: "primary" },
          { href: "/logout", label: "Sign out", description: "Keluar dari sesi", variant: "danger" },
        ]}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center text-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Section tidak ditemukan
          </p>
          <h1 className="text-3xl font-bold">Oops, modul tidak tersedia</h1>
          <p className="max-w-2xl text-sm text-slate-700">
            Pastikan ID modul benar atau cek apakah data sudah tersimpan di tabel Supabase
            <span className="font-semibold text-slate-900"> categories</span> dan
            <span className="font-semibold text-slate-900"> questions</span>.
          </p>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kembali ke dashboard
          </Link>
        </div>
      </SidebarShell>
    );
  }

  return (
    <SidebarShell
      title="Detail modul"
      roleLabel={admin ? "Role: admin" : "Role: user"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Kembali ke daftar modul" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
        { href: "/admin", label: "Admin", description: "Bank soal & data", variant: "primary" },
        { href: "/logout", label: "Sign out", description: "Keluar dari sesi", variant: "danger" },
      ]}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-16 md:pb-10">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Detail modul
          </p>
          <h1 className="text-3xl font-bold text-slate-900">{section.name}</h1>
          <p className="text-sm text-slate-700">
            Tipe: <span className="font-semibold text-slate-900">{section.type}</span> · Kode: {section.code}
            {section.school ? (
              <>
                {" "}· Sekolah: <span className="font-semibold text-slate-900">{section.school}</span>
              </>
            ) : null}
          </p>
          {section.description ? (
            <p className="text-sm leading-relaxed text-slate-700">{section.description}</p>
          ) : null}
        </div>

        <ExamSectionCard section={section} />

        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Latihan per Sub-Topik</h2>
            <p className="text-sm text-slate-600">
              Pilih sub-topik spesifik untuk latihan mendalam tanpa timer
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {section.topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/practice/${topic.id}`}
                className="group flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-lg group-hover:bg-sky-200">
                  📚
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-slate-900 group-hover:text-sky-900">
                    {topic.name}
                  </h3>
                  {topic.description && (
                    <p className="text-sm text-slate-600">{topic.description}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    {topic.questionCount ? `${topic.questionCount} soal tersedia` : "Klik untuk latihan"}
                  </p>
                </div>
                <div className="text-sm font-semibold text-slate-400 group-hover:text-sky-600">
                  →
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <ConfirmStartTryoutButton
            href={section.type === "SKD" ? "/tryout/real/skd" : `/tryout/real/${encodeURIComponent(section.id)}`}
            durationMinutes={section.type === "SKD" ? 100 : 60}
            title="Mulai Tryout Real?"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Mulai Tryout Real (Timer)
          </ConfirmStartTryoutButton>
        </div>

        <TryoutRunner
          sectionId={section.id}
          topics={section.topics}
          questions={questions}
          source={questionSource}
        />

        <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-sm text-slate-700">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ringkasan modul
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{section.topics.length} sub-topik</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Data section: {source}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Data soal: {questionSource}</span>
            </div>
            <p className="text-sm text-slate-700">
              Siklus tryout: pilih sub-topik, jawab soal, submit untuk dapat skor & pembahasan, lalu reset untuk ulang.
            </p>
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}
