import {
  upgradeDescription,
  UPGRADES,
  type State,
  type UpgradeId,
} from "./simulation";

export type Language = "en" | "tr";
export function resolveLanguage(
  saved: string | null,
  browser = "en",
): Language {
  return saved === "tr" || saved === "en"
    ? saved
    : browser.toLowerCase().startsWith("tr")
      ? "tr"
      : "en";
}
let saved: string | null = null;
try {
  saved = localStorage.getItem("junk-magnet-language");
} catch {
  /* Storage is optional. */
}
let language: Language = resolveLanguage(
  saved,
  typeof navigator === "undefined" ? "en" : navigator.language,
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
  "Level up": "Seviye atladın",
  "Level {level} · Choose one upgrade.": "Seviye {level} · Bir yetenek seç.",
  "THE SWARM IS YOUR AMMO.": "SÜRÜ SENİN CEPHANEN.",
  "THE SCRAPYARD": "HURDALIK",
  "ENDLESS SHIFT": "SONSUZ VARDİYA",
  "Game controls": "Oyun kontrolleri",
  "Enable sound": "Sesi aç",
  "Mute sound": "Sesi kapat",
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
  "Move with WASD or arrows · Space to launch":
    "WASD veya oklarla hareket et · Boşluk ile fırlat",
  "SCRAP ORBIT": "HURDA YÖRÜNGESİ",
  "Your orbit attacks automatically. Get close to loose scrap.":
    "Yörüngendeki hurdalar otomatik saldırır. Yerdeki hurdalara yaklaş.",
  "LAUNCH SCRAP": "HURDA FIRLAT",
  "SPACE / CLICK": "BOŞLUK / TIKLA",
  "Movement joystick": "Hareket çubuğu",
  "Taking a breather.": "Biraz soluklan.",
  Move: "Hareket",
  Collect: "Toplama",
  Launch: "Fırlatma",
  Upgrade: "Geliştirme",
  Recover: "Toparlanma",
  "WASD / arrow keys, or drag anywhere in the yard.":
    "WASD / ok tuşlarını kullan veya alanda parmağını sürükle.",
  "Get near silver scrap. It joins your orbit and attacks automatically.":
    "Gümüş hurdalara yaklaş. Yörüngene katılıp otomatik saldırırlar.",
  "Aim with the pointer, then click or press Space. Without a pointer, move toward your target first.":
    "Fareyle nişan al, ardından tıkla veya Boşluk tuşuna bas. Dokunmatik ekranda önce hedefe doğru hareket et.",
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
  "Junk Magnet 3D scrapyard. Move with WASD or arrow keys and launch scrap with Space.":
    "Junk Magnet 3B hurdalık. WASD veya ok tuşlarıyla hareket et, Boşluk ile hurda fırlat.",
  "DRAG TO MOVE · TAP TO LAUNCH": "SÜRÜKLEYEREK İLERLE · DOKUNARAK FIRLAT",
  "Drag anywhere in the yard · Tap Launch to fire":
    "Alanda parmağını sürükle · Ateş etmek için Fırlat’a dokun",
};
export function t(
  source: string,
  values: Record<string, string | number> = {},
): string {
  const copy = language === "tr" ? (turkish[source] ?? source) : source;
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
const names: Record<UpgradeId, string> = {
  saw: "Yörünge Testereleri",
  lightning: "Zincir Şimşek",
  turret: "Hurda Tareti",
  burst: "Manyetik Patlama",
  boots: "Turbo Paletler",
  magnet: "Toplayıcı Mıknatıs",
  armor: "Çelik Zırh",
  repair: "Saha Onarımı",
  refill: "Hurda İkmali",
  overclock: "Aşırı Güç",
};
export function upgradeName(id: UpgradeId) {
  return language === "tr" ? names[id] : UPGRADES[id].name;
}
export function localizedUpgradeDescription(s: State, id: UpgradeId): string {
  if (language === "en") return upgradeDescription(s, id);
  const rank = s.upgrades[id],
    next = rank + 1;
  switch (id) {
    case "saw":
      return `Testere hasarı ${rank + 1} → ${next + 1}. Daha geniş ve hızlı yörünge.`;
    case "lightning":
      return rank
        ? `Zincirin vurduğu hedef sayısı ${rank + 1} → ${next + 1}. Daha yüksek hasar.`
        : "Her 2,8 saniyede 2 düşmana 4’er hasar veren şimşek çakar.";
    case "turret":
      return rank
        ? `Taret hasarı ${2 + rank} → ${2 + next}. Daha hızlı ateş eder, daha uzun dayanır.`
        : "Her 8 saniyede bir taret kurar. Her atış 3 hasar verir.";
    case "burst":
      return rank
        ? `Patlama hasarı ${2 + rank * 2} → ${2 + next * 2}. Daha geniş alan, daha kısa bekleme.`
        : "Her 5 saniyede yakındaki düşmanlara hasar verir ve onları geri iter.";
    case "boots":
      return `Hareket hızı +%12 (toplam +%${next * 12}).`;
    case "magnet":
      return `Toplama yarıçapı ${(3.2 + rank * 0.9).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} → ${(3.2 + next * 0.9).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m.`;
    case "armor":
      return `Her temasın verdiği hasarı ${next * 2} azaltır.`;
    case "refill":
      return "Yörüngendeki 12 hurdayı doldurur ve fırlatma beklemesini sıfırlar.";
    case "overclock":
      return "20 saniye boyunca +%25 hasar ve +%15 hareket hızı. Tekrar seçmek süreyi yeniler.";
    case "repair":
      return `Hemen 35 can yeniler (${Math.ceil(s.hp)} → ${Math.min(100, Math.ceil(s.hp) + 35)}).`;
  }
}
