/**
 * Types and interfaces for Scan AI (Suggestions on chart).
 * Technical detection of levels, trendlines, Fibonacci, patterns, and Elliott waves.
 */

export type ScanAiGroup =
  | "levels"
  | "lines"
  | "fibonacci"
  | "patterns"
  | "elliott";

export type ScanAiState =
  | "waiting"
  | "in_play"
  | "tested"
  | "played_out"
  | "invalidated"
  | "old";

export type ScanAiStrength = "all" | "moderate" | "strong";

export type ScanAiDensity = "auto" | "less" | "normal" | "more";

export type ScanAiDepth = "short" | "medium" | "deep";

export interface ScanAiAnchor {
  time: number; // Unix timestamp in seconds
  price: number;
}

export interface ScanAiDrawingOptions {
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed";
  fillColor?: string;
  color?: string;
  fill?: string;
  fibLevels?: { level: number; color?: string }[];
}

export interface ScanAiSuggestion {
  id: string;
  group: ScanAiGroup;
  type: string;
  label?: string;
  name?: string;
  description?: string;
  state: ScanAiState;
  strength: "all" | "moderate" | "strong" | "weak";
  score: number;
  drawingTool: "horizontal_ray" | "trendline" | "fib_retracement" | "rectangle" | "path";
  anchors: ScanAiAnchor[];
  options?: ScanAiDrawingOptions & Record<string, any>;
  target?: number | null;
  stop?: number | null;
  invalidationPrice?: number | null;
  metrics?: Record<string, any>;
  createdAt?: number;
}

export interface ScanAiRequest {
  symbol: string;
  contract: string;
  timeframe: string;
  depth?: ScanAiDepth;
  density?: ScanAiDensity;
  strength?: ScanAiStrength;
  states?: ScanAiState[];
  groups?: ScanAiGroup[];
  patterns?: string[];
  targetsAndStop?: boolean;
  from?: number;
  to?: number;
}

export interface ScanAiResponse {
  symbol: string;
  contract: string;
  timeframe: string;
  depth: ScanAiDepth;
  density: ScanAiDensity;
  strength: ScanAiStrength;
  evaluatedBars: number;
  suggestions: ScanAiSuggestion[];
  summary: {
    totalSuggestions: number;
    groupCounts: Record<string, number>;
  };
}
