import Link from "next/link";
import { LoginClient } from "./login-client";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ next?: string; error?: string; error_description?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error, error_description } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";

  const user = await getCurrentUser();

  // If user is already logged in
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="bg-slate-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-3xl">
              👋
            </div>
            <h1 className="text-xl font-bold text-white">Sudah Login!</h1>
            <p className="mt-2 text-sm text-slate-400">
              Anda terdeteksi aktif sebagai <span className="font-medium text-white">{user.email}</span>
            </p>
          </div>
          <div className="p-8 space-y-4">
            <Link
              href={nextPath}
              className="block w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 hover:shadow-xl"
            >
              Lanjut ke Aplikasi
            </Link>
            <Link
              href="/logout"
              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-rose-600"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Split Layout
  return (
    <div className="flex min-h-screen flex-row bg-white">

      {/* LEFT SIDE: Feature / Brand */}
      <div className="relative hidden w-0 flex-1 lg:block">
        {/* Background Image/Gradient */}
        <div className="absolute inset-0 h-full w-full bg-slate-900">
          {/* Decorative Gradients */}
          <div className="absolute top-0 left-0 h-full w-full overflow-hidden">
            <div className="absolute top-0 left-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/30 blur-[100px]" />
            <div className="absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/2 translate-y-1/2 rounded-full bg-purple-600/20 blur-[100px]" />
          </div>

          {/* Content Layer */}
          <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
            <div className="flex items-center gap-6">
              <img src="/logo.png" alt="OmniTes Logo" className="h-24 w-24 object-contain" />
              <span className="text-5xl font-bold tracking-tight">OmniTes</span>
            </div>

            <div className="mb-24 space-y-6">
              <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-white">
                Wujudkan Kampus dan <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-300">
                  Karier Impian Mulai di Sini.
                </span>
              </h1>
              <p className="max-w-lg text-lg text-slate-300">
                Hadapi UTBK, CPNS, dan berbagai seleksi dengan percaya diri. Latih mental dan strategimu melalui ribuan soal terstruktur dan evaluasi yang akurat.
              </p>

              {/* Features List */}
              <ul className="space-y-4 pt-4">
                {[
                  "Pengalaman Ujian Real-time",
                  "Laporan Kelemahan & Kekuatan",
                  "Materi Standar Terbaru (SNPMB & BKN)"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/30 text-indigo-300 font-bold">✓</span>
                    <span className="font-medium text-slate-200">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-sm text-slate-500">
              © 2024 OmniTes Platform. All rights reserved.
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-12 lg:hidden flex items-center gap-4">
            <img src="/logo.png" alt="OmniTes Logo" className="h-16 w-16 object-contain" />
            <span className="text-3xl font-bold text-slate-900">OmniTes</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Selamat Datang Kembali
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Silakan login untuk mengakses akun latihan Anda.
            </p>
          </div>

          <LoginClient
            nextPath={nextPath}
            initialError={
              error_description
                ? decodeURIComponent(error_description)
                : error
                  ? `Login error: ${error}`
                  : null
            }
          />
        </div>
      </div>
    </div>
  );
}
