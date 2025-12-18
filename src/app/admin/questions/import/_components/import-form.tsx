"use client";

import { useState } from "react";
import { importQuestions, validateImportFile } from "../actions";

type ValidationResult = {
  valid: boolean;
  totalQuestions: number;
  errors: string[];
  warnings: string[];
  preview: Array<{
    category_slug: string;
    question_text: string;
    question_type: string;
  }>;
};

type ImportResult = {
  success: boolean;
  message: string;
  imported: number;
  failed: number;
  errors: Array<{ line: number; error: string }>;
};

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidation(null);
      setImportResult(null);
    }
  };

  const handleValidate = async () => {
    if (!file) return;

    setValidating(true);
    setValidation(null);

    try {
      const content = await file.text();
      const formData = new FormData();
      formData.append("content", content);

      const result = await validateImportFile(formData);
      setValidation(result as ValidationResult);
    } catch (error) {
      console.error("Validation error:", error);
      setValidation({
        valid: false,
        totalQuestions: 0,
        errors: ["Gagal membaca file. Pastikan format JSON valid."],
        warnings: [],
        preview: [],
      });
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file || !validation?.valid) return;

    setImporting(true);
    setImportResult(null);

    try {
      const content = await file.text();
      const formData = new FormData();
      formData.append("content", content);

      const result = await importQuestions(formData);
      setImportResult(result as ImportResult);
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({
        success: false,
        message: "Gagal import soal. Terjadi error.",
        imported: 0,
        failed: 0,
        errors: [],
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Upload File JSON</h2>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Pilih File JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-sky-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-200"
            />
          </label>

          {file && (
            <div className="text-sm text-slate-600">
              File terpilih: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleValidate}
              disabled={!file || validating}
              className="rounded-lg bg-sky-600 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {validating ? "Memvalidasi..." : "1. Validasi File"}
            </button>

            {validation?.valid && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {importing ? "Mengimport..." : "2. Import Soal"}
              </button>
            )}
          </div>
        </div>
      </div>

      {validation && (
        <div className="space-y-4">
          <div
            className={`rounded-lg border p-4 ${
              validation.valid
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <h3
              className={`font-bold ${validation.valid ? "text-emerald-900" : "text-rose-900"}`}
            >
              {validation.valid ? "✅ Validasi Berhasil" : "❌ Validasi Gagal"}
            </h3>
            <p className={`mt-1 text-sm ${validation.valid ? "text-emerald-800" : "text-rose-800"}`}>
              Total soal: {validation.totalQuestions}
            </p>
          </div>

          {validation.errors.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <h3 className="font-bold text-rose-900">Errors:</h3>
              <ul className="mt-2 space-y-1 text-sm text-rose-800">
                {validation.errors.map((err, idx) => (
                  <li key={idx}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-bold text-amber-900">Warnings:</h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {validation.warnings.map((warn, idx) => (
                  <li key={idx}>• {warn}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.preview.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-bold text-slate-900">Preview (5 soal pertama):</h3>
              <div className="mt-3 space-y-2">
                {validation.preview.slice(0, 5).map((q, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="font-semibold text-slate-900">{q.question_text}</div>
                    <div className="mt-1 text-slate-600">
                      Category: {q.category_slug} | Type: {q.question_type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {importResult && (
        <div
          className={`rounded-lg border p-6 ${
            importResult.success
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
          }`}
        >
          <h2
            className={`text-xl font-bold ${
              importResult.success ? "text-emerald-900" : "text-rose-900"
            }`}
          >
            {importResult.success ? "✅ Import Berhasil!" : "❌ Import Gagal"}
          </h2>
          <p className={`mt-2 ${importResult.success ? "text-emerald-800" : "text-rose-800"}`}>
            {importResult.message}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-semibold text-slate-900">Berhasil:</div>
              <div className="text-2xl font-bold text-emerald-700">{importResult.imported}</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">Gagal:</div>
              <div className="text-2xl font-bold text-rose-700">{importResult.failed}</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-rose-900">Detail Errors:</h3>
              <ul className="mt-2 space-y-1 text-sm text-rose-800">
                {importResult.errors.map((err, idx) => (
                  <li key={idx}>
                    Baris {err.line}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importResult.success && (
            <div className="mt-4">
              <a
                href="/admin/questions"
                className="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Lihat Bank Soal →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
