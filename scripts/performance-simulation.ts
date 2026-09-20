import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createState, update, chooseUpgrade, ENTITY_LIMITS, type UpgradeId } from '../src/simulation';

// node --expose-gc --import tsx scripts/performance-simulation.ts
// Protected player makes a sustained workload possible; this is not a survival score.
assert.ok(global.gc, 'Run with --expose-gc');
const output = process.env.PERF_OUTPUT ?? '.impeccable/review/performance';
const priority: UpgradeId[] = ['lightning', 'burst', 'turret', 'saw', 'armor', 'magnet', 'boots', 'repair'];
const state = createState();
state.phase = 'playing';
const timings: number[] = [];
const samples: unknown[] = [];
const peaks = { enemies: 0, pickups: 0, shots: 0, turrets: 0, events: 0 };
let nextSample = 0;
let movement = { x: 0, z: 0 };
global.gc();
const startHeapMiB = process.memoryUsage().heapUsed / 2 ** 20;
const start = performance.now();
const cpu = process.cpuUsage();
for (let frame = 0; state.time < 12 * 60 && frame < 13 * 60 * 60; frame++) {
  if (state.phase === 'upgrade') {
    const choice = priority.find(id => state.choices.includes(id)) ?? state.choices[0];
    assert.ok(choice);
    assert.ok(chooseUpgrade(state, choice));
  }
  state.immunity = 100;
  // Reconsider movement at 4 Hz, outside the measured simulation update.
  if (frame % 15 === 0) {
    let target: { x: number; z: number } | undefined;
    let closest = Infinity;
    for (const pickup of state.pickups) {
      const d = Math.hypot(pickup.x - state.player.x, pickup.z - state.player.z);
      if (pickup.kind === 'xp' && d < closest) { closest = d; target = pickup; }
    }
    const dx = target ? target.x - state.player.x : Math.cos(state.time / 12);
    const dz = target ? target.z - state.player.z : Math.sin(state.time / 6);
    const length = Math.hypot(dx, dz) || 1;
    movement = { x: dx / length, z: dz / length };
  }
  const before = performance.now();
  update(state, 1 / 60, movement);
  timings.push(performance.now() - before);
  assert.notEqual(state.phase, 'lost', 'Protected stress fixture must remain alive');
  for (const key of Object.keys(peaks) as (keyof typeof peaks)[]) {
    peaks[key] = Math.max(peaks[key], state[key].length);
    assert.ok(state[key].length <= ENTITY_LIMITS[key], `${key} exceeds its cap`);
  }
  state.events = [];
  if (state.time >= nextSample) {
    global.gc();
    samples.push({ seconds: state.time, heapMiB: process.memoryUsage().heapUsed / 2 ** 20, rssMiB: process.memoryUsage().rss / 2 ** 20, enemies: state.enemies.length, pickups: state.pickups.length, level: state.level });
    nextSample += 60;
  }
}
assert.ok(state.time >= 12 * 60, 'Stress fixture must complete twelve simulated minutes');
const elapsedMs = performance.now() - start;
const usedCpu = process.cpuUsage(cpu);
timings.sort((a, b) => a - b);
const result = {
  method: '12 simulated minutes at 60 updates/second, protected player, 4 Hz pickup-seeking bot. Simulation only; no browser, GPU, or rendering. Timing samples themselves retain a small array in the Node heap.',
  seconds: state.time, frames: timings.length, wallMs: elapsedMs,
  cpuMs: (usedCpu.user + usedCpu.system) / 1000,
  medianUpdateMs: timings[Math.floor(timings.length * .5)],
  p95UpdateMs: timings[Math.floor(timings.length * .95)],
  p99UpdateMs: timings[Math.floor(timings.length * .99)],
  maxUpdateMs: timings.at(-1),
  startHeapMiB, peaks, limits: ENTITY_LIMITS, level: state.level, kills: state.kills, samples,
};
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/simulation.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
