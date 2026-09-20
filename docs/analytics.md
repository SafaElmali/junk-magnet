# Game analytics

Junk Magnet uses PostHog for explicit game events. The default public token connects
production builds to [Junk Magnet](https://us.posthog.com/) in
your PostHog organization. The [Game Analytics dashboard](https://us.posthog.com/)
contains ten validated charts. Its timezone is UTC.

Override the public token with `VITE_POSTHOG_KEY` and its ingestion endpoint with
`VITE_POSTHOG_HOST` before building if needed. Copy `.env.example` to `.env` for local configuration; Vite embeds
these values at build time, so changing them requires a rebuild. Never use a
personal API key in a `VITE_` variable.

Tracking is disabled with an explicitly empty token, on localhost, and in Vite development.
For deliberate local QA, set `VITE_ANALYTICS_DEV=true`. Set
`VITE_ANALYTICS_DISABLED=true` to disable tracking entirely. All captures include
`app`, `analytics_version`, and `environment`. The dashboard definitions in
[posthog-charts.json](posthog-charts.json) filter to `environment=production`.

## Events

| Event                        | When and useful properties                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `game_loaded`                | Assets and WebGL ready: `load_duration_ms`, `language`, `graphics_quality`, `input_type`                                       |
| `game_load_failed`           | Boot fails: categorical `stage`, without raw exception contents                                                                |
| `run_started`                | New solo run or first co-op snapshot: `run_id`, `mode`, `robot_id`, language, graphics and input; co-op includes `player_role` |
| `run_completed`              | Defeat, once per player/run: `duration_seconds`, `kills`, `level`, `wave`, `scrap_launched`, `parts_earned`                    |
| `run_abandoned`              | Explicit restart, co-op exit/disconnection, or switch to co-op: run summary and `reason`                                       |
| `survival_milestone`         | Once per run at 30, 60, 180, 300 and 600 gameplay seconds: `milestone_seconds`                                                 |
| `upgrade_selected`           | Accepted upgrade, observed from simulation or authoritative co-op snapshot: `upgrade_id`, `rank`, `level`                      |
| `evolution_unlocked`         | Evolution first becomes active: `evolution_id` and run summary                                                                 |
| `menu_opened`                | Menu changes: `menu`                                                                                                           |
| `robot_selected`             | Successful selection: `robot_id`                                                                                               |
| `robot_unlocked`             | Successful purchase: `robot_id`, `cost_parts`                                                                                  |
| `workshop_upgrade_purchased` | Successful purchase: `upgrade_id`, new `rank`, `cost_parts`                                                                    |
| `coop_lobby_opened`          | Player opens Play Together                                                                                                     |
| `coop_connection_attempted`  | Valid create/join request: `action`                                                                                            |
| `coop_lobby_joined`          | First confirmed lobby response per connection: `action`, `player_role`                                                         |
| `coop_connection_failed`     | One categorized failure per connection attempt: `action`, `reason`                                                             |
| `setting_changed`            | Language or graphics selection: `setting`, `value`                                                                             |

Run events and progression milestones include `run_id`, `mode` and `robot_id`.
Co-op counts **player-runs**: a two-player match produces a start for each player.
No room codes or player coordinates are included in custom properties. Starting
weapons are excluded from upgrade selections. Pausing and resuming preserve the
run ID, and translated result rerenders do not duplicate completion captures.

## Interpretation and privacy

Players are anonymous browser identities, not accounts. Clearing storage or
switching devices creates a different identity. Click autocapture, automatic
pageviews, automatic exception capture and session recording are disabled.
PostHog still attaches its normal browser/session/device properties to custom
events. Analytics failures must not block gameplay.

Closed tabs, crashes and blocked analytics can leave starts without a completion
or abandonment event. The completion count is therefore not a perfect inverse
of abandonment. Survival averages include completed runs only; milestones also
measure longer runs that have not completed. The activation funnel measures
browser-level progression within one hour and can span multiple runs.

## Verification

```sh
npx tsx --test src/run-analytics.test.ts src/progression.test.ts src/coop-session.test.ts
npm run build
```

For the SDK/browser check, start a separate Vite server:

```sh
VITE_POSTHOG_KEY=phc_analytics_browser_test VITE_ANALYTICS_DEV=true npx vite --host 127.0.0.1 --port 5196 --strictPort
node scripts/analytics-browser.mjs
```

The browser check intercepts PostHog requests and verifies real UI captures without
ingesting fake gameplay. It seeds a saved-game fixture for workshop purchases.

SDK reference: [PostHog JavaScript usage](https://posthog.com/docs/libraries/js/usage).
