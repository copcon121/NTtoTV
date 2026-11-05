/* Browser regression for periodic LQ refresh; all API/WS traffic is mocked. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { build } = require('../frontend/node_modules/esbuild');
const { chromium } = require(path.join(process.env.LOCALAPPDATA,
  'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core'));

(async () => {
  const baseline = process.argv.includes('--baseline');
  const bundle = await build({ stdin: { contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { LiquidityPage } from './src/liquidity/LiquidityPage';
    import './src/styles.css';
    createRoot(document.getElementById('root')).render(React.createElement(LiquidityPage));
  `, resolveDir: path.resolve(__dirname, '../frontend'), loader: 'tsx' },
    bundle: true, jsx: 'automatic', format: 'iife', write: false, outfile: 'probe.js',
    plugins: baseline ? [{ name: 'original-canvas-reset', setup(builder) {
      builder.onLoad({ filter: /LiquidityPage\.tsx$/ }, async ({ path: file }) => ({
        contents: (await fs.promises.readFile(file, 'utf8'))
          .replace('if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;', 'canvas.width = bitmapWidth;')
          .replace('if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;', 'canvas.height = bitmapHeight;'),
        loader: 'tsx',
      }));
    } }] : [] });
  const server = http.createServer((req, res) => {
    const asset = bundle.outputFiles.find(file => req.url === '/' + path.basename(file.path));
    res.setHeader('Content-Type', asset ? (req.url.endsWith('.css') ? 'text/css' : 'text/javascript') : 'text/html');
    res.end(asset ? asset.text : '<link rel="stylesheet" href="/probe.css"><div id="root"></div><script src="/probe.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe') });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.clock.install();
    await page.routeWebSocket('**/ws/chart', () => {});
    await page.addInitScript(() => {
      window.__bitmapResets = [];
      window.__linePaints = 0;
      for (const dimension of ['width', 'height']) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dimension);
        Object.defineProperty(HTMLCanvasElement.prototype, dimension, { ...descriptor, set(value) {
          if (this.getAttribute('aria-label') === 'GC liquidity timing chart')
            window.__bitmapResets.push({ dimension, previous: descriptor.get.call(this), value });
          descriptor.set.call(this, value);
        } });
      }
      const text = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (label, ...args) {
        if (this.canvas.getAttribute('aria-label') === 'GC liquidity timing chart' && String(label).includes(' @ '))
          window.__linePaints++;
        return text.call(this, label, ...args);
      };
    });
    const now = Date.now();
    const minute = Math.floor(now / 60000) * 60000;
    const bars = Array.from({ length: 120 }, (_, i) => ({ time: minute - (119 - i) * 60000,
      open: 4200, close: 4200.5, high: 4202, low: 4198, volume: 60, closed: i < 119 }));
    const metadata = { symbol: 'GC', contract: 'GC', source: 'rithmic', sourceContract: 'GC 12-26',
      sessionId: 'repaint-fixture', connected: true, synchronized: true };
    const tracker = { relativeEnabled: false, relativeTrigger: 50, relativeDomFrom: 20, relativeDomTo: 100,
      absoluteEnabled: false, absoluteTrigger: 500, absoluteDomFrom: 1, absoluteDomTo: 10,
      longTermEnabled: true, longTermTrigger: 500, longTermDomFrom: 1, longTermDomTo: 80, longTermMinAgeSeconds: 14400 };
    const explorer = { lineEnabled: false, halftimeSeconds: 60, signal: {}, volumeSpike: {}, absorption: {} };
    const polls = { icebergs: 0, stops: 0 };
    await page.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let data = {};
      if (pathname.startsWith('/api/me/profile')) data = { profile: { id: 'fixture', payload: { version: 1,
        liquidityChart: { version: 1, timeframe: '1m', visibleBars: 120, offsetBars: -10,
          heatmap: { minDurationSeconds: 0 }, siStops: { version: 2 } } } } };
      else if (pathname === '/api/history') data = { ...metadata, tf: '1m', bars };
      else if (pathname === '/api/liquidity') data = { events: [], lines: [{
        lineId: 'resting-bid', side: 'bid', price: 4201, startedAt: bars[30].time, lastAt: now,
        endedAt: null, currentSize: 1500, peakSize: 1500, threshold: 500, domDistance: 10, active: true,
        samples: [{ time: now - 60000, size: 1500, active: true }, { time: now, size: 1500, active: true }],
      }] };
      else if (pathname === '/api/liquidity/settings') data = { settings: tracker };
      else if (pathname === '/api/market-explorer/settings') data = { settings: explorer };
      else if (pathname === '/api/market-explorer') data = { signals: [] };
      else if (pathname === '/api/big-trades') data = { trades: [] };
      else if (pathname === '/api/orderflow/volume-delta') data = { bars: [] };
      else if (pathname === '/api/orderflow/icebergs') { polls.icebergs++; data = { ...metadata, icebergs: [] }; }
      else if (pathname === '/api/orderflow/si-stops') { polls.stops++; data = { ...metadata, chains: [] }; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/lq`);
    await page.waitForFunction(() => window.__linePaints > 0);
    await page.evaluate(() => { window.__bitmapResets = []; window.__linePaints = 0; });
    for (let index = 0; index < 3; index++) {
      const before = { ...polls };
      await page.clock.runFor(10050);
      await page.waitForFunction(() => window.__linePaints > 0);
      assert.ok(polls.icebergs > before.icebergs && polls.stops > before.stops, 'Both 10-second synchronizations must run');
    }
    const refresh = await page.evaluate(() => ({ resets: window.__bitmapResets, paints: window.__linePaints }));
    assert.deepEqual(refresh.resets, [], 'Periodic refresh must keep the populated canvas bitmap');
    assert.ok(refresh.paints >= 3, 'Liquidity line must still render across periodic refreshes');
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForFunction(() => window.__bitmapResets.length > 0);
    const resize = await page.evaluate(() => ({ resets: window.__bitmapResets, paints: window.__linePaints }));
    assert.ok(resize.resets.every(reset => reset.previous !== reset.value), 'Actual resizing must only change differing dimensions');
    assert.ok(resize.paints > refresh.paints, 'Resizing must repaint the line');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ baseline, polls, refresh, resize, errors }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
