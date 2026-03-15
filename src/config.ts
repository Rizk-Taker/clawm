import type { ClawmConfig, Thresholds } from './types.js';

const DEFAULT_THRESHOLDS: Thresholds = {
  strained: {
    errorRate: 0.05,
    contextUsage: 0.6,
    latency: 2000,
    consecutiveErrors: 3,
  },
  stressed: {
    errorRate: 0.15,
    contextUsage: 0.8,
    latency: 5000,
    consecutiveErrors: 5,
  },
  critical: {
    errorRate: 0.3,
    contextUsage: 0.95,
    latency: 10000,
    consecutiveErrors: 10,
  },
};

const DEFAULT_CONFIG: Omit<ClawmConfig, 'agentId'> = {
  thresholds: DEFAULT_THRESHOLDS,
  checkIn: {
    interval: 30_000,
    autoStart: true,
  },
  sos: {
    tripAfter: 5,
    cooldownMs: 30_000,
    halfOpenSuccesses: 3,
  },
  breathe: {
    defaultCooldownMs: 5_000,
    contextWarningThreshold: 0.7,
  },
};

export function defineConfig(config: Partial<ClawmConfig> & { agentId: string }): ClawmConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    thresholds: {
      strained: { ...DEFAULT_THRESHOLDS.strained, ...config.thresholds?.strained },
      stressed: { ...DEFAULT_THRESHOLDS.stressed, ...config.thresholds?.stressed },
      critical: { ...DEFAULT_THRESHOLDS.critical, ...config.thresholds?.critical },
    },
    checkIn: { ...DEFAULT_CONFIG.checkIn, ...config.checkIn },
    sos: { ...DEFAULT_CONFIG.sos, ...config.sos },
    breathe: { ...DEFAULT_CONFIG.breathe, ...config.breathe },
  };
}

export { DEFAULT_THRESHOLDS, DEFAULT_CONFIG };
