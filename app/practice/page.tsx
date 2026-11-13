
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProfileMenu from "@/components/ProfileMenu";

type WordResult = {
  word: string;
  recognized: boolean;
};

type Question = {
  id: string;
  language: string;
  title: string;
  description: string;
  reference_text: string;
  locale: string;
  access_tier: "free" | "premium";
  completed?: boolean;
  progress_status?: "in_progress" | "completed" | "skipped";
};

function PracticeContent() {
  const searchParams = useSearchParams();
  const initialLanguage = searchParams.get("language") || "";

  const [language, setLanguage] = useState(initialLanguage);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [wordResults, setWordResults] = useState<WordResult[]>([]);
  const [completed, setCompleted] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  async function loadQuestions(selectedLanguage: string) {
    if (!selectedLanguage) return;

    setLoading(true);
    setMessage("");
    setQuestions([]);
    setIndex(0);
    setTranscript("");
    setWordResults([]);
    setCompleted(false);

    try {
      const response = await fetch(
        `/api/practice?language=${encodeURIComponent(selectedLanguage)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load practice questions.");
      }

      setQuestions(data.questions || []);

      if (!data.questions?.length) {
        setMessage(
          "No published speaking questions are available for this language."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialLanguage === "English" || initialLanguage === "Hindi" || initialLanguage === "Bengali") {
      loadQuestions(initialLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }

      const recorder = mediaRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function clearFeedback() {
    setTranscript("");
    setWordResults([]);
    setCompleted(false);
    setMessage("");
  }

  function stopActiveRecording() {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }

    setRecording(false);
  }

  // Normalize browser MIME types such as audio/webm;codecs=opus.
  function getSupportedMimeType(mimeType: string) {
    const normalized = mimeType.split(";")[0].trim().toLowerCase();

    if (normalized === "audio/webm") {
      return { mimeType: "audio/webm", extension: "webm" };
    }

    if (normalized === "audio/mp4") {
      return { mimeType: "audio/mp4", extension: "mp4" };
    }

    if (normalized === "audio/ogg") {
      return { mimeType: "audio/ogg", extension: "ogg" };
    }

    if (normalized === "audio/wav" || normalized === "audio/x-wav") {
      return { mimeType: "audio/wav", extension: "wav" };
    }

    return {
      mimeType: normalized || "application/octet-stream",
      extension: "bin",
    };
  }

  async function startRecording() {
    const currentQuestion = questions[index];

    if (!currentQuestion || completed || submitting || recording) {
      return;
    }

    clearFeedback();

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage(
        "Audio recording is not supported by this browser. Please use a recent version of Chrome."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      let preferredMimeType = "";

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        preferredMimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        preferredMimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        preferredMimeType = "audio/mp4";
      }

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setMessage("An error occurred while recording. Please try again.");
        setRecording(false);

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.onstop = async () => {
        const format = getSupportedMimeType(recorder.mimeType);

        // Keep the original audio bytes but remove the codecs suffix.
        const audioBlob = new Blob(chunksRef.current, {
          type: format.mimeType,
        });

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (audioBlob.size === 0) {
          setMessage("No audio was recorded. Please try again.");
          return;
        }

        await submitRecording(audioBlob, format.extension);
      };

      recorder.start();

      setRecording(true);
      setMessage("Recording. Speak the complete sentence clearly.");

      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          setRecording(false);
          setMessage("Recording limit reached. Processing your audio...");
        }
      }, 25000);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to access your microphone."
      );
    }
  }

  function stopRecording() {
    if (!recording) return;

    stopActiveRecording();
    setMessage("Processing your recording...");
  }

  async function submitRecording(audioBlob: Blob, extension: string) {
    const question = questions[index];

    if (!question) return;

    setSubmitting(true);
    setMessage("Checking your sentence...");

    try {
      const formData = new FormData();

      formData.append(
        "audio",
        audioBlob,
        `speaking-recording.${extension}`
      );

      formData.append("questionId", question.id);

      const response = await fetch("/api/practice", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to process your recording."
        );
      }

      setTranscript(data.transcript || "");
      setWordResults(data.words || []);
      setCompleted(Boolean(data.completed));

      setMessage(
        data.completed
          ? "All words were recognised. Question completed!"
          : "Some words were not recognised. Please try again."
      );

      setQuestions((previous) =>
        previous.map((item) =>
          item.id === question.id
            ? {
                ...item,
                completed: Boolean(data.completed),
                progress_status: data.completed
                  ? "completed"
                  : "in_progress",
              }
            : item
        )
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function skipQuestion() {
    const question = questions[index];

    if (!question || completed || submitting || recording || loading) {
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();

      formData.append("action", "skip");
      formData.append("questionId", question.id);

      const response = await fetch("/api/practice", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to skip question.");
      }

      setQuestions((previous) =>
        previous.map((item) =>
          item.id === question.id
            ? {
                ...item,
                completed: false,
                progress_status: "skipped",
              }
            : item
        )
      );

      setIndex((current) => current + 1);
      clearFeedback();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to skip question."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function goToNextQuestion() {
    if (recording || submitting) return;

    setIndex((current) => current + 1);
    clearFeedback();
  }

  const currentQuestion = questions[index];

  const recognizedCount = wordResults.filter(
    (item) => item.recognized
  ).length;

  const progressPercent =
    wordResults.length > 0
      ? Math.round((recognizedCount / wordResults.length) * 100)
      : 0;

  return (
    <main className="premium-page">
      <nav className="navbar">
        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </nav>

      <div className="premium-container">
        <div className="checkout-card">
          <h1>Speaking Practice</h1>

          <p>
            Read the sentence aloud and practise your pronunciation.
          </p>

          <div className="account-field">
            <label htmlFor="practice-language">Choose language</label>

            <select
              id="practice-language"
              value={language}
              disabled={loading || recording || submitting}
              onChange={(event) => {
                const selected = event.target.value;

                setLanguage(selected);

                if (selected) {
                  loadQuestions(selected);
                } else {
                  setQuestions([]);
                  setIndex(0);
                  clearFeedback();
                  setMessage("");
                }
              }}
            >
              <option value="">Choose a language</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Bengali">Bengali</option>
            </select>
          </div>

          {loading && <p>Loading speaking questions...</p>}

          {currentQuestion && !loading && (
            <div className="account-subscription-card">
              <p>
                Question {index + 1} of {questions.length}
              </p>

              <h2>{currentQuestion.title}</h2>

              {currentQuestion.description && (
                <p>{currentQuestion.description}</p>
              )}

              <div className="speaking-sentence">
                {wordResults.length > 0 ? (
                  wordResults.map((item, wordIndex) => (
                    <span
                      key={`${wordIndex}-${item.word}`}
                      className={
                        item.recognized
                          ? "speaking-word speaking-word-correct"
                          : "speaking-word speaking-word-missed"
                      }
                    >
                      {item.word}{" "}
                    </span>
                  ))
                ) : (
                  <p>{currentQuestion.reference_text}</p>
                )}
              </div>

              <p className="speaking-instruction">
                Speak the complete sentence shown above.
              </p>

              {!recording ? (
                <button
                  className="account-primary-button"
                  type="button"
                  disabled={submitting || completed}
                  onClick={startRecording}
                >
                  {submitting ? "Processing..." : "Start Speaking"}
                </button>
              ) : (
                <button
                  className="account-danger-button"
                  type="button"
                  onClick={stopRecording}
                >
                  Stop Recording
                </button>
              )}

              {recording && (
                <p role="status">
                  <span aria-hidden="true">🔴 </span>
                  Recording your voice...
                </p>
              )}

              {submitting && (
                <p role="status">
                  Processing your recording. Please wait...
                </p>
              )}

              {wordResults.length > 0 && (
                <div className="speaking-feedback">
                  <p>
                    Recognised words: {recognizedCount} / {wordResults.length}
                  </p>

                  <div className="speaking-progress-track">
                    <div
                      className="speaking-progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <p>
                    Your recording: {transcript || "No transcript returned."}
                  </p>
                </div>
              )}

              {message && <p role="status">{message}</p>}

              {completed && index < questions.length - 1 && (
                <button
                  className="account-primary-button"
                  type="button"
                  disabled={submitting}
                  onClick={goToNextQuestion}
                >
                  Next Question
                </button>
              )}

              {!completed && (
                <button
                  className="account-secondary-button"
                  type="button"
                  disabled={submitting || recording}
                  onClick={skipQuestion}
                >
                  Skip Question
                </button>
              )}

              {completed && index === questions.length - 1 && (
                <p>You've completed all available questions!</p>
              )}
            </div>
          )}

          {!loading &&
            questions.length > 0 &&
            index >= questions.length && (
              <div className="account-subscription-card">
                <h2>Practice session finished</h2>

                <p>
                  You've reached the end of the available questions.
                </p>

                <button
                  className="account-primary-button"
                  type="button"
                  onClick={() => loadQuestions(language)}
                >
                  Practise Again
                </button>
              </div>
            )}

          {!loading && !currentQuestion && message && (
            <p role="status">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <main className="premium-page">Loading practice...</main>
      }
    >
      <PracticeContent />
    </Suspense>
  );
}
