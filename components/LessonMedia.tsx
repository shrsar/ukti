
"use client";

import { useEffect, useState } from "react";

type LessonFile = {
  id: string;
  fileName: string;
  fileType: string;
  url: string;
};

type Props = {
  lessonId: string;
};

export default function LessonMedia({ lessonId }: Props) {
  const [files, setFiles] = useState<LessonFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      try {
        const response = await fetch(
          `/api/lessons/${lessonId}/documents`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not load lesson files.");
        }

        if (!cancelled) {
          setFiles(result.files || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load files."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (loading) {
    return <p>Loading lesson files...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (files.length === 0) {
    return null;
  }

  return (
    <section className="lesson-media">
      <h2>Lesson Materials</h2>

      {files.map((file) => {
        const isAudio = ["mp3", "wav", "m4a"].includes(file.fileType);
        const isVideo = ["mp4", "mov", "webm"].includes(file.fileType);
        const isDocument = ["docx", "pdf"].includes(file.fileType);

        return (
          <div className="lesson-media-item" key={file.id}>
            <h3>{file.fileName}</h3>

            {isAudio && (
              <audio controls preload="metadata">
                <source src={file.url} />
                Your browser does not support audio playback.
              </audio>
            )}

            {isVideo && (
              <video controls preload="metadata" playsInline>
                <source src={file.url} />
                Your browser does not support video playback.
              </video>
            )}

            {isDocument && (
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
              >
                Open document
              </a>
            )}
          </div>
        );
      })}
    </section>
  );
}
