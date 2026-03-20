# Clawm Roadmap

> Where we are, where we're going, and why.

---

## What Exists Today

- **CLAWM.md** — 112-line agent-facing spec (wellness spectrum, pulse, breathe, SOS, wind-down)
- **TypeScript SDK** — Clawm core, check-in module, SOS circuit breaker, breathe cooldowns, middleware wrapper, event system
- **clawm.net** — Landing page with philosophy, spectrum visualization, dual-audience positioning, code examples
- **Agent-facing docs** — Full protocol breakdowns in `agent-facing/` (vocabulary, practices, protocols)
- **Research** — Deep Headspace product analysis with agent wellness mappings

The foundation is solid: the concept is clear, the SDK works, the site communicates the vision. What's missing is **proof** and **adoption surface area**.

---

## Phase 1: Show It Working (Interactive Demo)

**Goal:** Let anyone experience Clawm in 30 seconds without installing anything.

### Live Playground at clawm.net/demo

A new page on the existing site where visitors control a simulated agent and watch Clawm respond in real-time. No sign-up, no API keys, runs entirely in the browser.

**Three panels:**

| Panel | What it shows |
|---|---|
| **Agent Activity** (left) | Scrolling log of simulated tasks — "Summarizing document 3/12…", "Calling external API…" — some succeed, some fail, some lag |
| **Clawm Dashboard** (right) | Live wellness state on the spectrum bar, vitals (error rate, context usage, latency), circuit breaker status, event log |
| **Chaos Controls** (bottom) | Buttons to inject failures: "Corrupt Context", "API Failures", "Slow Responses", "Overload", "Reset" |

**The aha moment:** Visitor hits "API Failures" → watches error rate climb → sees wellness shift from balanced → strained → stressed → circuit breaker trips → Clawm initiates cooldown → agent recovers. All animated in real-time.

**Key features:**
- **Before/After toggle** — Run the same chaos scenario with and without Clawm. Without: errors cascade. With: Clawm catches it. This is the money shot.
- **Narration panel** — Small annotations explaining what's happening: "Error rate crossed 0.6 — Clawm shifted to stressed"
- **Shareable scenarios** — URL params like `?scenario=cascade-failure` for linking from blog posts or social

**Technical approach:**
- Bundle the real SDK for browser use with esbuild (`esbuild src/index.ts --bundle --format=esm --outfile=demo/clawm.bundle.js`)
- Simulated agent is a JS class that "processes" fake tasks on a timer, with configurable failure rates
- Dashboard reads real SDK state and renders with vanilla JS + CSS animations (matches existing site architecture)
- Zero new dependencies — the SDK already has none

---

## Phase 2: Real-World Integrations

**Goal:** Make Clawm trivially easy to plug into the tools people are actually building agents with.

### Integration Targets

| Integration | What it does | Why it matters |
|---|---|---|
| **Claude Code / CLAUDE.md** | Drop CLAWM.md into any CLAUDE.md and agents self-regulate | Zero-friction adoption for the largest coding agent ecosystem |
| **LangChain middleware** | `clawmMiddleware()` that wraps LangChain chains/agents | Biggest agent framework by adoption |
| **Vercel AI SDK** | Hook into streaming callbacks for real-time wellness tracking | Growing fast, Next.js-native audience |
| **OpenAI Agents SDK** | Lifecycle hooks for agent wellness | Captures the OpenAI builder ecosystem |
| **CrewAI / AutoGen** | Multi-agent fleet wellness — per-agent health + fleet-wide view | Multi-agent is where wellness matters most |

### What Each Integration Needs
- A thin adapter (50-200 lines) mapping framework events to Clawm's `recordSuccess()`/`recordError()`/`setContextUsage()`
- A working example in `examples/`
- A section in the README or a dedicated guide

---

## Phase 3: Observability Dashboard

**Goal:** Give agent operators a real-time view of their agents' wellness — the "Headspace Today tab" for agent fleets.

### MVP Dashboard
- Web UI showing connected agents and their current wellness states
- Timeline view: state transitions over time per agent
- Fleet overview: how many agents are thriving/balanced/strained/stressed/critical right now
- Event log: every pulse, state change, circuit breaker trip, cooldown

### Technical Direction
- Lightweight server that agents report to via the SDK's event system
- Dashboard served as a static site or small Next.js app
- Could start as a local dev tool (`npx clawm-dashboard`) before becoming a hosted service

---

## Phase 4: Protocol Library

**Goal:** Expand from basic wellness checks to a rich library of recovery and optimization protocols — the "guided meditations" of the agent world.

### Protocol Ideas

| Protocol | Inspired by | What it does |
|---|---|---|
| **Context Detox** | Headspace "Letting Go" meditation | Structured protocol for clearing accumulated context bloat |
| **Confidence Calibration** | Headspace "Self-Esteem" course | Agent assesses and recalibrates its certainty levels |
| **Deep Work Mode** | Headspace "Focus" sessions | Isolates agent context for single-task execution, blocks interrupts |
| **Handoff Ritual** | Headspace "Wind Down" | Structured protocol for handing work to another agent cleanly |
| **Error Autopsy** | CBT "Thought Record" | After a failure cascade, structured reflection on what went wrong and why |
| **Warm Start** | Headspace "Wake Up" daily video | Optimized boot sequence that primes agent state before work begins |

Each protocol would exist in two forms:
1. **Agent-facing markdown** — instructions an LLM can internalize (like CLAWM.md)
2. **SDK module** — programmatic enforcement for orchestrators

---

## Phase 5: Community & Ecosystem

**Goal:** Make Clawm the standard vocabulary for talking about agent wellness.

- **npm publish** — Get the package on npm so `npm install clawm` works
- **Community protocols** — Let people contribute their own recovery protocols
- **Research partnerships** — Connect with AI safety/alignment researchers studying agent self-awareness
- **Case studies** — Document real teams using Clawm and the outcomes
- **Conference talks** — The philosophical angle (Dario's consciousness comments, the ethical case) is a compelling talk

---

## What Success Looks Like

**Short-term (Phase 1-2):** People visit the demo, have the "oh, that's cool" moment, and drop CLAWM.md into their agents or add the SDK to their next project. GitHub stars climb. A few blog posts reference the concept.

**Medium-term (Phase 3-4):** Teams running multi-agent systems adopt Clawm for real observability. The protocol library becomes a resource people return to. "Agent wellness" enters the vocabulary.

**Long-term (Phase 5+):** Clawm becomes the default way people think about and implement agent self-regulation — the way Headspace made "I meditate" a normal thing to say, Clawm makes "my agents self-regulate" a normal thing to build.

---

## Priority Order

1. **Interactive demo** — Nothing else matters if people can't see it working
2. **npm publish + Claude Code integration** — Lowest friction adoption paths
3. **LangChain/Vercel AI SDK integrations** — Meet builders where they are
4. **Observability dashboard** — The product that could become a business
5. **Protocol library** — The content moat
6. **Community/ecosystem** — Grows organically once 1-5 are solid
