// Rewarded-ad offers in the CrazyGames build. English source copy is the lookup key.
// Each row: English, Turkish, German, French, Spanish, Portuguese.
const rows: [string, string, string, string, string, string][] = [
  // Revive offer on defeat
  ["Out of power", "Enerjin bitti", "Keine Energie mehr", "Plus d’énergie", "Sin energía", "Sem energia"],
  [
    "Watch a short ad to revive with {health} health.",
    "Kısa bir reklam izle, {health} canla yeniden ayağa kalk.",
    "Sieh dir kurz Werbung an und mach mit {health} Leben weiter.",
    "Regarde une courte pub pour repartir avec {health} points de vie.",
    "Mira un anuncio corto para reanimarte con {health} de salud.",
    "Vê um anúncio curto para reviver com {health} de vida.",
  ],
  ["WATCH AD", "REKLAM İZLE", "WERBUNG ANSEHEN", "VOIR LA PUB", "VER ANUNCIO", "VER ANÚNCIO"],
  ["NO THANKS", "HAYIR, SAĞ OL", "NEIN, DANKE", "NON MERCI", "NO, GRACIAS", "NÃO, OBRIGADO"],
  // Double parts on the result
  [
    "WATCH AD · DOUBLE PARTS",
    "REKLAM İZLE · 2 KAT PARÇA",
    "WERBUNG · TEILE ×2",
    "PUB · PIÈCES ×2",
    "ANUNCIO · PIEZAS ×2",
    "ANÚNCIO · PEÇAS ×2",
  ],
  [
    "+{parts} parts (doubled) · Bank: {total}",
    "+{parts} parça (2 kat) · Toplam: {total}",
    "+{parts} Teile (verdoppelt) · Vorrat: {total}",
    "+{parts} pièces (doublées) · Réserve : {total}",
    "+{parts} piezas (duplicadas) · Reserva: {total}",
    "+{parts} peças (em dobro) · Reserva: {total}",
  ],
  [
    "No ad available right now",
    "Şu an reklam yok",
    "Gerade keine Werbung verfügbar",
    "Aucune pub disponible pour l’instant",
    "No hay anuncios ahora mismo",
    "Nenhum anúncio disponível agora",
  ],
];
export const adLocales: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  ["tr", "de", "fr", "es", "pt"].map((language, index) => [
    language,
    Object.fromEntries(rows.map((row) => [row[0], row[index + 1]])),
  ]),
);
