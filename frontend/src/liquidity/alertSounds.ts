export type LiquiditySound = "voice" | "beep" | "chime" | "pulse";
export type LiquiditySoundEvent = "iceberg" | "bigTrade" | "longTerm" | "volumeSpike" | "absorption" | "volumeStop";

export interface LiquidityAlertSounds {
  icebergEnabled: boolean;
  longTermEnabled: boolean;
  iceberg: LiquiditySound;
  bigTrade: LiquiditySound;
  longTerm: LiquiditySound;
  volumeSpike: LiquiditySound;
  absorption: LiquiditySound;
  volumeStop: LiquiditySound;
}

export const SOUND_OPTIONS: readonly [LiquiditySound, string][] = [
  ["voice", "Voice (event name)"], ["beep", "Beep"], ["chime", "Chime"], ["pulse", "Double pulse"],
];
export const DEFAULT_ALERT_SOUNDS: LiquidityAlertSounds = {
  icebergEnabled: false, longTermEnabled: true,
  iceberg: "voice", bigTrade: "beep", longTerm: "chime",
  volumeSpike: "chime", absorption: "pulse", volumeStop: "beep",
};
const EVENT_NAMES: Record<LiquiditySoundEvent, string> = {
  iceberg: "Iceberg", bigTrade: "Big trade", longTerm: "Long term liquidity",
  volumeSpike: "Volume spike", absorption: "Absorption", volumeStop: "SI Stops",
};

export function normalizeAlertSounds(input: unknown): LiquidityAlertSounds {
  const source = input && typeof input === "object" ? input as Partial<LiquidityAlertSounds> : {};
  const result = { ...DEFAULT_ALERT_SOUNDS };
  for (const event of Object.keys(EVENT_NAMES) as LiquiditySoundEvent[]) {
    if (SOUND_OPTIONS.some(([value]) => value === source[event])) result[event] = source[event]!;
  }
  result.icebergEnabled = source.icebergEnabled === true;
  result.longTermEnabled = source.longTermEnabled !== false;
  return result;
}

// One reusable context, unlocked by a user gesture, keeps alerts inexpensive.
let audioContext: AudioContext | undefined;
const lastPlayed = new Map<LiquiditySoundEvent, number>();
function getAudioContext(): AudioContext | undefined {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return undefined;
  if (!audioContext || audioContext.state === "closed") audioContext = new Ctx();
  return audioContext;
}

export function unlockAlertAudio(): void {
  try {
    const context = getAudioContext();
    if (context?.state === "suspended") void context.resume().catch(() => {});
  } catch { /* Audio is optional. */ }
}

export function playLiquiditySound(
  event: LiquiditySoundEvent, sound: LiquiditySound, preview = false,
): void {
  try {
    const now = Date.now();
    if (!preview && now - (lastPlayed.get(event) ?? 0) < (sound === "voice" ? 2_000 : 500)) return;
    lastPlayed.set(event, now);
    if (sound === "voice" && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
      // Skip busy speech instead of building a delayed queue of market alerts.
      if (!preview && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) return;
      if (preview) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(EVENT_NAMES[event]);
      utterance.lang = "en-US";
      utterance.rate = 1.05;
      utterance.onerror = (error) => {
        if (error.error !== "canceled" && error.error !== "interrupted") playLiquiditySound(event, "chime", true);
      };
      window.speechSynthesis.speak(utterance);
      return;
    }
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume().catch(() => {});
    const frequencies = sound === "beep" ? [660] : sound === "pulse" ? [440, 440] : [660, 990];
    frequencies.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.17;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  } catch { /* Audio must never interrupt the chart. */ }
}
