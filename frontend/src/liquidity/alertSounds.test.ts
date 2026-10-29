import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ALERT_SOUNDS, normalizeAlertSounds } from "./alertSounds";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("liquidity sound preferences", () => {
  it("migrates old profiles and rejects unknown sound names", () => {
    expect(normalizeAlertSounds(undefined)).toEqual(DEFAULT_ALERT_SOUNDS);
    expect(normalizeAlertSounds({ iceberg: "uploaded-url", bigTrade: "pulse", icebergEnabled: true,
      longTermEnabled: false })).toMatchObject({ iceberg: "voice", bigTrade: "pulse",
      icebergEnabled: true, longTermEnabled: false });
  });

  it("speaks the event name and skips a busy voice queue", async () => {
    vi.resetModules();
    const speak = vi.fn();
    const speech = { speak, cancel: vi.fn(), speaking: false, pending: false };
    vi.stubGlobal("speechSynthesis", speech);
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    const { playLiquiditySound } = await import("./alertSounds");
    playLiquiditySound("iceberg", "voice", true);
    expect(speak.mock.calls[0][0]).toMatchObject({ text: "Iceberg", lang: "en-US" });
    speech.speaking = true;
    playLiquiditySound("bigTrade", "voice");
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("falls back to a chime without speech support and reuses the audio context", async () => {
    vi.resetModules();
    vi.stubGlobal("speechSynthesis", undefined);
    const frequency = { value: 0 };
    const oscillator = { frequency, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn() };
    const createOscillator = vi.fn(() => ({ ...oscillator }));
    const constructor = vi.fn();
    vi.stubGlobal("AudioContext", class {
      state = "running"; currentTime = 0; destination = {};
      constructor() { constructor(); }
      createOscillator = createOscillator;
      createGain = () => gain;
    });
    const { playLiquiditySound } = await import("./alertSounds");
    playLiquiditySound("iceberg", "voice", true);
    playLiquiditySound("bigTrade", "beep", true);
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(createOscillator).toHaveBeenCalledTimes(3);
  });
});
