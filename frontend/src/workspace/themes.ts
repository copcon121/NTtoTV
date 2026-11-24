import type { WorkspaceTheme } from "./types";

export const DEFAULT_THEME: WorkspaceTheme = {
  preset: "System Dark",
  background: "#0b0f14",
  text: "#dbe7f3",
  rise: "#35d6b0",
  fall: "#ff637d",
  buy: "#31cf86",
  sell: "#f05c67",
  accent: "#35d6b0",
};

const preset = (name: string, values: Partial<WorkspaceTheme>): WorkspaceTheme => ({
  ...DEFAULT_THEME,
  ...values,
  preset: name,
});

export const THEME_PRESETS: readonly WorkspaceTheme[] = [
  preset("System", {}),
  preset("System Dark", {}),
  preset("System Light", { background: "#f4f6f8", text: "#252b33", rise: "#14996a", fall: "#d94a55", buy: "#14996a", sell: "#d94a55", accent: "#177fb8" }),
  preset("Arctic", { background: "#101923", text: "#dbeaff", rise: "#4fd1c5", fall: "#fb7185", accent: "#60a5fa" }),
  preset("Astro Trader", { background: "#0e0b19", text: "#e7defa", rise: "#48e5a4", fall: "#ff4f81", accent: "#a78bfa" }),
  preset("Dawn", { background: "#fff6eb", text: "#47372f", rise: "#26966a", fall: "#d65c50", accent: "#e09b54" }),
  preset("Day One", { background: "#f5f1e8", text: "#2e3438", rise: "#368b64", fall: "#c85757", accent: "#5887a7" }),
  preset("Gold Rush", { background: "#17140d", text: "#f2e7c8", rise: "#8ed16b", fall: "#e76855", accent: "#e3b341" }),
  preset("Platinum", { background: "#171a1e", text: "#e1e4e8", rise: "#61c9a8", fall: "#eb727e", accent: "#a8b5c3" }),
  preset("Profit Cowboy", { background: "#17130f", text: "#f0e3cf", rise: "#5ec77a", fall: "#e35f52", accent: "#c99453" }),
  preset("Red Dragon", { background: "#180e12", text: "#f6e5e6", rise: "#50c878", fall: "#f05b69", accent: "#c53549" }),
  preset("Sahara", { background: "#201a12", text: "#f3e6cb", rise: "#95bc67", fall: "#d86d51", accent: "#d0a35a" }),
  preset("Smoothie", { background: "#171425", text: "#eee8fa", rise: "#61d6a3", fall: "#f276a4", accent: "#b18be0" }),
  preset("VHS Noir", { background: "#080b10", text: "#dce5ed", rise: "#25e6bf", fall: "#ff5277", accent: "#cf52f2" }),
  preset("Wen Moon", { background: "#101723", text: "#dce5f1", rise: "#44c49b", fall: "#ec6b79", accent: "#7aa7ff" }),
  preset("Wonderland", { background: "#101a23", text: "#e0edf5", rise: "#68d7a7", fall: "#ff8c9a", accent: "#70d4e9" }),
];

