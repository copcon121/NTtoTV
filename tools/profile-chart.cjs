/* Isolated chart performance probe; no production mutations or saved profiles. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { build } = require('../frontend/node_modules/esbuild');
const { chromium } = require(path.join(process.env.LOCALAPPDATA,
  'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core'));

async function main() {
  const bundle = await build({ stdin: { contents: `
    import { LightweightChartsAdapter } from './src/chart/lightweightChartsAdapter';
    window.Adapter = LightweightChartsAdapter;
  `, resolveDir: path.resolve(__dirname, '../frontend'), loader: 'ts' },
    bundle: true, format: 'iife', write: false, sourcemap: 'inline' });
  const server = http.createServer((req, res) => {
    if (req.url === '/probe.js') {
      res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<div id="chart" style="width:1400px;height:850px"></div><script src="/probe.js"></script>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe') });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const result = await page.evaluate(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
      const count = 10000;
      const minute = Math.floor(Date.now() / 60000) * 60000;
      const bars = Array.from({ length: count }, (_, i) => {
        const open = 4200 + Math.sin(i / 13) * 9 + Math.sin(i / 3) * 2;
        const close = open + Math.sin(i * 7) * 1.5;
        return { time: minute - (count - 1 - i) * 60000, open, close,
          high: Math.max(open, close) + 0.6, low: Math.min(open, close) - 0.7,
          volume: 100 + i % 500 };
      });
      const deltas = bars.map((bar, i) => ({ time: bar.time, volume: bar.volume,
        buyVolume: 100, sellVolume: 80, delta: i % 2 ? 20 : -20,
        deltaHigh: 30, deltaLow: -30, openDelta: 0, closeDelta: i % 2 ? 20 : -20 }));
      const results = [];
      for (const mode of ['base', 'tdu', 'xkontrol', 'momentum', 'mgann', 'wave', 'all']) {
        const adapter = new window.Adapter(document.getElementById('chart'));
        adapter.setTduSignalsVisible(['tdu', 'all'].includes(mode));
        adapter.setXKontrolVisible(['xkontrol', 'all'].includes(mode));
        adapter.setGcPushMomentumVisible(['momentum', 'all'].includes(mode));
        adapter.setMgannSwingVisible(['mgann', 'all'].includes(mode));
        adapter.setCvdVisible(['wave', 'all'].includes(mode));
        adapter.setBars(bars);
        adapter.setVolumeDelta(deltas);
        adapter.chart.timeScale().setVisibleLogicalRange({ from: count - 120, to: count + 4 });
        await sleep(600);
        const timings = {};
        for (const name of ['updateBar', 'updateVolumeDelta', 'renderTduSignals',
          'renderXKontrolSignals', 'updateGcPushMomentumAt', 'renderCandleSeries',
          'renderMgannSwing', 'currentMgannOverlay', 'renderWaveDeltaSeries']) {
          const original = adapter[name];
          adapter[name] = function (...args) {
            const start = performance.now();
            try { return original.apply(this, args); }
            finally {
              const item = timings[name] ??= { calls: 0, ms: 0, maxMs: 0 };
              const ms = performance.now() - start;
              item.calls++; item.ms += ms; item.maxMs = Math.max(item.maxMs, ms);
            }
          };
        }
        const frameGaps = [];
        let running = true;
        let previous = performance.now();
        function frame(now) { frameGaps.push(now - previous); previous = now; if (running) requestAnimationFrame(frame); }
        requestAnimationFrame(frame);
        const start = performance.now();
        for (let frame = 0; frame < 36; frame++) {
          // A transport burst of eight successive live snapshots plus delta.
          for (let tick = 0; tick < 8; tick++) {
            const close = bars[count - 1].close + Math.sin(frame * 8 + tick) * 3;
            adapter.updateBar({ ...bars[count - 1], close,
              high: bars[count - 1].high + 3, low: bars[count - 1].low - 3,
              volume: 1000 + frame * 8 + tick }, false);
            adapter.updateVolumeDelta({ ...deltas[count - 1], delta: tick * 5, closeDelta: tick * 5 });
          }
          await nextFrame();
        }
        await sleep(650);
        running = false;
        frameGaps.sort((a, b) => a - b);
        results.push({ mode, bars: count, snapshots: 288, elapsedMs: performance.now() - start,
          frameGapP95: frameGaps[Math.floor(frameGaps.length * 0.95)], maxFrameGap: Math.max(...frameGaps), timings });
        adapter.dispose();
      }
      return results;
    });
    const report = { results: result, errors };
    const out = path.resolve(__dirname, '../_run_logs/chart-performance');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `${process.argv[2] || 'probe'}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
