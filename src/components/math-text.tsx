"use client";

import { useMemo, useEffect, useState } from "react";
import type katex from "katex";
import "katex/dist/katex.min.css";

type Props = {
  text: string;
  className?: string;
};

/**
 * Render text with inline LaTeX math formulas
 * Supports both inline ($...$) and display ($$...$$) math
 * 
 * Examples:
 * - Inline: "Jika $x = 2$ dan $y = 3$, maka..."
 * - Display: "$$E = mc^2$$"
 * - Mixed: "Rumus kuadrat: $$ax^2 + bx + c = 0$$ dengan $a \neq 0$"
 */
export function MathText({ text, className = "" }: Props) {
  const [katexLib, setKatexLib] = useState<typeof katex | null>(null);

  useEffect(() => {
    // Dynamic import KaTeX only on client-side
    import("katex").then((mod) => setKatexLib(mod));
  }, []);

  const rendered = useMemo(() => {
    if (!text || !katexLib) return text;

    try {
      // Replace display math ($$...$$) first
      let processed = text.replace(/\$\$(.*?)\$\$/g, (match, formula) => {
        try {
          const html = katexLib.renderToString(formula.trim(), {
            displayMode: true,
            throwOnError: false,
          });
          return `<span class="math-display">${html}</span>`;
        } catch {
          return match;
        }
      });

      // Replace inline math ($...$)
      processed = processed.replace(/\$(.*?)\$/g, (match, formula) => {
        try {
          const html = katexLib.renderToString(formula.trim(), {
            displayMode: false,
            throwOnError: false,
          });
          return `<span class="math-inline">${html}</span>`;
        } catch {
          return match;
        }
      });

      return processed;
    } catch {
      return text;
    }
  }, [text, katexLib]);

  if (!katexLib) {
    // Fallback for SSR or if KaTeX not loaded
    return <span className={className}>{text}</span>;
  }

  return (
    <span
      className={`math-text ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

/**
 * Math-enabled textarea with live preview
 */
export function MathTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      {value && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <p className="mb-2 text-xs font-semibold text-sky-900">Preview dengan rumus:</p>
          <MathText text={value} className="text-sm text-slate-900" />
        </div>
      )}
    </div>
  );
}
