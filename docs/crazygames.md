# CrazyGames release

[Deployment](deployment.md) · [Analytics](analytics.md) · [Asset pipeline](assets.md)

Junk Magnet is in CrazyGames **Basic Launch** (started 23 September 2026, ends 14 October 2026). Promotion to Full Launch is judged on [three metrics](https://docs.crazygames.com/resources/basic-launch-metrics/): average playtime (10+ minutes for strong games), Day 1 retention (10–15%) and conversion, meaning players who play at least one minute (80%+, under 10 s load and under 20 MB build for top games). Updates during Basic Launch are approved automatically, and metrics keep running across versions.

## Release

```sh
npm run publish:crazygames
```

This builds `dist-crazygames/`, opens Chrome on the game's portal page, clicks **Submit new version**, uploads the folder and sets the form: Data Module progress save, mobile support, not multiplayer, SDK muting. The game dashboard sometimes stays on its loading spinner, so the script reloads it after 20 seconds without the button, up to three times. The portal uploads each file separately and keeps **Save** disabled until all are done; the script waits for Save to enable, logging progress, for up to 10 minutes. It then asks before saving; when the terminal is not interactive, it waits for you to click **Save** in the browser. To save without the prompt, for example when an agent runs the release, pass `--save` (or set `CRAZYGAMES_SAVE=1`):

```sh
npm run publish:crazygames -- --save
```

With `--save` the script clicks Save as soon as it is enabled, prints the QA tool URL and closes the browser, which frees the session for another browser to open that URL. The first run asks you to log in (Google, or email if Google rejects the automated browser); the session is kept in `.crazygames-session/`, which is gitignored along with the screenshots the script writes there: the filled form, and the page at any failure. If the portal changes its form, the script fails at the missing control; update the selector in `scripts/publish-crazygames.mjs`.

Saving creates a **Draft** in Game Versions and opens it in the QA tool on crazygames.com/preview; the script prints that URL. Play it (press Play promptly, since its load time runs until the first gameplay start), check its Log and Warnings tabs, then press **Continue**, which opens the QA checklist in a new tab. The checklist is self-attested: answer each requirement, scan **Show QR** to test on a phone, add update notes and confirm. During Basic Launch the update is then approved automatically and goes live. To finish a draft later, click **Submit update** on it in Game Versions. Discard drafts you won't submit.

Release in batches, once or twice a week. The CrazyGames dashboard refreshes daily, so more frequent uploads do not give faster feedback, and each batch is easier to connect to a change in the metrics.

## How the build differs from playjunkmagnet.com

`npm run build:crazygames` (`scripts/build-crazygames.mjs`) runs Vite with `--mode crazygames`:

- Uses the game page (`play/index.html`) as the upload's `index.html`. The playjunkmagnet.com landing page is not included.
- Loads the [HTML5 SDK v3](https://docs.crazygames.com/sdk/intro/) and starts through `src/crazygames-entry.ts`, which initializes the SDK before the game reads saved data.
- Saves progress and settings in the SDK [Data Module](https://docs.crazygames.com/sdk/data/), which syncs across devices for signed-in players. Existing `junk-magnet-*` browser saves are copied in on first launch. If Progress Save is not enabled for the version, or an ad blocker removes the SDK, the game falls back to browser storage.
- Reports `loadingStart`/`loadingStop` around asset loading and `gameplayStart`/`gameplayStop` whenever active play begins or ends (menus, pause, level-up choices and results stop it). The SDK itself throttles calls closer than about one second.
- Follows the CrazyGames mute setting over the in-game sound settings.
- Disables PostHog and co-op. Use the CrazyGames dashboard for metrics.
- Leaves out the web-only guide page, removes the social image, sitemap, `robots.txt` and the favicon (the portal's uploader stalls on `favicon.svg`, and an embedded game shows no tab icon), and Draco-compresses the models (7.7 MB to 1.2 MB). The decoder is copied to `draco/`; the web build keeps uncompressed models and never loads it.

The result is about 13.5 MB in 99 files, within the 50 MB, 1500-file and 20 MB benchmark sizes. The build fails if it exceeds a hard limit, lacks `index.html` or still links to the guide page (the menu's guide link is omitted in this build, since CrazyGames forbids links out of the game).

## Check the build

```sh
npm run build:crazygames
npx vite preview --outDir dist-crazygames --port 5187
node scripts/crazygames-browser.mjs
```

On localhost the SDK runs in `local` mode. The check verifies SDK loading and gameplay events through a play/pause/menu cycle, rendering with the compressed models, migration of an earlier browser save into the Data Module, settings written to the Data Module, no PostHog requests, no failed requests and no page errors.
