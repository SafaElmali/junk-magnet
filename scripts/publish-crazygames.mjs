// Uploads dist-crazygames/ as a new version in the CrazyGames developer portal
// (`npm run publish:crazygames` builds first). The first run asks you to log in
// in the opened browser; the session stays in .crazygames-session/ (gitignored).
// Nothing is saved without confirmation: answer the terminal prompt, or click
// Save in the browser yourself when the terminal is not interactive.
import { chromium } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const GAME =
  "https://developer.crazygames.com/games/YOUR_CRAZYGAMES_GAME_ID";
const build = resolve("dist-crazygames");
if (!existsSync(`${build}/index.html`))
  throw new Error("Missing dist-crazygames/. Run npm run build:crazygames.");

const context = await chromium.launchPersistentContext(".crazygames-session", {
  channel: "chrome",
  headless: false,
  viewport: null,
});
const page = context.pages()[0] ?? (await context.newPage());
const minutes = (n) => n * 60_000;

await page.goto(GAME);
if (new URL(page.url()).pathname.startsWith("/login")) {
  console.log("Log in to CrazyGames in the browser window (Google or email).");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: minutes(10),
  });
  await page.goto(GAME);
}
await page.getByRole("button", { name: "Submit new version" }).first().click();

// The portal uploads each file separately; wait until the network is quiet.
const input = page.locator('input[type="file"]');
await input.waitFor({ state: "attached" });
let inFlight = 0;
const track = (delta) => () => (inFlight += delta);
page.on("request", track(1));
page.on("requestfinished", track(-1));
page.on("requestfailed", track(-1));
const files = readdirSync(build, { recursive: true, withFileTypes: true });
console.log(`Uploading ${files.filter((f) => f.isFile()).length} files…`);
await input.setInputFiles(build);
for (let quiet = 0, waited = 0; quiet < 3; waited++) {
  if (waited > 600) throw new Error("Upload did not finish in 10 minutes.");
  await page.waitForTimeout(1000);
  quiet = inFlight <= 0 ? quiet + 1 : 0;
}

// Current integration: Data Module saves, SDK muting, mobile, single-player.
await page.locator('input[type="radio"][value="SDKPS"]').check();
await page.getByLabel("The game supports mobile devices").setChecked(true);
await page
  .getByLabel("The game is an online multiplayer game")
  .setChecked(false);
await page
  .getByLabel("The game supports CrazyGames muting audio through SDK")
  .setChecked(true);
// Portal screenshots show account details; keep them with the ignored session.
const shot = ".crazygames-session/upload.png";
await page.screenshot({ path: shot, fullPage: true });
console.log(`Form filled. Screenshot: ${shot}`);

if (process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Save this version on CrazyGames? [y/N] ");
  rl.close();
  if (answer.trim().toLowerCase() === "y") {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    console.log("Saved. Check the portal for any remaining step.");
  } else console.log("Not saved.");
} else console.log("Review the form, then click Save in the browser window.");
console.log("Close the browser window when you are done.");
await new Promise((done) => context.on("close", done));
