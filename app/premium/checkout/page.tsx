
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProfileMenu from "@/components/ProfileMenu";
import {
  PREMIUM_PRICE,
  PREMIUM_BILLING_PERIOD,
} from "@/lib/pricing";

declare global {
  interface Window {
    Razorpay?: new (
      options: Record<string, unknown>
    ) => {
      open: () => void;
    };
  }
}

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export default function PremiumCheckoutPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRazorpayScript(): Promise<boolean> {
    if (window.Razorpay) return true;

    return new Promise((resolve) => {
      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(true), {
          once: true,
        });
        existingScript.addEventListener("error", () => resolve(false), {
          once: true,
        });

        if (window.Razorpay) resolve(true);
        return;
      }

      const script = document.createElement("script");

      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  }

  async function startPayment() {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        setMessage("Unable to load Razorpay. Please try again.");
        setLoading(false);
        return;
      }

      const orderResponse = await fetch(
        "/api/razorpay/create-order",
        { method: "POST" }
      );

      const orderData = await orderResponse.json();

      if (orderResponse.status === 401) {
        router.replace("/login");
        return;
      }

      if (!orderResponse.ok) {
        setMessage(
          orderData.error || "Unable to create payment order."
        );
        setLoading(false);
        return;
      }

      const RazorpayCheckout = window.Razorpay;

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Ukti",
        description: `Premium subscription - ${PREMIUM_BILLING_PERIOD}`,
        order_id: orderData.order_id,

        config: {
          display: {
            blocks: {
              Ukti_methods: {
                name: "Pay using UPI or Net Banking",
                instruments: [
                  { method: "upi" },
                  { method: "netbanking" },
                ],
              },
            },
            sequence: ["block.Ukti_methods"],
            preferences: {
              show_default_blocks: false,
            },
          },
        },

        theme: {
          color: "#95608f",
        },

        handler: async (response: RazorpaySuccess) => {
          setMessage("Verifying your payment...");

          try {
            const verifyResponse = await fetch(
              "/api/razorpay/verify-payment",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(response),
              }
            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {
              setMessage(
                verifyData.error ||
                  "Payment verification is pending. Please contact support if money was deducted."
              );
              setLoading(false);
              return;
            }

            setMessage("Payment successful. Premium is activated.");

            router.replace("/dashboard");
            router.refresh();
          } catch (error) {
            console.error("Payment verification error:", error);

            setMessage(
              "Payment was submitted, but verification is pending. Please contact support if money was deducted."
            );
            setLoading(false);
          }
        },

        modal: {
          ondismiss: () => {
            setMessage(
              "Payment window closed. No confirmation received."
            );
            setLoading(false);
          },
        },
      };

      const checkout = new RazorpayCheckout(options);
      checkout.open();
    } catch (error) {
      console.error("Checkout error:", error);
      setMessage("Unable to start payment. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="premium-page">
      <header className="navbar">
        <nav className="nav-links">
          <a href="/dashboard">Home</a>
          <a href="/lessonss">Lessons</a>
          <a href="/premium">Plans</a>
        </nav>

        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </header>

      <section className="premium-container">
        <div className="premium-heading">
          <p className="dashboard-eyebrow">Ukti PREMIUM</p>

          <h1>Complete your payment</h1>

          <p>
            Unlock your selected Premium languages for one month.
          </p>
        </div>

        <div className="checkout-card">
          <div className="checkout-total">
            <span>Premium subscription</span>

            <strong>
              {PREMIUM_PRICE} / {PREMIUM_BILLING_PERIOD}
            </strong>
          </div>

          <p className="checkout-payment-note">
            Fixed payment of {PREMIUM_PRICE} for one month.
            No automatic deductions or recurring charges.
          </p>

          <div className="checkout-details">
            <h3>Secure payment</h3>

            <p>
              Pay exactly {PREMIUM_PRICE} using UPI or Net Banking
              through Razorpay.
            </p>

            <p>
              The amount is set by Ukti's server and cannot be
              changed in the checkout.
            </p>
          </div>

          <button
            type="button"
            className="continue-premium-button"
            onClick={startPayment}
            disabled={loading}
          >
            {loading ? "Please wait..." : `Pay ${PREMIUM_PRICE}`}
          </button>

          {message && (
            <p className="premium-save-message" role="status">
              {message}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
