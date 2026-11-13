
export const LANGUAGES = [
  "English",
  "Hindi",
  "Bengali",
] as const;

export type Language = (typeof LANGUAGES)[number];
