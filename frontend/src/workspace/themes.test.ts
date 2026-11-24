import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyWorkspaceTheme,
  DEFAULT_THEME,
  getWorkspaceTheme,
  initializeWorkspaceTheme,
  normalizeTheme,
  THEME_PRESETS,
  THEME_STORAGE_KEY,
  workspaceColors,
} from "./themes";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  applyWorkspaceTheme(DEFAULT_THEME);
});

describe("workspace theme compatibility", () => {
  it("imports a light chart profile with a readable complete palette", () => {
    const theme = normalizeTheme({ preset: "Custom", background: "#f4f4f4" });
    expect(theme.background).toBe("#f4f4f4");
    expect(theme.text).toBe(THEME_PRESETS[2].text);
    expect(theme.rise).toBe(THEME_PRESETS[2].rise);
  });

  it("repairs an already saved workspace created by the background-only migration", () => {
    const theme = normalizeTheme({ ...DEFAULT_THEME, preset: "Custom", background: "#ffffff" });
    expect(theme.text).toBe(THEME_PRESETS[2].text);
    expect(theme.accent).toBe(THEME_PRESETS[2].accent);
  });

  it("preserves an explicitly customized palette", () => {
    const theme = { ...THEME_PRESETS[2], preset: "Custom", background: "#fff5e5", text: "#41392f", accent: "#85632e" };
    expect(normalizeTheme(theme)).toEqual(theme);
  });

  it("preserves all seven colors of a named user theme after reload", () => {
    const theme = { ...DEFAULT_THEME, preset: "My light desk", background: "#ffffff" };
    expect(normalizeTheme(theme)).toEqual(theme);
  });

  it("keeps accent and secondary labels readable across every preset", () => {
    const luminance = (color: string) => {
      const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    for (const theme of THEME_PRESETS) {
      const colors = workspaceColors(theme);
      for (const foreground of [colors.accentText, colors.muted]) {
        const values = [luminance(foreground), luminance(colors.panel)];
        expect((Math.max(...values) + 0.05) / (Math.min(...values) + 0.05), theme.preset).toBeGreaterThanOrEqual(4.5);
      }
      expect(colors.accent).toBe(theme.accent);
    }
  });

  it("defines distinct rise and fall colors for every theme preset to drive candle and volume coloring", () => {
    for (const theme of THEME_PRESETS) {
      expect(theme.rise, theme.preset).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.fall, theme.preset).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.rise, theme.preset).not.toBe(theme.fall);
      expect(theme.background, theme.preset).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("system color scheme changes", () => {
  it("follows System while preserving presets selected after startup", () => {
    const events = new EventTarget();
    const scheme = {
      matches: true,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    vi.stubGlobal("matchMedia", () => scheme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ ...DEFAULT_THEME, preset: "System" }));
    const cleanup = initializeWorkspaceTheme();
    try {
      expect(getWorkspaceTheme().background).toBe(DEFAULT_THEME.background);
      scheme.matches = false;
      events.dispatchEvent(new Event("change"));
      expect(getWorkspaceTheme().background).toBe(THEME_PRESETS[2].background);

      const gold = THEME_PRESETS.find((theme) => theme.preset === "Gold Rush")!;
      applyWorkspaceTheme(gold, true);
      scheme.matches = true;
      events.dispatchEvent(new Event("change"));
      expect(getWorkspaceTheme()).toEqual(gold);

      applyWorkspaceTheme(THEME_PRESETS[2], true);
      scheme.matches = false;
      events.dispatchEvent(new Event("change"));
      expect(getWorkspaceTheme()).toEqual(THEME_PRESETS[2]);

      window.dispatchEvent(new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: JSON.stringify({ ...DEFAULT_THEME, preset: "System" }),
      }));
      expect(getWorkspaceTheme().background).toBe(THEME_PRESETS[2].background);
      scheme.matches = true;
      events.dispatchEvent(new Event("change"));
      expect(getWorkspaceTheme().background).toBe(DEFAULT_THEME.background);
    } finally {
      cleanup();
    }
  });
});
