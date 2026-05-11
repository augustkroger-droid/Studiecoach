import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteFromTable(
    table: string,
    column: string,
    userId: string
) {
    const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, userId);

    if (error) {
        throw new Error(`${table}.${column}: ${error.message}`);
    }
}

export async function POST(req: Request) {
    try {
        console.log("DELETE USER ROUTE HIT");

        const { userId } = await req.json();

        console.log("UserId received:", userId);

        if (!userId) {
            return NextResponse.json(
                { error: "Missing userId" },
                { status: 400 }
            );
        }

        // Kontrollera att användaren finns
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("id, username")
            .eq("id", userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                {
                    error: "Användaren hittades inte i profiles.",
                    details: profileError?.message || null,
                },
                { status: 404 }
            );
        }

        console.log("Profile found:", profile);

        // Ta bort relaterad data först
        await deleteFromTable("study_sessions", "user_id", userId);

        await deleteFromTable("study_posts", "user_id", userId);

        await deleteFromTable(
            "admin_class_students",
            "student_id",
            userId
        );

        await deleteFromTable(
            "teacher_students",
            "student_id",
            userId
        );

        await deleteFromTable(
            "teacher_students",
            "teacher_id",
            userId
        );

        await deleteFromTable(
            "teacher_classes",
            "teacher_id",
            userId
        );

        await deleteFromTable(
            "teacher_own_class_students",
            "student_id",
            userId
        );

        await deleteFromTable(
            "teacher_own_classes",
            "teacher_id",
            userId
        );

        await deleteFromTable(
            "admin_classes",
            "admin_id",
            userId
        );

        // Ta bort profil
        const {
            data: deletedProfiles,
            error: deleteProfileError,
        } = await supabaseAdmin
            .from("profiles")
            .delete()
            .eq("id", userId)
            .select("id, username");

        if (deleteProfileError) {
            throw new Error(
                `profiles delete failed: ${deleteProfileError.message}`
            );
        }

        if (!deletedProfiles || deletedProfiles.length === 0) {
            throw new Error(
                `Ingen profile-rad togs bort för userId: ${userId}`
            );
        }

        console.log("Deleted profile:", deletedProfiles);

        // Ta bort auth-användaren
        const { error: authDeleteError } =
            await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            throw new Error(
                `Auth delete failed: ${authDeleteError.message}`
            );
        }

        console.log("Deleted auth user:", userId);

        return NextResponse.json({
            success: true,
            deletedUserId: userId,
            deletedProfile: deletedProfiles,
        });
    } catch (error) {
        console.error("DELETE USER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown server error",
            },
            { status: 500 }
        );
    }
}