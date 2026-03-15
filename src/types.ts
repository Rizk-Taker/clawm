// ── Wellness States ──────────────────────────────────────────────

export type WellnessState = 'thriving' | 'balanced' | 'strained' | 'stressed' | 'critical';

export const WELLNESS_STATES: readonly WellnessState[] = [
  'thriving',
  'balanced',
  'strained',
  'stressed',
  'critical',
] as const;

// ── Vitals ──────────────────────────────────────────────────────

export interface Vitals {
  state: WellnessState;
  errorRate: number;        // 0-1 ratio of errors to total operations
  contextUsage: number;     // 0-1 ratio of context consumed
  latency: number;          // average latency in ms
  consecutiveErrors: number;
  uptime: number;           // ms since start
  timestamp: number;        // Date.now()
}

export interface VitalsSnapshot {
  totalOperations: number;
  totalErrors: number;
  errorRate: number;
  contextUsage: number;
  latency: number;
  consecutiveErrors: number;
  uptime: number;
}

// ── Thresholds ──────────────────────────────────────────────────

export interface StateThresholds {
  errorRate: number;
  contextUsage: number;
  latency: number;
  consecutiveErrors: number;
}

export interface Thresholds {
  strained: StateThresholds;
  stressed: StateThresholds;
  critical: StateThresholds;
}

// ── Events ──────────────────────────────────────────────────────

export interface ClawmEvents {
  stateChange: { from: WellnessState; to: WellnessState; vitals: Vitals };
  pulse: { vitals: Vitals };
  cooldown: { duration: number };
  cooldownEnd: { duration: number };
  trip: { reason: string; module: string };
  reset: { module: string };
  halfOpen: { module: string };
  error: { error: Error; module: string };
  operation: { success: boolean; latency: number };
}

export type ClawmEventName = keyof ClawmEvents;

// ── Config ──────────────────────────────────────────────────────

export interface CheckInConfig {
  /** Interval in ms between automatic pulses. 0 = disabled. */
  interval: number;
  /** Whether to start automatic check-ins on initialization. */
  autoStart: boolean;
}

export interface SOSConfig {
  /** Number of consecutive errors before tripping the circuit. */
  tripAfter: number;
  /** Time in ms to wait in open state before moving to half-open. */
  cooldownMs: number;
  /** Number of successes in half-open state before fully closing. */
  halfOpenSuccesses: number;
}

export interface BreatheConfig {
  /** Default cooldown duration in ms. */
  defaultCooldownMs: number;
  /** Context usage warning threshold (0-1). */
  contextWarningThreshold: number;
}

export interface ClawmConfig {
  agentId: string;
  thresholds: Thresholds;
  checkIn: CheckInConfig;
  sos: SOSConfig;
  breathe: BreatheConfig;
}

// ── Module Interface ────────────────────────────────────────────

export interface Module {
  readonly name: string;
  start(): void;
  stop(): void;
  destroy(): void;
}

// ── Storage ─────────────────────────────────────────────────────

export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

// ── Middleware ───────────────────────────────────────────────────

export interface MiddlewareContext {
  startTime: number;
  vitals: Vitals;
}

export type BeforeHook = (ctx: MiddlewareContext) => void | Promise<void>;
export type AfterHook = (ctx: MiddlewareContext, result: unknown) => void | Promise<void>;
export type ErrorHook = (ctx: MiddlewareContext, error: Error) => void | Promise<void>;

// ── Circuit Breaker ─────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';
