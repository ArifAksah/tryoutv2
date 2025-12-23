"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { signInWithGoogleAction } from "./actions";

type Props = {
  nextPath: string;
  initialError?: string | null;
};

export function LoginClient({ nextPath, initialError = null }: Props) {
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleLogin = async () => {
    setError(null);
    setPending(true);
    try {
      const res = await signInWithGoogleAction(nextPath);
      if (res?.error) {
        setError(res.error);
        setPending(false);
      }
    } catch (e) {
      setError("Kesalahan koneksi ke Google.");
      setPending(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      window.location.assign(nextPath || "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal login.");
      setPending(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 animate-fade-in-up">
          ⚠️ {error}
        </div>
      )}

      {/* Main Login Option */}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm font-medium leading-6">
            <span className="bg-white px-6 text-slate-500">Masuk sebagai Siswa</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={pending}
          className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {/* Google Icon SVG */}
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {pending ? "Menghubungkan..." : "Lanjut dengan Google"}
        </button>
      </div>

      {/* Admin / Email Section */}
      <div className="pt-4">
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm font-medium leading-6">
              <span className="bg-white px-2 text-xs uppercase tracking-widest text-slate-400">Atau Admin Login</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="sr-only">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-xl border-0 bg-slate-50 px-4 py-3.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-all"
                placeholder="Email Admin"
                required
              />
            </div>
            <div>
              <label className="sr-only">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border-0 bg-slate-50 px-4 py-3.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-all"
                placeholder="Password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex w-full justify-center rounded-xl bg-slate-900 px-3 py-3.5 text-sm font-bold leading-6 text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-all disabled:opacity-70"
          >
            {pending ? "Memproses..." : "Masuk sebagai Admin"}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-slate-400">
        Butuh bantuan? <a href="#" className="font-semibold text-indigo-600 hover:text-indigo-500">Hubungi Support</a>
      </p>
    </div>
  );
}
