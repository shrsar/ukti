
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/lib/languages";
import ProfileMenu from "@/components/ProfileMenu";

export default function ImportLessonPage() {
  const router = useRouter();

  const [language, setLanguage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lessonNumber, setLessonNumber] = useState("1");
  const [accessTier, setAccessTier] = useState("free");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!language || !title.trim() || files.length === 0) {
      setMessage("Please complete the required fields and select files.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("language", language);
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("lesson_number", lessonNumber);
      formData.append("access_tier", accessTier);

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/admin/lessonss/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed.");
      }

      setMessage("Lesson uploaded successfully.");

      router.push("/admin/lessonss");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="premium-page">
      <nav className="navbar">
        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </nav>

      <div className="premium-container">
        <div className="checkout-card">
          <h1>Import Lesson</h1>
          <p>
            Create a lesson and upload documents, audio and video files.
          </p>

          <form onSubmit={handleSubmit}>
            <label>Language</label>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              required
            >
              <option value="">Select language</option>
              {LANGUAGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label>Lesson title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter lesson title"
              required
            />

            <label>Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Enter lesson description"
              rows={3}
            />

            <label>Lesson number</label>
            <input
              type="number"
              min="1"
              value={lessonNumber}
              onChange={(event) => setLessonNumber(event.target.value)}
              required
            />

            <label>Access type</label>
            <select
              value={accessTier}
              onChange={(event) => setAccessTier(event.target.value)}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>

            <label>Upload lesson files</label>
            <input
              type="file"
              accept=".docx,.pdf,.mp3,.wav,.m4a,.mp4,.mov,.webm"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files || []))
              }
              required
            />

            <p>
              Supported: DOCX, PDF, MP3, WAV, M4A, MP4, MOV and WEBM.
              Maximum 100 MB per file.
            </p>

            {files.length > 0 && (
              <div className="selected-files">
                <strong>Selected files</strong>
                {files.map((file, index) => (
                  <p key={`${file.name}-${index}`}>
                    {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                ))}
              </div>
            )}

            {message && <p role="status">{message}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Uploading..." : "Create lesson and upload"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push("/admin/lessonss")}
          >
            Back to lessons
          </button>
        </div>
      </div>
    </main>
  );
}
