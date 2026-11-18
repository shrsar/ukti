
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { PREMIUM_AMOUNT_PAISE } from "@/lib/pricing";

export async function POST(request: Request) {
  try {
    // Authenticate the user
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
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    // Read the exact languages selected for this purchase
    const body = await request.json();
    const requestedLanguages = body?.languages;

    if (
      !Array.isArray(requestedLanguages) ||
      requestedLanguages.length === 0 ||
      !requestedLanguages.every(
        (language: unknown) =>
          typeof language === "string" && language.trim().length > 0
      )
    ) {
      return NextResponse.json(
        { error: "Please select at least one Premium language." },
        { status: 400 }
      );
    }

    // Remove duplicates
    const languages = [...new Set(
      requestedLanguages.map((language: string) => language.trim())
    )];

    // Create server-side Supabase admin client
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

    // Retrieve this user's pending Premium selections
    const { data: pendingLanguages, error: languageError } =
      await adminDb
        .from("user_languages")
        .select("language")
        .eq("user_id", user.id)
        .eq("selected_plan", "premium")
        .eq("subscription_status", "pending_payment");

    if (languageError) {
      console.error("User languages error:", languageError.message);

      return NextResponse.json(
        { error: "Unable to retrieve your Premium selections." },
        { status: 500 }
      );
    }

    const pendingLanguageSet = new Set(
      (pendingLanguages || []).map((item) => item.language)
    );

    // Reject any language that is not pending Premium for this user
    const invalidLanguages = languages.filter(
      (language) => !pendingLanguageSet.has(language)
    );

    if (invalidLanguages.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more selected languages are not awaiting Premium payment. Please return to Plans and try again.",
        },
        { status: 400 }
      );
    }

    // Calculate total using only the requested, validated languages
    const totalAmount = languages.length * PREMIUM_AMOUNT_PAISE;

    if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: totalAmount,
      currency: "INR",
      receipt: `KaKhaGaGha_${Date.now()}`,
      partial_payment: false,
      notes: {
        user_id: user.id,
        product: "KaKhaGaGha Premium - 1 month",
        languages: languages.join(", "),
        language_count: String(languages.length),
        price_per_language_paise: String(PREMIUM_AMOUNT_PAISE),
      },
    });

    // Save the exact language snapshot with the order
    const { error: saveError } = await adminDb
      .from("payment_orders")
      .insert({
        user_id: user.id,
        razorpay_order_id: order.id,
        amount: totalAmount,
        currency: "INR",
        status: "created",
        languages,
      });

    if (saveError) {
      console.error("Payment order save error:", saveError.message);

      return NextResponse.json(
        { error: "Unable to save payment order." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order_id: order.id,
      amount: totalAmount,
      currency: "INR",
      key_id: process.env.RAZORPAY_KEY_ID,
      languages,
    });
  } catch (error) {
    console.error("Razorpay order error:", error);

    return NextResponse.json(
      { error: "Unable to create payment order." },
      { status: 500 }
    );
  }
}
