
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProfileMenu from "@/components/ProfileMenu";
import { LANGUAGES } from "@/lib/languages";

type Lesson = {
  id: string;
  language: string;
  lesson_number: number;
  title: string;
  description: string | null;
  access_tier: "free" | "premium";
  status: string;
};

type LanguageAccess = {
  language: string;
  selected_plan: "basic" | "premium";
  subscription_status: "active" | "pending_payment" | "cancelled";
};

export default function LessonsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [selectedLanguage, setSelectedLanguage] = useState<string>("English");
  const [languageAccess, setLanguageAccess] = useState<LanguageAccess[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      // Load the user's subscription information.
      const { data: accessData, error: accessError } = await supabase
        .from("user_languages")
        .select("language, selected_plan, subscription_status")
        .eq("user_id", user.id);

      if (accessError) throw accessError;

      const access = (accessData || []) as LanguageAccess[];
      setLanguageAccess(access);

      // No enrolment record means Basic access by default.
      const selectedAccess = access.find(
        (item) => item.language === selectedLanguage
      );

      const premiumActive =
        selectedAccess?.selected_plan === "premium" &&
        selectedAccess?.subscription_status === "active";

      // Fetch published lessons regardless of enrolment records.
      const { data: lessonData, error: lessonError } = await supabase
        .from("lessons")
        .select(
          "id, language, lesson_number, title, description, access_tier, status"
        )
        .eq("language", selectedLanguage)
        .eq("status", "published")
        .order("lesson_number", { ascending: true });

      if (lessonError) throw lessonError;

      // Free lessons are always accessible.
      // Premium lessons require an active Premium subscription.
      const accessibleLessons = ((lessonData || []) as Lesson[]).filter(
        (lesson) =>
          lesson.access_tier === "free" ||
          (lesson.access_tier === "premium" && premiumActive)
      );

      setLessons(accessibleLessons);
    } catch (err) {
      console.error("Lessons loading error:", err);

      setError(
        err instanceof Error ? err.message : "Could not load lessons."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedLanguage, router, supabase]);

  useEffect(() => {
    void loadLessons();
  }, [loadLessons]);

  const currentAccess = languageAccess.find(
    (item) => item.language === selectedLanguage
  );

  const premiumActive =
    currentAccess?.selected_plan === "premium" &&
    currentAccess?.subscription_status === "active";

  function chooseLanguage(language: string) {
    setSelectedLanguage(language);
    setLanguageMenuOpen(false);
  }

  return (
    <main className="premium-page">
      <nav className="navbar">
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/practice">Practice</Link>
          <Link href="/progress">Progress</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>

        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </nav>

      <div className="premium-container">
        <div className="checkout-card">
          <h1>Less</h1>
          <p>Choose a language and continue learning at your own pace.</p>

          <div
            style={{
              position: "relative",
              margin: "24px 0",
              display: "inline-block",
            }}
          >
            <button
              type="button"
              onClick={() => setLanguageMenuOpen((open) => !open)}
              aria-expanded={languageMenuOpen}
              aria-haspopup="listbox"
              className="continue-premium-button"
            >
              {selectedLanguage} {languageMenuOpen ? "▲" : "▼"}
            </button>

            {languageMenuOpen && (
              <div
                role="listbox"
                aria-label="Choose a language"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  zIndex: 20,
                  minWidth: "180px",
                  background: "#fffaf5",
                  border: "1px solid #e8dce5",
                  borderRadius: "12px",
                  padding: "8px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                }}
              >
                {LANGUAGES.map((language) => (
                  <button
                    key={language}
                    type="button"
                    role="option"
                    aria-selected={selectedLanguage === language}
                    onClick={() => chooseLanguage(language)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "11px 12px",
                      border: "none",
                      borderRadius: "8px",
                      background:
                        selectedLanguage === language
                          ? "#eee3f5"
                          : "transparent",
                      color: "#49345d",
                      cursor: "pointer",
                      fontSize: "15px",
                    }}
                  >
                    {language}
                    {selectedLanguage === language ? " ✓" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <p>Loading lessons...</p>
          ) : error ? (
            <p role="alert" style={{ color: "crimson" }}>
              {error}
            </p>
          ) : lessons.length === 0 ? (
            <div>
              <h2>No lessons available yet</h2>
              <p>
                There are currently no published lessons available for{" "}
                {selectedLanguage}.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  margin: "20px 0",
                }}
              >
                <h2 style={{ margin: 0 }}>
                  {selectedLanguage} lessons
                </h2>

                <span
                  style={{
                    fontSize: "13px",
                    color: "#705b79",
                    background: "#f1eaf4",
                    padding: "6px 12px",
                    borderRadius: "20px",
                  }}
                >
                  {premiumActive ? "Premium access" : "Basic access"}
                </span>
              </div>

              <div>
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    style={{
                      border: "1px solid #e8dce5",
                      borderRadius: "12px",
                      padding: "18px",
                      marginBottom: "14px",
                      background: "#fffaf5",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <p style={{ margin: 0, color: "#705b79" }}>
                        Lesson {lesson.lesson_number}
                      </p>

                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color:
                            lesson.access_tier === "premium"
                              ? "#75449a"
                              : "#47734d",
                          background:
                            lesson.access_tier === "premium"
                              ? "#eee3f5"
                              : "#e8f3e8",
                          padding: "5px 10px",
                          borderRadius: "20px",
                        }}
                      >
                        {lesson.access_tier.toUpperCase()}
                      </span>
                    </div>

                    <h3>{lesson.title}</h3>

                    {lesson.description && (
                      <p>{lesson.description}</p>
                    )}

                    <Link
                      href={`/lessons/${lesson.id}`}
                      className="continue-premium-button"
                      style={{
                        display: "inline-block",
                        textDecoration: "none",
                        marginTop: "8px",
                      }}
                    >
                      Open lesson
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
