
export type ProgressType = "lesson" | "question";

export type ProgressEntry = {
  language: string;
  lessons: string[];
  questions: string[];
};

const STORAGE_KEY = "kakha_progress";
const PROGRESS_EVENT = "kakha-progress-updated";

function normalizeLanguage(language: string) {
  return language.trim().toLowerCase();
}

function readProgress(): ProgressEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch {
    return [];
  }
}

function writeProgress(entries: ProgressEntry[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function markCompleted(
  language: string,
  type: ProgressType,
  contentId: string
) {
  if (!language || !contentId) return;

  const entries = readProgress();
  const normalized = normalizeLanguage(language);

  let entry = entries.find(
    (item) => normalizeLanguage(item.language) === normalized
  );

  if (!entry) {
    entry = {
      language,
      lessons: [],
      questions: [],
    };

    entries.push(entry);
  }

  const list = type === "lesson" ? entry.lessons : entry.questions;

  // Avoid duplicate completions
  if (!list.includes(contentId)) {
    list.push(contentId);
  }

  writeProgress(entries);
}

export function getProgress() {
  return readProgress();
}

export function getLanguageProgress(language: string) {
  const normalized = normalizeLanguage(language);

  return (
    readProgress().find(
      (item) => normalizeLanguage(item.language) === normalized
    ) ?? {
      language,
      lessons: [],
      questions: [],
    }
  );
}

export function isCompleted(
  language: string,
  type: ProgressType,
  contentId: string
) {
  const entry = getLanguageProgress(language);
  const list = type === "lesson" ? entry.lessons : entry.questions;

  return list.includes(contentId);
}

export function subscribeToProgress(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(PROGRESS_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(PROGRESS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
