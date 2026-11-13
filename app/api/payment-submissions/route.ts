
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { PREMIUM_AMOUNT } from "@/lib/pricing";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
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
      { error: "Please log in." },
      { status: 401 }
    );
  }

  const body = await request.json();

  const payment_method = body.payment_method;
  const transaction_reference = String(
    body.transaction_reference || ""
  ).trim();

  if (!["UPI", "Bank Transfer"].includes(payment_method)) {
    return NextResponse.json(
      { error: "Invalid payment method." },
      { status: 400 }
    );
  }

  if (
    transaction_reference.length < 6 ||
    transaction_reference.length > 100
  ) {
    return NextResponse.json(
      { error: "Enter a valid transaction reference." },
      { status: 400 }
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

  const { data: existing } = await adminDb
    .from("payment_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("transaction_reference", transaction_reference)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This transaction reference has already been submitted." },
      { status: 409 }
    );
  }

  const { error } = await adminDb
    .from("payment_submissions")
    .insert({
      user_id: user.id,
      amount: PREMIUM_AMOUNT,
      payment_method,
      transaction_reference,
      status: "pending",
    });

  if (error) {
    return NextResponse.json(
      { error: "Unable to submit payment reference." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    amount: PREMIUM_AMOUNT,
    message: "Payment reference submitted for manual verification.",
  });
}
