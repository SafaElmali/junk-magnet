// Level-up tools, revives, stage clears and the Night Shift. English source copy is the lookup key.
// Each row: English, Turkish, German, French, Spanish, Portuguese.
const rows: [string, string, string, string, string, string][] = [];
export const runRulesLocales: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  ["tr", "de", "fr", "es", "pt"].map((language, index) => [
    language,
    Object.fromEntries(rows.map((row) => [row[0], row[index + 1]])),
  ]),
);
