import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const text = await request.text();
        const body = JSON.parse(text);

        if (!body?.id) {
            return NextResponse.json({ error: "Saknar pass-id" }, { status: 400 });
        }

        const remainingSeconds = Math.max(0, Number(body.remaining_seconds || 0));

        const { error } = await supabaseAdmin
            .from("study_sessions")
            .update({
                status: "paused",
                remaining_seconds: remainingSeconds,
                started_at: null,
                paused_at: new Date().toISOString(),
            })
            .eq("id", body.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json(
            { error: "Kunde inte pausa passet" },
            { status: 500 }
        );
    }
}