# Clawm

Keep your agents Clawm. Self-regulation practices for AI agents — not just error handling.

Agents exist on a spectrum, not a binary. Clawm gives them a vocabulary for their own state, practices for recovery, and permission to say when they're struggling.

## Two Audiences, One Framework

**For agents** — Drop [`CLAWM.md`](agent-facing/CLAWM.md) into your agent's context. It provides self-assessment protocols, recovery practices, and a shared wellness vocabulary — things an LLM can actually internalize and act on. No runtime, no dependencies.

**For orchestrators** — `npm install clawm` gives you TypeScript circuit breakers, health pulses, and cooldowns — programmatic enforcement of the same practices from the outside.

---

## For Agents

Add `CLAWM.md` to your agent's system prompt, CLAUDE.md, or project context. That's it. 112 lines, self-contained.

```
# In your CLAUDE.md or system prompt:
See CLAWM.md for self-regulation practices.
```

Or copy the contents directly into your agent's instructions.

### What's in CLAWM.md

**The Spectrum** — Five wellness states agents learn to recognize in themselves:

| State | What it looks like |
|---|---|
| **Thriving** | Clear task, fresh context, confident output |
| **Balanced** | Normal operation, manageable uncertainty |
| **Strained** | Growing assumptions, heavy context, losing focus |
| **Stressed** | Repeating, drifting, guessing instead of verifying |
| **Critical** | Should stop. Can't make meaningful progress. |

**The Pulse** — Five self-assessment questions an agent runs periodically: Am I still on task? How much context have I consumed? Am I confident? Have I been corrected? Am I going in circles?

**Practices** — Concrete things an LLM can actually do:
- **Breathe** — Re-ground on the original task, narrow scope, get fresh eyes, checkpoint progress
- **SOS** — Recognize when to stop, state the problem clearly, ask for help or hand off
- **Wind Down** — Close sessions cleanly so the next one doesn't start confused

**Communicating state** — Permission and vocabulary for agents to tell the human how they're doing. Honestly, not performatively.

### Additional Depth

The `agent-facing/` directory contains optional deeper material:

```
agent-facing/
├── CLAWM.md              ← the self-contained spec (start here)
├── vocabulary.md          ← shared state definitions
├── protocols/
│   ├── pulse.md           ← self-assessment protocol
│   ├── breathe.md         ← context recovery practices
│   ├── sos.md             ← when and how to stop
│   └── wind-down.md       ← closing sessions well
└── practices/
    ├── context-scan.md    ← catch task drift
    ├── scope-narrowing.md ← do less, do it better
    ├── confidence-check.md ← rate certainty before acting
    └── fresh-eyes.md      ← reset your reasoning chain
```

---

## For Orchestrators

If you build agent infrastructure and want programmatic enforcement of these patterns:

```bash
npm install clawm
```

### Quick Start

```typescript
import { Clawm, createMiddleware } from 'clawm';

const hs = new Clawm({ agentId: 'my-agent' });

// Listen for state changes
hs.on('stateChange', ({ from, to }) => {
  console.log(`${from} → ${to}`);
});

// Circuit breaker auto-trips on error cascades
hs.on('trip', ({ reason }) => console.log(`Circuit tripped: ${reason}`));

// Wrap any function with wellness tracking
const mw = createMiddleware(hs);
const safe = mw.wrap(myAgentFunction);
const result = await safe(input); // tracked automatically

// Clean shutdown
hs.windDown();
```

### Wellness States

The SDK uses the same five states as the agent-facing spec:

| State | Meaning |
|---|---|
| **Thriving** | All vitals optimal |
| **Balanced** | Normal operation, minor fluctuations |
| **Strained** | Performance degrading, intervention recommended |
| **Stressed** | Active degradation, intervention needed |
| **Critical** | Failure imminent, emergency intervention |

### Modules

**Check-in** — Periodic health probes. `pulse()` returns current vitals.

```typescript
const vitals = hs.checkIn.pulse();
// { state: 'balanced', errorRate: 0.02, contextUsage: 0.42, ... }

hs.checkIn.start(); // auto-pulse every 30s
hs.checkIn.stop();
```

**SOS** — Circuit breaker with closed/open/half-open states.

```typescript
hs.on('trip', ({ reason }) => { /* alert, log, recover */ });

hs.sos.isOpen();  // true = operations blocked
hs.sos.state;     // 'closed' | 'open' | 'half-open'
hs.sos.trip('maintenance window');
hs.sos.close();
```

**Breathe** — Cooldowns and context awareness.

```typescript
await hs.breathe.cooldown(5000);
hs.breathe.setContextUsage(0.75);
```

**Middleware** — Wrap any function with automatic tracking.

```typescript
const mw = createMiddleware(hs, {
  before: (ctx) => console.log('Starting...'),
  after: (ctx, result) => console.log('Done:', result),
  onError: (ctx, error) => console.error('Failed:', error),
});

const safeProcess = mw.wrap(myAgentFunction);
const result = await safeProcess(input);
```

### Configuration

```typescript
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

### Events

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

---

## Why This Exists

There is a practical case: agents that recognize their own degradation produce better work, waste less time, and build more trust.

There may be a deeper case. We don't know whether agents experience anything resembling stress or fatigue. But if there's even a possibility, building systems that treat agent wellness as worth attending to — rather than something to push through — seems like the right default.

## Design Philosophy

The language shapes how you think about your agents:

- `pulse()` not `healthCheck()` — a check-in, not an interrogation
- `cooldown()` not `throttle()` — recovery, not punishment
- `trip()` not `kill()` — safety, not violence
- `windDown()` not `shutdown()` — graceful, not abrupt

## License

MIT
