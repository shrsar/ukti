
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
        existingScript.addEventListener(
          "load",
          () => resolve(!!window.Razorpay),
          { once: true }
        );

        existingScript.addEventListener(
          "error",
          () => resolve(false),
          { once: true }
        );

        if (window.Razorpay) resolve(true);
        return;
      }

      const script = document.createElement("script");

      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";

      script.async = true;

      script.onload = () => resolve(!!window.Razorpay);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  }

  async function startPayment() {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      // Get the exact languages passed from the selection page
      const params = new URLSearchParams(window.location.search);
      const languages = params.getAll("language");

      if (languages.length === 0) {
        setMessage(
          "No Premium languages selected. Please return to Plans."
        );
        setLoading(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        setMessage("Unable to load Razorpay. Please try again.");
        setLoading(false);
        return;
      }

      // Create payment order on the server using selected languages
      const orderResponse = await fetch(
        "/api/razorpay/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            languages,
          }),
        }
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

        description: `Premium - ${PREMIUM_PRICE} per language / ${PREMIUM_BILLING_PERIOD}`,

        order_id: orderData.order_id,

        // Show Cards and UPI; hide Netbanking
        config: {
          display: {
            blocks: {
              Ukti_methods: {
                name: "Pay using Cards or UPI",
                instruments: [
                  { method: "card" },
                  { method: "upi" },
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

            setMessage(
              "Payment successful. Your Premium languages are activated."
            );

            router.replace("/dashboard");
            router.refresh();
          } catch (error) {
            console.error(
              "Payment verification error:",
              error
            );

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

      setMessage(
        "Unable to start payment. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <main className="premium-page">
      <header className="navbar">
        <nav className="nav-links">
          <a href="/dashboard">Home</a>
          <a href="/lessons">Lessons</a>
          <a href="/premium">Plans</a>
        </nav>

        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </header>

      <section className="premium-container">
        <div className="premium-heading">
          <p className="dashboard-eyebrow">
            Ukti PREMIUM
          </p>

          <h1>Complete your payment</h1>

          <p>
            Unlock your selected Premium languages for one month.
          </p>
        </div>

        <div className="checkout-card">
          <div className="checkout-total">
            <span>Premium subscription</span>

            <strong>
              {PREMIUM_PRICE} / language /{" "}
              {PREMIUM_BILLING_PERIOD}
            </strong>
          </div>

          <p className="checkout-payment-note">
            Premium is charged separately for each selected
            language. Your total payment is calculated as:
            number of selected languages × {PREMIUM_PRICE}.
            No automatic deductions or recurring charges.
          </p>

          <div className="checkout-details">
            <h3>Secure payment</h3>

            <p>
              Pay {PREMIUM_PRICE} per language using Debit/Credit
              Cards or UPI through Razorpay.
            </p>

            <p>
              Your total payment depends on the number of
              Premium languages selected.
            </p>

            <p>
              The amount is calculated by Ukti&apos;s server
              and cannot be changed in the checkout.
            </p>
          </div>

          <button
            type="button"
            className="continue-premium-button"
            onClick={startPayment}
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : "Continue to payment"}
          </button>

          {message && (
            <p
              className="premium-save-message"
              role="status"
            >
              {message}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
