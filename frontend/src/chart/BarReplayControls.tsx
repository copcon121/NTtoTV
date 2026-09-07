import {
  BAR_REPLAY_SPEEDS,
  type BarReplaySpeed,
} from "./barReplay";

export type BarReplayPhase = "idle" | "selecting" | "active";

export interface BarReplayControlsProps {
  phase: BarReplayPhase;
  playing: boolean;
  speed: BarReplaySpeed;
  currentBar: number;
  totalBars: number;
  selectionError?: string;
  onCancelSelection: () => void;
  onTogglePlaying: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSpeedChange: (speed: BarReplaySpeed) => void;
  onExit: () => void;
}

export function BarReplayControls({
  phase,
  playing,
  speed,
  currentBar,
  totalBars,
  selectionError,
  onCancelSelection,
  onTogglePlaying,
  onStepBack,
  onStepForward,
  onSpeedChange,
  onExit,
}: BarReplayControlsProps) {
  if (phase === "idle") {
    return null;
  }

  if (phase === "selecting") {
    return (
      <div className="bar-replay-controls is-selecting" role="status">
        <span>{selectionError || "Click a candle to choose the replay start"}</span>
        <button type="button" onClick={onCancelSelection}>Cancel</button>
      </div>
    );
  }

  const complete = totalBars > 0 && currentBar >= totalBars;
  return (
    <div className="bar-replay-controls is-active" aria-label="Bar replay controls">
      <span className="bar-replay-live-lock" title="Live MT5 trading is disabled during replay">
        Replay
      </span>
      <button type="button" onClick={onStepBack} disabled={currentBar <= 1}>
        Back
      </button>
      <button
        type="button"
        className="bar-replay-main"
        onClick={onTogglePlaying}
        disabled={complete}
      >
        {playing ? "Pause" : complete ? "Done" : "Play"}
      </button>
      <button type="button" onClick={onStepForward} disabled={complete}>
        Step
      </button>
      <label className="bar-replay-speed">
        <span className="sr-only">Replay speed</span>
        <select
          aria-label="Replay speed"
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.currentTarget.value) as BarReplaySpeed)}
        >
          {BAR_REPLAY_SPEEDS.map((value) => (
            <option key={value} value={value}>{value}x</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onExit}>Live</button>
    </div>
  );
}
