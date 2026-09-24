# CrazyGames agent release

[CrazyGames release](crazygames.md) · [Deployment](deployment.md)

How an agent such as Claude Code ships a CrazyGames release from start to finish. The steps follow [CrazyGames release](crazygames.md#release); this page covers what changes when nobody is at the terminal. The QA checklist is an attestation made in the developer's name, and its last step puts the update live, so the agent verifies what it can and asks about the rest.

Ask the developer before:

- starting a release (releases go out in batches, once or twice a week),
- answering any checklist item the agent did not verify itself,
- the final **Continue** that puts the update live, showing the checklist answers and update notes.

## Before you start

Work from an up-to-date `main`. The portal session lives in the main checkout's `.crazygames-session/`. From a git worktree, link it instead of logging in again:

```sh
ln -s "$(git rev-parse --path-format=absolute --git-common-dir)/../.crazygames-session" .crazygames-session
```

Git lists the link as untracked, since the ignore rule matches only a directory; remove it when you are done. If the session has expired, the script waits for a login in its browser window. The developer has to do that; agents don't enter passwords.

## 1. Upload and save

```sh
npm run publish:crazygames -- --save
```

The script builds, uploads, fills the form, clicks **Save** once it is enabled, prints `Saved. QA tool: <url>` and closes its browser, which frees the session for step 2. Build and upload take a few minutes, so run it in the background and read its output. While uploading it logs `Still uploading after N s (M requests)…` every 15 seconds; if the request count stops rising, the upload has stalled.

On failure the script exits with an error and leaves a screenshot in `.crazygames-session/`:

| Message | Screenshot | Next step |
| --- | --- | --- |
| The game dashboard did not load after 3 reloads. | `dashboard.png` | Check the screenshot; the portal may be down. Rerun later. |
| Upload did not finish in 10 minutes. | `upload-timeout.png` | Nothing was saved. A file may be stalling the uploader, as `favicon.svg` once did; find it and rerun. |
| Clicked Save, but the QA tool did not open within 2 minutes | `save.png` | Look in Game Versions for the new draft and open it with **Submit update**. |
| A Playwright timeout on a form control | none | The portal changed its form; update the selector in `scripts/publish-crazygames.mjs`. |

## 2. Play the build in the QA tool

Open the printed URL in a headed Playwright persistent context on the same session:

```js
import { chromium } from "@playwright/test";

const context = await chromium.launchPersistentContext(".crazygames-session", {
  channel: "chrome",
  headless: false,
  viewport: null,
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(qaToolUrl);
```

Don't use Claude in Chrome here: its tabs report `document.hidden`, so the game never starts. Playwright turns off background throttling.

Press Play promptly, since the QA tool's load time runs until the first gameplay start. Play a short run, then read the **Log** and **Warnings** tabs and report anything in them to the developer. **Continue** opens the checklist on developer.crazygames.com/qa-continue in a new tab (`context.waitForEvent("page")`).

## 3. Answer the checklist

The checklist is a table of Yes/No requirements, one `<tr>` per item. Find a row with `page.locator("tr").filter({ hasText: "…" })`: labels that contain a **Docs** or **Show QR** link don't match exact text.

Answer only what you checked in step 2. Ask the developer about the rest, which includes at least browsers other than Chrome and phone testing through **Show QR**. Answers from an earlier release don't carry over. Write the update notes from the commits since the last release, in player terms.

Show the developer the answers and notes. After they confirm, tick the confirmation box and press **Continue**. During Basic Launch the update is approved automatically and goes live straight away.

## 4. Clean up

Close the Playwright browser and remove the `.crazygames-session` link from the worktree. Report the build id (`gameBuildId` in the QA tool URL) to the developer. Ask before discarding drafts left in Game Versions.
