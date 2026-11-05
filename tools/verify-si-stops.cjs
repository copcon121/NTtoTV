/* Isolated built-LQ browser check. Every API mutation is mocked. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.LOCALAPPDATA,
  'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core'));

async function main() {
  const root = path.resolve(__dirname, '../frontend/dist');
  const output = path.resolve(__dirname, '../_run_logs/ui-regression');
  fs.mkdirSync(output, { recursive: true });
  const defaults = {};
  for (const area of ['liquidity', 'market-explorer']) {
    const response = await fetch(`http://127.0.0.1:8000/api/${area}/settings`);
    assert.ok(response.ok);
    defaults[area] = (await response.json()).settings;
  }
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const target = path.resolve(root, '.' + (['/lq', '/'].includes(pathname) ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(target)] || 'application/octet-stream');
    fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1223/chrome-win64/chrome.exe') });
  let page;
  const errors = [];
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 950 }, hasTouch: true });
    await page.routeWebSocket('**/ws/chart', () => {});
    const saved = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const transform = CanvasRenderingContext2D.prototype.setTransform;
      CanvasRenderingContext2D.prototype.setTransform = function (...args) {
        if (this.canvas.getAttribute('aria-label') === 'GC liquidity timing chart') {
          window.__siPaint = [];
          window.__siLabels = [];
        }
        return transform.apply(this, args);
      };
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
        if (this.canvas.getAttribute('aria-label') === 'GC liquidity timing chart') {
          window.__siPaint?.push(String(text));
          window.__siLabels?.push({ text: String(text), x, y });
        }
        return fillText.apply(this, arguments);
      };
    });
    const minute = Math.floor(Date.now() / 60000) * 60000;
    const bars = Array.from({ length: 120 }, (_, i) => ({ time: minute - (119 - i) * 60000,
      open: 4200, close: 4200.5, high: 4202, low: 4198, volume: 60, closed: i < 119 }));
    const chain = (index, volume, side = 'buy') => ({
      type: 'si_stop', symbol: 'GC', contract: 'GC', source: 'rithmic', method: 'aggressor_chain', status: 'completed',
      sourceContract: 'GC 12-26', sessionId: 'ui-fixture', chainId: `ui-fixture:${index}`, sequence: index,
      side, time: bars[index].time + 30000, startTime: bars[index].time + 29000, completedTime: bars[index].time + 30001,
      price: side === 'buy' ? 4200 : 4201, firstPrice: 4199.9, vwap: 4200,
      executedVolume: volume, executionCount: 2, aggressorCount: 2, endReason: 'depth', throughPriceLevels: true,
    });
    const chains = [chain(95, 137), chain(75, 17), chain(50, 53, 'sell')];
    let liquidityChart = { version: 1, timeframe: '1m', siStops: { version: 1,
      enabled: true, aggregate: false, minVolume: 0, automatic: true } };
    await page.route('**/api/**', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const body = ['PUT', 'PATCH'].includes(request.method()) ? request.postDataJSON() : undefined;
      let data;
      if (pathname.startsWith('/api/me/profile')) {
        if (body?.liquidityChart) { liquidityChart = body.liquidityChart; saved.push(liquidityChart); }
        data = { profile: { id: 'ui', payload: { version: 1, liquidityChart } }, liquidityChart };
      } else if (pathname === '/api/history') data = { symbol: 'GC', contract: 'GC', tf: '1m', bars };
      else if (pathname === '/api/orderflow/si-stops') data = { symbol: 'GC', contract: 'GC', source: 'rithmic',
        sourceContract: 'GC 12-26', sessionId: 'ui-fixture', connected: true, synchronized: true, chains };
      else if (pathname === '/api/orderflow/icebergs') data = { symbol: 'GC', contract: 'GC', source: 'rithmic',
        sourceContract: 'GC 12-26', sessionId: 'ui-fixture', connected: true, synchronized: true, icebergs: [] };
      else if (pathname === '/api/orderflow/volume-delta') data = { bars: [] };
      else if (pathname === '/api/liquidity') data = { events: [], lines: [] };
      else if (pathname === '/api/big-trades') data = { trades: [] };
      else if (pathname === '/api/market-explorer') data = { signals: [{ signalId: 'legacy', kind: 'market_volume_stop',
        side: 'buy', signalIndex: 1, time: bars[100].time, detectionTime: bars[100].time + 1,
        price: 4200, value: 99999, threshold: 500, ratio: 1 }] };
      else if (pathname.endsWith('/settings')) {
        const area = pathname.split('/')[2];
        data = { settings: body ?? defaults[area], sentToBookmap: false };
      } else data = {};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/lq`);
    await page.waitForFunction(() => window.__siPaint?.includes('137') && !window.__siPaint?.includes('17'));
    assert.ok(!(await page.evaluate(() => window.__siPaint)).some(s => s.includes('MV1')));
    const label = await page.evaluate(() => window.__siLabels.find(row => row.text === '137'));
    const canvasBox = await page.getByLabel('GC liquidity timing chart').boundingBox();
    await page.mouse.move(canvasBox.x + label.x + 3, canvasBox.y + label.y);
    await page.waitForFunction(() => window.__siPaint?.includes('BUY SI Stops - 137 contracts') &&
      window.__siPaint?.includes('1 chain - 2 trade prints') && window.__siPaint?.includes('Inferred stop activity'));
    await page.screenshot({ path: path.join(output, 'lq-si-stops-before-settings.png') });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.equal(await page.getByLabel('Show SI Stops', { exact: true }).isChecked(), true);
    assert.equal(await page.locator('.si-stops-settings-group').count(), 1);
    assert.equal(await page.getByLabel('Minimum executed volume', { exact: true }).inputValue(), '50');
    assert.equal(await page.getByLabel('Automatic size filter', { exact: true }).isChecked(), false);
    assert.equal(await page.getByText('Market Volume Stop Signal 1', { exact: true }).count(), 0);
    const accent = await page.getByRole('button', { name: 'Save & Apply' }).evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(accent, 'rgb(53, 214, 176)');
    const checkboxAccent = await page.getByLabel('Show SI Stops', { exact: true }).evaluate(el => getComputedStyle(el).accentColor);
    assert.equal(checkboxAccent, 'rgb(53, 214, 176)');
    const checkboxAccents = await page.locator('.liquidity-settings-dialog input[type="checkbox"]')
      .evaluateAll(elements => elements.map(el => getComputedStyle(el).accentColor));
    assert.ok(checkboxAccents.every(color => color === 'rgb(53, 214, 176)'));
    const panelColors = await page.locator('.liquidity-settings-group').evaluateAll(elements => elements.map(el => ({
      background: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderColor,
    })));
    assert.equal(new Set(panelColors.map(row => JSON.stringify(row))).size, 1, 'All settings panels must use one palette');
    const missingHelp = await page.locator('.liquidity-settings-dialog input, .liquidity-settings-dialog select')
      .evaluateAll(elements => elements.filter(el => !el.closest(
        '.liquidity-settings-field, .liquidity-settings-enable-row, .liquidity-sound-choice')?.querySelector('.liquidity-setting-help-button'))
        .map(el => el.getAttribute('aria-label') || el.id || el.outerHTML));
    assert.deepEqual(missingHelp, [], 'Every settings option must have a help button');
    const assertTooltip = async text => {
      const tip = page.getByRole('tooltip');
      await tip.waitFor({ state: 'visible' });
      assert.ok((await tip.innerText()).includes(text));
      const rect = await tip.evaluate(el => ({ left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top,
        right: el.getBoundingClientRect().right, bottom: el.getBoundingClientRect().bottom,
        width: innerWidth, height: innerHeight }));
      assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= rect.width && rect.bottom <= rect.height,
        'Tooltip must fit inside the viewport');
    };
    await page.locator('.si-stops-settings-group').first().scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Giải thích Minimum executed volume', exact: true }).hover();
    await assertTooltip('TỪNG chain');
    await page.screenshot({ path: path.join(output, 'lq-si-stops-settings.png') });
    await page.getByRole('button', { name: 'Giải thích Minimum executed volume', exact: true }).focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('tooltip').count(), 0);
    await page.getByRole('button', { name: 'Giải thích Show invalidated historical ICE', exact: true }).click();
    await assertTooltip('Invalidated không đồng nghĩa');
    await page.screenshot({ path: path.join(output, 'lq-iceberg-settings-tooltip.png') });
    await page.keyboard.press('Escape');
    await page.getByLabel('Minimum executed volume', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Save & Apply' }).click();
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.waitForFunction(() => window.__siPaint?.includes('137') && window.__siPaint?.includes('17'));
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Minimum executed volume', { exact: true }).fill('50');
    await page.getByRole('button', { name: 'Save & Apply' }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Saved detectors, layers and sound settings'));
    const deadline = Date.now() + 8000;
    while (!saved.some(p => p.siStops?.version === 2 && p.siStops?.minVolume === 50 && !p.siStops.automatic) && Date.now() < deadline) await page.waitForTimeout(100);
    assert.ok(saved.some(p => p.siStops?.version === 2 && p.siStops?.minVolume === 50 && !p.siStops.automatic),
      'Fixed minimum 50 must persist in the upgraded liquidityChart profile');
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.waitForFunction(() => window.__siPaint?.includes('137') && !window.__siPaint?.includes('17'));
    await page.screenshot({ path: path.join(output, 'lq-si-stops-chart.png') });
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.equal(await page.getByLabel('Minimum executed volume', { exact: true }).inputValue(), '50');
    assert.equal(await page.getByLabel('Automatic size filter', { exact: true }).isChecked(), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.si-stops-settings-group').first().scrollIntoViewIfNeeded();
    const geometry = await page.locator('.liquidity-settings-dialog').evaluate(el => ({
      left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right,
      viewport: innerWidth, body: document.documentElement.scrollWidth,
    }));
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewport + 1 && geometry.body <= geometry.viewport + 1);
    await page.screenshot({ path: path.join(output, 'lq-si-stops-mobile.png') });
    await page.getByRole('button', { name: 'Giải thích Aggregation price area', exact: true }).tap();
    await assertTooltip('không phải số ticks');
    await page.screenshot({ path: path.join(output, 'lq-si-stops-mobile-tooltip.png') });
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    const result = { passed: true, builtFrontend: true, mockedApiMutations: true,
      markerFilter: true, legacyMvMarkersAbsent: true, profileRoundTrip: true,
      fixedMin50Migration: true, singleSiSettingsGroup: true, tooltipUnits: true,
      allOptionsHaveHelp: true, uniformSettingsPanels: true, mobileTooltip: true,
      turquoiseAccent: accent, mobileWidth: geometry.viewport, pageErrors: errors };
    fs.writeFileSync(path.join(output, 'si-stops-verification.json'), JSON.stringify(result, null, 2));
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    if (page) {
      process.stdout.write(JSON.stringify({ url: page.url(), errors, body: await page.locator('body').innerText(), paint: await page.evaluate(() => window.__siPaint) }) + '\n');
      await page.screenshot({ path: path.join(output, 'lq-si-stops-failure.png') });
    }
    throw error;
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
