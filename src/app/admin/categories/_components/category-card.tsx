"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteCategoryWithQuestions, getCategoryStats } from "../actions";
import type { Category } from "../page";
import Swal from "sweetalert2";

type Props = {
  category: Category;
  level: number;
};

export function CategoryCard({ category, level }: Props) {
  const [loading, setLoading] = useState(false);

  const bgColors = ["bg-white", "bg-slate-50", "bg-slate-100"];
  const borderColors = ["border-slate-200", "border-slate-300", "border-slate-400"];
  const bgColor = bgColors[level - 1] || "bg-white";
  const borderColor = borderColors[level - 1] || "border-slate-200";

  const handleDeleteClick = async () => {
    setLoading(true);
    try {
      const stats = await getCategoryStats(category.id);

      const html = `
        Anda akan menghapus kategori <b>"${category.name}"</b>.<br/><br/>
        <div style="text-align:left">
          <div>• <b>${stats.totalQuestions}</b> soal langsung di kategori ini</div>
          ${
            stats.childCategories > 0
              ? `<div>• <b>${stats.childCategories}</b> sub-kategori (children)</div>
                 <div>• <b>${stats.totalWithChildren}</b> total soal (termasuk di sub-kategori)</div>`
              : ""
          }
        </div>
        <br/>
        <b style="color:#be123c">Tindakan ini TIDAK BISA dibatalkan.</b>
      `;

      const res = await Swal.fire({
        title: "Hapus kategori & semua soal?",
        html,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, Hapus Semua",
        cancelButtonText: "Batal",
        reverseButtons: true,
      });

      if (!res.isConfirmed) return;

      void Swal.fire({
        title: "Menghapus...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const formData = new FormData();
      formData.append("id", category.id);
      await deleteCategoryWithQuestions(formData);
    } catch (error) {
      console.error("Error fetching stats:", error);
      void Swal.fire({
        icon: "error",
        title: "Gagal",
        text: "Gagal memproses penghapusan kategori",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`rounded-lg border ${borderColor} ${bgColor} p-4`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-900">{category.name}</h3>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                {category.type || "unknown"}
              </span>
              {category.questionCount ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {category.questionCount} soal
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Slug: <code className="rounded bg-slate-100 px-1 text-xs">{category.slug}</code>
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/admin/categories/${category.id}/edit`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>
            <Link
              href={`/admin/categories/new?parent=${category.id}`}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-100"
            >
              + Sub
            </Link>
            <button
              onClick={handleDeleteClick}
              disabled={loading}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              {loading ? "..." : "Hapus"}
            </button>
          </div>
        </div>

        {category.children && category.children.length > 0 && (
          <div className="mt-4 space-y-3 pl-6">
            {category.children.map((child) => (
              <CategoryCard key={child.id} category={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
