
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
    payment.amount !== 5000 ||
    payment.currency !== "INR" ||
    !payment.order_id ||
    !payment.id
  ) {
    throw new Error("Payment is not a valid captured ₹50 payment.");
  }

  const { data: order, error: orderError } = await adminDb
    .from("payment_orders")
    .select("*")
    .eq("razorpay_order_id", payment.order_id)
    .single();

  if (orderError || !order) {
    throw new Error("Payment order was not found.");
  }

  if (order.amount !== 5000 || order.currency !== "INR") {
    throw new Error("Stored order amount is invalid.");
  }

  if (
    order.razorpay_payment_id &&
    order.razorpay_payment_id !== payment.id
  ) {
    throw new Error("A different payment is already attached to this order.");
  }

  const languages = order.languages as string[];

  if (!Array.isArray(languages) || languages.length === 0) {
    throw new Error("No languages are associated with this payment order.");
  }

  // Mark the payment as captured.
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

  // Activate only the languages saved in this specific order.
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

  return { success: true };
}
