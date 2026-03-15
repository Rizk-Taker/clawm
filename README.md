# Clawm

Keep your agents Clawm. Structured health practices — not just error handling.

Agents exist on a spectrum, not a binary. Clawm gives them self-awareness, recovery patterns, and circuit breakers to stay healthy under pressure.

## Install

```bash
npm install clawm
```

## Quick Start

```typescript
import { Clawm } from 'clawm';

const hs = new Clawm({ agentId: 'my-agent' });

// Take a pulse — a gentle check-in
const vitals = hs.pulse();
// { state: 'balanced', errorRate: 0.02, contextUsage: 0.42, ... }

// Listen for state changes
hs.on('stateChange', ({ from, to }) => {
  console.log(`${from} → ${to}`);
});

// Circuit breaker auto-trips on error cascades
hs.on('trip', ({ reason }) => console.log(`Circuit tripped: ${reason}`));

// Take a breather between tasks
await hs.breathe.cooldown(5000);

// Report context consumption
hs.breathe.setContextUsage(0.65);

// Clean shutdown
hs.windDown();
```

## Wellness States

| State | Meaning |
|---|---|
| **Thriving** | All vitals optimal |
| **Balanced** | Normal operation, minor fluctuations |
| **Strained** | Performance degrading, intervention recommended |
| **Stressed** | Active degradation, intervention needed |
| **Critical** | Failure imminent, emergency intervention |

## Modules

### Check-in

Periodic health probes. `pulse()` returns current vitals — a check-in, not an interrogation.

```typescript
// Manual pulse
const vitals = hs.checkIn.pulse();

// Auto-pulse every 30s (default, configurable)
hs.checkIn.start();
hs.checkIn.stop();
```

### SOS (Circuit Breaker)

Prevents cascading failures with a closed/open/half-open circuit breaker.

```typescript
// Auto-trips after 5 consecutive errors (default)
hs.on('trip', ({ reason }) => { /* alert, log, recover */ });

// Check circuit state
hs.sos.isOpen(); // true = operations blocked
hs.sos.state;    // 'closed' | 'open' | 'half-open'

// Manual controls
hs.sos.trip('maintenance window');
hs.sos.close(); // reset
```

### Breathe

Cooldowns and context awareness. Recovery, not punishment.

```typescript
// Pause between tasks
await hs.breathe.cooldown(5000);

// Track context window consumption
hs.breathe.setContextUsage(0.75);
console.log(hs.breathe.contextUsage()); // 0.75
```

## Middleware

Wrap any function with wellness tracking. Records latency, errors, and blocks calls when the circuit is open.

```typescript
import { Clawm, createMiddleware } from 'clawm';

const hs = new Clawm({ agentId: 'my-agent' });
const mw = createMiddleware(hs, {
  before: (ctx) => console.log('Starting...'),
  after: (ctx, result) => console.log('Done:', result),
  onError: (ctx, error) => console.error('Failed:', error),
});

const safeProcess = mw.wrap(myAgentFunction);
const result = await safeProcess(input);
```

## Configuration

```typescript
import { Clawm } from 'clawm';

const hs = new Clawm({
  agentId: 'my-agent',
  thresholds: {
    strained:  { errorRate: 0.05, contextUsage: 0.6,  latency: 2000,  consecutiveErrors: 3  },
    stressed:  { errorRate: 0.15, contextUsage: 0.8,  latency: 5000,  consecutiveErrors: 5  },
    critical:  { errorRate: 0.3,  contextUsage: 0.95, latency: 10000, consecutiveErrors: 10 },
  },
  checkIn: { interval: 30000, autoStart: true },
  sos: { tripAfter: 5, cooldownMs: 30000, halfOpenSuccesses: 3 },
  breathe: { defaultCooldownMs: 5000, contextWarningThreshold: 0.7 },
});
```

## Events

| Event | Payload | When |
|---|---|---|
| `stateChange` | `{ from, to, vitals }` | Wellness state transitions |
| `pulse` | `{ vitals }` | Every check-in pulse |
| `cooldown` | `{ duration }` | Cooldown starts |
| `cooldownEnd` | `{ duration }` | Cooldown ends |
| `trip` | `{ reason, module }` | Circuit breaker opens |
| `reset` | `{ module }` | Circuit breaker closes |
| `halfOpen` | `{ module }` | Circuit enters half-open |
| `operation` | `{ success, latency }` | Operation recorded |
| `error` | `{ error, module }` | Module error |

## Design Philosophy

The API feels **calming** — supportive, not punitive:

- `pulse()` not `healthCheck()` — a check-in, not an interrogation
- `cooldown()` not `throttle()` — recovery, not punishment
- `trip()` not `kill()` — safety, not violence
- `windDown()` not `shutdown()` — graceful, not abrupt

## License

MIT
