// Core
export { Clawm } from './clawm.js';
export { ClawmEmitter } from './events.js';
export { VitalsAggregator } from './vitals.js';
export { defineConfig, DEFAULT_THRESHOLDS, DEFAULT_CONFIG } from './config.js';

// Modules
export { CheckInModule } from './modules/check-in.js';
export { SOSModule } from './modules/sos.js';
export { BreatheModule } from './modules/breathe.js';

// Storage
export { MemoryStorage } from './storage/memory.js';

// Middleware
export { createMiddleware } from './middleware/index.js';

// Types
export type {
  WellnessState,
  Vitals,
  VitalsSnapshot,
  Thresholds,
  StateThresholds,
  ClawmConfig,
  ClawmEvents,
  ClawmEventName,
  CheckInConfig,
  SOSConfig,
  BreatheConfig,
  Module,
  StorageAdapter,
  CircuitState,
  MiddlewareContext,
  BeforeHook,
  AfterHook,
  ErrorHook,
} from './types.js';
export { WELLNESS_STATES } from './types.js';
