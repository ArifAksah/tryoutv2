import { requireAdminUser } from "@/lib/auth";
import { ImportForm } from "./_components/import-form";

export const dynamic = "force-dynamic";

export default async function ImportQuestionsPage() {
  await requireAdminUser("/admin/questions/import");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Soal dari JSON</h1>
        <p className="text-sm text-slate-600">
          Upload file JSON untuk menambahkan banyak soal sekaligus
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-semibold text-amber-900">📋 Langkah-langkah:</p>
        <ol className="mt-2 space-y-1 text-amber-800">
          <li>1. Download template JSON dari <code className="rounded bg-amber-100 px-1">templates/import-questions-template.json</code></li>
          <li>2. Isi template dengan soal-soal Anda</li>
          <li>3. Pastikan semua <code className="rounded bg-amber-100 px-1">category_slug</code> sudah ada di database</li>
          <li>4. Upload file JSON di form bawah</li>
          <li>5. Klik &quot;Validasi File&quot; untuk preview</li>
          <li>6. Jika OK, klik &quot;Import Soal&quot;</li>
        </ol>
      </div>

      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
        <p className="font-semibold text-rose-900">⚠️ Jika Import Error &quot;column not found&quot;:</p>
        <p className="mt-2 text-rose-800">
          Jalankan SQL migration di Supabase SQL Editor:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-rose-100 p-2 text-xs text-rose-900">
          ALTER TABLE public.questions{'\n'}
          {'  '}ADD COLUMN IF NOT EXISTS question_image_url text,{'\n'}
          {'  '}ADD COLUMN IF NOT EXISTS question_image_alt text;
        </pre>
        <p className="mt-2 text-rose-800">
          📖 Panduan lengkap: <strong>MIGRATION-GUIDE.md</strong>
        </p>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm">
        <p className="font-semibold text-sky-900">📖 Dokumentasi Lengkap:</p>
        <p className="mt-2 text-sky-800">
          Baca <strong>IMPORT-GUIDE.md</strong> untuk format JSON, contoh, validasi, dan troubleshooting.
        </p>
      </div>

      <ImportForm />
    </div>
  );
}
