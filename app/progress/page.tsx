
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { getProgress, subscribeToProgress } from "@/lib/progress";
import ProfileMenu from "@/components/ProfileMenu";

type ContentItem = {
  id: string | number;
  language: string;
};

type LanguageStats = {
  language: string;
  totalLessons: number;
  completedLessons: number;
};

type ProgressEntry = {
  language: string;
  lessons: string[];
  questions: string[];
};

function percentage(completed: number, total: number) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

export default function ProgressPage() {
  const supabase = useMemo(() => createClient(), []);

  const [lessons, setLessons] = useState<ContentItem[]>([]);
  const [lessonsError, setLessonsError] = useState("");
  const [loading, setLoading] = useState(true);

  const [completionRecords, setCompletionRecords] =
    useState<ProgressEntry[]>([]);

  // Refresh completion data when lessons are completed.
  useEffect(() => {
    function refreshCompletions() {
      setCompletionRecords(getProgress());
    }

    refreshCompletions();

    return subscribeToProgress(refreshCompletions);
  }, []);

  // Fetch published lessons only.
  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      setLessonsError("");

      const lessonResult = await supabase
        .from("lessons")
        .select("id, language")
        .eq("status", "published");

      if (cancelled) return;

      if (lessonResult.error) {
        console.error("Lessons query error:", lessonResult.error);
        setLessonsError(lessonResult.error.message);
        setLessons([]);
      } else {
        setLessons((lessonResult.data || []) as ContentItem[]);
      }

      setLoading(false);
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Calculate lesson statistics for each language.
  const stats: LanguageStats[] = useMemo(() => {
    return LANGUAGES.map((language) => {
      const languageLessons = lessons.filter(
        (item) =>
          item.language.trim().toLowerCase() ===
          language.trim().toLowerCase()
      );

      const record = completionRecords.find(
        (item) =>
          item.language.trim().toLowerCase() ===
          language.trim().toLowerCase()
      );

      const completedLessonIds = new Set(
        (record?.lessons || []).map(String)
      );

      const completedLessons = languageLessons.filter(
        (item) => completedLessonIds.has(String(item.id))
      ).length;

      return {
        language,
        totalLessons: languageLessons.length,
        completedLessons,
      };
    });
  }, [lessons, completionRecords]);

  return (
    <main className="kg-progress-page">
      <nav className="navbar">
        <div className="nav-links">
          <a href="/">Home</a>
          <a href="/lessons">Lessons</a>
          <a href="/practice">Practice</a>
        </div>

        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </nav>

      <div className="kg-progress-container">
        <header className="kg-progress-header">
          <p className="kg-progress-eyebrow">
            YOUR LEARNING JOURNEY
          </p>

          <h1>Your Progress</h1>

          <p>
            Track the lessons you complete across all languages.
          </p>
        </header>

        {loading ? (
          <div className="kg-progress-loading">
            Loading your learning progress...
          </div>
        ) : (
          <>
            {lessonsError && (
              <div className="kg-progress-error">
                <h3>Some progress data could not be loaded</h3>
                <p>
                  <strong>Lessons:</strong> {lessonsError}
                </p>
              </div>
            )}

            {/* PER-LANGUAGE PROGRESS */}
            <section className="kg-progress-section">
              <div>
                <h2>Progress by language</h2>
                <p>
                  Your completed lessons across all languages.
                </p>
              </div>

              <div className="kg-progress-language-grid">
                {stats.map((item) => {
                  const languagePercentage = percentage(
                    item.completedLessons,
                    item.totalLessons
                  );

                  return (
                    <article
                      className="kg-progress-language-card"
                      key={item.language}
                    >
                      <div className="kg-progress-language-heading">
                        <h3>{item.language}</h3>

                        <span className="kg-progress-language-total">
                          {languagePercentage}%
                        </span>
                      </div>

                      <div className="kg-progress-bar">
                        <div
                          className="kg-progress-bar-fill"
                          style={{
                            width: `${languagePercentage}%`,
                          }}
                        />
                      </div>

                      <div className="kg-progress-stat-row">
                        <span>Lessons</span>
                        <strong>
                          {item.completedLessons} / {item.totalLessons}
                        </strong>
                      </div>

                      <div className="kg-progress-bar kg-progress-small-bar">
                        <div
                          className="kg-progress-bar-fill"
                          style={{
                            width: `${languagePercentage}%`,
                          }}
                        />
                      </div>

                      <p className="kg-progress-language-total">
                        {item.completedLessons} of {item.totalLessons} lessons
                        completed
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <footer className="kg-progress-footer">
              <a href="/lessons" className="kg-progress-link">
                Continue learning →
              </a>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
