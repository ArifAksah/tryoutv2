"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  description?: string;
  variant?: "default" | "primary" | "danger";
  group?: string;
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

function navItemClass(variant: NavItem["variant"], isActive: boolean): string {
  if (variant === "primary") {
    return "border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  }
  if (variant === "danger") {
    return "border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300";
  }
  if (isActive) {
    return "border-sky-300 bg-sky-50 text-sky-900";
  }
  return "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900";
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
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Group nav items
  const groupedNav: Record<string, NavItem[]> = {};
  const defaultGroup = "Menu";
  nav.forEach((item) => {
    const group = item.group || defaultGroup;
    if (!groupedNav[group]) groupedNav[group] = [];
    groupedNav[group]!.push(item);
  });

  const orderedGroups = Object.keys(groupedNav).sort((a, b) => {
    // Custom sort: Menu first, Latihan second, Admin/Danger last
    if (a === "Menu") return -1;
    if (b === "Menu") return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[260px_1fr]">
      {/* Mobile Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <Link href={brandHref} className="text-lg font-bold text-slate-900">
          {brandLabel}
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        >
          {isOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] transform border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-full flex-col">
          {/* Brand Header */}
          <div className="hidden border-b border-slate-100 px-6 py-6 md:block">
            <Link href={brandHref} className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-900">{brandLabel}</span>
            </Link>
            <p className="mt-1 text-xs font-medium text-slate-500">{title}</p>
          </div>

          {/* User Info Mobile (in Sidebar) */}
          <div className="border-b border-slate-100 px-6 py-4 md:hidden">
            <p className="text-sm font-semibold text-slate-900">{userEmail}</p>
            {roleLabel && (
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {roleLabel}
              </span>
            )}
          </div>

          {/* Nav Links */}
          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-8">
              {orderedGroups.map((group) => (
                <div key={group}>
                  <h3 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {groupedNav[group]?.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={`group flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition ${navItemClass(
                            item.variant,
                            isActive
                          )}`}
                        >
                          <span>{item.label}</span>
                          {item.description && !item.variant && (
                            <span className="hidden text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 lg:block">
                              {/* Optional: icon or short desc */}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* User Footer (Desktop) */}
          <div className="hidden border-t border-slate-100 bg-slate-50/50 p-4 md:block">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600" />
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-slate-900">{userEmail}</p>
                {roleLabel && <p className="text-xs text-slate-500">{roleLabel}</p>}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="w-full px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
