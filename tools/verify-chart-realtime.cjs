/* Compare rendered output with an explicit pre-change adapter snapshot. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { build } = require('../frontend/node_modules/esbuild');
const { chromium } = require(path.join(process.env.LOCALAPPDATA,
  'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core'));

async function main() {
  assert.ok(process.argv[2], 'Pass the pre-change lightweightChartsAdapter.ts path');
  const baseline = fs.readFileSync(path.resolve(process.argv[2]), 'utf8');
  const bundle = await build({ stdin: { contents: `
    import { LightweightChartsAdapter as Before } from 'baseline-adapter';
    import { LightweightChartsAdapter as After } from './src/chart/lightweightChartsAdapter';
    window.adapters = [Before, After];
  `, resolveDir: path.resolve(__dirname, '../frontend'), loader: 'ts' },
    bundle: true, format: 'iife', write: false,
    plugins: [{ name: 'baseline', setup(builder) {
      builder.onResolve({ filter: /^baseline-adapter$/ }, () => ({ path: 'baseline', namespace: 'baseline' }));
      builder.onLoad({ filter: /.*/, namespace: 'baseline' }, () => ({
        contents: baseline, loader: 'ts', resolveDir: path.resolve(__dirname, '../frontend/src/chart'),
      }));
    } }] });
  const server = http.createServer((req, res) => {
    if (req.url === '/probe.js') {
      res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<div id="a" style="width:900px;height:600px"></div><div id="b" style="width:900px;height:600px"></div><script src="/probe.js"></script>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe') });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const results = await page.evaluate(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const count = 1000;
      const minute = Math.floor(Date.now() / 60000) * 60000;
      const bars = Array.from({ length: count }, (_, i) => {
        const open = 4200 + Math.sin(i / 13) * 9 + Math.sin(i / 3) * 2;
        const close = open + Math.sin(i * 7) * 1.5;
        return { time: minute - (count - 1 - i) * 60000, open, close,
          high: Math.max(open, close) + 0.6, low: Math.min(open, close) - 0.7, volume: 100 + i % 500 };
      });
      const deltas = bars.map(bar => ({ time: bar.time, volume: bar.volume, buyVolume: 60, sellVolume: 40,
        delta: 20, deltaHigh: 30, deltaLow: -30, openDelta: 0, closeDelta: 20 }));
      const adapters = window.adapters.map((Adapter, i) => {
        const adapter = new Adapter(document.getElementById(i ? 'b' : 'a'));
        adapter.setTduSignalsVisible(true); adapter.setXKontrolVisible(true);
        adapter.setGcPushMomentumVisible(true); adapter.setMgannSwingVisible(true); adapter.setCvdVisible(true);
        adapter.setBars(bars); adapter.setVolumeDelta(deltas);
        return adapter;
      });
      const results = [];
      function compare(name) {
        const fields = ['candleBars', 'candleSeries', 'volumeSeries', 'deltaSeries',
          'gcPushMomentumSeries', 'gcPushMomentumPushSeries', 'gcPushMomentumSignalSeries',
          'mgannSwingSeries', 'mgannLiveSwingSeries', 'waveDeltaSeries'];
        const mismatches = [];
        for (const field of fields) {
          const value = adapter => field === 'candleBars' ? adapter[field] : adapter[field]?.data();
          const before = value(adapters[0]);
          const after = value(adapters[1]);
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            const index = before?.findIndex((row, i) => JSON.stringify(row) !== JSON.stringify(after?.[i]));
            mismatches.push({ field, index, before: before?.[index], after: after?.[index],
              lengths: [before?.length, after?.length] });
          }
        }
        results.push({ name, mismatches });
      }
      try {
        // Hundreds of repeated forming-bar snapshots, including simultaneous delta.
        for (let tick = 0; tick < 24; tick++) for (const adapter of adapters) {
          adapter.updateBar({ ...bars.at(-1), close: 4200 + tick / 10, volume: 1000 + tick }, false);
          adapter.updateVolumeDelta({ ...deltas.at(-1), delta: tick, closeDelta: tick });
        }
        await sleep(800); compare('forming bar burst');
        // Several new buckets in one frame must be inserted in timestamp order.
        for (let bucket = 1; bucket <= 3; bucket++) for (const adapter of adapters) {
          adapter.updateBar({ ...bars.at(-1), time: minute + bucket * 60000,
            close: 4200 + bucket, volume: 400 + bucket }, bucket < 3);
          adapter.updateVolumeDelta({ ...deltas.at(-1), time: minute + bucket * 60000 });
        }
        await sleep(800); compare('close and multiple new buckets');
        for (const adapter of adapters) adapter.updateBar({ ...bars[400], close: 4204 }, true);
        await sleep(800); compare('historical correction');
        // A bar with identical OHLCV can still change from provisional to closed.
        for (const adapter of adapters) adapter.updateBar(adapter.candleBars.at(-1), true);
        await sleep(800); compare('unchanged OHLCV close event');
        for (const adapter of adapters) { adapter.setMgannSwingVisible(false); adapter.setGcPushMomentumVisible(false); }
        for (const adapter of adapters) { adapter.setMgannSwingVisible(true); adapter.setGcPushMomentumVisible(true); }
        await sleep(800); compare('disable and restore indicators');
      } finally { for (const adapter of adapters) adapter.dispose(); }
      return results;
    });
    console.log(JSON.stringify({ results, errors }));
    assert.deepEqual(errors, []);
    assert.ok(results.every(result => result.mismatches.length === 0), 'Rendered projections differ from baseline');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
