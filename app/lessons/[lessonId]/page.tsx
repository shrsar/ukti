
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DOMPurify from "dompurify";

import { createClient } from "@/lib/supabase/client";
import { markCompleted, isCompleted } from "@/lib/progress";
import LessonMedia from "@/components/LessonMedia";
import ProfileMenu from "@/components/ProfileMenu";

type Lesson = {
  id: string;
  language: string;
  title: string;
  description: string | null;
  lesson_number: number;
  access_tier: "free" | "premium";
  status: string;
  content: {
    html?: string;
    sections?: {
      heading?: string;
      explanation?: string;
      examples?: string[];
    }[];
  } | null;
};

export default function IndividualLessonPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params.lessonId;

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [safeHtml, setSafeHtml] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPlan, setCurrentPlan] = useState<"basic" | "premium">(
    "basic"
  );

  const [completed, setCompleted] = useState(false);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [completionError, setCompletionError] = useState("");

  // Load lesson and verify access
  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      try {
        setLoading(true);
        setError("");
        setCompletionError("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        // Fetch the lesson
        const {
          data: lessonData,
          error: lessonError,
        } = await supabase
          .from("lessons")
          .select(
            "id, language, title, description, lesson_number, access_tier, status, content"
          )
          .eq("id", lessonId)
          .eq("status", "published")
          .maybeSingle();

        if (lessonError) {
          throw lessonError;
        }

        if (!lessonData) {
          if (!cancelled) {
            setError("Lesson not found or not published.");
          }
          return;
        }

        // Verify language access
        const {
          data: languageAccess,
          error: accessError,
        } = await supabase
          .from("user_languages")
          .select("selected_plan, subscription_status")
          .eq("user_id", user.id)
          .eq("language", lessonData.language)
          .maybeSingle();

        if (accessError) {
          throw accessError;
        }

        if (!languageAccess) {
          if (!cancelled) {
            setError("You do not have access to this language.");
          }
          return;
        }

        const isPremiumActive =
          languageAccess.selected_plan === "premium" &&
          languageAccess.subscription_status === "active";

        // Premium lesson access
        if (
          lessonData.access_tier === "premium" &&
          !isPremiumActive
        ) {
          if (!cancelled) {
            setError("This lesson requires an active Premium plan.");
          }
          return;
        }

        const loadedLesson = lessonData as Lesson;

        if (cancelled) return;

        setLesson(loadedLesson);

        const activePlan: "basic" | "premium" = isPremiumActive
          ? "premium"
          : "basic";

        setCurrentPlan(activePlan);

        // Sanitize HTML lesson content
        setSafeHtml(
          DOMPurify.sanitize(loadedLesson.content?.html || "")
        );

        // Restore completion status from local progress storage
        setCompleted(
          isCompleted(
            loadedLesson.language,
            "lesson",
            String(loadedLesson.id)
          )
        );
      } catch (err) {
        console.error("Lesson loading error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading the lesson."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (lessonId) {
      void loadLesson();
    }

    return () => {
      cancelled = true;
    };
  }, [lessonId, router, supabase]);

  // Mark lesson as completed
  function handleMarkCompleted() {
    if (!lesson || savingCompletion || completed) return;

    try {
      setSavingCompletion(true);
      setCompletionError("");

      markCompleted(
        lesson.language,
        "lesson",
        String(lesson.id)
      );

      setCompleted(true);
    } catch (err) {
      console.error("Lesson completion error:", err);

      setCompletionError(
        "Could not save your progress. Please try again."
      );
    } finally {
      setSavingCompletion(false);
    }
  }

  return (
    <main className="premium-page">
      <nav className="navbar">
        <div className="nav-links">
          <button
            type="button"
            onClick={() => router.push("/lessons")}
          >
            Lessons
          </button>
        </div>

        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </nav>

      <div className="premium-container">
        <div className="checkout-card">
          {loading ? (
            <p>Loading lesson...</p>
          ) : error ? (
            <>
              <h2>Unable to open lesson</h2>
              <p>{error}</p>

              <button
                type="button"
                onClick={() => router.push("/lessons")}
              >
                Back to lessons
              </button>

              {error.includes("Premium") && (
                <button
                  type="button"
                  onClick={() => router.push("/premium")}
                >
                  Get Premium
                </button>
              )}
            </>
          ) : lesson ? (
            <>
              <p>
                {lesson.language} · Lesson {lesson.lesson_number}
              </p>

              <h1>{lesson.title}</h1>

              {lesson.description && (
                <p>{lesson.description}</p>
              )}

              {/* Lesson content */}
              <div className="lesson-content">
                {safeHtml ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: safeHtml,
                    }}
                  />
                ) : (
                  lesson.content?.sections?.map(
                    (section, index) => (
                      <section key={index}>
                        {section.heading && (
                          <h2>{section.heading}</h2>
                        )}

                        {section.explanation && (
                          <p style={{ whiteSpace: "pre-wrap" }}>
                            {section.explanation}
                          </p>
                        )}

                        {section.examples &&
                          section.examples.length > 0 && (
                            <ul>
                              {section.examples.map(
                                (example, i) => (
                                  <li key={i}>{example}</li>
                                )
                              )}
                            </ul>
                          )}
                      </section>
                    )
                  )
                )}
              </div>

              {/* Lesson media */}
              <LessonMedia lessonId={lesson.id} />

              {/* Completion tracking */}
              <div className="lesson-completion">
                {completed ? (
                  <p className="lesson-completed-message">
                    ✓ Lesson completed! Your progress has been saved.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleMarkCompleted}
                    disabled={savingCompletion}
                  >
                    {savingCompletion
                      ? "Saving progress..."
                      : "Mark lesson as completed"}
                  </button>
                )}

                {completionError && (
                  <p role="alert">{completionError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => router.push("/lessons")}
              >
                Back to lessons
              </button>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