export function normalizeTheme(value: unknown): WorkspaceTheme {
  if (!value || typeof value !== "object") return { ...DEFAULT_THEME };
  const source = value as Partial<WorkspaceTheme>;
  const known = THEME_PRESETS.find((item) => item.preset === source.preset);
  const background = typeof source.background === "string" && /^#[0-9a-f]{6}$/i.test(source.background)
    ? source.background : (known ?? DEFAULT_THEME).background;
  const palette = known ?? THEME_PRESETS[contrastInk(background) === "#111820" ? 2 : 1];
  // Early workspace migration saved a light chart background with every other dark default.
  const legacyLightTheme = !known && (!source.preset || source.preset === "Custom") && palette.preset === "System Light"
    && (["text", "rise", "fall", "buy", "sell", "accent"] as const)
      .every((key) => source[key] === undefined || source[key] === DEFAULT_THEME[key]);
  return {
    ...palette,
    ...Object.fromEntries(
      (["background", "text", "rise", "fall", "buy", "sell", "accent"] as const)
        .filter((key) => typeof source[key] === "string" && /^#[0-9a-f]{6}$/i.test(source[key]!))
        .filter((key) => !legacyLightTheme || key === "background")
        .map((key) => [key, source[key]]),
    ),
    preset: typeof source.preset === "string" ? source.preset : DEFAULT_THEME.preset,
  } as WorkspaceTheme;
}

export function resolveWorkspaceTheme(theme: WorkspaceTheme, systemDark: boolean): WorkspaceTheme {
  if (theme.preset !== "System") return theme;
  return { ...THEME_PRESETS[systemDark ? 1 : 2], preset: "System" };
}

export const THEME_STORAGE_KEY = "gc.workspace.theme.v1";
export const CUSTOM_THEMES_STORAGE_KEY = "gc.workspace.custom-themes.v1";
export const THEME_COLOR_KEYS = ["background", "text", "rise", "fall", "buy", "sell", "accent"] as const;
export type ThemeColorKey = typeof THEME_COLOR_KEYS[number];
export interface CustomWorkspaceTheme { id: string; theme: WorkspaceTheme }

export function loadCustomThemes(): CustomWorkspaceTheme[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const library: CustomWorkspaceTheme[] = [];
    for (const entry of stored) {
      if (!entry || typeof entry.id !== "string" || !entry.id || library.some((item) => item.id === entry.id)) continue;
      if (validateCustomTheme(entry.theme, library)) continue;
      library.push({ id: entry.id, theme: { ...entry.theme, preset: entry.theme.preset.trim() } });
    }
    return library;
  } catch {
    return [];
  }
}

export function validateCustomTheme(value: unknown, library: readonly CustomWorkspaceTheme[], editingId?: string): string | undefined {
  const theme = value as Partial<WorkspaceTheme> | null;
  if (!theme || typeof theme.preset !== "string" || !theme.preset.trim()) return "Enter a theme name.";
  const name = theme.preset.trim();
  if (name.length > 80) return "Use a theme name of 80 characters or fewer.";
  if (THEME_PRESETS.some((item) => item.preset.toLowerCase() === name.toLowerCase()) || name.toLowerCase() === "custom") {
    return "Choose a name different from the built-in presets and Custom.";
  }
  if (library.some((item) => item.id !== editingId && item.theme.preset.toLowerCase() === name.toLowerCase())) {
    return "A custom theme with this name already exists.";
  }
  if (THEME_COLOR_KEYS.some((key) => typeof theme[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(theme[key]!))) {
    return "Enter a six-digit HEX color (#RRGGBB) for every palette field.";
  }
  return undefined;
}

export function saveCustomTheme(theme: WorkspaceTheme, editingId?: string):
  { entry: CustomWorkspaceTheme; library: CustomWorkspaceTheme[]; error?: never } | { error: string; entry?: never; library?: never } {
  const library = loadCustomThemes();
  const error = validateCustomTheme(theme, library, editingId);
  if (error) return { error };
  if (editingId && !library.some((item) => item.id === editingId)) return { error: "This theme is no longer in the library. Create a new copy instead." };
  const entry = { id: editingId ?? crypto.randomUUID(), theme: { ...theme, preset: theme.preset.trim() } };
  const next = editingId ? library.map((item) => item.id === editingId ? entry : item) : [...library, entry];
  try {
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(next));
    return { entry, library: next };
  } catch {
    return { error: "The theme could not be saved. Check browser storage and try again." };
  }
}

let activeTheme = DEFAULT_THEME;
let preferredTheme = DEFAULT_THEME;
const themeListeners = new Set<() => void>();

export const getWorkspaceTheme = () => activeTheme;
export function subscribeWorkspaceTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => { themeListeners.delete(listener); };
}

export function initializeWorkspaceTheme() {
  try {
    preferredTheme = normalizeTheme(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? "null"));
  } catch {
    // Use the default when storage is unavailable.
  }
  const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
  const applyPreferred = () => applyWorkspaceTheme(resolveWorkspaceTheme(preferredTheme, scheme?.matches ?? true));
  applyPreferred();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY || !event.newValue) return;
    try {
      preferredTheme = normalizeTheme(JSON.parse(event.newValue));
      applyPreferred();
    } catch {
      // Keep the current theme when a stored value is invalid.
    }
  };
  window.addEventListener("storage", onStorage);
  scheme?.addEventListener("change", applyPreferred);
  const onParentTheme = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "workspace-theme") return;
    preferredTheme = normalizeTheme(event.data.theme);
    applyPreferred();
  };
  if (window.parent !== window && new URLSearchParams(window.location.search).has("widget")) {
    document.documentElement.dataset.workspaceWidget = "true";
    window.addEventListener("message", onParentTheme);
  }
  return () => {
    window.removeEventListener("storage", onStorage);
    scheme?.removeEventListener("change", applyPreferred);
    window.removeEventListener("message", onParentTheme);
  };
}

