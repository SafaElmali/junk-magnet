import { getLanguage, type Language } from "./i18n";
import type { SpecializationId } from "./specializations";
type Copy = Record<SpecializationId, [string, string]>;
const copy: Record<Language, Copy> = {
  en: {
    saw_reaper: ["Wide Reaper", "+0.6 m orbit, +50% blade damage. Launch damage −25%."],
    saw_rail: ["Rail Shards", "+50% launch damage; shots pierce 3 enemies. Blade damage −35%."],
    lightning_chain: ["Chain Network", "Arcs hit 3 extra targets and reach 6 m between jumps. Damage −25%."],
    lightning_focus: ["Focused Bolt", "Strike one target for triple damage. No chaining."],
    turret_rapid: ["Rapid Sentry", "Fire intervals −40%. Shot damage −30%."],
    turret_sniper: ["Rail Sentry", "Double damage, 14 m range and +1 pierce. Fire intervals +60%."],
    burst_wave: ["Repulsion Wave", "+50% radius, double knockback. Damage −25%."],
    burst_crush: ["Core Crusher", "+120% damage. Radius −25%; weaker knockback."],
  },
  tr: {
    saw_reaper: ["Geniş Biçici", "Yörünge +0,6 m, bıçak hasarı +%50. Fırlatma hasarı −%25."],
    saw_rail: ["Raylı Parçalar", "Fırlatma hasarı +%50; atışlar 3 düşmanı deler. Bıçak hasarı −%35."],
    lightning_chain: ["Zincir Ağı", "3 ek hedef; sıçrama menzili 6 m. Hasar −%25."],
    lightning_focus: ["Odaklı Şimşek", "Tek hedefe üç kat hasar. Sıçrama yapmaz."],
    turret_rapid: ["Seri Taret", "Atış aralığı −%40. Atış hasarı −%30."],
    turret_sniper: ["Keskin Taret", "İki kat hasar, 14 m menzil, 1 ek delme. Atış aralığı +%60."],
    burst_wave: ["İtme Dalgası", "Etki yarıçapı +%50, iki kat itme. Hasar −%25."],
    burst_crush: ["Çekirdek Ezici", "Hasar +%120. Etki yarıçapı −%25; daha zayıf itme."],
  },
  de: {
    saw_reaper: ["Weite Sense", "+0,6 m Umlauf, +50% Klingenschaden. Abschussschaden −25%."],
    saw_rail: ["Schienensplitter", "+50% Abschussschaden; durchschlägt 3 Gegner. Klingenschaden −35%."],
    lightning_chain: ["Kettennetz", "3 zusätzliche Ziele, 6 m Sprungweite. Schaden −25%."],
    lightning_focus: ["Fokusblitz", "Dreifacher Schaden an einem Ziel. Keine Sprünge."],
    turret_rapid: ["Schnellgeschütz", "Feuerintervall −40%. Projektilschaden −30%."],
    turret_sniper: ["Scharfschützengeschütz", "Doppelter Schaden, 14 m Reichweite, +1 Durchschlag. Intervall +60%."],
    burst_wave: ["Abstoßungswelle", "+50% Radius, doppelter Rückstoß. Schaden −25%."],
    burst_crush: ["Kernbrecher", "+120% Schaden. Radius −25%; schwächerer Rückstoß."],
  },
  fr: {
    saw_reaper: ["Grande faucheuse", "+0,6 m d’orbite, +50% de dégâts des lames. Dégâts de tir −25%."],
    saw_rail: ["Éclats perforants", "+50% de dégâts de tir ; traverse 3 ennemis. Dégâts des lames −35%."],
    lightning_chain: ["Réseau électrique", "3 cibles supplémentaires, sauts de 6 m. Dégâts −25%."],
    lightning_focus: ["Éclair concentré", "Dégâts triples sur une cible. Aucun saut."],
    turret_rapid: ["Sentinelle rapide", "Intervalle de tir −40%. Dégâts des tirs −30%."],
    turret_sniper: ["Sentinelle de précision", "Dégâts doubles, portée de 14 m, +1 perforation. Intervalle +60%."],
    burst_wave: ["Vague répulsive", "+50% de rayon, recul doublé. Dégâts −25%."],
    burst_crush: ["Broyeur central", "+120% de dégâts. Rayon −25% ; recul réduit."],
  },
  es: {
    saw_reaper: ["Segadora amplia", "+0,6 m de órbita, +50% de daño de cuchillas. Daño de disparo −25%."],
    saw_rail: ["Fragmentos de riel", "+50% de daño de disparo; atraviesa 3 enemigos. Daño de cuchillas −35%."],
    lightning_chain: ["Red de rayos", "3 objetivos adicionales y saltos de 6 m. Daño −25%."],
    lightning_focus: ["Rayo concentrado", "Triple daño a un objetivo. Sin saltos."],
    turret_rapid: ["Centinela rápida", "Intervalo de disparo −40%. Daño de disparo −30%."],
    turret_sniper: ["Centinela de precisión", "Doble daño, alcance de 14 m, +1 perforación. Intervalo +60%."],
    burst_wave: ["Onda de repulsión", "+50% de radio, doble empuje. Daño −25%."],
    burst_crush: ["Triturador central", "+120% de daño. Radio −25%; menor empuje."],
  },
  pt: {
    saw_reaper: ["Ceifador amplo", "+0,6 m de órbita, +50% de dano das lâminas. Dano de disparo −25%."],
    saw_rail: ["Estilhaços de trilho", "+50% de dano de disparo; atravessa 3 inimigos. Dano das lâminas −35%."],
    lightning_chain: ["Rede elétrica", "3 alvos adicionais e saltos de 6 m. Dano −25%."],
    lightning_focus: ["Raio concentrado", "Dano triplo em um alvo. Sem saltos."],
    turret_rapid: ["Sentinela rápida", "Intervalo de disparo −40%. Dano dos tiros −30%."],
    turret_sniper: ["Sentinela de precisão", "Dano duplo, alcance de 14 m, +1 perfuração. Intervalo +60%."],
    burst_wave: ["Onda de repulsão", "+50% de raio, empurrão duplo. Dano −25%."],
    burst_crush: ["Esmagador central", "+120% de dano. Raio −25%; empurrão menor."],
  },
};
const headings: Record<Language, [string, string]> = {
  en: ["WEAPON SPECIALIZATION", "Choose one permanent branch for this run."],
  tr: ["SİLAH UZMANLAŞMASI", "Bu tur için kalıcı bir dal seç."],
  de: ["WAFFENSPEZIALISIERUNG", "Wähle einen dauerhaften Zweig für diesen Lauf."],
  fr: ["SPÉCIALISATION D’ARME", "Choisissez une branche permanente pour cette partie."],
  es: ["ESPECIALIZACIÓN DE ARMA", "Elige una rama permanente para esta partida."],
  pt: ["ESPECIALIZAÇÃO DE ARMA", "Escolha um ramo permanente para esta partida."],
};
export function specializationCopy(id: SpecializationId) { return copy[getLanguage()][id]; }
export function specializationHeading() { return headings[getLanguage()]; }
