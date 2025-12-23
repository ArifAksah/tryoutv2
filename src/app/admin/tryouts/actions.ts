"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function getInt(formData: FormData, name: string): number | null {
  const raw = getString(formData, name);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function getBool(formData: FormData, name: string): boolean {
  const raw = getString(formData, name);
  return raw === "on" || raw === "true" || raw === "1";
}

export async function upsertTryoutPackage(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/tryouts");

  const slug = getString(formData, "slug").toLowerCase();
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const durationMinutes = getInt(formData, "duration_minutes");
  const isActive = getBool(formData, "is_active");

  if (!slug || !title) redirect("/admin/tryouts");
  if (durationMinutes !== null && durationMinutes <= 0) redirect("/admin/tryouts");

  const supabase = await getSupabaseServerClient("write");

  const { data, error } = await supabase
    .from("exam_packages")
    .upsert(
      {
        slug,
        title,
        description: description || null,
        duration_minutes: durationMinutes,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id, slug")
    .maybeSingle();

  if (error || !data?.id) redirect("/admin/tryouts");

  revalidatePath("/admin/tryouts");
  redirect(`/admin/tryouts?package=${encodeURIComponent(data.id)}`);
}

export async function updateTryoutPackage(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/tryouts");

  const id = getString(formData, "id");
  const slug = getString(formData, "slug").toLowerCase();
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const durationMinutes = getInt(formData, "duration_minutes");
  const isActive = getBool(formData, "is_active");

  if (!id || !slug || !title) redirect("/admin/tryouts");
  if (durationMinutes !== null && durationMinutes <= 0) redirect("/admin/tryouts");

  const supabase = await getSupabaseServerClient("write");
  const { error } = await supabase
    .from("exam_packages")
    .update({
      slug,
      title,
      description: description || null,
      duration_minutes: durationMinutes,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) redirect("/admin/tryouts");

  revalidatePath("/admin/tryouts");
  redirect(`/admin/tryouts?package=${encodeURIComponent(id)}`);
}

export async function deleteTryoutPackage(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/tryouts");

  const id = getString(formData, "id");
  if (!id) redirect("/admin/tryouts");

  const supabase = await getSupabaseServerClient("write");
  await supabase.from("exam_packages").delete().eq("id", id);

  revalidatePath("/admin/tryouts");
  redirect("/admin/tryouts");
}

export async function upsertTryoutBlueprint(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/tryouts");

  const packageId = getString(formData, "package_id");
  const categoryId = getString(formData, "category_id");
  const questionCount = getInt(formData, "question_count");

  if (!packageId) redirect("/admin/tryouts");
  if (!categoryId) redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}`);
  if (!questionCount || questionCount <= 0) redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}`);

  const supabase = await getSupabaseServerClient("write");
  const { error } = await supabase
    .from("exam_package_blueprints")
    .upsert(
      {
        package_id: packageId,
        category_id: categoryId,
        question_count: questionCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "package_id,category_id" }
    );

  if (error) redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}`);

  revalidatePath("/admin/tryouts");
  redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}`);
}

export async function deleteTryoutBlueprint(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/tryouts");

  const id = getString(formData, "id");
  const packageId = getString(formData, "package_id");
  if (!id) redirect("/admin/tryouts");

  const supabase = await getSupabaseServerClient("write");
  await supabase.from("exam_package_blueprints").delete().eq("id", id);

  revalidatePath("/admin/tryouts");
  redirect(`/admin/tryouts${packageId ? `?package=${encodeURIComponent(packageId)}` : ""}`);
}

