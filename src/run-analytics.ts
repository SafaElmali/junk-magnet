import type { AnalyticsEvent, AnalyticsProperties } from "./analytics";
import type { State } from "./simulation";

/** One lifecycle per player/run; observations also work with server snapshots. */
export function createRunAnalytics(
  capture: (event: AnalyticsEvent, properties: AnalyticsProperties) => void,
) {
  let current:
    { id: string; mode: string; robot: string; ended: boolean } | undefined;
  let upgrades: State["upgrades"];
  let evolutions: State["evolutions"];
  let milestones = new Set<number>();
  const emit = (event: AnalyticsEvent, properties: AnalyticsProperties) => {
    if (!current) return;
    capture(event, {
      run_id: current.id,
      mode: current.mode,
      robot_id: current.robot,
      ...properties,
    });
  };
  const summary = (state: State) => ({
    duration_seconds: Math.round(state.time),
    kills: state.kills,
    level: state.level,
    wave: state.wave,
    scrap_launched: state.launched,
  });
  return {
    start(
      id: string,
      mode: "solo" | "coop",
      state: State,
      properties: AnalyticsProperties = {},
    ) {
      if (current?.id === id) return;
      current = { id, mode, robot: state.config.robotId, ended: false };
      upgrades = { ...state.upgrades };
      evolutions = { ...state.evolutions };
      milestones = new Set();
      emit("run_started", properties);
    },
    observe(state: State) {
      if (!current || current.ended) return;
      for (const seconds of [30, 60, 180, 300, 600]) {
        if (state.time >= seconds && !milestones.has(seconds)) {
          milestones.add(seconds);
          emit("survival_milestone", {
            milestone_seconds: seconds,
            ...summary(state),
          });
        }
      }
      for (const id of Object.keys(state.upgrades) as Array<
        keyof State["upgrades"]
      >) {
        if (state.upgrades[id] > upgrades[id]) {
          emit("upgrade_selected", {
            upgrade_id: id,
            rank: state.upgrades[id],
            level: state.level,
          });
        }
      }
      for (const id of Object.keys(state.evolutions) as Array<
        keyof State["evolutions"]
      >) {
        if (state.evolutions[id] && !evolutions[id])
          emit("evolution_unlocked", { evolution_id: id, ...summary(state) });
      }
      upgrades = { ...state.upgrades };
      evolutions = { ...state.evolutions };
    },
    complete(state: State, partsEarned: number) {
      if (!current || current.ended || state.phase !== "lost") return;
      current.ended = true;
      emit("run_completed", {
        ...summary(state),
        parts_earned: partsEarned,
        outcome: "defeated",
      });
    },
    abandon(state: State, reason: "restart" | "coop_left" | "mode_changed") {
      if (!current || current.ended) return;
      current.ended = true;
      emit("run_abandoned", { ...summary(state), reason });
    },
  };
}
