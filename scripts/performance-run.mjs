import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

// Production build: npm run build; npx vite preview --port 5279 --strictPort
// CPU: 100% is one logical core. RSS includes the isolated browser's processes
// and may double-count shared pages; it is not JS heap or dedicated GPU memory.
const url = process.env.GAME_URL ?? 'http://127.0.0.1:5279/play/';
const output = process.env.PERF_OUTPUT ?? '.impeccable/review/performance';
await mkdir(output, { recursive: true });
const report = {
  date: new Date().toISOString(), url,
  host: { platform: os.platform(), cpu: os.cpus()[0].model, cores: os.cpus().length, ramGiB: os.totalmem() / 2 ** 30 },
  method: 'Isolated headless Chrome, production build, 1440x900 CSS pixels at DPR 2. Real keyboard gameplay; no gameplay state mutation. Post-GC heap is measured outside timed windows. Process RSS includes shared pages and browser overhead. Not a physical mobile benchmark.',
  scenarios: [], errors: [],
};
const round = n => Math.round(n * 100) / 100;
const percentile = (xs, p) => xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : null;
for (const quality of (process.env.PERF_QUALITIES ?? 'high,performance').split(',')) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    report.browser = browser.version();
    const root = await browser.newBrowserCDPSession();
    if (!report.gpu) report.gpu = (await root.send('SystemInfo.getInfo')).gpu;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    page.on('pageerror', e => report.errors.push({ quality, message: e.message }));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.addInitScript(q => {
      if (!['http:', 'https:'].includes(location.protocol)) return;
      if (q === 'default') localStorage.removeItem('junk-magnet-graphics');
      else localStorage.setItem('junk-magnet-graphics', q);
      const nativeRAF = window.requestAnimationFrame.bind(window);
      window.__perf = { intervals: [], activeIntervals: [], callbacks: [], longTasks: [], previous: null };
      window.requestAnimationFrame = callback => nativeRAF(time => {
        const stats = window.__perf;
        const playing = document.getElementById('app')?.dataset.phase === 'playing';
        if (stats.previous !== null) stats.intervals.push(time - stats.previous);
        if (stats.previous !== null && playing && stats.previousPlaying) stats.activeIntervals.push(time - stats.previous);
        stats.previousPlaying = playing;
        stats.previous = time;
        const start = performance.now();
        callback(time);
        stats.callbacks.push(performance.now() - start);
      });
      new PerformanceObserver(list => {
        window.__perf.longTasks.push(...list.getEntries().map(e => e.duration));
      }).observe({ type: 'longtask', buffered: false });
    }, quality);
    const read = () => page.evaluate(() => window.__JUNK_MAGNET__.snapshot());
    async function resources() {
      const processes = (await root.send('SystemInfo.getProcessInfo')).processInfo;
      const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      let rssKiB = 0;
      try {
        const lines = execFileSync('ps', ['-o', 'rss=', '-p', processes.map(p => p.id).join(',')], { encoding: 'utf8' });
        rssKiB = lines.trim().split(/\s+/).reduce((sum, n) => sum + Number(n), 0);
      } catch { rssKiB = NaN; }
      return { processes, metrics, rssMiB: rssKiB / 1024, wall: performance.now() };
    }
    async function retained() {
      await cdp.send('HeapProfiler.collectGarbage');
      const r = await resources();
      return { heapMiB: round(r.metrics.JSHeapUsedSize / 2 ** 20), rssMiB: round(r.rssMiB), nodes: r.metrics.Nodes };
    }
    let held = new Set();
    async function keys(next = []) {
      const desired = new Set(next);
      for (const key of held) if (!desired.has(key)) await page.keyboard.up(key);
      for (const key of desired) if (!held.has(key)) await page.keyboard.down(key);
      held = desired;
    }
    async function play(s) {
      if (s.phase === 'upgrade') {
        await keys();
        await page.waitForTimeout(280);
        const priority = ['turret', 'lightning', 'burst', 'saw', 'armor', 'magnet', 'boots', 'repair'];
        const choice = priority.find(id => s.choices.includes(id)) ?? s.choices[0];
        // A rank-3 weapon offers its branches instead of upgrades; take the first.
        await page.locator(choice ? `[data-upgrade="${choice}"]` : '[data-specialization]').first().click();
      } else if (s.phase === 'lost') {
        await keys();
        await page.locator('#again').click();
      } else if (s.phase === 'playing') {
        const distance = p => Math.hypot(p.x - s.player.x, p.z - s.player.z);
        const target = [...s.xpDrops].sort((a, b) => distance(a) - distance(b))[0]
          ?? [...s.enemies].sort((a, b) => distance(a) - distance(b))[0];
        let dx = target ? target.x - s.player.x : Math.cos(s.time / 10);
        let dz = target ? target.z - s.player.z : Math.sin(s.time / 10);
        if (!s.xpDrops.length && Math.hypot(dx, dz) < 2.5) dx = dz = 0;
        const next = [];
        if (Math.abs(dx) > 0.2) next.push(dx > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(dz) > 0.2) next.push(dz > 0 ? 'KeyS' : 'KeyW');
        await keys(next);
      }
    }
    async function measure(name, seconds, gameplay = false) {
      const beforeGC = await retained();
      const firstState = await read();
      await page.evaluate(() => { window.__perf = { intervals: [], activeIntervals: [], callbacks: [], longTasks: [], previous: null }; });
      const start = await resources();
      const samples = [];
      let nextSample = 0;
      const phases = {};
      while (performance.now() - start.wall < seconds * 1000) {
        const state = await read();
        phases[state.phase] = (phases[state.phase] ?? 0) + 1;
        if (gameplay) await play(state);
        if (performance.now() > nextSample) {
          const r = await resources();
          samples.push({ seconds: round((r.wall - start.wall) / 1000), rssMiB: round(r.rssMiB), heapMiB: round(r.metrics.JSHeapUsedSize / 2 ** 20), nodes: r.metrics.Nodes, enemies: state.enemyCount, geometries: state.world.geometries, textures: state.world.textures });
          nextSample = performance.now() + 2000;
        }
        await page.waitForTimeout(250);
      }
      await keys();
      const end = await resources();
      const frames = await page.evaluate(() => window.__perf);
      const final = await read();
      const cpuByType = {};
      for (const process of end.processes) {
        const original = start.processes.find(p => p.id === process.id);
        if (original) cpuByType[process.type] = (cpuByType[process.type] ?? 0) + (process.cpuTime - original.cpuTime) / ((end.wall - start.wall) / 1000) * 100;
      }
      const result = {
        quality, name, seconds: round((end.wall - start.wall) / 1000),
        // No animation callbacks is expected for a correctly idle scene.
        fps: frames.intervals.length ? round(frames.intervals.length / (frames.intervals.reduce((a, b) => a + b, 0) / 1000)) : 0,
        activeFps: frames.activeIntervals.length ? round(frames.activeIntervals.length / (frames.activeIntervals.reduce((a, b) => a + b, 0) / 1000)) : 0,
        renderedFrames: final.world.frames === undefined ? undefined : final.world.frames - firstState.world.frames,
        medianFrameMs: round(percentile(frames.intervals, .5)), p95FrameMs: round(percentile(frames.intervals, .95)),
        framesOver25msPercent: frames.intervals.length ? round(100 * frames.intervals.filter(n => n > 25).length / frames.intervals.length) : 0,
        callbackMedianMs: round(percentile(frames.callbacks, .5)), callbackP95Ms: round(percentile(frames.callbacks, .95)),
        rendererMainThreadBusyPercent: round((end.metrics.TaskDuration - start.metrics.TaskDuration) / ((end.wall - start.wall) / 1000) * 100),
        cpuPercent: round(Object.values(cpuByType).reduce((a, b) => a + b, 0)),
        cpuByType: Object.fromEntries(Object.entries(cpuByType).map(([k, v]) => [k, round(v)])),
        rssMedianMiB: round(percentile(samples.map(s => s.rssMiB), .5)), rssPeakMiB: round(Math.max(...samples.map(s => s.rssMiB))),
        beforeGC, afterGC: await retained(), longTasks: frames.longTasks.length,
        phases, samples, final,
      };
      report.scenarios.push(result);
      await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({ quality, name, fps: result.fps, cpu: result.cpuPercent, rss: result.rssMedianMiB, heap: result.afterGC.heapMiB, phase: final.phase, time: final.time }));
    }
    await page.goto('about:blank');
    const baselineStart = await resources();
    await page.waitForTimeout(3000);
    const baselineEnd = await resources();
    report.scenarios.push({ quality, name: 'blank-browser', rssMiB: round(baselineEnd.rssMiB), cpuPercent: round(baselineEnd.processes.reduce((sum, p) => sum + Math.max(0, p.cpuTime - (baselineStart.processes.find(a => a.id === p.id)?.cpuTime ?? p.cpuTime)), 0) / ((baselineEnd.wall - baselineStart.wall) / 1000) * 100) });
    await page.goto(url);
    await page.waitForFunction(() => window.__JUNK_MAGNET__, { timeout: 60000 });
    await page.waitForTimeout(3000);
    await measure('menu', 15);
    await page.locator('#start').click();
    await measure('gameplay', 60, true);
    let state = await read();
    while (state.phase === 'upgrade' || state.phase === 'lost') { await play(state); state = await read(); }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__JUNK_MAGNET__.snapshot().phase === 'paused');
    await measure('paused', 15);
    await page.screenshot({ path: `${output}/${quality}-paused.png` });
  } finally { await browser.close(); }
}
await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2) + '\n');
if (report.errors.length) process.exitCode = 1;
