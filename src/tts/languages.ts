// Curated BCP 47 language tags. The Web Speech API uses these; iPad / macOS
// users can download Enhanced voices for any of them via Settings ->
// Accessibility -> Spoken Content. Kept short so the picker fits a small
// screen without scroll; the field still accepts any string for power users
// who edit JSON via backup.

export interface LanguageOption {
  code: string;
  // Display label that includes the native script name where helpful.
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "fr-FR", label: "French (France)" },
  { code: "fr-CA", label: "French (Canada)" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "nl-NL", label: "Dutch" },
  { code: "sv-SE", label: "Swedish" },
  { code: "no-NO", label: "Norwegian" },
  { code: "da-DK", label: "Danish" },
  { code: "fi-FI", label: "Finnish" },
  { code: "pl-PL", label: "Polish" },
  { code: "cs-CZ", label: "Czech" },
  { code: "hu-HU", label: "Hungarian" },
  { code: "ro-RO", label: "Romanian" },
  { code: "el-GR", label: "Greek" },
  { code: "tr-TR", label: "Turkish" },
  { code: "ru-RU", label: "Russian" },
  { code: "uk-UA", label: "Ukrainian" },
  { code: "ar-SA", label: "Arabic" },
  { code: "he-IL", label: "Hebrew" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Mainland)" },
  { code: "zh-TW", label: "Chinese (Taiwan)" },
  { code: "th-TH", label: "Thai" },
  { code: "vi-VN", label: "Vietnamese" },
  { code: "id-ID", label: "Indonesian" },
];

export function labelForLanguage(code: string): string {
  return LANGUAGE_OPTIONS.find((l) => l.code === code)?.label ?? code;
}

// Compare two BCP 47 tags case-insensitively. "fr-FR" matches "fr-fr".
export function bcp47Equal(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// Primary subtag, e.g. "fr-FR" -> "fr". Used by speak() to find a fallback
// voice when no exact match exists.
export function primarySubtag(code: string): string {
  return code.split("-")[0].toLowerCase();
}
