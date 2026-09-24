// The fourth robot and resuming saved runs. English source copy is the lookup key.
// Each row: English, Turkish, German, French, Spanish, Portuguese.
const rows: [string, string, string, string, string, string][] = [
  [
    "Heavy magnet unit. +2 armor, +0.4 m pickup range, −8% speed.",
    "Ağır mıknatıs ünitesi. +2 zırh, +0,4 m toplama menzili, −%8 hız.",
    "Schwere Magneteinheit. +2 Panzerung, +0,4 m Sammelradius, −8 % Tempo.",
    "Unité magnétique lourde. +2 d’armure, +0,4 m de collecte, −8 % de vitesse.",
    "Unidad magnética pesada. +2 de armadura, +0,4 m de recogida, −8 % de velocidad.",
    "Unidade magnética pesada. +2 de armadura, +0,4 m de recolha, −8% de velocidade.",
  ],
];
export const robotLocales: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  ["tr", "de", "fr", "es", "pt"].map((language, index) => [
    language,
    Object.fromEntries(rows.map((row) => [row[0], row[index + 1]])),
  ]),
);
