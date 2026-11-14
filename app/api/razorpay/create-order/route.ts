
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { PREMIUM_AMOUNT_PAISE } from "@/lib/pricing";

export async function POST() {
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

    // Find languages awaiting Premium payment
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

    // Get unique selected Premium languages
    const languages = [
      ...new Set(
        (pendingLanguages || []).map((item) => item.language)
      ),
    ];

    if (languages.length === 0) {
      return NextResponse.json(
        {
          error: "There are no pending Premium selections to pay for.",
        },
        { status: 400 }
      );
    }

    // Calculate total: number of languages × Premium price
    const totalAmount = languages.length * PREMIUM_AMOUNT_PAISE;

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: totalAmount,
      currency: "INR",
      receipt: `Ukti_${Date.now()}`,
      partial_payment: false,
      notes: {
        user_id: user.id,
        product: "Ukti Premium - 1 month",
        languages: languages.join(", "),
        language_count: String(languages.length),
        price_per_language_paise: String(PREMIUM_AMOUNT_PAISE),
      },
    });

    // Save order in Supabase
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
    });
  } catch (error) {
    console.error("Razorpay order error:", error);

    return NextResponse.json(
      { error: "Unable to create payment order." },
      { status: 500 }
    );
  }
}