export async function applyMasterBlueprint(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/tryouts");

  const packageId = getString(formData, "package_id");
  const institutionId = getString(formData, "institution_id");

  if (!packageId || !institutionId) redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}`);

  const supabase = await getSupabaseServerClient("write");

  // 1. Fetch Master Blueprints
  const { data: masters, error: masterError } = await supabase
    .from("exam_blueprints")
    .select("category_id, question_count")
    .eq("institution_id", institutionId);

  if (masterError || !masters || masters.length === 0) {
    redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent("Master blueprint kosong.")}`);
  }

  // 2. Clear existing package blueprints (optional, but requested for 'schema' consistency)
  // Actually safer to delete all before applying schema to assume 'reset'.
  await supabase.from("exam_package_blueprints").delete().eq("package_id", packageId);

  // 3. Insert new rows
  const rows = masters.map(m => ({
    package_id: packageId,
    category_id: m.category_id,
    question_count: m.question_count,
    updated_at: new Date().toISOString()
  }));

  const { error: insertError } = await supabase
    .from("exam_package_blueprints")
    .insert(rows);

  if (insertError) {
    redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath("/admin/tryouts");
  redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}`);
}

function distributeProportional(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);

  const raw = weights.map((w) => (total * w) / sum);
  const base = raw.map((x) => Math.floor(x));
  let remaining = total - base.reduce((a, b) => a + b, 0);

  const order = raw
    .map((x, i) => ({ i, frac: x - base[i] }))
    .sort((a, b) => b.frac - a.frac);

  let idx = 0;
  while (remaining > 0 && order.length > 0) {
    base[order[idx].i] += 1;
    remaining -= 1;
    idx = (idx + 1) % order.length;
  }

  return base;
}

function allocateWithCaps(weights: number[], caps: number[], total: number): number[] {
  const n = weights.length;
  const out = Array.from({ length: n }, () => 0);
  const capsLeft = caps.map((c) => Math.max(0, c));
  let remaining = Math.max(0, total);

  if (remaining === 0) return out;

  // Keep iterating because some buckets might hit caps.
  while (remaining > 0) {
    const activeIdx = capsLeft
      .map((c, i) => ({ i, c }))
      .filter((x) => x.c > 0)
      .map((x) => x.i);

    if (activeIdx.length === 0) break;

    const activeWeights = activeIdx.map((i) => Math.max(0, weights[i] ?? 0));
    const weightSum = activeWeights.reduce((a, b) => a + b, 0);
    const roundWeights = weightSum > 0 ? activeWeights : activeIdx.map(() => 1);
    const proposed = distributeProportional(roundWeights, remaining);

    let progressed = false;
    for (let k = 0; k < activeIdx.length; k += 1) {
      const i = activeIdx[k];
      const give = Math.min(proposed[k] ?? 0, capsLeft[i]);
      if (give <= 0) continue;
      out[i] += give;
      capsLeft[i] -= give;
      remaining -= give;
      progressed = true;
      if (remaining === 0) break;
    }

    // Fallback: if rounding produced all zeros but we still have remaining, allocate 1-by-1.
    if (!progressed && remaining > 0) {
      for (const i of activeIdx) {
        if (remaining === 0) break;
        if (capsLeft[i] <= 0) continue;
        out[i] += 1;
        capsLeft[i] -= 1;
        remaining -= 1;
      }
    }

    if (!progressed && remaining > 0) break;
  }

  return out;
}

export async function generateBlueprintProportional(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/tryouts");

  const packageId = getString(formData, "package_id");
  const parentCategoryId = getString(formData, "parent_category_id");
  const totalRaw = getString(formData, "total_questions");
  const distributionMode = getString(formData, "distribution_mode") || "stock";
  const totalQuestions = Math.trunc(Number(totalRaw));

  if (!packageId) redirect("/admin/tryouts");
  if (!parentCategoryId) redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}`);
  if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) {
    redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent("Total soal harus > 0")}`);
  }

  const supabase = await getSupabaseServerClient("write");

  const { data: parentRow } = await supabase
    .from("categories")
    .select("id, slug")
    .eq("id", parentCategoryId)
    .maybeSingle();

  const parentSlug = String((parentRow as { slug?: unknown } | null)?.slug ?? "").toLowerCase();

  const { data: children, error: childrenError } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("parent_id", parentCategoryId)
    .order("name", { ascending: true });

  if (childrenError) {
    redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent(childrenError.message)}`);
  }

  const childList = (children ?? []) as Array<{ id: string; name: string; slug: string }>;
  if (childList.length === 0) {
    redirect(
      `/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent(
        "Kategori parent tidak punya child. Pilih parent (root/section), bukan sub-topik."
      )}`
    );
  }

  const availableCounts: number[] = [];
  const eligibleChildren: Array<{ id: string; slug: string; available: number }> = [];

  for (const c of childList) {
    const { data: count } = await supabase.rpc("count_questions_recursive", { category_id: c.id });
    const available = Math.trunc(Number(count ?? 0));
    if (available > 0) {
      eligibleChildren.push({ id: c.id, slug: c.slug, available });
      availableCounts.push(available);
    }
  }

  if (eligibleChildren.length === 0) {
    redirect(
      `/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent(
        "Tidak ada child yang punya soal (question count = 0)."
      )}`
    );
  }

  const totalAvailable = eligibleChildren.reduce((s, x) => s + x.available, 0);
  if (totalQuestions > totalAvailable) {
    redirect(
      `/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent(
        `Total soal melebihi stok. Total diminta=${totalQuestions}, tersedia=${totalAvailable}.`
      )}`
    );
  }

  if (totalQuestions < eligibleChildren.length) {
    redirect(
      `/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent(
        `Total soal terlalu kecil untuk dibagi ke ${eligibleChildren.length} kategori (min ${eligibleChildren.length}).`
      )}`
    );
  }

  let weights: number[];
  if (distributionMode === "ratio") {
    // Default ratio preset:
    // - if parent is skd and children are twk/tiu/tkp, use 30:35:45
    // - otherwise, equal ratio (1:1:1...)
    const ratioBySlug: Record<string, number> = { twk: 30, tiu: 35, tkp: 45 };
    const slugs = eligibleChildren.map((c) => c.slug.toLowerCase());
    const isSkdPreset = parentSlug === "skd" && slugs.some((s) => s === "twk") && slugs.some((s) => s === "tiu") && slugs.some((s) => s === "tkp");
    weights = eligibleChildren.map((c) => (isSkdPreset ? ratioBySlug[c.slug.toLowerCase()] ?? 1 : 1));
  } else {
    // stock-based
    weights = eligibleChildren.map((x) => x.available);
  }

  // Ensure each eligible child gets at least 1 question.
  const base = eligibleChildren.map(() => 1);
  const remaining = totalQuestions - base.length;
  const caps = eligibleChildren.map((c) => Math.max(0, c.available - 1));
  const extra = allocateWithCaps(weights, caps, remaining);
  const allocations = base.map((b, i) => b + (extra[i] ?? 0));

  // Replace existing blueprint
  await supabase.from("exam_package_blueprints").delete().eq("package_id", packageId);

  const rows = eligibleChildren.map((c, i) => ({
    package_id: packageId,
    category_id: c.id,
    question_count: allocations[i],
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase.from("exam_package_blueprints").insert(rows);
  if (insertError) {
    redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}&error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath("/admin/tryouts");
  redirect(`/admin/tryouts?package=${encodeURIComponent(packageId)}`);
}
