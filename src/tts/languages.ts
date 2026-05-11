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

// Characters that don't sit on a typical English keyboard but come up often
// in the target language. Used to render an inline AccentBar under text
// fields with a language set. Keyed by BCP 47 primary subtag.
//
// Both cases of each letter are included so the user can pick without holding
// shift. Punctuation and quotation marks are included where the language uses
// distinctive forms.
const ACCENTS_BY_PRIMARY: Record<string, string[]> = {
  fr: [
    "à", "À", "â", "Â", "ç", "Ç", "é", "É", "è", "È", "ê", "Ê", "ë", "Ë",
    "î", "Î", "ï", "Ï", "ô", "Ô", "œ", "Œ", "ù", "Ù", "û", "Û", "ü", "Ü",
    "«", "»",
  ],
  es: [
    "á", "Á", "é", "É", "í", "Í", "ñ", "Ñ", "ó", "Ó", "ú", "Ú", "ü", "Ü",
    "¿", "¡",
  ],
  de: ["ä", "Ä", "ö", "Ö", "ü", "Ü", "ß", "ẞ"],
  it: ["à", "À", "è", "È", "é", "É", "ì", "Ì", "ò", "Ò", "ù", "Ù"],
  pt: [
    "á", "Á", "à", "À", "â", "Â", "ã", "Ã", "ç", "Ç", "é", "É", "ê", "Ê",
    "í", "Í", "ó", "Ó", "ô", "Ô", "õ", "Õ", "ú", "Ú",
  ],
  nl: ["ë", "Ë", "ï", "Ï", "é", "É", "ó", "Ó"],
  sv: ["å", "Å", "ä", "Ä", "ö", "Ö"],
  no: ["æ", "Æ", "ø", "Ø", "å", "Å"],
  da: ["æ", "Æ", "ø", "Ø", "å", "Å"],
  fi: ["ä", "Ä", "ö", "Ö", "å", "Å"],
  pl: [
    "ą", "Ą", "ć", "Ć", "ę", "Ę", "ł", "Ł", "ń", "Ń", "ó", "Ó", "ś", "Ś",
    "ź", "Ź", "ż", "Ż",
  ],
  cs: [
    "á", "Á", "č", "Č", "ď", "Ď", "é", "É", "ě", "Ě", "í", "Í", "ň", "Ň",
    "ó", "Ó", "ř", "Ř", "š", "Š", "ť", "Ť", "ú", "Ú", "ů", "Ů", "ý", "Ý",
    "ž", "Ž",
  ],
  hu: [
    "á", "Á", "é", "É", "í", "Í", "ó", "Ó", "ö", "Ö", "ő", "Ő",
    "ú", "Ú", "ü", "Ü", "ű", "Ű",
  ],
  ro: ["ă", "Ă", "â", "Â", "î", "Î", "ș", "Ș", "ț", "Ț"],
  tr: ["ç", "Ç", "ğ", "Ğ", "ı", "İ", "ö", "Ö", "ş", "Ş", "ü", "Ü"],
  el: [
    "ά", "Ά", "έ", "Έ", "ή", "Ή", "ί", "Ί", "ό", "Ό", "ύ", "Ύ", "ώ", "Ώ",
    "ϊ", "Ϊ", "ϋ", "Ϋ",
  ],
  ru: ["ё", "Ё", "ъ", "Ъ", "ь", "Ь", "й", "Й", "э", "Э"],
  uk: ["ї", "Ї", "є", "Є", "і", "І", "ґ", "Ґ"],
  vi: [
    "ă", "â", "ê", "ô", "ơ", "ư", "đ", "Ă", "Â", "Ê", "Ô", "Ơ", "Ư", "Đ",
  ],
};

export function accentsFor(lang: string | undefined): string[] {
  if (!lang) return [];
  return ACCENTS_BY_PRIMARY[primarySubtag(lang)] ?? [];
}
