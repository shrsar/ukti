
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in to access lesson files." },
        { status: 401 }
      );
    }

    const adminDb = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: lesson, error: lessonError } = await adminDb
      .from("lessons")
      .select("id, language, access_tier, status")
      .eq("id", lessonId)
      .maybeSingle();

    if (lessonError || !lesson || lesson.status !== "published") {
      return NextResponse.json(
        { error: "Lesson not found." },
        { status: 404 }
      );
    }

    const { data: languageAccess, error: accessError } = await adminDb
      .from("user_languages")
      .select("selected_plan, subscription_status")
      .eq("user_id", user.id)
      .eq("language", lesson.language)
      .maybeSingle();

    if (accessError || !languageAccess) {
      return NextResponse.json(
        { error: "You have not selected this language." },
        { status: 403 }
      );
    }

    if (
      lesson.access_tier === "premium" &&
      !(
        languageAccess.selected_plan === "premium" &&
        languageAccess.subscription_status === "active"
      )
    ) {
      return NextResponse.json(
        { error: "An active Premium plan is required for this lesson." },
        { status: 403 }
      );
    }

    const { data: documents, error: documentsError } = await adminDb
      .from("lesson_documents")
      .select("id, file_name, file_type, storage_path")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (documentsError) {
      throw new Error(documentsError.message);
    }

    const files = [];

    for (const document of documents || []) {
      const { data: signedFile, error: signedError } =
        await adminDb.storage
          .from("lesson-documents")
          .createSignedUrl(document.storage_path, 3600);

      if (signedError || !signedFile) {
        console.error("Signed URL error:", signedError?.message);
        continue;
      }

      files.push({
        id: document.id,
        fileName: document.file_name,
        fileType: document.file_type,
        url: signedFile.signedUrl,
      });
    }

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Lesson documents error:", error);

    return NextResponse.json(
      { error: "Could not load lesson files." },
      { status: 500 }
    );
  }
}
