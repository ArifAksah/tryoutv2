import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  description?: string;
  variant?: "default" | "primary" | "danger";
};

type Props = {
  brandLabel?: string;
  brandHref?: string;
  title: string;
  roleLabel?: string;
  userEmail?: string | null;
  nav: NavItem[];
  children: ReactNode;
};

function navItemClass(variant: NavItem["variant"]): string {
  if (variant === "primary") {
    return "border-emerald-600 text-emerald-700 hover:bg-emerald-50";
  }
  if (variant === "danger") {
    return "border-rose-500 text-rose-600 hover:bg-rose-50";
  }
  return "border-slate-200 text-slate-700 hover:bg-slate-50";
}

export function SidebarShell({
  brandLabel = "Tryout",
  brandHref = "/",
  title,
  roleLabel,
  userEmail,
  nav,
  children,
}: Props) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[280px_1fr]">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex items-start justify-between gap-4 px-6 py-5 md:block">
          <div className="space-y-1">
            <Link href={brandHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="tracking-wide">{brandLabel}</span>
            </Link>
            <p className="text-xs text-slate-500">{title}</p>
          </div>

          <div className="flex flex-col items-end gap-2 md:mt-4 md:items-start">
            {roleLabel ? (
              <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                {roleLabel}
              </span>
            ) : null}
            {userEmail ? (
              <span className="max-w-[16rem] truncate text-xs text-slate-500">{userEmail}</span>
            ) : null}
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-6 pb-5 md:flex-col md:overflow-visible">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition md:shrink ${navItemClass(
                item.variant
              )}`}
            >
              <span className="block">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 hidden text-xs font-medium text-slate-500 md:block">
                  {item.description}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
