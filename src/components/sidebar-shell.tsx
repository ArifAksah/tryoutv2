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
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:block md:px-6 md:py-5">
          <div className="space-y-1">
            <Link href={brandHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="tracking-wide text-lg md:text-sm">{brandLabel}</span>
            </Link>
            <p className="text-xs text-slate-500 hidden md:block">{title}</p>
          </div>

          <div className="flex items-center gap-3 md:mt-4 md:flex-col md:items-start md:gap-2">
            {roleLabel ? (
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 md:px-3 md:py-1 md:text-xs">
                {roleLabel}
              </span>
            ) : null}
            {userEmail ? (
              <span className="hidden leading-none text-xs text-slate-500 md:block md:max-w-[16rem] md:truncate">
                {userEmail}
              </span>
            ) : null}
            {/* Mobile-only avatar/initials could go here if needed */}
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 md:flex-col md:overflow-visible md:px-6 md:pb-5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition md:shrink md:px-4 md:text-sm ${navItemClass(
                item.variant
              )}`}
            >
              <span className="block whitespace-nowrap">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 hidden text-xs font-medium text-slate-500 md:block">
                  {item.description}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
