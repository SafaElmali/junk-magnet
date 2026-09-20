import { locales } from "./locales";
import {
  upgradeDescription,
  UPGRADES,
  type State,
  type UpgradeId,
} from "./simulation";

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
] as const;
export type Language = (typeof LANGUAGES)[number]["code"];
export function resolveLanguage(
  saved: string | null,
  browser: string | readonly string[] = "en",
): Language {
  const match = (value: string | null) =>
    LANGUAGES.find(
      ({ code }) =>
        code === value?.toLowerCase().replace("_", "-").split("-")[0],
    )?.code;
  const preferences = typeof browser === "string" ? [browser] : browser;
  return match(saved) ?? preferences.map(match).find(Boolean) ?? "en";
}
// Country flags are original SVG artwork, never emoji glyphs. Native names remain
// the accessible language labels; these flags are decorative visual shortcuts.
export function languageFlag(code: Language): string {
  const art: Record<Language, string> = {
    en: '<path fill="#24466c" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="5" d="m0 0 30 20M30 0 0 20"/><path stroke="#c5433a" stroke-width="2" d="m0 0 30 20M30 0 0 20"/><path stroke="#fff" stroke-width="7" d="M15 0v20M0 10h30"/><path stroke="#c5433a" stroke-width="4" d="M15 0v20M0 10h30"/>',
    tr: '<path fill="#e30a17" d="M0 0h30v20H0z"/><circle cx="10" cy="10" r="5" fill="#fff"/><circle cx="11.25" cy="10" r="4" fill="#e30a17"/><polygon fill="#fff" points="15.000,10.000 16.727,9.439 16.727,7.622 17.795,9.092 19.523,8.531 18.455,10.000 19.523,11.469 17.795,10.908 16.727,12.378 16.727,10.561"/>',
    de: '<path fill="#262b2f" d="M0 0h30v7H0z"/><path fill="#c74237" d="M0 7h30v6H0z"/><path fill="#edc049" d="M0 13h30v7H0z"/>',
    fr: '<path fill="#265694" d="M0 0h10v20H0z"/><path fill="#fff" d="M10 0h10v20H10z"/><path fill="#d44943" d="M20 0h10v20H20z"/>',
    es: '<path fill="#bb3933" d="M0 0h30v20H0z"/><path fill="#efc449" d="M0 5h30v10H0z"/><path fill="#bd4339" stroke="#fff2ce" stroke-width=".6" d="M8 7h5v5q-2.5 3-5 0z"/><path stroke="#efc449" d="M10.5 7v6M8 10h5"/>',
    pt: '<path fill="#257552" d="M0 0h12v20H0z"/><path fill="#c7433d" d="M12 0h18v20H12z"/><circle cx="12" cy="10" r="4.5" fill="none" stroke="#efc449" stroke-width="1.3"/><path fill="#fff" stroke="#c7433d" stroke-width="1" d="M9.5 7h5v5q-2.5 3-5 0z"/><path stroke="#31587d" stroke-width="1.5" d="M12 8v4M10.5 10h3"/>',
  };
  return `<svg class="language-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">${art[code]}</svg>`;
}
let saved: string | null = null;
try {
  saved = localStorage.getItem("junk-magnet-language");
} catch {
  /* Storage is optional. */
}
let language: Language = resolveLanguage(
  saved,
  typeof navigator === "undefined"
    ? []
    : [...(navigator.languages ?? []), navigator.language],
);
export function getLanguage() {
  return language;
}
export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem("junk-magnet-language", next);
  } catch {
    /* Private browsing can disable storage. */
  }
}

