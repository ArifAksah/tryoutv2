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

  // State for email/password form
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
      setError("Terjadi kesalahan saat menghubungi server Google.");
      setPending(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          User (SSO)
        </p>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={pending}
          className="w-full rounded-lg border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
        >
          {pending ? "Mengalihkan..." : "Masuk dengan Google"}
        </button>
      </div>

      <div className="border-t border-slate-200 pt-4" />

      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setPending(true);
          try {
            const supabase = getSupabaseBrowserClient();
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) {
              setError(error.message);
              return;
            }
            window.location.assign(nextPath || "/");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Gagal login dengan email/password");
          } finally {
            setPending(false);
          }
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Admin (tanpa SSO)
        </p>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            placeholder="admin@contoh.com"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-900">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            required
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        >
          {pending ? "Masuk..." : "Masuk dengan Email"}
        </button>
        <p className="text-xs text-slate-500">
          Akun admin dibuat di Supabase Auth (email/password), lalu diberi role dengan mengisi tabel <span className="font-semibold text-slate-700">admin_users</span>.
        </p>
      </form>

      <p className="text-xs text-slate-500">
        Jika login berhasil, kamu akan diarahkan kembali ke <span className="font-semibold text-slate-700">{nextPath || "/"}</span>.
      </p>
    </div>
  );
}
