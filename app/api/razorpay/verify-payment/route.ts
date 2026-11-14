
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { fulfillRazorpayOrder } from "@/lib/razorpay/fulfill";
import { PREMIUM_AMOUNT_PAISE } from "@/lib/pricing";

export async function POST(request: Request) {
  try {
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

    const body = await request.json();

    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Payment verification details are missing." },
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

    // Find the order belonging to this user
    const { data: savedOrder, error: orderError } = await adminDb
      .from("payment_orders")
      .select("*")
      .eq("razorpay_order_id", orderId)
      .eq("user_id", user.id)
      .single();

    if (orderError || !savedOrder) {
      return NextResponse.json(
        { error: "Payment order not found." },
        { status: 404 }
      );
    }

    // Get unique languages stored with this payment order
    const languages = Array.isArray(savedOrder.languages)
      ? [...new Set(savedOrder.languages)]
      : [];

    if (languages.length === 0) {
      return NextResponse.json(
        { error: "No languages are associated with this payment order." },
        { status: 400 }
      );
    }

    // Calculate the expected amount from the saved language selection
    const expectedAmount = languages.length * PREMIUM_AMOUNT_PAISE;

    // Ensure the saved order amount matches the expected amount
    if (
      Number(savedOrder.amount) !== expectedAmount ||
      savedOrder.currency !== "INR"
    ) {
      console.error("Saved payment order amount mismatch:", {
        savedAmount: savedOrder.amount,
        expectedAmount,
        languageCount: languages.length,
      });

      return NextResponse.json(
        { error: "The payment order amount does not match your Premium selection." },
        { status: 400 }
      );
    }

    // Verify Razorpay payment signature
    const expectedSignature = createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET!
    )
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { error: "Invalid payment signature." },
        { status: 400 }
      );
    }

    const suppliedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      return NextResponse.json(
        { error: "Invalid payment signature." },
        { status: 400 }
      );
    }

    // Fetch payment directly from Razorpay
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const payment = await razorpay.payments.fetch(paymentId);

    // Verify payment against the full multi-language amount
    if (
      payment.order_id !== orderId ||
      payment.amount !== expectedAmount ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return NextResponse.json(
        {
          error: `Payment has not been captured for the expected amount of ₹${(
            expectedAmount / 100
          ).toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    // Activate all languages associated with this payment order
    await fulfillRazorpayOrder({
      id: payment.id,
      order_id: String(payment.order_id),
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
    });

    return NextResponse.json({
      success: true,
      languages,
      amount: expectedAmount,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    return NextResponse.json(
      {
        error:
          "Unable to verify payment. Please contact support if money was deducted.",
      },
      { status: 500 }
    );
  }
}
