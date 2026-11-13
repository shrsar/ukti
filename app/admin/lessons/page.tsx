
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProfileMenu from "@/components/ProfileMenu";
import LessonRichTextEditor from "@/components/LessonRichTextEditor";
import { LANGUAGES } from "@/lib/languages";

type Lesson = {
  id: string;
  language: string;
  lesson_number: number;
  title: string;
  description: string;
  content: Record<string, unknown>;
  access_tier: "free" | "premium";
  status: "draft" | "published";
  created_at?: string;
};

type LessonForm = {
  language: string;
  lesson_number: string;
  title: string;
  description: string;
  content: string;
  access_tier: "free" | "premium";
  status: "draft" | "published";
};

const emptyForm: LessonForm = {
  language: "",
  lesson_number: "1",
  title: "",
  description: "",
  content: "",
  access_tier: "free",
  status: "draft",
};

// Escape legacy imported text before displaying it as HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Supports both new HTML content and older imported JSON sections.
function getEditorContent(content: Record<string, unknown>): string {
  if (typeof content.html === "string") {
    return content.html;
  }

  const sections = Array.isArray(content.sections)
    ? content.sections
    : [];

  return sections
    .map((item) => {
      if (!item || typeof item !== "object") return "";

      const section = item as {
        heading?: string;
        explanation?: string;
        examples?: unknown[];
      };

      const heading =
        typeof section.heading === "string"
          ? `<h2>${escapeHtml(section.heading)}</h2>`
          : "";

      const explanation =
        typeof section.explanation === "string"
          ? section.explanation
              .split(/\n{2,}/)
              .map(
                (paragraph) =>
                  `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`
              )
              .join("")
          : "";

      const examples = Array.isArray(section.examples)
        ? section.examples
            .map((example) => {
              if (typeof example === "string") {
                return `<li>${escapeHtml(example)}</li>`;
              }

              if (example && typeof example === "object") {
                const exampleObject = example as Record<string, unknown>;

                const text = Object.values(exampleObject)
                  .filter((value) => typeof value === "string")
                  .join(" — ");

                return text ? `<li>${escapeHtml(text)}</li>` : "";
              }

              return "";
            })
            .join("")
        : "";

      return (
        heading +
        explanation +
        (examples ? `<ul>${examples}</ul>` : "")
      );
    })
    .join("");
}

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [form, setForm] = useState<LessonForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("all");

  const loadLessons = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/lessons", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load lessons.");
      }

      setLessons(Array.isArray(data.lessons) ? data.lessons : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  function updateField<K extends keyof LessonForm>(
    field: K,
    value: LessonForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setMessage("");
    setError("");
  }

  function editLesson(lesson: Lesson) {
    setEditingId(lesson.id);

    setForm({
      language: lesson.language,
      lesson_number: String(lesson.lesson_number),
      title: lesson.title,
      description: lesson.description || "",
      content: getEditorContent(lesson.content || {}),
      access_tier: lesson.access_tier,
      status: lesson.status,
    });

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      language: form.language.trim(),
      lesson_number: Number(form.lesson_number),
      title: form.title.trim(),
      description: form.description.trim(),
      content: {
        html: form.content,
      },
      access_tier: form.access_tier,
      status: form.status,
    };

    if (
      !payload.language ||
      !payload.title ||
      !Number.isInteger(payload.lesson_number) ||
      payload.lesson_number < 1
    ) {
      setError("Enter a language, title, and valid lesson number.");
      setSaving(false);
      return;
    }

    if (!payload.content.html.trim()) {
      setError("Please write some lesson content.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/lessons", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingId ? { id: editingId, ...payload } : payload
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save the lesson.");
      }

      const successMessage = editingId
        ? "Lesson updated successfully."
        : "Lesson created successfully.";

      resetForm();
      setMessage(successMessage);

      await loadLessons();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson(lesson: Lesson) {
    const confirmed = window.confirm(
      `Delete "${lesson.title}"? This may also delete its associated student progress records.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/lessons", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: lesson.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete the lesson.");
      }

      if (editingId === lesson.id) {
        resetForm();
      }

      setMessage("Lesson deleted successfully.");

      await loadLessons();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  const filteredLessons =
    filterLanguage === "all"
      ? lessons
      : lessons.filter(
          (lesson) => lesson.language === filterLanguage
        );

  return (
    <main className="premium-page">
      <nav className="navbar">
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/lessons">Lessons</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>

        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </nav>

      <div className="premium-container">
        <div className="checkout-card">
          <h1>Manage lessons</h1>

          <p>
            Create, edit, publish, and manage lessons for your
            language courses.
          </p>

          <div style={{ margin: "20px 0" }}>
            <Link
              href="/admin/lessons/import"
              className="continue-premium-button"
            >
              Import
            </Link>
          </div>

          {message && (
            <p role="status" style={{ color: "green" }}>
              {message}
            </p>
          )}

          {error && (
            <p role="alert" style={{ color: "crimson" }}>
              {error}
            </p>
          )}

          <hr />

          <h2>{editingId ? "Edit lesson" : "Create a lesson"}</h2>

          <form onSubmit={saveLesson}>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="language">Language</label>

              <select
                id="language"
                value={form.language}
                onChange={(event) =>
                  updateField("language", event.target.value)
                }
                required
                style={{ width: "100%" }}
              >
                <option value="">Select a language</option>

                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="lesson-number">Lesson number</label>

              <input
                id="lesson-number"
                type="number"
                min="1"
                value={form.lesson_number}
                onChange={(event) =>
                  updateField("lesson_number", event.target.value)
                }
                required
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="title">Lesson title</label>

              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(event) =>
                  updateField("title", event.target.value)
                }
                placeholder="Example: Everyday Greetings"
                required
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="description">Description</label>

              <textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Briefly describe this lesson"
                rows={3}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label>Lesson content</label>

              <LessonRichTextEditor
                value={form.content}
                onChange={(value) =>
                  updateField("content", value)
                }
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="access-tier">Access type</label>

              <select
                id="access-tier"
                value={form.access_tier}
                onChange={(event) =>
                  updateField(
                    "access_tier",
                    event.target.value as "free" | "premium"
                  )
                }
                style={{ width: "100%" }}
              >
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="status">Publication status</label>

              <select
                id="status"
                value={form.status}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value as "draft" | "published"
                  )
                }
                style={{ width: "100%" }}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="submit"
                className="continue-premium-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update lesson"
                    : "Create lesson"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="continue-premium-button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel editing
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="checkout-card" style={{ marginTop: "28px" }}>
          <h2>Existing lessons</h2>

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="language-filter">
              Filter by language
            </label>

            <select
              id="language-filter"
              value={filterLanguage}
              onChange={(event) =>
                setFilterLanguage(event.target.value)
              }
              style={{ width: "100%" }}
            >
              <option value="all">All languages</option>

              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p>Loading lessons...</p>
          ) : filteredLessons.length === 0 ? (
            <p>No lessons found for this language.</p>
          ) : (
            <div>
              {filteredLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  style={{
                    border: "1px solid #e8dce5",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "14px",
                  }}
                >
                  <h3>
                    {lesson.language} — Lesson{" "}
                    {lesson.lesson_number}
                  </h3>

                  <h4>{lesson.title}</h4>

                  {lesson.description && (
                    <p>{lesson.description}</p>
                  )}

                  <p>
                    Access:{" "}
                    <strong>
                      {lesson.access_tier.toUpperCase()}
                    </strong>
                  </p>

                  <p>
                    Status:{" "}
                    <strong>
                      {lesson.status.toUpperCase()}
                    </strong>
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "12px",
                    }}
                  >
                    <button
                      type="button"
                      className="continue-premium-button"
                      onClick={() => editLesson(lesson)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="continue-premium-button"
                      onClick={() => deleteLesson(lesson)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
