
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        return NextResponse.json({ error: "Missing Service Role Key" }, { status: 500 });
    }

    const supabase = createClient(url, serviceKey);

    // Upsert UTBK Institution
    const { data: utbkInst, error: instError } = await supabase
        .from("institutions")
        .upsert(
            { code: "UTBK", name: "UTBK SNBT" },
            { onConflict: "code" }
        )
        .select()
        .single();

    if (instError) {
        return NextResponse.json({ error: instError.message }, { status: 500 });
    }

    // Check Roots
    const { data: categories } = await supabase
        .from("categories")
        .select("id, name, slug")
        .is("parent_id", null);

    const { data: institutions } = await supabase
        .from("institutions")
        .select("id, name, code");

    return NextResponse.json({
        message: "Migration success",
        utbkInst,
        categories,
        institutions
    });
}
