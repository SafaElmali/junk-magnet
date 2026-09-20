import { test } from "node:test";
import assert from "node:assert/strict";
import { createRunAnalytics } from "./run-analytics";
import { createState, chooseUpgrade } from "./simulation";
import type { AnalyticsEvent, AnalyticsProperties } from "./analytics";

function setup() {
  const events: { event: AnalyticsEvent; properties: AnalyticsProperties }[] =
    [];
  const analytics = createRunAnalytics((event, properties) =>
    events.push({ event, properties }),
  );
  return { events, analytics, state: createState() };
}

test("resuming and rerendering results cannot duplicate a run", () => {
  const { analytics, events, state } = setup();
  analytics.start("one", "solo", state);
  analytics.start("one", "solo", state);
  analytics.complete(state, 0);
  assert.equal(events.length, 1);
  state.phase = "lost";
  state.time = 74;
  analytics.complete(state, 6);
  analytics.complete(state, 6);
  analytics.abandon(state, "restart");
  assert.deepEqual(
    events.map((e) => e.event),
    ["run_started", "run_completed"],
  );
  assert.equal(events[1].properties.duration_seconds, 74);
  assert.equal(events[1].properties.parts_earned, 6);
});

test("milestones fire once across repeated observations and reset on replay", () => {
  const { analytics, events, state } = setup();
  analytics.start("one", "solo", state);
  state.time = 181;
  analytics.observe(state);
  analytics.observe(state);
  assert.deepEqual(
    events
      .filter((e) => e.event === "survival_milestone")
      .map((e) => e.properties.milestone_seconds),
    [30, 60, 180],
  );
  analytics.abandon(state, "restart");
  const next = createState();
  analytics.start("two", "solo", next);
  next.time = 30;
  analytics.observe(next);
  assert.equal(events.at(-1)?.properties.run_id, "two");
});

test("track accepted upgrades, including repeatable supplies, not starting weapons", () => {
  const { analytics, events, state } = setup();
  analytics.start("one", "solo", state);
  analytics.observe(state);
  for (let i = 0; i < 2; i++) {
    state.phase = "upgrade";
    state.choices = ["repair"];
    assert.equal(chooseUpgrade(state, "repair"), true);
    analytics.observe(state);
    analytics.observe(state);
  }
  assert.deepEqual(
    events
      .filter((e) => e.event === "upgrade_selected")
      .map((e) => e.properties.rank),
    [1, 2],
  );
});

test("co-op snapshots count confirmed changes and leave only once", () => {
  const { analytics, events, state } = setup();
  analytics.start("shared", "coop", state, { player_role: "guest" });
  const snapshot = structuredClone(state);
  snapshot.upgrades.lightning = 1;
  analytics.observe(snapshot);
  analytics.observe(structuredClone(snapshot));
  analytics.abandon(snapshot, "coop_left");
  analytics.abandon(snapshot, "coop_left");
  snapshot.phase = "lost";
  analytics.complete(snapshot, 4);
  assert.deepEqual(
    events.map((e) => e.event),
    ["run_started", "upgrade_selected", "run_abandoned"],
  );
  assert.ok(events.every((e) => e.properties.mode === "coop"));
});
