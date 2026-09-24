import type { AnalyticsEvent, AnalyticsProperties } from "./analytics";
import type { State } from "./simulation";

// 900 s is the final boss: the share of runs that reach the stage clear.
const MILESTONES = [30, 60, 180, 300, 600, 900];
/** One lifecycle per player/run; observations also work with server snapshots. */
export function createRunAnalytics(
  capture: (event: AnalyticsEvent, properties: AnalyticsProperties) => void,
) {
  let current:
    | { id: string; mode: string; robot: string; stage: string; ended: boolean }
    | undefined;
  let upgrades: State["upgrades"];
  let evolutions: State["evolutions"];
  let milestones = new Set<number>();
  const emit = (event: AnalyticsEvent, properties: AnalyticsProperties) => {
    if (!current) return;
    capture(event, {
      run_id: current.id,
      mode: current.mode,
      robot_id: current.robot,
      stage: current.stage,
      ...properties,
    });
  };
  const summary = (state: State) => ({
    duration_seconds: Math.round(state.time),
    kills: state.kills,
    level: state.level,
    wave: state.wave,
    scrap_launched: state.launched,
    boss_kills: state.stats?.bossKills ?? 0,
    revives_used: state.stats?.revivesUsed ?? 0,
    rerolls_used: state.stats?.rerollsUsed ?? 0,
    banishes_used: state.stats?.banishesUsed ?? 0,
  });
  return {
    start(
      id: string,
      mode: "solo" | "coop",
      state: State,
      properties: AnalyticsProperties = {},
    ) {
      if (current?.id === id) return;
      current = {
        id,
        mode,
        robot: state.config.robotId,
        stage: state.config.stage ?? "yard",
        ended: false,
      };
      upgrades = { ...state.upgrades };
      evolutions = { ...state.evolutions };
      milestones = new Set();
      emit("run_started", properties);
    },
    /** A solo run restored after a reload: no second start or passed milestones. */
    resume(id: string, state: State, properties: AnalyticsProperties = {}) {
      if (current?.id === id) return;
      current = { id, mode: "solo", robot: state.config.robotId, ended: false };
      upgrades = { ...state.upgrades };
      evolutions = { ...state.evolutions };
      milestones = new Set(MILESTONES.filter((seconds) => state.time >= seconds));
      emit("run_resumed", { ...summary(state), ...properties });
    },
    observe(state: State) {
      if (!current || current.ended) return;
      for (const seconds of MILESTONES) {
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
      if (
        !current ||
        current.ended ||
        (state.phase !== "lost" && state.phase !== "won")
      )
        return;
      current.ended = true;
      emit("run_completed", {
        ...summary(state),
        parts_earned: partsEarned,
        outcome: state.phase === "won" ? "cleared" : "defeated",
      });
    },
    abandon(state: State, reason: "restart" | "coop_left" | "mode_changed") {
      if (!current || current.ended) return;
      current.ended = true;
      emit("run_abandoned", { ...summary(state), reason });
    },
  };
}
