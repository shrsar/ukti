
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function getAdminContext() {
  const cookieStore = await cookies();

  // Read the authenticated user from the browser session.
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

  if (authError || !user?.email) {
    return {
      authorized: false as const,
      reason: "NOT_LOGGED_IN",
    };
  }

  // Create a server-only Supabase administrator client.
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

  // Retrieve administrator configuration.
  const { data: settings, error: settingsError } = await adminDb
    .from("payment_settings")
    .select("admin_email")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    console.error("Admin settings database error:", settingsError.message);

    return {
      authorized: false as const,
      reason: "SETTINGS_ERROR",
    };
  }

  if (!settings?.admin_email) {
    return {
      authorized: false as const,
      reason: "ADMIN_EMAIL_NOT_CONFIGURED",
    };
  }

  // Compare the authenticated email with the configured admin email.
  if (
    user.email.trim().toLowerCase() !==
    settings.admin_email.trim().toLowerCase()
  ) {
    return {
      authorized: false as const,
      reason: "EMAIL_MISMATCH",
    };
  }

  return {
    authorized: true as const,
    user,
    adminDb,
  };
}
