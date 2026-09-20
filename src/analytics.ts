import posthog from "posthog-js";

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | string[]
>;
export type AnalyticsEvent =
  | "game_loaded"
  | "game_load_failed"
  | "run_started"
  | "run_completed"
  | "run_abandoned"
  | "survival_milestone"
  | "upgrade_selected"
  | "evolution_unlocked"
  | "menu_opened"
  | "robot_selected"
  | "robot_unlocked"
  | "workshop_upgrade_purchased"
  | "coop_lobby_opened"
  | "coop_connection_attempted"
  | "coop_lobby_joined"
  | "coop_connection_failed"
  | "setting_changed";

let enabled = false;

export function initAnalytics() {
  // Public ingestion token for the configured project, safe in client bundles.
  const key =
    import.meta.env.VITE_POSTHOG_KEY ??
    "";
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    location.hostname,
  );
  if (
    !key ||
    import.meta.env.VITE_ANALYTICS_DISABLED === "true" ||
    ((import.meta.env.DEV || local) &&
      import.meta.env.VITE_ANALYTICS_DEV !== "true")
  )
    return;
  try {
    posthog.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
      persistence: "localStorage",
    });
    posthog.register({
      app: "junk-magnet",
      analytics_version: 1,
      environment: import.meta.env.DEV || local ? "development" : "production",
    });
    enabled = true;
  } catch {
    // Analytics must never prevent loading or playing the game.
  }
}

export function track(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
) {
  if (!enabled) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* Keep gameplay independent. */
  }
}
