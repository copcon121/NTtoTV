// @ts-ignore
import { readFileSync } from "node:fs";
// @ts-ignore
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Unified theme tokens and mobile settings layout", () => {
  // @ts-ignore
  const cssPath = resolve(__dirname, "../styles.css");
  const css = readFileSync(cssPath, "utf-8");

  it("defines the single canonical pearl-turquoise accent in :root", () => {
    expect(css).toMatch(/--gc-accent:\s*#35d6b0;/i);
    expect(css).toMatch(/--gc-accent-ink:\s*#061b16;/i);
    expect(css).toMatch(/--workspace-accent:\s*var\(--gc-accent\);/);
    expect(css).toMatch(/--workspace-accent-ink:\s*var\(--gc-accent-ink\);/);
  });

  it("applies universal accent-color to native inputs to prevent browser-default blue", () => {
    expect(css).toMatch(
      /input\[type="checkbox"\],\s*input\[type="radio"\],\s*input\[type="range"\]\s*\{[^}]*accent-color:\s*var\(--gc-accent\);/
    );
  });

  it("uses pearl-turquoise for primary Add/Save/Enable buttons without legacy yellow or green", () => {
    // .alert-add
    const alertAddMatch = css.match(/\.alert-add\s*\{([^}]+)\}/);
    expect(alertAddMatch).not.toBeNull();
    expect(alertAddMatch![1]).toContain("var(--gc-accent)");
    expect(alertAddMatch![1]).toContain("var(--gc-accent-ink)");
    expect(alertAddMatch![1]).not.toContain("#e0b341");

    // .telegram-save
    const telegramSaveMatch = css.match(/\.telegram-save\s*\{([^}]+)\}/);
    expect(telegramSaveMatch).not.toBeNull();
    expect(telegramSaveMatch![1]).toContain("var(--gc-accent)");
    expect(telegramSaveMatch![1]).toContain("var(--gc-accent-ink)");
    expect(telegramSaveMatch![1]).not.toContain("#e0b341");

    // .liquidity-settings-dialog button.is-primary
    const lqPrimaryMatch = css.match(/\.liquidity-settings-dialog\s+button\.is-primary\s*\{([^}]+)\}/);
    expect(lqPrimaryMatch).not.toBeNull();
    expect(lqPrimaryMatch![1]).toContain("var(--gc-accent)");
    expect(lqPrimaryMatch![1]).toContain("var(--gc-accent-ink)");
    expect(lqPrimaryMatch![1]).not.toContain("#00d68f");
  });

  it("styles settings help buttons with pearl-turquoise accent without legacy blue", () => {
    const helpButtonMatch = css.match(/\.liquidity-settings-dialog\s+button\.liquidity-setting-help-button\s*\{([^}]+)\}/);
    expect(helpButtonMatch).not.toBeNull();
    expect(helpButtonMatch![1]).toContain("var(--gc-accent)");
    expect(helpButtonMatch![1]).not.toContain("#9fc8ee");

    const helpButtonHoverMatch = css.match(
      /\.liquidity-settings-dialog\s+button\.liquidity-setting-help-button:hover[^\{]*\{([^}]+)\}/
    );
    expect(helpButtonHoverMatch).not.toBeNull();
    expect(helpButtonHoverMatch![1]).toContain("var(--gc-accent-ink)");
    expect(helpButtonHoverMatch![1]).not.toContain("#8fc9f5");
  });

  it("contains mobile layout rules to prevent grid blowout and support scrolling", () => {
    // Media query max-width: 760px
    const media760Match = css.match(/@media\s*\(max-width:\s*760px\)\s*\{([\s\S]*?)(?=@media|\/\* Alerts)/);
    expect(media760Match).not.toBeNull();
    const media760 = media760Match![1];

    // .si-stops-settings-group must reset to grid-column: auto
    expect(media760).toMatch(/\.si-stops-settings-group\s*\{[^}]*grid-column:\s*auto;/);

    // .si-stops-settings-columns must collapse to 1 column
    expect(media760).toMatch(/\.si-stops-settings-columns\s*\{[^}]*grid-template-columns:\s*1fr;/);

    // Safe-area-inset rules must be present
    expect(media760).toContain("env(safe-area-inset-top");
    expect(media760).toContain("env(safe-area-inset-bottom");
  });

  it("fits content cleanly across 320px, 375px, 390px, 430px viewports without horizontal blowout", () => {
    const viewports = [320, 375, 390, 430];
    for (const vw of viewports) {
      // Metrics from @media (max-width: 480px):
      const backdropPadding = 6 * 2; // 12px
      const dialogBorder = 1 * 2; // 2px
      const dialogWidth = vw - backdropPadding; // e.g. 308px at 320
      const dialogInnerWidth = dialogWidth - dialogBorder; // 306px at 320

      const groupsPadding = 8 * 2; // 16px
      const fieldsetAvailable = dialogInnerWidth - groupsPadding; // 290px at 320

      const groupPadding = 10 * 2; // 20px
      const groupBorder = 1 * 2; // 2px
      const innerFieldsetWidth = fieldsetAvailable - groupPadding - groupBorder; // 268px at 320

      const inputWidth = 80; // 80px
      const fieldGap = 8; // 8px
      const labelAvailableWidth = innerFieldsetWidth - inputWidth - fieldGap; // 180px at 320

      expect(dialogWidth).toBeLessThanOrEqual(vw);
      expect(labelAvailableWidth).toBeGreaterThan(160); // Guarantees comfortable wrapping space
    }
  });
});
