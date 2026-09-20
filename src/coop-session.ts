import {
  createState,
  update,
  offerUpgrade,
  chooseUpgrade,
  type State,
  type Vec,
  type UpgradeId,
  type GameEvent,
} from "./simulation";
import { updateDiscovery } from "./discovery";
import { ROBOTS, type RunConfig } from "./progression";

/** Workshop saves are local. Accept only known robots and bounded earned bonuses. */
export function coopConfig(value: unknown): RunConfig {
  const v =
    value && typeof value === "object" ? (value as Partial<RunConfig>) : {};
  const robot = ROBOTS.find((r) => r.id === v.robotId) ?? ROBOTS[0];
  const bounded = (n: unknown, max: number) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.max(0, Math.min(max, n))
      : 0;
  return {
    robotId: robot.id,
    startingWeapon: robot.startingWeapon,
    speedMultiplier: robot.speedMultiplier,
    damageMultiplier: robot.damageMultiplier,
    damageReduction: Math.floor(bounded(v.damageReduction, 3)),
    pickupBonus:
      robot.pickupBonus +
      Math.round(
        bounded((v.pickupBonus ?? 0) - robot.pickupBonus, 1.05) / 0.35,
      ) *
        0.35,
  };
}
const sharedKeys = [
  "enemies",
  "pickups",
  "encounters",
  "discovery",
  "rng",
  "nextId",
  "spawned",
  "spawnTimer",
  "kills",
  "earnedParts",
] as const;
function share(from: State, to: State) {
  for (const key of sharedKeys)
    (to as unknown as Record<string, unknown>)[key] = from[key];
}
export type PartnerState = Pick<
  State,
  | "player"
  | "facing"
  | "hp"
  | "scrap"
  | "time"
  | "config"
  | "upgrades"
  | "immunity"
> & { revive: number };
export type CoopSnapshot = {
  type: "snapshot";
  runId: string;
  state: State;
  partner: PartnerState;
  down: boolean;
  revive: number;
  events: GameEvent[];
};

/** One authoritative world; actors retain their own combat timers and upgrade queue. */
export class CoopSession {
  players: [State, State];
  revive = [0, 0];
  finished = false;
  constructor(
    configs: [RunConfig, RunConfig],
    public runId: string,
  ) {
    this.players = [
      createState(coopConfig(configs[0])),
      createState(coopConfig(configs[1])),
    ];
    this.players[0].player.x = -1;
    this.players[1].player.x = 1;
    for (const p of this.players) p.phase = "playing";
    share(this.players[0], this.players[1]);
  }
  tick(dt: number, inputs: [Vec, Vec]) {
    if (this.finished) return;
    dt = Math.min(0.05, Math.max(0, dt));
    if (!dt) return;
    const beforeXP = this.players.map((p) => p.xp);
    const time = this.players[0].time + dt;
    const living = this.players.filter((p) => p.hp > 0);
    let authority = this.players[0];
    for (const p of this.players) {
      share(authority, p);
      if (p.hp > 0) p.phase = "playing";
    }
    for (const p of living) {
      share(authority, p);
      // Other actors must see the latest shared encounter arrays before choosing a target.
      for (const other of this.players) share(p, other);
      update(p, dt, inputs[this.players.indexOf(p)], {
        world: p === living[0],
        players: this.players,
        deferUpgrade: true,
        deferDiscovery: true,
        spawnMultiplier: 1.5,
      });
      authority = p;
    }
    for (const p of this.players) {
      share(authority, p);
      p.time = time;
    }
    const alive = this.players.filter((p) => p.hp > 0);
    const partsBefore = this.players.map((p) => p.earnedParts);
    if (alive.length) updateDiscovery(alive[0], dt, alive);
    const totalParts =
      partsBefore[0] +
      this.players.reduce(
        (sum, p, i) => sum + p.earnedParts - partsBefore[i],
        0,
      );
    const xpGained = this.players.reduce(
      (sum, p, i) => sum + Math.max(0, p.xp - beforeXP[i]),
      0,
    );
    for (let i = 0; i < 2; i++) {
      const p = this.players[i],
        other = this.players[1 - i];
      p.xp = beforeXP[i] + xpGained;
      p.earnedParts = totalParts;
      if (p.hp <= 0) {
        p.phase = "lost";
        p.shots = [];
        p.turrets = []; // A disabled robot cannot leave suspended projectiles in the yard.
        const near =
          other.hp > 0 &&
          Math.hypot(other.player.x - p.player.x, other.player.z - p.player.z) <
            2.3;
        this.revive[i] = near ? this.revive[i] + dt : 0;
        if (this.revive[i] >= 3) {
          p.hp = 40;
          p.immunity = 2;
          p.phase = "playing";
          this.revive[i] = 0;
        }
      }
      if (p.hp > 0) {
        offerUpgrade(p);
        p.phase = "playing";
      }
    }
    this.finished = this.players.every((p) => p.hp <= 0);
  }
  choose(index: number, id: UpgradeId, level: number) {
    const p = this.players[index];
    if (
      !p ||
      this.finished ||
      p.hp <= 0 ||
      p.level !== level ||
      !p.choices.includes(id)
    )
      return false;
    p.phase = "upgrade";
    const chosen = chooseUpgrade(p, id);
    p.phase = "playing";
    return chosen;
  }
  snapshot(index: number): CoopSnapshot {
    const p = this.players[index],
      partner = this.players[1 - index];
    const events = this.players.flatMap((actor, i) =>
      actor.events.filter(
        (e) => i === index || !["hurt", "collect"].includes(e.kind),
      ),
    );
    return {
      type: "snapshot",
      runId: this.runId,
      down: p.hp <= 0 && !this.finished,
      revive: this.revive[index],
      events,
      state: {
        ...p,
        phase: this.finished ? "lost" : "playing",
        events: [],
        shots: this.players.flatMap((a) => a.shots),
        turrets: this.players.flatMap((a) => a.turrets),
        discovery: {
          ...p.discovery,
          points: [...p.discovery.points]
            .sort(
              (a, b) =>
                Math.hypot(a.x - p.player.x, a.z - p.player.z) -
                Math.hypot(b.x - p.player.x, b.z - p.player.z),
            )
            .slice(0, 11),
        },
      },
      partner: {
        player: { ...partner.player },
        facing: { ...partner.facing },
        hp: partner.hp,
        scrap: partner.scrap,
        time: partner.time,
        config: partner.config,
        upgrades: partner.upgrades,
        immunity: partner.immunity,
        revive: this.revive[1 - index],
      },
    };
  }
  clearEvents() {
    for (const p of this.players) p.events = [];
  }
}
