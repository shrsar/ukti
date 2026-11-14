
"use client";

import {
  PREMIUM_PRICE,
  PREMIUM_AMOUNT_PAISE,
} from "@/lib/pricing";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProfileMenu from "@/components/ProfileMenu";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES } from "@/lib/languages";

type Plan = "basic" | "premium";

type SavedLanguage = {
  language: string;
  selected_plan: Plan;
  subscription_status: string;
};

const PREMIUM_FEATURES = [
  "Everything included in Basic",
  "No Ads",
  "Unlimited practice",
  "Detailed Lessons",
];

const BASIC_FEATURES = [
  "Ads",
  "Limited practice",
  "Basic Lessons",
  "Progress tracking",
];

export default function PremiumPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("premium");
  const [savedChoices, setSavedChoices] = useState<SavedLanguage[]>([]);
  const [message, setMessage] = useState("");

  // Load saved languages and plans
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadChoices() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (!active) return;

        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("user_languages")
          .select("language, selected_plan, subscription_status")
          .eq("user_id", authData.user.id);

        if (!active) return;

        if (error) {
          setMessage("Unable to load your saved choices.");
        } else {
          const saved = (data || []).filter(
            (item) => LANGUAGES.includes(item.language)
          ) as SavedLanguage[];

          setSavedChoices(saved);
          setSelectedLanguages(saved.map((item) => item.language));

          if (saved.length > 0) {
            const existingPremium = saved.some(
              (item) => item.selected_plan === "premium"
            );

            setSelectedPlan(existingPremium ? "premium" : "basic");
          }
        }
      } catch {
        if (active) {
          setMessage("Unable to load your account. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadChoices();

    return () => {
      active = false;
    };
  }, [router]);

  // Select or deselect languages
  function toggleLanguage(language: string) {
    setSelectedLanguages((previous) =>
      previous.includes(language)
        ? previous.filter((item) => item !== language)
        : [...previous, language]
    );

    setMessage("");
  }

  // Select a plan
  function selectPlan(plan: Plan) {
    if (saving) return;

    setSelectedPlan(plan);
    setMessage("");
  }

  // Identify selected languages that still require payment
  const premiumLanguagesToPay =
    selectedPlan === "premium"
      ? selectedLanguages.filter((language) => {
          const existing = savedChoices.find(
            (item) => item.language === language
          );

          // Do not charge again for already-active Premium languages
          return !(
            existing?.selected_plan === "premium" &&
            existing.subscription_status === "active"
          );
        })
      : [];

  // Calculate using numeric paise
  const estimatedTotalPaise =
    premiumLanguagesToPay.length * PREMIUM_AMOUNT_PAISE;

  const estimatedTotal = estimatedTotalPaise / 100;

  // Save selections and continue
  async function continueWithPlan() {
    if (saving) return;

    if (selectedLanguages.length === 0) {
      setMessage("Please select at least one language.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const userId = authData.user.id;

      // Save currently selected languages
      const records = selectedLanguages.map((language) => {
        const existing = savedChoices.find(
          (item) => item.language === language
        );

        const status =
          selectedPlan === "basic"
            ? "active"
            : existing?.selected_plan === "premium" &&
                existing.subscription_status === "active"
              ? "active"
              : "pending_payment";

        return {
          user_id: userId,
          language,
          selected_plan: selectedPlan,
          subscription_status: status,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: saveError } = await supabase
        .from("user_languages")
        .upsert(records, {
          onConflict: "user_id,language",
        });

      if (saveError) {
        console.error("Plan save error:", saveError.message);
        setMessage("Unable to save your choices. Please try again.");
        return;
      }

      // Remove unchecked Basic languages
      const removableBasicLanguages = savedChoices
        .filter(
          (item) =>
            !selectedLanguages.includes(item.language) &&
            item.selected_plan === "basic"
        )
        .map((item) => item.language);

      // Remove unchecked unpaid Premium languages
      // Preserve already-active Premium languages
      const removablePendingPremiumLanguages = savedChoices
        .filter(
          (item) =>
            !selectedLanguages.includes(item.language) &&
            item.selected_plan === "premium" &&
            item.subscription_status === "pending_payment"
        )
        .map((item) => item.language);

      const removableLanguages = [
        ...new Set([
          ...removableBasicLanguages,
          ...removablePendingPremiumLanguages,
        ]),
      ];

      if (removableLanguages.length > 0) {
        const { error: deleteError } = await supabase
          .from("user_languages")
          .delete()
          .eq("user_id", userId)
          .in("language", removableLanguages);

        if (deleteError) {
          console.error("Language removal error:", deleteError.message);

          setMessage(
            "Your choices were saved, but some unchecked languages could not be removed. Please try again."
          );
          return;
        }
      }

      // Continue to payment only when payment is due
      if (selectedPlan === "premium") {
        if (premiumLanguagesToPay.length > 0) {
          // Pass only the languages requiring payment
          const params = new URLSearchParams();

          premiumLanguagesToPay.forEach((language) => {
            params.append("language", language);
          });

          router.push(`/premium/checkout?${params.toString()}`);
          return;
        }

        router.push("/dashboard");
        return;
      }

      router.push("/lessons");
    } catch (error) {
      console.error("Continue error:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Keyboard selection for plan cards
  function handlePlanKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    plan: Plan
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectPlan(plan);
    }
  }

  if (loading) {
    return (
      <main className="premium-page">
        <p>Loading your account...</p>
      </main>
    );
  }

  return (
    <main className="premium-page">
      <header className="navbar">
        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/lessons">Lessons</Link>
          <Link href="/practice">Practice</Link>
          <Link href="/progress">Progress</Link>
        </nav>

        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </header>

      <section className="premium-container">
        <div className="premium-heading">
          <p className="dashboard-eyebrow">Ukti MEMBERSHIP</p>

          <h1>Build your language journey</h1>

          <p>
            Choose the languages you want to learn,
            then select Basic or Premium for your selected languages.
          </p>
        </div>

        {/* LANGUAGE SELECTION */}
        <section className="language-selection-list">
          <h2>1. Choose your languages</h2>

          <p className="premium-helper">
            Select only the languages you want to include in this plan.
          </p>

          <div className="language-checkbox-grid">
            {LANGUAGES.map((language) => (
              <label
                key={language}
                className={`language-checkbox ${
                  selectedLanguages.includes(language)
                    ? "language-checked"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(language)}
                  onChange={() => toggleLanguage(language)}
                />

                <span>{language}</span>
              </label>
            ))}
          </div>
        </section>

        {/* PLAN SELECTION */}
        <section className="premium-plan-selection">
          <h2>2. Choose your plan</h2>

          <p className="premium-helper">
            Your selected plan applies to the languages checked above.
          </p>

          <div className="plan-comparison-grid">
            {/* BASIC CARD */}
            <article
              className={`subscription-card ${
                selectedPlan === "basic" ? "plan-selected" : ""
              }`}
              role="radio"
              aria-checked={selectedPlan === "basic"}
              aria-label="Select Basic plan"
              tabIndex={0}
              onClick={() => selectPlan("basic")}
              onKeyDown={(event) =>
                handlePlanKeyDown(event, "basic")
              }
              style={{ cursor: "pointer" }}
            >
              <div className="subscription-card-heading">
                <h4>Basic</h4>

                {selectedPlan === "basic" && (
                  <span className="selected-label">Selected</span>
                )}
              </div>

              <p className="subscription-price">Free</p>

              <p className="subscription-description">
                Start learning at your own pace.
              </p>

              <ul className="subscription-features">
                {BASIC_FEATURES.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>

            {/* PREMIUM CARD */}
            <article
              className={`subscription-card premium-card ${
                selectedPlan === "premium" ? "plan-selected" : ""
              }`}
              role="radio"
              aria-checked={selectedPlan === "premium"}
              aria-label="Select Premium plan"
              tabIndex={0}
              onClick={() => selectPlan("premium")}
              onKeyDown={(event) =>
                handlePlanKeyDown(event, "premium")
              }
              style={{ cursor: "pointer" }}
            >
              <span className="premium-label">RECOMMENDED</span>

              <div className="subscription-card-heading">
                <h4>Premium</h4>

                {selectedPlan === "premium" && (
                  <span className="selected-label">Selected</span>
                )}
              </div>

              <p className="subscription-price">
                {PREMIUM_PRICE}
                <span>/ language / month</span>
              </p>

              <p className="subscription-description">
                Enjoy the complete Ukti learning experience.
              </p>

              <ul className="subscription-features">
                {PREMIUM_FEATURES.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {/* PAYMENT SUMMARY */}
        <div className="premium-continue-area">
          <div>
            <p>
              {selectedLanguages.length} language
              {selectedLanguages.length === 1 ? "" : "s"} selected
            </p>

            {selectedPlan === "premium" ? (
              <>
                <span>
                  {premiumLanguagesToPay.length} new Premium language
                  {premiumLanguagesToPay.length === 1 ? "" : "s"} to pay for
                </span>

                <p>
                  Estimated total: {premiumLanguagesToPay.length} ×{" "}
                  {PREMIUM_PRICE} = ₹
                  {estimatedTotal.toFixed(2)}
                </p>
              </>
            ) : (
              <span>Basic plan selected — Free</span>
            )}
          </div>

          <button
            type="button"
            className="continue-premium-button"
            onClick={continueWithPlan}
            disabled={saving || selectedLanguages.length === 0}
          >
            {saving
              ? "Saving..."
              : selectedPlan === "premium"
                ? premiumLanguagesToPay.length > 0
                  ? `Continue to payment (₹${estimatedTotal.toFixed(2)})`
                  : "Continue to dashboard"
                : "Continue with Basic"}

            <span aria-hidden="true"> →</span>
          </button>
        </div>

        {message && (
          <p className="premium-save-message" role="status">
            {message}
          </p>
        )}

        <p className="premium-footer">
          Your language selections and plan are saved to your Ukti account. No refund possible under any circumstances
        </p>
      </section>
    </main>
  );
}
