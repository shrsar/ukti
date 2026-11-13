
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type LessonAccessTier = "free" | "premium";
type LessonStatus = "draft" | "published";

function isValidContent(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validateLesson(body: Record<string, unknown>) {
  const language =
    typeof body.language === "string" ? body.language.trim() : "";

  const title =
    typeof body.title === "string" ? body.title.trim() : "";

  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : "";

  const lesson_number = Number(body.lesson_number);
  const access_tier = body.access_tier;
  const status = body.status;

  if (!language || !title) {
    return { error: "Language and lesson title are required." };
  }

  if (!Number.isSafeInteger(lesson_number) || lesson_number < 1) {
    return { error: "Enter a valid lesson number." };
  }

  if (
    access_tier !== "free" &&
    access_tier !== "premium"
  ) {
    return { error: "Access type must be free or premium." };
  }

  if (
    status !== "draft" &&
    status !== "published"
  ) {
    return { error: "Status must be draft or published." };
  }

  if (!isValidContent(body.content)) {
    return { error: "Lesson content must be a valid JSON object." };
  }

  return {
    lesson: {
      language,
      title,
      description,
      lesson_number,
      access_tier: access_tier as LessonAccessTier,
      status: status as LessonStatus,
      content: body.content,
    },
  };
}

async function getAuthorizedAdmin() {
  const context = await getAdminContext();

  if (!context.authorized) {
    return null;
  }

  return context;
}

async function readJsonBody(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return {
        body: null,
        error: "Invalid request data.",
      };
    }

    return {
      body: body as Record<string, unknown>,
      error: null,
    };
  } catch {
    return {
      body: null,
      error: "Invalid JSON request body.",
    };
  }
}

// GET: Fetch all lessons
export async function GET() {
  try {
    const context = await getAuthorizedAdmin();

    if (!context) {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const { data: lessons, error } = await context.adminDb
      .from("lessons")
      .select("*")
      .order("language", { ascending: true })
      .order("lesson_number", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      lessons: lessons || [],
    });
  } catch (error) {
    console.error("Fetch lessons error:", error);

    return NextResponse.json(
      { error: "Unable to fetch lessons." },
      { status: 500 }
    );
  }
}

// POST: Create a new lesson
export async function POST(request: Request) {
  try {
    const context = await getAuthorizedAdmin();

    if (!context) {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const { body, error: bodyError } = await readJsonBody(request);

    if (bodyError || !body) {
      return NextResponse.json(
        { error: bodyError },
        { status: 400 }
      );
    }

    const validation = validateLesson(body);

    if (validation.error) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { data: lesson, error } = await context.adminDb
      .from("lessons")
      .insert(validation.lesson!)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "That lesson number already exists for this language.",
          },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        lesson,
        message: "Lesson created successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create lesson error:", error);

    return NextResponse.json(
      { error: "Unable to create lesson." },
      { status: 500 }
    );
  }
}

// PATCH: Update an existing lesson
export async function PATCH(request: Request) {
  try {
    const context = await getAuthorizedAdmin();

    if (!context) {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const { body, error: bodyError } = await readJsonBody(request);

    if (bodyError || !body) {
      return NextResponse.json(
        { error: bodyError },
        { status: 400 }
      );
    }

    if (
      typeof body.id !== "string" ||
      !body.id.trim()
    ) {
      return NextResponse.json(
        { error: "A valid lesson ID is required." },
        { status: 400 }
      );
    }

    const validation = validateLesson(body);

    if (validation.error) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { data: lesson, error } = await context.adminDb
      .from("lessons")
      .update({
        ...validation.lesson!,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id.trim())
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "That lesson number already exists for this language.",
          },
          { status: 409 }
        );
      }

      throw error;
    }

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      lesson,
      message: "Lesson updated successfully.",
    });
  } catch (error) {
    console.error("Update lesson error:", error);

    return NextResponse.json(
      { error: "Unable to update lesson." },
      { status: 500 }
    );
  }
}

// DELETE: Delete a lesson
export async function DELETE(request: Request) {
  try {
    const context = await getAuthorizedAdmin();

    if (!context) {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const { body, error: bodyError } = await readJsonBody(request);

    if (bodyError || !body) {
      return NextResponse.json(
        { error: bodyError },
        { status: 400 }
      );
    }

    if (
      typeof body.id !== "string" ||
      !body.id.trim()
    ) {
      return NextResponse.json(
        { error: "A valid lesson ID is required." },
        { status: 400 }
      );
    }

    const { data: lesson, error } = await context.adminDb
      .from("lessons")
      .delete()
      .eq("id", body.id.trim())
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lesson deleted successfully.",
    });
  } catch (error) {
    console.error("Delete lesson error:", error);

    return NextResponse.json(
      { error: "Unable to delete lesson." },
      { status: 500 }
    );
  }
}
