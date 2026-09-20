const rows = [
  [
    "Experience",
    "Deneyim",
    "Erfahrung",
    "Expérience",
    "Experiencia",
    "Experiência",
  ],
  [
    "Attack scrap",
    "Saldırı hurdası",
    "Angriffsschrott",
    "Munitions",
    "Chatarra de ataque",
    "Sucata de ataque",
  ],
  [
    "Workshop parts",
    "Atölye parçası",
    "Werkstattteile",
    "Pièces d’atelier",
    "Piezas de taller",
    "Peças de oficina",
  ],
  ["Health", "Can", "Gesundheit", "Santé", "Salud", "Vida"],
  [
    "Orbit full",
    "Yörünge dolu",
    "Umlaufbahn voll",
    "Orbite pleine",
    "Órbita llena",
    "Órbita cheia",
  ],
  [
    "Refill orbit",
    "Yörüngeyi doldur",
    "Umlaufbahn füllen",
    "Remplir l’orbite",
    "Llenar la órbita",
    "Encher a órbita",
  ],
  [
    "Saved to the workshop when this run ends.",
    "Parçalar tur sonunda atölyeye kaydedilir.",
    "Teile werden am Rundenende in der Werkstatt gespeichert.",
    "Les pièces sont conservées à l’atelier en fin de partie.",
    "Las piezas se guardan en el taller al terminar la partida.",
    "As peças ficam na oficina no fim da partida.",
  ],
];
export const discoveryLocales: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  ["tr", "de", "fr", "es", "pt"].map((language, index) => [
    language,
    Object.fromEntries(rows.map((row) => [row[0], row[index + 1]])),
  ]),
);
