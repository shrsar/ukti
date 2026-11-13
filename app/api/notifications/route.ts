
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function getUserClient() {
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
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return { supabase, user };
}

export async function GET() {
  const context = await getUserClient();

  if (!context) {
    return NextResponse.json(
      { error: "Please log in." },
      { status: 401 }
    );
  }

  const { data, error } = await context.supabase
    .from("notifications")
    .select(
      "id, title, message, notification_type, language, reference_id, read_at, created_at"
    )
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const notifications = data || [];

  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter(
      (item) => !item.read_at
    ).length,
  });
}

export async function PATCH(request: NextRequest) {
  const context = await getUserClient();

  if (!context) {
    return NextResponse.json(
      { error: "Please log in." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const now = new Date().toISOString();

    let query = context.supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", context.user.id)
      .is("read_at", null);

    if (body.markAll === true) {
      // Mark all unread notifications as read.
    } else if (
      typeof body.id === "string" &&
      body.id.trim()
    ) {
      query = query.eq("id", body.id);
    } else {
      return NextResponse.json(
        { error: "Provide a notification ID or markAll: true." },
        { status: 400 }
      );
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