export function workspaceColors(theme: WorkspaceTheme) {
  const panel = mix(theme.background, theme.text, 0.09);
  return {
    ...theme,
    panel,
    muted: readableColor(mix(theme.text, theme.background, 0.4), panel),
    accentText: readableColor(theme.accent, panel),
    border: mix(theme.background, theme.text, 0.2),
    grid: mix(theme.background, theme.text, 0.08),
    crosshair: mix(theme.background, theme.text, 0.5),
  };
}
export type WorkspaceColors = ReturnType<typeof workspaceColors>;

export function applyWorkspaceTheme(theme: WorkspaceTheme, persist = false): void {
  preferredTheme = theme;
  const colors = workspaceColors(theme);
  const root = document.documentElement;
  root.style.colorScheme = contrastInk(theme.background) === "#111820" ? "light" : "dark";
  root.style.setProperty("--gc-background", theme.background);
  root.style.setProperty("--workspace-control-text", theme.text);
  root.style.setProperty("--workspace-control-border", mix(theme.background, theme.text, 0.25));
  root.style.setProperty("--workspace-hover-border", mix(theme.background, theme.accent, 0.6));
  root.style.setProperty("--workspace-hover", mix(theme.background, theme.text, 0.14));
  root.style.setProperty("--gc-panel", colors.panel);
  root.style.setProperty("--gc-control", mix(theme.background, theme.text, 0.045));
  root.style.setProperty("--gc-text", theme.text);
  root.style.setProperty("--gc-muted", colors.muted);
  root.style.setProperty("--gc-accent", theme.accent);
  root.style.setProperty("--gc-accent-text", colors.accentText);
  root.style.setProperty("--gc-accent-ink", contrastInk(theme.accent));
  root.style.setProperty("--gc-border", mix(theme.background, theme.text, 0.2));
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--bg", theme.background);
  root.style.setProperty("--panel", colors.panel);
  root.style.setProperty("--muted", colors.muted);
  root.style.setProperty("--border", mix(theme.background, theme.text, 0.2));
  root.style.setProperty("--workspace-rise", theme.rise);
  root.style.setProperty("--workspace-fall", theme.fall);
  root.style.setProperty("--up", theme.rise);
  root.style.setProperty("--down", theme.fall);
  root.style.setProperty("--workspace-buy", theme.buy);
  root.style.setProperty("--workspace-sell", theme.sell);
  root.style.setProperty("--workspace-buy-ink", contrastInk(theme.buy));
  root.style.setProperty("--workspace-sell-ink", contrastInk(theme.sell));
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme)); } catch {
      // The selected theme remains active without browser storage.
    }
  }
  if (JSON.stringify(activeTheme) !== JSON.stringify(theme)) {
    activeTheme = theme;
    for (const listener of themeListeners) listener();
  }
}

function mix(a: string, b: string, amount: number): string {
  const aa = [1, 3, 5].map((index) => parseInt(a.slice(index, index + 2), 16));
  const bb = [1, 3, 5].map((index) => parseInt(b.slice(index, index + 2), 16));
  return `#${aa.map((value, index) => Math.round(value * (1 - amount) + bb[index] * amount).toString(16).padStart(2, "0")).join("")}`;
}

function contrastInk(color: string): string {
  return luminance(color) > 0.179 ? "#111820" : "#f6fbff";
}

function luminance(color: string): number {
  const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function readableColor(color: string, background: string): string {
  const ink = contrastInk(background);
  const backgroundLuminance = luminance(background) + 0.05;
  for (let step = 0; step <= 10; step++) {
    const candidate = mix(color, ink, step / 10);
    const candidateLuminance = luminance(candidate) + 0.05;
    if (Math.max(candidateLuminance, backgroundLuminance) / Math.min(candidateLuminance, backgroundLuminance) >= 4.5) return candidate;
  }
  return ink;
}

