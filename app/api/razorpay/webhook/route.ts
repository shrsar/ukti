
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { fulfillRazorpayOrder } from "@/lib/razorpay/fulfill";

export async function POST(request: Request) {
  try {
    // Read the original request body for signature verification.
    const rawBody = await request.text();

    const signature = request.headers.get(
      "x-razorpay-signature"
    );

    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Webhook signature is missing." },
        { status: 400 }
      );
    }

    const expectedSignature = createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET
    )
      .update(rawBody)
      .digest("hex");

    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
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
        { error: "Webhook signature verification failed." },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;

      if (!payment) {
        return NextResponse.json(
          { error: "Payment information is missing." },
          { status: 400 }
        );
      }

      await fulfillRazorpayOrder({
        id: payment.id,
        order_id: payment.order_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    // Non-2xx response allows Razorpay to retry delivery.
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}
