
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { PREMIUM_AMOUNT_PAISE } from "@/lib/pricing";

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type CapturedPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

export async function fulfillRazorpayOrder(
  payment: CapturedPayment
) {
  if (
    payment.status !== "captured" ||
    payment.currency !== "INR" ||
    !payment.order_id ||
    !payment.id
  ) {
    throw new Error("Payment is not a valid captured payment.");
  }

  // Retrieve the saved order
  const { data: order, error: orderError } = await adminDb
    .from("payment_orders")
    .select("*")
    .eq("razorpay_order_id", payment.order_id)
    .single();

  if (orderError || !order) {
    throw new Error("Payment order was not found.");
  }

  // Validate the languages associated with this order
  const rawLanguages = order.languages;

  if (
    !Array.isArray(rawLanguages) ||
    rawLanguages.length === 0 ||
    !rawLanguages.every(
      (language) =>
        typeof language === "string" && language.trim().length > 0
    )
  ) {
    throw new Error("No valid languages are associated with this payment order.");
  }

  const languages = [...new Set(rawLanguages)];

  // Calculate the expected payment for all selected languages
  const expectedAmount =
    languages.length * PREMIUM_AMOUNT_PAISE;

  // Validate both the saved order and the captured payment
  if (
    Number(order.amount) !== expectedAmount ||
    order.currency !== "INR" ||
    payment.amount !== expectedAmount
  ) {
    throw new Error("Payment amount does not match the Premium language selection.");
  }

  // Prevent another payment from being attached to this order
  if (
    order.razorpay_payment_id &&
    order.razorpay_payment_id !== payment.id
  ) {
    throw new Error("A different payment is already attached to this order.");
  }

  // Mark the payment as captured
  const { error: updateOrderError } = await adminDb
    .from("payment_orders")
    .update({
      razorpay_payment_id: payment.id,
      status: "captured",
      updated_at: new Date().toISOString(),
    })
    .eq("razorpay_order_id", payment.order_id);

  if (updateOrderError) {
    throw new Error(updateOrderError.message);
  }

  // Activate all Premium languages included in this order
  const { error: activateError } = await adminDb
    .from("user_languages")
    .update({
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", order.user_id)
    .eq("selected_plan", "premium")
    .eq("subscription_status", "pending_payment")
    .in("language", languages);

  if (activateError) {
    throw new Error(activateError.message);
  }

  return {
    success: true,
    languages,
    amount: expectedAmount,
  };
}
