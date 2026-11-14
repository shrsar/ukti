
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DOMPurify from "dompurify";

import { createClient } from "@/lib/supabase/client";
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

  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: lessonData, error: lessonError } =
          await supabase
            .from("lessons")
            .select(
              "id, language, title, description, lesson_number, access_tier, status, content"
            )
            .eq("id", lessonId)
            .eq("status", "published")
            .maybeSingle();

        if (lessonError || !lessonData) {
          if (!cancelled) {
            setError("Lesson not found or not published.");
          }
          return;
        }

        const { data: languageAccess, error: accessError } =
          await supabase
            .from("user_languages")
            .select("selected_plan, subscription_status")
            .eq("user_id", user.id)
            .eq("language", lessonData.language)
            .maybeSingle();

        if (accessError || !languageAccess) {
          if (!cancelled) {
            setError("You do not have access to this language.");
          }
          return;
        }

        if (
          lessonData.access_tier === "premium" &&
          !(
            languageAccess.selected_plan === "premium" &&
            languageAccess.subscription_status === "active"
          )
        ) {
          if (!cancelled) {
            setError(
              "This lesson requires an active Premium plan."
            );
          }
          return;
        }

        const loadedLesson = lessonData as Lesson;

        if (!cancelled) {
          setLesson(loadedLesson);
          setSafeHtml(
            DOMPurify.sanitize(loadedLesson.content?.html || "")
          );
        }
      } catch (err) {
        console.error("Lesson loading error:", err);

        if (!cancelled) {
          setError(
            "Something went wrong while loading the lesson."
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

              <LessonMedia lessonId={lesson.id} />

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
