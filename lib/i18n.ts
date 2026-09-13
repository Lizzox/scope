export const localeCatalogs = {
  de: {
    projects: "Projekte", myWork: "Meine Arbeit", inbox: "Eingang", calendar: "Kalender",
    settings: "Einstellungen", share: "Teilen", task: "Aufgabe", board: "Board", list: "Liste",
  },
  en: {
    projects: "Projects", myWork: "My work", inbox: "Inbox", calendar: "Calendar",
    settings: "Settings", share: "Share", task: "Task", board: "Board", list: "List",
  },
} as const;

export type ScopeLocale = keyof typeof localeCatalogs;
export type TranslationKey = keyof typeof localeCatalogs.de;

// Community language packs can implement this shape without touching UI components.
export type LocaleCatalog = Record<TranslationKey, string>;

export function translate(locale: ScopeLocale, key: TranslationKey) {
  return localeCatalogs[locale]?.[key] ?? localeCatalogs.de[key];
}

export const supportedLocales = Object.keys(localeCatalogs) as ScopeLocale[];
