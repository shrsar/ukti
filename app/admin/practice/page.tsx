
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileMenu from "@/components/ProfileMenu";

type PracticeQuestion = {
  id: string;
  language: string;
  title: string;
  description: string;
  reference_text: string | null;
  locale: string | null;
  access_tier: "free" | "premium";
  status: "draft" | "published";
};

const emptyForm = {
  language: "English",
  title: "",
  description: "",
  referenceText: "",
  accessTier: "free" as "free" | "premium",
};

function getLocale(language: string) {
  const locales: Record<string, string> = {
    English: "en-IN",
    Hindi: "hi-IN",
    Bengali: "bn-IN",
  };

  return locales[language] || "en-IN";
}

export default function AdminPracticePage() {
  const router = useRouter();

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadQuestions() {
    try {
      const response = await fetch("/api/admin/practice", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load practice questions."
        );
      }

      setQuestions(result.questions || []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load questions."
      );
    }
  }

  useEffect(() => {
    void loadQuestions();
  }, []);

  function updateForm(field: keyof typeof emptyForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function editQuestion(question: PracticeQuestion) {
    if (!question.reference_text) {
      setMessage(
        "This is an old MCQ question. It cannot be edited in the new speaking format."
      );
      return;
    }

    setEditingId(question.id);
    setForm({
      language: question.language,
      title: question.title,
      description: question.description || "",
      referenceText: question.reference_text,
      accessTier: question.access_tier,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveQuestion(status: "draft" | "published") {
    setMessage("");

    if (
      !form.language ||
      !form.title.trim() ||
      !form.referenceText.trim()
    ) {
      setMessage("Language, title and sentence are required.");
      return;
    }

    setLoading(true);

    const body = {
      ...(editingId ? { id: editingId } : {}),
      language: form.language,
      locale: getLocale(form.language),
      title: form.title.trim(),
      description: form.description.trim(),
      reference_text: form.referenceText.trim(),
      access_tier: form.accessTier,
      status,
    };

    try {
      const response = await fetch("/api/admin/practice", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save question.");
      }

      setMessage(
        status === "published"
          ? "Speaking question published successfully."
          : "Draft saved successfully."
      );

      setForm(emptyForm);
      setEditingId("");
      await loadQuestions();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuestion(id: string) {
    if (!window.confirm("Delete this practice question permanently?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/practice?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete question.");
      }

      if (editingId === id) {
        setEditingId("");
        setForm(emptyForm);
      }

      setMessage("Practice question deleted.");
      await loadQuestions();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete question."
      );
    }
  }

  const sentencePlaceholder =
    form.language === "Hindi"
      ? "उदाहरण: आज आप कैसा महसूस कर रहे हैं?"
      : form.language === "Bengali"
        ? "উদাহরণ: আজ আপনি কেমন আছেন?"
        : "Example: How are you feeling today?";

  return (
    <main className="premium-page">
      <nav className="navbar">
        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </nav>

      <div className="premium-container">
        <div className="checkout-card">
          <h1>
            {editingId ? "Edit Speaking Question" : "Add Speaking Question"}
          </h1>

          <p>
            Create a sentence for students to read aloud in English, Hindi
            or Bengali.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveQuestion("draft");
            }}
          >
            <div className="account-field">
              <label htmlFor="practice-language">Language</label>
              <select
                id="practice-language"
                value={form.language}
                onChange={(event) =>
                  updateForm("language", event.target.value)
                }
                required
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Bengali">Bengali</option>
              </select>
            </div>

            <div className="account-field">
              <label htmlFor="practice-title">Question title</label>
              <input
                id="practice-title"
                value={form.title}
                onChange={(event) =>
                  updateForm("title", event.target.value)
                }
                placeholder="e.g. Everyday Conversations"
                required
              />
            </div>

            <div className="account-field">
              <label htmlFor="practice-description">Description</label>
              <textarea
                id="practice-description"
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                placeholder="Optional description"
              />
            </div>

            <div className="account-field">
              <label htmlFor="reference-text">
                Sentence (use native script)
              </label>
              <textarea
                id="reference-text"
                value={form.referenceText}
                onChange={(event) =>
                  updateForm("referenceText", event.target.value)
                }
                placeholder={sentencePlaceholder}
                rows={4}
                required
              />
              <p>
                Students will see this sentence and speak it aloud.
              </p>
            </div>

            <div className="account-field">
              <label htmlFor="practice-access">Access</label>
              <select
                id="practice-access"
                value={form.accessTier}
                onChange={(event) =>
                  updateForm("accessTier", event.target.value)
                }
              >
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <button
              className="account-primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Draft"}
            </button>

            <button
              className="account-primary-button"
              type="button"
              disabled={loading}
              onClick={() => void saveQuestion("published")}
            >
              {loading ? "Saving..." : "Publish Question"}
            </button>

            {editingId && (
              <button
                className="account-secondary-button"
                type="button"
                onClick={() => {
                  setEditingId("");
                  setForm(emptyForm);
                  setMessage("");
                }}
              >
                Cancel Editing
              </button>
            )}
          </form>

          {message && <p role="status">{message}</p>}
        </div>

        <div className="checkout-card">
          <h2>Existing Practice Questions</h2>

          {questions.length === 0 ? (
            <p>No practice questions created yet.</p>
          ) : (
            questions.map((question) => (
              <div
                key={question.id}
                className="account-subscription-card"
              >
                <h3>{question.title}</h3>
                <p>{question.language}</p>
                <p>
                  {question.access_tier.toUpperCase()} ·{" "}
                  {question.status.toUpperCase()}
                </p>

                {question.reference_text ? (
                  <p>{question.reference_text}</p>
                ) : (
                  <p>
                    Legacy MCQ question — not available in the new speaking
                    practice interface.
                  </p>
                )}

                {question.reference_text && (
                  <button
                    className="account-secondary-button"
                    type="button"
                    onClick={() => editQuestion(question)}
                  >
                    Edit
                  </button>
                )}

                <button
                  className="account-danger-button"
                  type="button"
                  onClick={() => void deleteQuestion(question.id)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <button
          className="account-secondary-button"
          type="button"
          onClick={() => router.push("/admin/lessonss")}
        >
          Back to lessons
        </button>
      </div>
    </main>
  );
}
