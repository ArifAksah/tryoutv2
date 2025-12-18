"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

type Props = {
  href: string;
  durationMinutes?: number | null;
  title?: string;
  subtitle?: string;
  confirmText?: string;
  cancelText?: string;
  className?: string;
  children: ReactNode;
};

export function ConfirmStartTryoutButton({
  href,
  durationMinutes,
  title = "Mulai Tryout?",
  subtitle,
  confirmText = "Mulai",
  cancelText = "Batal",
  className,
  children,
}: Props) {
  const router = useRouter();

  const handleClick = async () => {
    const durationLabel =
      typeof durationMinutes === "number" && Number.isFinite(durationMinutes) && durationMinutes > 0
        ? `${durationMinutes} menit`
        : "mengikuti pengaturan kategori/paket (default 30 menit)";

    const html = `${
      subtitle ? `<div style=\"margin-bottom:6px\">${subtitle}</div>` : ""
    }
    <div>Durasi: <b>${durationLabel}</b></div>
    <div style=\"margin-top:10px\">Mulai sekarang?</div>`;

    const res = await Swal.fire({
      title,
      html,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
    });

    if (res.isConfirmed) {
      router.push(href);
    }
  };

  return (
    <button type="button" onClick={() => void handleClick()} className={className}>
      {children}
    </button>
  );
}
