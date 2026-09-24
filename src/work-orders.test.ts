import test from "node:test";
import assert from "node:assert/strict";
import { createProgression, loadProgress, ROBOTS, type RunRecord } from "./progression";
import { EVOLUTIONS, type EvolutionId } from "./evolution-core";
import { STAGE_IDS } from "./stages";
import { WORK_ORDER_GROUPS, dueWorkOrders, nextWorkOrder, workOrders } from "./work-orders";

const storage = () => {
  let data: string | null = null;
  return {
    getItem: () => data,
    setItem: (_key: string, value: string) => {
      data = value;
    },
  };
};
let runs = 0;
const run = (changes: Partial<RunRecord> = {}): RunRecord => ({
  runId: `run-${++runs}`,
  phase: "lost",
  stage: "yard",
  daily: null,
  robotId: "scrap",
  time: 30,
  kills: 10,
  level: 2,
  earnedParts: 0,
  bossKills: 0,
  minibossKills: 0,
  eliteKills: 0,
  chestsOpened: 0,
  questsCompleted: 0,
  evolutions: [],
  specializations: 0,
  revivesUsed: 0,
  rerollsUsed: 0,
  banishesUsed: 0,
  partsMultiplier: 1,
  ...changes,
});

test("the catalog has unique ids, every group and about a thousand parts of rewards", () => {
  const orders = workOrders(ROBOTS);
  assert.equal(new Set(orders.map((o) => o.id)).size, orders.length);
  assert.ok(orders.length >= 24 && orders.length <= 32, `${orders.length} orders`);
  for (const group of WORK_ORDER_GROUPS)
    assert.ok(orders.some((o) => o.group === group), group);
  const total = orders.reduce((sum, o) => sum + o.reward, 0);
  assert.ok(total >= 850 && total <= 1100, `${total} parts`);
  for (const o of orders) {
    assert.ok(o.reward >= 10 && o.reward <= 90, o.id);
    assert.ok(o.target >= 1, o.id);
  }
});

test("goals are generic over stages, robots and evolutions", () => {
  const ids = workOrders(ROBOTS).map((o) => o.id);
  for (const stage of STAGE_IDS) assert.ok(ids.includes(`clear-${stage}`), stage);
  for (const robot of ROBOTS.filter((r) => r.cost > 0))
    assert.ok(ids.includes(`robot-${robot.id}`), robot.id);
  const every = workOrders(ROBOTS).find((o) => o.id === "evolve-all")!;
  assert.equal(every.target, Object.keys(EVOLUTIONS).length);
  const some = workOrders(ROBOTS).find((o) => o.id === "evolve-some")!;
  assert.ok(some.target >= 2 && some.target < every.target);
  // A robot added to the table later gets its own order without code changes here.
  const more = [...ROBOTS, { id: "tank", cost: 200 }] as unknown as typeof ROBOTS;
  const extended = workOrders(more);
  assert.ok(extended.some((o) => o.id === "robot-tank"));
  assert.equal(extended.find((o) => o.id === "robots-all")!.target, ROBOTS.length + 1);
});

test("a finished run completes due orders once, pays their rewards and lists them on the receipt", () => {
  const p = createProgression(storage());
  const first = p.recordRun(
    run({ time: 312, kills: 640, level: 21, bossKills: 1, minibossKills: 2, chestsOpened: 3, evolutions: ["vortex"], specializations: 1 }),
  )!;
  const ids = first.orders.map((o) => o.id);
  assert.deepEqual(ids, [
    "survive-2",
    "survive-5",
    "kills-run",
    "miniboss",
    "boss",
    "level-10",
    "level-20",
    "evolve",
    "specialize",
    "chests-run",
  ]);
  const rewards = first.orders.reduce((sum, o) => sum + o.reward, 0);
  assert.equal(first.parts, first.earned + rewards);
  const saved = p.getProgress();
  assert.deepEqual(saved.orders, ids);
  assert.equal(saved.ordersSeen, 0);
  // A weaker run repeats nothing; a later lifetime total completes on its own run.
  assert.deepEqual(p.recordRun(run({ time: 400, kills: 700 }))!.orders, []);
  for (let i = 0; i < 12; i++) p.recordRun(run({ kills: 700 }));
  assert.deepEqual(p.recordRun(run({ kills: 700 }))!.orders.map((o) => o.id), ["kills-10k"]);
  assert.deepEqual(p.markOrdersSeen(), [...ids, "kills-10k"]);
  assert.deepEqual(p.markOrdersSeen(), []);
});

test("robot, evolution, stage and daily goals read lifetime progress", () => {
  const p = createProgression(storage());
  const all = Object.keys(EVOLUTIONS) as EvolutionId[];
  p.recordRun(run({ evolutions: all.slice(0, 1) }));
  const done = p.recordRun(run({ evolutions: all.slice(1), robotId: "volt" }))!.orders.map((o) => o.id);
  assert.ok(done.includes("evolve-some") && done.includes("evolve-all"));
  assert.ok(done.includes("robot-volt"));
  assert.deepEqual(p.getProgress().robotsUsed, ["scrap", "volt"]);
  const cleared = p.recordRun(run({ phase: "won", time: 900 }))!;
  assert.ok(cleared.orders.some((o) => o.id === "clear-yard"));
  assert.equal(cleared.unlockedStage, "night");
  const daily = p.recordRun(run({ daily: "2026-09-24" }))!;
  assert.ok(daily.orders.some((o) => o.id === "daily"));
  assert.equal(daily.daily?.reward, 25);
  for (const day of ["2026-09-25", "2026-09-26"]) p.recordRun(run({ daily: day }));
  assert.equal(p.getProgress().daily.longest, 3);
  assert.ok(p.getProgress().orders.includes("streak-3"));
});

test("the next order is the unfinished goal closest to completion", () => {
  const p = loadProgress(storage());
  assert.ok(nextWorkOrder(p, ROBOTS), "a fresh save still has a goal");
  const veteran = { ...p, bestTime: 462, orders: ["survive-2", "survive-5"] };
  assert.equal(nextWorkOrder(veteran, ROBOTS)?.id, "survive-10");
  assert.deepEqual(dueWorkOrders(veteran, ROBOTS).map((o) => o.id), []);
  // Old saves keep records from before work orders; they complete on the next run.
  const returning = { ...p, bestTime: 700 };
  assert.deepEqual(
    dueWorkOrders(returning, ROBOTS).map((o) => o.id),
    ["survive-2", "survive-5", "survive-10"],
  );
});
