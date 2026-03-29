# CLAUDE.md — clawm

Wellness framework for AI agents. Self-regulation, circuit breakers, and health monitoring — not just error handling.

## Quick Reference

```bash
npm test            # vitest run (all tests)
npm run test:watch  # vitest in watch mode
npm run build       # tsc -p tsconfig.build.json → dist/
npm run typecheck   # tsc --noEmit (type-check only)
```

## Tech Stack

- **TypeScript** (strict mode, ES2022 target, NodeNext modules)
- **Vitest** for testing (globals enabled, node environment)
- **Node.js >=18** — zero runtime dependencies
- Output: ESM (`dist/index.js`) + CJS (`dist/index.cjs`) + type declarations

## Project Structure

```
src/
  index.ts            # Public API barrel export
  clawm.ts            # Clawm class — main orchestrator
  types.ts            # All type definitions (WellnessState, Vitals, configs, etc.)
  config.ts           # Default thresholds + defineConfig() merge helper
  events.ts           # ClawmEmitter — typed EventEmitter wrapper
  vitals.ts           # VitalsAggregator — tracks metrics, determines wellness state
  modules/
    check-in.ts       # CheckInModule — periodic pulse / vitals snapshots
    sos.ts            # SOSModule — circuit breaker (closed → open → half-open)
    breathe.ts        # BreatheModule — cooldowns and context usage tracking
  middleware/
    index.ts          # createMiddleware() — wrap async functions with auto-tracking
  storage/
    types.ts          # Re-exports StorageAdapter from types.ts
    memory.ts         # MemoryStorage — in-memory Map-based StorageAdapter
tests/
  headspace.test.ts   # Core Clawm class tests
  vitals.test.ts      # VitalsAggregator tests
  modules/
    sos.test.ts       # Circuit breaker tests
    breathe.test.ts   # Cooldown/context tests
    check-in.test.ts  # Pulse/interval tests
  middleware/
    middleware.test.ts # Middleware wrap tests
agent-facing/         # Markdown docs designed to be read by AI agents
  CLAWM.md            # Agent-facing overview
  vocabulary.md       # Domain terminology
  protocols/          # Breathe, SOS, wind-down, pulse protocols
  practices/          # Fresh-eyes, confidence-check, context-scan, scope-narrowing
examples/
  basic.ts            # Usage example
```

## Architecture

**Clawm** is the main entry point. It composes three modules:

1. **CheckIn** — periodic health pulses. Calls `VitalsAggregator.getVitals()` and emits `pulse` events.
2. **SOS** — circuit breaker. Tracks consecutive errors, trips open after threshold, auto-transitions to half-open after cooldown, closes after N successes.
3. **Breathe** — cooldowns (`breathe.cooldown(ms)`) and context usage tracking (`breathe.setContextUsage(0-1)`).

All modules communicate through **ClawmEmitter** (typed wrapper around Node EventEmitter). **VitalsAggregator** is the single source of truth for metrics and wellness state determination.

### Wellness States (ordered by severity)
`thriving` → `balanced` → `strained` → `stressed` → `critical`

State is determined by comparing error rate, context usage, latency, and consecutive errors against configurable thresholds.

### Circuit States (SOS module)
`closed` (normal) → `open` (tripped, blocks operations) → `half-open` (testing recovery)

## Key Conventions

- **Module interface**: all modules implement `{ name, start(), stop(), destroy() }`
- **Imports use `.js` extension** — required for NodeNext module resolution (even for .ts source files)
- **No runtime dependencies** — only devDependencies (typescript, vitest, @types/node)
- **Timers call `.unref()`** to avoid keeping the process alive
- **Config uses deep merge** — partial configs merge with `DEFAULT_THRESHOLDS` / `DEFAULT_CONFIG`
- **Wellness vocabulary** — the codebase uses wellness metaphors intentionally (pulse, breathe, check-in, SOS, wind-down). Maintain this language.

## Testing Patterns

- Tests live in `tests/` mirroring `src/` structure
- Vitest globals enabled — use `describe`, `it`, `expect`, `afterEach` without imports (though existing tests do import them)
- Always call `clawm.windDown()` in `afterEach` to clean up timers
- Disable auto check-ins in tests: `{ checkIn: { interval: 0, autoStart: false } }`
- Tests are synchronous where possible; use `vi.useFakeTimers()` for timer-dependent tests

## Exports

Two package entry points:
- `clawm` — everything (Clawm, modules, types, config, storage)
- `clawm/middleware` — just `createMiddleware()`

## Adding a New Module

1. Create `src/modules/my-module.ts` implementing the `Module` interface
2. Add config type to `types.ts`, add defaults to `config.ts`
3. Wire it into `Clawm` constructor in `clawm.ts`
4. Export from `src/modules/index.ts` and `src/index.ts`
5. Add tests in `tests/modules/my-module.test.ts`
6. Optionally add agent-facing docs in `agent-facing/protocols/`