// English source copy is the translation key. Static DOM bindings retain original
// text nodes, preserving icons, controls and the current run when language changes.
export const turkish: Record<string, string> = {
  "SURVIVE. SALVAGE. REPEAT.": "DAYAN. TOPLA. TEKRARLA.",
  "Main menu": "Ana menü",
  PLAY: "OYNA",
  CONTINUE: "DEVAM ET",
  "NEW RUN": "YENİ TUR",
  ABILITIES: "YETENEKLER",
  SETTINGS: "AYARLAR",
  "HOW TO PLAY": "NASIL OYNANIR?",
  "MAIN MENU": "ANA MENÜ",
  BACK: "GERİ",
  "Your character": "Karakterin",
  "YOUR SURVIVOR": "KARAKTERİN",
  "Tiny robot. Endless potential.": "Küçük robot. Sınırsız potansiyel.",
  "STARTING WEAPON": "BAŞLANGIÇ SİLAHI",
  "Endless survival · Increasing difficulty": "Sonsuz mücadele · Artan zorluk",
  READY: "HAZIR",
  Language: "Dil",
  Sound: "Ses",
  Music: "Müzik",
  "Volume down": "Sesi azalt",
  "Volume up": "Sesi artır",
  ON: "AÇIK",
  OFF: "KAPALI",
  "Move. Collect. Choose your upgrades. Attacks are automatic.":
    "Hareket et. Topla. Yetenek seç. Saldırılar otomatik.",
  All: "Tümü",
  Weapons: "Silahlar",
  Support: "Destek",
  Supplies: "Takviyeler",
  "Filter abilities": "Yetenekleri filtrele",
  "Know your tools. Build your survival.":
    "Ekipmanını tanı. Mücadeleye hazırlan.",
  "MAX RANK": "EN YÜKSEK SEVİYE",
  REPEATABLE: "TEKRAR SEÇİLEBİLİR",
  "Your starting weapon": "Başlangıç silahın",
  "Available through level-up choices": "Seviye atladığında seçilebilir",
  "A field guide, not a loadout. Choose your upgrades when you level up.":
    "Bu ekran yetenek rehberidir. Geliştirmelerini oyun içinde seviye atlayınca seçersin.",
  "Scrap blades circle your robot and hit nearby enemies. More ranks increase damage, orbit size and speed.":
    "Hurdalar robotunun çevresinde dönerek yakındaki düşmanlara vurur. Seviye arttıkça hasar, yörünge genişliği ve dönüş hızı artar.",
  "An electric arc jumps between 2 enemies, dealing 4 damage every 2.8 seconds. More ranks add targets and damage.":
    "Her 2,8 saniyede 2 düşman arasında sıçrayan bir şimşek, her birine 4 hasar verir. Seviye arttıkça hedef sayısı ve hasar artar.",
  "Deploy a stationary turret every 8 seconds. Each shot deals 3 damage. More ranks improve fire rate, damage and lifetime.":
    "Her 8 saniyede sabit bir taret kurar. Her atış 3 hasar verir. Seviye arttıkça daha hızlı ateş eder, güçlenir ve daha uzun dayanır.",
  "A magnetic shockwave hits nearby enemies for 4 damage and pushes them back every 5 seconds. More ranks widen and strengthen the blast.":
    "Her 5 saniyede bir manyetik dalga, yakındaki düşmanlara 4 hasar verir ve onları geri iter. Seviye arttıkça etki alanı ve hasar büyür.",
  "Move 12% faster per rank. Slip through gaps and keep ahead of the swarm.":
    "Her seviyede %12 daha hızlı hareket et. Boşluklardan sıyrıl ve sürünün önünde kal.",
  "Extend your pickup radius by 0.9 metres per rank. Collect energy and reload your scrap from farther away.":
    "Her seviyede toplama yarıçapını 0,9 metre genişlet. Enerjiyi ve hurdaları daha uzaktan topla.",
  "Reduce contact damage by 2 per rank. Every enemy hit still deals at least 1 damage.":
    "Her seviyede düşman temasının hasarını 2 azaltır. Her vuruş yine de en az 1 hasar verir.",
  "Restore 35 health immediately, up to 100. Can be selected again on a later level.":
    "Hemen 35 can yeniler; canın en fazla 100 olur. Sonraki seviyelerde tekrar seçilebilir.",
  "Refill all 12 scrap pieces and reset the automatic attack cooldown. Can be selected again.":
    "Yörüngendeki 12 hurdayı doldurur ve otomatik atışın bekleme süresini sıfırlar. Tekrar seçilebilir.",
  "Gain 25% damage and 15% movement speed for 20 seconds. Choosing it again refreshes the duration.":
    "20 saniye boyunca %25 hasar ve %15 hareket hızı kazan. Tekrar seçmek süreyi yeniler.",
  "ALL ABILITIES": "YETENEKLERE DÖN",
  "Ability pages": "Yetenek sayfaları",
  "Previous page": "Önceki sayfa",
  "Next page": "Sonraki sayfa",
  "Help pages": "Yardım adımları",
  "Previous step": "Önceki adım",
  "Next step": "Sonraki adım",
  "Level up": "Seviye atladın",
  "Level {level} · Choose one upgrade.": "Seviye {level} · Bir yetenek seç.",
  "THE SWARM IS YOUR AMMO.": "SÜRÜ SENİN CEPHANEN.",
  "THE SCRAPYARD": "HURDALIK",
  "ENDLESS SHIFT": "SONSUZ VARDİYA",
  "Game controls": "Oyun kontrolleri",
  "Enable sound": "Sesi aç",
  "Mute sound": "Sesi kapat",
  "Enable music": "Müziği aç",
  "Mute music": "Müziği kapat",
  "How to play": "Nasıl oynanır?",
  "Pause game": "Oyunu duraklat",
  "Game arena": "Oyun alanı",
  "Experience toward next level": "Sonraki seviyeye ilerleme",
  "Game status": "Oyun durumu",
  "Robot health": "Robotun canı",
  "JUNK RECYCLED": "TOPLANAN HURDA",
  "COLLECT BLUE ENERGY. BUILD SOMETHING BIGGER.":
    "MAVİ ENERJİ TOPLA. DAHA DA GÜÇLEN.",
  "Current abilities": "Mevcut yetenekler",
  "Opening the yard…": "Hurdalık açılıyor…",
  "Unpacking the good junk.": "Hurdalar hazırlanıyor.",
  "Small robot.": "Küçük robot.",
  "Endless trouble.": "Bitmeyen bela.",
  "Keep moving. Your weapons fire automatically.":
    "Hareket et. Silahların otomatik ateş eder.",
  "Collect blue energy to level up.": "Seviye atlamak için mavi enerji topla.",
  "Choose upgrades. Survive the swarm.":
    "Yetenek seç. Sürüye karşı hayatta kal.",
  "LET’S MAKE A MESS": "HAYDİ BAŞLAYALIM",
  "Move with WASD or arrows · Attacks are automatic":
    "WASD veya oklarla hareket et · Saldırılar otomatik",
  "SCRAP ORBIT": "HURDA YÖRÜNGESİ",
  "Your orbit attacks automatically. Get close to loose scrap.":
    "Yörüngendeki hurdalar otomatik saldırır. Yerdeki hurdalara yaklaş.",
  "LAUNCH SCRAP": "HURDA FIRLAT",
  "SPACE / CLICK": "BOŞLUK / TIKLA",
  "Movement joystick": "Hareket çubuğu",
  "Taking a breather.": "Biraz soluklan.",
  Move: "Hareket",
  Collect: "Toplama",
  Attack: "Saldırı",
  "AUTO ATTACK": "OTOMATİK SALDIRI",
  Upgrade: "Geliştirme",
  Recover: "Toparlanma",
  "WASD / arrow keys, or drag anywhere in the yard.":
    "WASD / ok tuşlarını kullan veya alanda parmağını sürükle.",
  "Get near silver scrap. It joins your orbit and attacks automatically.":
    "Gümüş hurdalara yaklaş. Yörüngene katılıp otomatik saldırırlar.",
  "Scrap fires at the nearest enemy automatically. Collect wreckage to reload.":
    "Hurdalar en yakın düşmana otomatik fırlatılır. Yeniden doldurmak için hurda topla.",
  "Collect blue energy. Each level pauses the yard: choose one of three abilities with a tap or keys 1–3.":
    "Mavi enerji topla. Her seviyede oyun duraklar: dokunarak veya 1–3 tuşlarıyla üç yetenekten birini seç.",
  "Your automatic pulse keeps firing when the orbit is empty. Collect wreckage to rebuild.":
    "Yörünge boşken otomatik darben ateş etmeyi sürdürür. Yeniden güçlenmek için hurda topla.",
  "BACK TO THE YARD": "OYUNA DÖN",
  "Start a fresh shift": "Yeni vardiya başlat",
  "Make room for more trouble.": "Biraz daha güçlen.",
  "Choose with 1, 2, or 3 · Your other abilities keep their upgrades.":
    "1, 2 veya 3 ile seç · Diğer yeteneklerin seviyelerini korur.",
  "SHIFT COMPLETE": "VARDİYA BİTTİ",
  "That's good junk.": "Güzel hurdaydı.",
  "SHIFT TIME": "HAYATTA KALMA",
  "LEVEL REACHED": "ULAŞILAN SEVİYE",
  "ONE MORE SHIFT": "BİR TUR DAHA",
  MOVE: "HAREKET",
  AIM: "NİŞAN AL",
  SPACE: "BOŞLUK",
  LAUNCH: "FIRLAT",
  "ONE ROBOT. ENDLESS POTENTIAL.": "TEK ROBOT. SINIRSIZ POTANSİYEL.",
  "ENDLESS SURVIVAL": "SONSUZ MÜCADELE",
  "A little scrap goes a long way.": "Bir avuç hurda yeter.",
  "The scrapyard keeps going. Collect blue energy, build your abilities, and survive as long as you can.":
    "Hurdalık bitmez. Mavi enerji topla, yeteneklerini geliştir ve dayanabildiğin kadar hayatta kal.",
  "The yard can wait. Your orbit and the swarm are paused.":
    "Hurdalık bekleyebilir. Yörüngen ve düşmanlar duraklatıldı.",
  "Level {level} · Pick one upgrade. The yard is paused.":
    "Seviye {level} · Bir yetenek seç. Oyun duraklatıldı.",
  "{name}, rank {rank}": "{name}, seviye {rank}",
  "20-SECOND BOOST": "20 SANİYELİK TAKVİYE",
  "INSTANT REPAIR": "ANINDA ONARIM",
  "INSTANT REFILL": "ANINDA İKMAL",
  "RANK {rank} → {next}": "SEVİYE {rank} → {next}",
  "NEW ABILITY": "YENİ YETENEK",
  "PRESSURE {wave}": "TEHDİT {wave}",
  "LV. {level}": "SV. {level}",
  "{xp} / {needed} XP": "{xp} / {needed} DP",
  "Level {level}, {xp} of {needed} experience":
    "Seviye {level}, {needed} deneyimin {xp} puanı toplandı",
  "RECHARGING…": "HAZIRLANIYOR…",
  "COLLECT MORE SCRAP": "HURDA TOPLA",
  "TAP TO RELEASE": "FIRLATMAK İÇİN DOKUN",
  "Empty orbit? Your pulse still fires. Collect silver wreckage to rebuild.":
    "Yörünge boş mu? Darben ateş etmeyi sürdürür. Gümüş hurda toplayıp yeniden doldur.",
  "Collect blue energy to level up. Your weapons attack automatically.":
    "Seviye atlamak için mavi enerji topla. Silahların otomatik saldırır.",
  "Try launching your orbit through a crowd. Space or click.":
    "Hurdalarını kalabalığın içine fırlat. Boşluk tuşunu kullan veya tıkla.",
  "Full scrap storm. Aim for a crowd and let it fly.":
    "Yörüngen dolu. Kalabalığa nişan al ve fırlat.",
  "Blue energy upgrades your build. Silver scrap reloads your orbit.":
    "Mavi enerji seni geliştirir. Gümüş hurda yörüngeni doldurur.",
  "BACK TO THE WORKSHOP": "ATÖLYEYE DÖNÜŞ",
  "A few dents. No regrets.": "Biraz ezildik. Pes etmedik.",
  "The swarm got this shift. {launches} scrap launches made it count.":
    "Bu vardiyada sürü kazandı. {launches} kez hurda fırlatarak karşılık verdin.",
  "Your build: {build}": "Yeteneklerin: {build}",
  "Preparing the scrapyard… {progress}%": "Hurdalık hazırlanıyor… %{progress}",
  "The yard couldn’t open.": "Hurdalık açılamadı.",
  "A 3D asset or WebGL failed to load. Please reload in a browser with hardware acceleration enabled.":
    "3B model veya WebGL yüklenemedi. Donanım hızlandırması açık bir tarayıcıda sayfayı yeniden yükle.",
  "TRY AGAIN": "TEKRAR DENE",
  "Junk Magnet 3D scrapyard. Move with WASD, arrow keys, or touch. Attacks are automatic.":
    "Junk Magnet 3B hurdalık. WASD, ok tuşları veya dokunarak hareket et. Saldırılar otomatik.",
  "DRAG TO MOVE · AUTO ATTACK": "SÜRÜKLEYEREK İLERLE · OTOMATİK SALDIRI",
  "Drag anywhere in the yard · Attacks are automatic":
    "Alanda parmağını sürükle · Saldırılar otomatik",
};
Object.assign(turkish, locales.tr);
export const translationCatalogs = {
  tr: turkish,
  de: locales.de,
  fr: locales.fr,
  es: locales.es,
  pt: locales.pt,
};
export function t(
  source: string,
  values: Record<string, string | number> = {},
): string {
  const copy =
    language === "en"
      ? source
      : (translationCatalogs[language][source] ?? source);
  return copy.replace(/\{(\w+)\}/g, (match, key) =>
    String(values[key] ?? match),
  );
}
export function bindStaticTranslations(root: HTMLElement) {
  const texts: { node: Text; source: string }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (turkish[node.data.trim()]) texts.push({ node, source: node.data });
  }
  const attrs: { node: Element; name: string; source: string }[] = [];
  root.querySelectorAll("[aria-label], [title]").forEach((node) => {
    for (const name of ["aria-label", "title"]) {
      const source = node.getAttribute(name);
      if (source && turkish[source]) attrs.push({ node, name, source });
    }
  });
  return () => {
    for (const { node, source } of texts)
      node.data = source.replace(source.trim(), t(source.trim()));
    for (const { node, name, source } of attrs)
      node.setAttribute(name, t(source));
  };
}
export function upgradeName(id: UpgradeId) {
  return t(UPGRADES[id].name);
}
export function localizedUpgradeDescription(s: State, id: UpgradeId): string {
  if (language === "en") return upgradeDescription(s, id);
  const rank = s.upgrades[id],
    next = rank + 1;
  const number = (value: number) =>
    value.toLocaleString(language, { maximumFractionDigits: 1 });
  switch (id) {
    case "saw":
      return t("Blade damage {before} → {after}. Wider, faster orbit.", {
        before: rank + 1,
        after: next + 1,
      });
    case "lightning":
      return rank
        ? t("Chained targets {before} → {after}. More damage.", {
            before: rank + 1,
            after: next + 1,
          })
        : t("Zap 2 enemies every 2.8 seconds for 4 damage each.");
    case "turret":
      return rank
        ? t("Turret damage {before} → {after}. Faster fire, longer life.", {
            before: 2 + rank,
            after: 2 + next,
          })
        : t("Deploy a turret every 8 seconds. Each shot deals 3 damage.");
    case "burst":
      return rank
        ? t(
            "Blast damage {before} → {after}. Larger radius, shorter cooldown.",
            { before: 2 + rank * 2, after: 2 + next * 2 },
          )
        : t("Blast and push back nearby enemies every 5 seconds.");
    case "boots":
      return t("Movement speed +12% (total +{total}%).", { total: next * 12 });
    case "magnet":
      return t("Pickup radius {before} → {after} m.", {
        before: number(3.2 + rank * 0.9),
        after: number(3.2 + next * 0.9),
      });
    case "armor":
      return t("Reduce every contact hit by {amount} damage.", {
        amount: next * 2,
      });
    case "refill":
      return t(
        "Restore all 12 orbiting scrap pieces and reset attack cooldown.",
      );
    case "overclock":
      return t(
        "+25% damage and +15% movement speed for 20 seconds. Refreshes duration.",
      );
    case "repair":
      return t("Restore 35 health now ({before} → {after}).", {
        before: Math.ceil(s.hp),
        after: Math.min(100, Math.ceil(s.hp) + 35),
      });
  }
}
