
import { NextRequest, NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function validateQuestion(body: any) {
  if (
    !body.language ||
    !["English", "Hindi"].includes(body.language) ||
    !body.title?.trim() ||
    !body.reference_text?.trim()
  ) {
    return "Choose English or Hindi and provide a title and sentence.";
  }

  const expectedLocale =
    body.language === "Hindi" ? "hi-IN" : "en-IN";

  if (body.locale !== expectedLocale) {
    return "The language locale does not match the selected language.";
  }

  if (!["free", "premium"].includes(body.access_tier)) {
    return "Invalid access tier.";
  }

  if (!["draft", "published"].includes(body.status)) {
    return "Invalid publication status.";
  }

  if (body.reference_text.trim().length > 1000) {
    return "The sentence must be 1000 characters or fewer.";
  }

  return null;
}

// Create notifications for eligible enrolled users.
async function createPracticeNotifications(
  adminDb: any,
  question: {
    id: string;
    language: string;
    title: string;
    access_tier: string;
  }
) {
  const { data: enrolments, error: enrolmentError } = await adminDb
    .from("user_languages")
    .select("user_id, selected_plan, subscription_status")
    .eq("language", question.language)
    .eq("subscription_status", "active");

  if (enrolmentError) {
    throw new Error(enrolmentError.message);
  }

  let eligibleUsers = (enrolments || []).filter(
    (enrolment: any) =>
      question.access_tier === "free" ||
      (enrolment.selected_plan === "premium" &&
        enrolment.subscription_status === "active")
  );

  const userIds = [
    ...new Set(eligibleUsers.map((item: any) => item.user_id)),
  ];

  if (userIds.length === 0) return 0;

  const { data: preferences, error: preferenceError } = await adminDb
    .from("user_preferences")
    .select("user_id, notifications_enabled")
    .in("user_id", userIds);

  if (preferenceError) {
    throw new Error(preferenceError.message);
  }

  const preferenceMap = new Map(
    (preferences || []).map((item: any) => [
      item.user_id,
      item.notifications_enabled,
    ])
  );

  eligibleUsers = eligibleUsers.filter((item: any) => {
    const preference = preferenceMap.get(item.user_id);

    // Users without a preference row are enabled by default.
    return preference !== false;
  });

  const uniqueUserIds = [
    ...new Set(eligibleUsers.map((item: any) => item.user_id)),
  ];

  if (uniqueUserIds.length === 0) return 0;

  const notificationRows = uniqueUserIds.map((userId) => ({
    user_id: userId,
    title: "New speaking practice question",
    message: `A new ${question.language} speaking practice question is available: ${question.title}`,
    notification_type: "practice",
    language: question.language,
    reference_id: question.id,
  }));

  const { error: notificationError } = await adminDb
    .from("notifications")
    .insert(notificationRows);

  if (notificationError) {
    throw new Error(notificationError.message);
  }

  return notificationRows.length;
}

export async function GET() {
  const context = await getAdminContext();

  if (!context.authorized) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const { data, error } = await context.adminDb
    .from("practice_questions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ questions: data || [] });
}

export async function POST(request: NextRequest) {
  const context = await getAdminContext();

  if (!context.authorized) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const validationError = validateQuestion(body);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await context.adminDb
      .from("practice_questions")
      .insert({
        language: body.language,
        title: body.title.trim(),
        description: body.description || "",
        reference_text: body.reference_text.trim(),
        locale: body.locale,
        access_tier: body.access_tier,
        status: body.status,
        created_by: context.user.id,
        published_at: body.status === "published" ? now : null,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    let notificationsCreated = 0;
    let notificationWarning: string | null = null;

    if (body.status === "published") {
      try {
        notificationsCreated = await createPracticeNotifications(
          context.adminDb,
          data
        );
      } catch (notificationError) {
        console.error(
          "Practice notification creation failed:",
          notificationError
        );

        notificationWarning =
          "The question was published, but notifications could not be created.";
      }
    }

    return NextResponse.json(
      {
        question: data,
        notificationsCreated,
        notificationWarning,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create practice question error:", error);

    return NextResponse.json(
      { error: "Unable to create practice question." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const context = await getAdminContext();

  if (!context.authorized) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Question ID is required." },
        { status: 400 }
      );
    }

    const validationError = validateQuestion(body);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } =
      await context.adminDb
        .from("practice_questions")
        .select("id, status")
        .eq("id", body.id)
        .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Question not found." },
        { status: 404 }
      );
    }

    const publishNow =
      body.status === "published" &&
      existing.status !== "published";

    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      language: body.language,
      title: body.title.trim(),
      description: body.description || "",
      reference_text: body.reference_text.trim(),
      locale: body.locale,
      access_tier: body.access_tier,
      status: body.status,
      updated_at: now,
    };

    if (publishNow) {
      updateData.published_at = now;
    }

    const { data, error } = await context.adminDb
      .from("practice_questions")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    let notificationsCreated = 0;
    let notificationWarning: string | null = null;

    if (publishNow) {
      try {
        notificationsCreated = await createPracticeNotifications(
          context.adminDb,
          data
        );
      } catch (notificationError) {
        console.error(
          "Practice notification creation failed:",
          notificationError
        );

        notificationWarning =
          "The question was published, but notifications could not be created.";
      }
    }

    return NextResponse.json({
      question: data,
      notificationsCreated,
      notificationWarning,
    });
  } catch (error) {
    console.error("Update practice question error:", error);

    return NextResponse.json(
      { error: "Unable to update practice question." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const context = await getAdminContext();

  if (!context.authorized) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Question ID is required." },
      { status: 400 }
    );
  }

  const { error } = await context.adminDb
    .from("practice_questions")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
