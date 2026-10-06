// Uploads dist-crazygames/ as a new version in the CrazyGames developer portal
// (`npm run publish:crazygames` builds first). The first run asks you to log in
// in the opened browser; the session stays in .crazygames-session/ (gitignored).
// Nothing is saved without confirmation: answer the terminal prompt, click Save
// in the browser yourself, or pass --save (or set CRAZYGAMES_SAVE=1) to save as
// soon as the upload finishes, print the QA tool URL and close the browser.
import { chromium, expect } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) loadEnvFile();
const gameId = process.env.CRAZYGAMES_GAME_ID?.trim();
if (!gameId)
  throw new Error(
    "Set CRAZYGAMES_GAME_ID in your environment or .env before publishing.",
  );
const GAME = `https://developer.crazygames.com/games/${encodeURIComponent(gameId)}`;
const build = resolve("dist-crazygames");
if (!existsSync(`${build}/index.html`))
  throw new Error("Missing dist-crazygames/. Run npm run build:crazygames.");
const autoSave =
  process.argv.includes("--save") || process.env.CRAZYGAMES_SAVE === "1";

const context = await chromium.launchPersistentContext(".crazygames-session", {
  channel: "chrome",
  headless: false,
  viewport: null,
});
const page = context.pages()[0] ?? (await context.newPage());
const seconds = (n) => n * 1000;
const minutes = (n) => n * 60_000;
// Portal screenshots show account details; keep them with the ignored session.
const screenshot = async (name) => {
  const path = `.crazygames-session/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
};
const fail = async (name, message) => {
  throw new Error(`${message} Screenshot: ${await screenshot(name)}`);
};

await page.goto(GAME);
if (new URL(page.url()).pathname.startsWith("/login")) {
  console.log("Log in to CrazyGames in the browser window (Google or email).");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: minutes(10),
  });
  await page.goto(GAME);
}
// The dashboard sometimes stays on its loading spinner; a reload fixes it.
const submit = page.getByRole("button", { name: "Submit new version" }).first();
for (let reloads = 0; ; reloads++) {
  const shown = await submit.waitFor({ timeout: seconds(20) }).then(
    () => true,
    () => false,
  );
  if (shown) break;
  if (reloads === 3)
    await fail("dashboard", "The game dashboard did not load after 3 reloads.");
  console.log(`Dashboard still loading; reloading (${reloads + 1}/3)…`);
  await page.reload();
}
await submit.click();

const input = page.locator('input[type="file"]');
await input.waitFor({ state: "attached" });
const save = page.getByRole("button", { name: /^Save/ });
let requests = 0;
page.on("requestfinished", () => requests++);
const files = readdirSync(build, { recursive: true, withFileTypes: true });
console.log(`Uploading ${files.filter((f) => f.isFile()).length} files…`);
await input.setInputFiles(build);
// The portal uploads each file separately and keeps Save disabled until all
// are done. In case Save starts out enabled, give it a moment to disable.
await expect(save)
  .toBeDisabled({ timeout: seconds(10) })
  .catch(() => {});
for (let waited = 0; !(await save.isEnabled()); waited++) {
  if (waited === 600)
    await fail("upload-timeout", "Upload did not finish in 10 minutes.");
  if (waited && waited % 15 === 0)
    console.log(`Still uploading after ${waited} s (${requests} requests)…`);
  await page.waitForTimeout(1000);
}
console.log("Upload finished.");

// Current integration: Data Module saves, SDK muting, mobile, single-player.
await page.locator('input[type="radio"][value="SDKPS"]').check();
await page.getByLabel("The game supports mobile devices").setChecked(true);
await page
  .getByLabel("The game is an online multiplayer game")
  .setChecked(false);
await page
  .getByLabel("The game supports CrazyGames muting audio through SDK")
  .setChecked(true);
console.log(`Form filled. Screenshot: ${await screenshot("upload")}`);

// Saving creates a draft and turns Save into "Go to QA", which opens the draft
// in the QA tool on crazygames.com/preview in this tab. (Until September 2026
// the portal opened the QA tool straight after Save; both are handled.)
const goToQA = page.getByRole("button", { name: /^Go to QA/ });
const inQATool = (url) => url.pathname.startsWith("/preview/");
const saveVersion = async () => {
  await save.click();
  const saved = await Promise.race([
    goToQA.waitFor({ timeout: minutes(2) }).then(() => "draft"),
    page
      .waitForURL(inQATool, { timeout: minutes(2), waitUntil: "commit" })
      .then(() => "qa-tool"),
  ]).catch(() => null);
  if (saved === "draft") {
    await goToQA.click();
    await page
      .waitForURL(inQATool, { timeout: minutes(1), waitUntil: "commit" })
      .catch(() => {});
  }
  if (inQATool(new URL(page.url())))
    console.log(`Saved. QA tool: ${page.url()}`);
  else {
    process.exitCode = 1;
    console.error(
      (saved
        ? "Saved, but Go to QA did not open the QA tool within 1 minute; "
        : "Clicked Save, but the draft was not saved within 2 minutes; ") +
        `check Game Versions for the draft. Screenshot: ${await screenshot("save")}`,
    );
  }
};

if (autoSave) {
  await saveVersion();
  // Free the session profile so another browser can open the QA tool with it.
  await context.close();
} else {
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("Save this version on CrazyGames? [y/N] ");
    rl.close();
    if (answer.trim().toLowerCase() === "y") await saveVersion();
    else console.log("Not saved.");
  } else
    console.log(
      "Review the form, then click Save in the browser window " +
        "(or rerun with --save to save automatically).",
    );
  console.log("Close the browser window when you are done.");
  await new Promise((done) => context.on("close", done));
}
