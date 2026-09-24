import {
  LANGUAGES,
  languageFlag,
  preferredLanguage,
  saveLanguage,
  type Language,
} from "../languages";
import { landingCopy } from "./landing-locales";

// index.html ships in English. Keep each translatable text node and label with its
// English source, so the page can switch languages any number of times.
const texts: { node: Text; source: string }[] = [];
const walker = document.createTreeWalker(
  document.documentElement,
  NodeFilter.SHOW_TEXT,
);
while (walker.nextNode()) {
  const node = walker.currentNode as Text;
  if (landingCopy.has(node.data.trim()))
    texts.push({ node, source: node.data });
}
const labels: { node: Element; name: string; source: string }[] = [];
for (const node of document.querySelectorAll("[alt], [aria-label]"))
  for (const name of ["alt", "aria-label"]) {
    const source = node.getAttribute(name);
    if (source && landingCopy.has(source)) labels.push({ node, name, source });
  }

const switcher = document.querySelector<HTMLElement>(".language")!;
const toggle = switcher.querySelector<HTMLButtonElement>(".language-toggle")!;
const menu = switcher.querySelector<HTMLElement>(".language-menu")!;
const chevron =
  '<svg class="language-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
menu.innerHTML = LANGUAGES.map(
  ({ code, name }) =>
    `<button class="language-option" type="button" data-language="${code}" lang="${code}">${languageFlag(code)}<span>${name}</span></button>`,
).join("");
const options = [
  ...menu.querySelectorAll<HTMLButtonElement>("[data-language]"),
];
let language = preferredLanguage();
const t = (source: string) => landingCopy.get(source)?.[language] ?? source;

function render() {
  document.documentElement.lang = language;
  for (const { node, source } of texts)
    node.data = source.replace(source.trim(), t(source.trim()));
  for (const { node, name, source } of labels)
    node.setAttribute(name, t(source));
  const { name } = LANGUAGES.find(({ code }) => code === language)!;
  toggle.innerHTML = `${languageFlag(language)}<span>${language.toUpperCase()}</span>${chevron}`;
  toggle.setAttribute(
    "aria-label",
    t("Language: {language}").replace("{language}", name),
  );
  for (const option of options)
    option.setAttribute(
      "aria-pressed",
      String(option.dataset.language === language),
    );
}

function setOpen(open: boolean) {
  menu.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
}

toggle.addEventListener("click", () => {
  setOpen(menu.hidden);
  if (!menu.hidden)
    options.find((option) => option.dataset.language === language)!.focus();
});
menu.addEventListener("click", (event) => {
  const option = (event.target as Element).closest<HTMLButtonElement>(
    "[data-language]",
  );
  if (!option) return;
  language = option.dataset.language as Language;
  saveLanguage(language);
  render();
  setOpen(false);
  toggle.focus();
});
switcher.addEventListener("keydown", (event) => {
  if (menu.hidden) return;
  if (event.key === "Escape") {
    setOpen(false);
    toggle.focus();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    options[(index + step + options.length) % options.length].focus();
  }
});
// Close when keyboard focus moves on or the pointer goes down elsewhere. A focusout
// without a new target (Safari does not focus clicked buttons) is left to the click.
switcher.addEventListener("focusout", (event) => {
  const next = event.relatedTarget as Node | null;
  if (next && !switcher.contains(next)) setOpen(false);
});
document.addEventListener("pointerdown", (event) => {
  if (!switcher.contains(event.target as Node)) setOpen(false);
});
// The game at /play/ shares this preference: follow a change made there when the
// visitor comes Back to this page or has it open in another tab.
for (const type of ["pageshow", "storage"])
  addEventListener(type, () => {
    const next = preferredLanguage();
    if (next === language) return;
    language = next;
    render();
  });

render();
switcher.hidden = false;
