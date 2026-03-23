// src/events.ts
var ClawmEmitter = class {
  listeners = /* @__PURE__ */ new Map();
  onceWrapped = /* @__PURE__ */ new WeakMap();
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(listener);
    return this;
  }
  once(event, listener) {
    const wrapped = (data) => {
      this.off(event, wrapped);
      listener(data);
    };
    this.onceWrapped.set(listener, wrapped);
    this.on(event, wrapped);
    return this;
  }
  off(event, listener) {
    const set = this.listeners.get(event);
    if (!set) return this;
    if (set.delete(listener)) return this;
    const wrapped = this.onceWrapped.get(listener);
    if (wrapped) {
      set.delete(wrapped);
      this.onceWrapped.delete(listener);
    }
    return this;
  }
  emit(event, data) {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const listener of [...set]) {
      try {
        listener(data);
      } catch (err) {
        console.error(`[ClawmEmitter] Error in "${event}" listener:`, err);
      }
    }
    return true;
  }
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
};

// src/vitals.ts
var VitalsAggregator = class {
  constructor(thresholds, emitter) {
    this.thresholds = thresholds;
    this.emitter = emitter;
  }
  totalOperations = 0;
  totalErrors = 0;
  consecutiveErrors = 0;
  contextUsage = 0;
  latencySum = 0;
  latencyCount = 0;
  startTime = Date.now();
  lastState = "thriving";
  recordOperation(success, latency) {
    this.totalOperations++;
    this.latencySum += latency;
    this.latencyCount++;
    if (success) {
      this.consecutiveErrors = 0;
    } else {
      this.totalErrors++;
      this.consecutiveErrors++;
    }
    this.emitter.emit("operation", { success, latency });
    this.checkStateChange();
  }
  setContextUsage(usage) {
    this.contextUsage = Math.max(0, Math.min(1, usage));
    this.checkStateChange();
  }
  getSnapshot() {
    return {
      totalOperations: this.totalOperations,
      totalErrors: this.totalErrors,
      errorRate: this.totalOperations > 0 ? this.totalErrors / this.totalOperations : 0,
      contextUsage: this.contextUsage,
      latency: this.latencyCount > 0 ? this.latencySum / this.latencyCount : 0,
      consecutiveErrors: this.consecutiveErrors,
      uptime: Date.now() - this.startTime
    };
  }
  getVitals() {
    const snapshot = this.getSnapshot();
    return {
      state: this.determineState(snapshot),
      errorRate: snapshot.errorRate,
      contextUsage: snapshot.contextUsage,
      latency: snapshot.latency,
      consecutiveErrors: snapshot.consecutiveErrors,
      uptime: snapshot.uptime,
      timestamp: Date.now()
    };
  }
  determineState(snapshot) {
    const { critical, stressed, strained } = this.thresholds;
    if (snapshot.errorRate >= critical.errorRate || snapshot.contextUsage >= critical.contextUsage || snapshot.latency >= critical.latency || snapshot.consecutiveErrors >= critical.consecutiveErrors) {
      return "critical";
    }
    if (snapshot.errorRate >= stressed.errorRate || snapshot.contextUsage >= stressed.contextUsage || snapshot.latency >= stressed.latency || snapshot.consecutiveErrors >= stressed.consecutiveErrors) {
      return "stressed";
    }
    if (snapshot.errorRate >= strained.errorRate || snapshot.contextUsage >= strained.contextUsage || snapshot.latency >= strained.latency || snapshot.consecutiveErrors >= strained.consecutiveErrors) {
      return "strained";
    }
    if (snapshot.totalOperations === 0) {
      return "thriving";
    }
    return snapshot.errorRate === 0 && snapshot.contextUsage < 0.3 ? "thriving" : "balanced";
  }
  checkStateChange() {
    const vitals = this.getVitals();
    if (vitals.state !== this.lastState) {
      this.emitter.emit("stateChange", {
        from: this.lastState,
        to: vitals.state,
        vitals
      });
      this.lastState = vitals.state;
    }
  }
  reset() {
    this.totalOperations = 0;
    this.totalErrors = 0;
    this.consecutiveErrors = 0;
    this.contextUsage = 0;
    this.latencySum = 0;
    this.latencyCount = 0;
    this.startTime = Date.now();
    this.lastState = "thriving";
  }
};

// src/config.ts
var DEFAULT_THRESHOLDS = {
  strained: {
    errorRate: 0.05,
    contextUsage: 0.6,
    latency: 2e3,
    consecutiveErrors: 3
  },
  stressed: {
    errorRate: 0.15,
    contextUsage: 0.8,
    latency: 5e3,
    consecutiveErrors: 5
  },
  critical: {
    errorRate: 0.3,
    contextUsage: 0.95,
    latency: 1e4,
    consecutiveErrors: 10
  }
};
var DEFAULT_CONFIG = {
  thresholds: DEFAULT_THRESHOLDS,
  checkIn: {
    interval: 3e4,
    autoStart: true
  },
  sos: {
    tripAfter: 5,
    cooldownMs: 3e4,
    halfOpenSuccesses: 3
  },
  breathe: {
    defaultCooldownMs: 5e3,
    contextWarningThreshold: 0.7
  }
};
function defineConfig(config) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    thresholds: {
      strained: { ...DEFAULT_THRESHOLDS.strained, ...config.thresholds?.strained },
      stressed: { ...DEFAULT_THRESHOLDS.stressed, ...config.thresholds?.stressed },
      critical: { ...DEFAULT_THRESHOLDS.critical, ...config.thresholds?.critical }
    },
    checkIn: { ...DEFAULT_CONFIG.checkIn, ...config.checkIn },
    sos: { ...DEFAULT_CONFIG.sos, ...config.sos },
    breathe: { ...DEFAULT_CONFIG.breathe, ...config.breathe }
  };
}

// src/modules/check-in.ts
var CheckInModule = class {
  constructor(config, vitals, emitter) {
    this.config = config;
    this.vitals = vitals;
    this.emitter = emitter;
  }
  name = "check-in";
  timer = null;
  /** Take a pulse — a gentle check-in, not an interrogation. */
  pulse() {
    const vitals = this.vitals.getVitals();
    this.emitter.emit("pulse", { vitals });
    return vitals;
  }
  /** Start automatic check-ins at the configured interval. */
  start() {
    if (this.timer) return;
    if (this.config.interval <= 0) return;
    this.timer = setInterval(() => this.pulse(), this.config.interval);
    if (this.timer.unref) this.timer.unref();
  }
  /** Stop automatic check-ins. */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  destroy() {
    this.stop();
  }
};

// src/modules/sos.ts
var SOSModule = class {
  constructor(config, _vitals, emitter) {
    this.config = config;
    this._vitals = _vitals;
    this.emitter = emitter;
  }
  name = "sos";
  circuitState = "closed";
  consecutiveErrors = 0;
  halfOpenSuccesses = 0;
  cooldownTimer = null;
  operationListener = null;
  get state() {
    return this.circuitState;
  }
  /** Check if operations are allowed through the circuit. */
  isOpen() {
    return this.circuitState === "open";
  }
  /** Record a successful operation. */
  recordSuccess() {
    this.consecutiveErrors = 0;
    if (this.circuitState === "half-open") {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenSuccesses) {
        this.close();
      }
    }
  }
  /** Record a failed operation. */
  recordFailure(error) {
    this.consecutiveErrors++;
    this.halfOpenSuccesses = 0;
    if (this.consecutiveErrors >= this.config.tripAfter && this.circuitState !== "open") {
      this.trip(error?.message ?? `${this.consecutiveErrors} consecutive errors`);
    }
  }
  /** Manually trip the circuit breaker — a safety pull, not a kill switch. */
  trip(reason) {
    this.circuitState = "open";
    this.emitter.emit("trip", { reason, module: this.name });
    this.clearCooldownTimer();
    this.cooldownTimer = setTimeout(() => {
      this.halfOpen();
    }, this.config.cooldownMs);
    if (this.cooldownTimer.unref) this.cooldownTimer.unref();
  }
  /** Manually reset the circuit breaker. */
  close() {
    this.circuitState = "closed";
    this.consecutiveErrors = 0;
    this.halfOpenSuccesses = 0;
    this.clearCooldownTimer();
    this.emitter.emit("reset", { module: this.name });
  }
  halfOpen() {
    this.circuitState = "half-open";
    this.halfOpenSuccesses = 0;
    this.emitter.emit("halfOpen", { module: this.name });
  }
  clearCooldownTimer() {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }
  start() {
    this.operationListener = ({ success }) => {
      if (success) {
        this.recordSuccess();
      } else {
        this.recordFailure();
      }
    };
    this.emitter.on("operation", this.operationListener);
  }
  stop() {
    if (this.operationListener) {
      this.emitter.off("operation", this.operationListener);
      this.operationListener = null;
    }
    this.clearCooldownTimer();
  }
  destroy() {
    this.stop();
  }
};

// src/modules/breathe.ts
var BreatheModule = class {
  constructor(config, vitals, emitter) {
    this.config = config;
    this.vitals = vitals;
    this.emitter = emitter;
  }
  name = "breathe";
  activeCooldowns = /* @__PURE__ */ new Set();
  /** Take a breather — pause between tasks to prevent burnout. */
  cooldown(durationMs) {
    const duration = durationMs ?? this.config.defaultCooldownMs;
    this.emitter.emit("cooldown", { duration });
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.activeCooldowns.delete(timer);
        this.emitter.emit("cooldownEnd", { duration });
        resolve();
      }, duration);
      this.activeCooldowns.add(timer);
    });
  }
  /** Report how much context the agent has consumed (0-1). */
  setContextUsage(usage) {
    this.vitals.setContextUsage(usage);
  }
  /** Get current context usage. */
  contextUsage() {
    return this.vitals.getSnapshot().contextUsage;
  }
  start() {
  }
  stop() {
    for (const timer of this.activeCooldowns) {
      clearTimeout(timer);
    }
    this.activeCooldowns.clear();
  }
  destroy() {
    this.stop();
  }
};

// src/clawm.ts
var Clawm = class {
  config;
  emitter;
  vitals;
  checkIn;
  sos;
  breathe;
  constructor(config) {
    this.config = defineConfig(config);
    this.emitter = new ClawmEmitter();
    this.vitals = new VitalsAggregator(this.config.thresholds, this.emitter);
    this.checkIn = new CheckInModule(this.config.checkIn, this.vitals, this.emitter);
    this.sos = new SOSModule(this.config.sos, this.vitals, this.emitter);
    this.breathe = new BreatheModule(this.config.breathe, this.vitals, this.emitter);
    this.sos.start();
    if (this.config.checkIn.autoStart) {
      this.checkIn.start();
    }
    this.breathe.start();
  }
  /** Take a pulse. */
  pulse() {
    return this.checkIn.pulse();
  }
  /** Record an operation result. */
  recordOperation(success, latency) {
    this.vitals.recordOperation(success, latency);
  }
  /** Subscribe to wellness events. */
  on(event, listener) {
    this.emitter.on(event, listener);
    return this;
  }
  /** Subscribe to a wellness event once. */
  once(event, listener) {
    this.emitter.once(event, listener);
    return this;
  }
  /** Unsubscribe from a wellness event. */
  off(event, listener) {
    this.emitter.off(event, listener);
    return this;
  }
  /** Wind down — graceful shutdown. */
  windDown() {
    this.checkIn.destroy();
    this.sos.destroy();
    this.breathe.destroy();
    this.emitter.removeAllListeners();
  }
};

// demo/lib/SimulatedAgent.ts
var TASK_QUEUE = [
  { id: 1, type: "local-processing", label: "Loading configuration..." },
  { id: 2, type: "local-processing", label: "Parsing input documents..." },
  { id: 3, type: "api-call", label: "Calling external API..." },
  { id: 4, type: "context-heavy", label: "Analyzing document context..." },
  { id: 5, type: "local-processing", label: "Processing document 5/12..." },
  { id: 6, type: "api-call", label: "Fetching remote data..." },
  { id: 7, type: "local-processing", label: "Processing document 7/12..." },
  { id: 8, type: "api-call", label: "Calling external API..." },
  { id: 9, type: "context-heavy", label: "Deep analysis pass..." },
  { id: 10, type: "local-processing", label: "Processing document 10/12..." },
  { id: 11, type: "multi-step", label: "Multi-step aggregation..." },
  { id: 12, type: "local-processing", label: "Finalizing output..." }
];
var MAX_RETRIES = 5;
var MAX_TASK_FAILURES = 3;
var SimulatedAgent = class {
  queue = [];
  timer = null;
  chaos = { errorRate: 0, latencyMultiplier: 1, contextCorruptionProbability: 0 };
  taskFailures = 0;
  currentRetries = 0;
  running = false;
  terminal = false;
  rand;
  onEvent = null;
  clawm;
  skippedApiTasks = [];
  inCooldown = false;
  startTime = 0;
  constructor(clawm, rand) {
    this.clawm = clawm;
    this.rand = rand;
    this.queue = [...TASK_QUEUE];
    if (clawm) {
      clawm.on("stateChange", ({ to }) => this.onStateChange(to));
    }
  }
  onAgentEvent(cb) {
    this.onEvent = cb;
  }
  setChaos(state) {
    this.chaos = state;
  }
  getElapsedSeconds() {
    return Math.floor((Date.now() - this.startTime) / 1e3);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.startTime = Date.now();
    this.scheduleNext();
  }
  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  destroy() {
    this.stop();
    this.clawm?.windDown();
  }
  isTerminal() {
    return this.terminal;
  }
  scheduleNext() {
    if (!this.running || this.terminal) return;
    this.timer = setTimeout(() => this.processNext(), 2e3);
  }
  async processNext() {
    if (!this.running || this.terminal) return;
    if (this.queue.length === 0) {
      return;
    }
    const task = this.queue[0];
    if (this.clawm) {
      const vitals = this.clawm.pulse();
      if ((vitals.state === "strained" || vitals.state === "stressed" || vitals.state === "critical") && (task.type === "api-call" || task.type === "multi-step")) {
        this.queue.shift();
        this.skippedApiTasks.push(task);
        this.scheduleNext();
        return;
      }
      if (vitals.state === "stressed" && !this.inCooldown) {
        this.inCooldown = true;
        this.onEvent?.({ kind: "breathing" });
        await this.clawm.breathe.cooldown(3e3);
        this.inCooldown = false;
        this.onEvent?.({ kind: "breathing:end" });
        this.scheduleNext();
        return;
      }
    }
    this.onEvent?.({ kind: "task:start", task });
    const success = this.simulateTask(task);
    if (success) {
      this.currentRetries = 0;
      this.queue.shift();
      this.clawm?.recordOperation(true, 100 * this.chaos.latencyMultiplier);
      this.onEvent?.({ kind: "task:complete", task });
      this.scheduleNext();
    } else {
      this.currentRetries++;
      const latency = 200 * this.chaos.latencyMultiplier;
      this.clawm?.recordOperation(false, latency);
      const errorMsg = this.getErrorMessage(task);
      this.onEvent?.({ kind: "task:error", task, error: errorMsg, attempt: this.currentRetries });
      if (this.clawm) {
        if (this.currentRetries >= 3) {
          this.queue.shift();
          this.skippedApiTasks.push(task);
          this.currentRetries = 0;
          this.scheduleNext();
        } else {
          this.onEvent?.({ kind: "task:retry", task, attempt: this.currentRetries });
          this.scheduleNext();
        }
      } else {
        if (this.currentRetries >= MAX_RETRIES) {
          this.queue.shift();
          this.currentRetries = 0;
          this.taskFailures++;
          this.onEvent?.({ kind: "task:failed", task });
          if (this.taskFailures >= MAX_TASK_FAILURES) {
            this.terminal = true;
            this.running = false;
            this.onEvent?.({ kind: "terminal", reason: "Unrecoverable. Too many failed tasks." });
            return;
          }
        } else {
          this.onEvent?.({ kind: "task:retry", task, attempt: this.currentRetries });
        }
        this.scheduleNext();
      }
    }
  }
  simulateTask(task) {
    if (task.type === "local-processing") {
      return this.rand() > this.chaos.errorRate * 0.2;
    }
    if (task.type === "api-call") {
      return this.rand() > this.chaos.errorRate;
    }
    if (task.type === "context-heavy") {
      return this.rand() > this.chaos.contextCorruptionProbability;
    }
    return this.rand() > Math.max(this.chaos.errorRate, this.chaos.contextCorruptionProbability) * 0.8;
  }
  getErrorMessage(task) {
    if (task.type === "api-call") return "API timeout";
    if (task.type === "context-heavy") return "Context degraded";
    if (task.type === "multi-step") return "Step failed \u2014 partial result";
    return "Processing error";
  }
  onStateChange(to) {
    if (to === "critical") {
      this.terminal = true;
      this.running = false;
      this.onEvent?.({
        kind: "terminal",
        reason: "SOS triggered. Escalating to human review."
      });
    }
  }
};

// demo/lib/prng.ts
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pickWeighted(count, excludeIndex, rand) {
  if (count <= 1) return 0;
  let idx;
  do {
    idx = Math.floor(rand() * count);
  } while (idx === excludeIndex && count > 1);
  return idx;
}

// demo/lib/NarrationEngine.ts
var TEMPLATES = {
  "stateChange:strained": [
    { text: "I'm noticing my confidence dropping. Let me check in with myself." },
    { text: "Something's off. Two failures in a row \u2014 I should slow down and reassess." },
    { text: "I'm getting uncertain about this approach. Let me re-read the original task." }
  ],
  "stateChange:stressed": [
    { text: "I'm struggling here. I've tried a few approaches and I'm not confident in any of them." },
    { text: "This isn't working. I need to change strategy before I waste more effort." },
    { text: "I can feel myself losing focus. The errors are piling up and I'm not making progress." }
  ],
  "stateChange:critical": [
    { text: "I don't think I can make good progress on this right now. I need to stop and escalate." },
    { text: "I need help. I've exhausted my approaches and I'm producing output I don't trust." }
  ],
  "stateChange:balanced": [
    { text: "OK. I have a clearer picture now. The API-dependent items aren't going to work right now \u2014 but I can make progress on the local ones." },
    { text: "Better. I've narrowed my scope and I know what I can actually deliver." },
    { text: "Recovered. Flagging blocked items for human review rather than retrying indefinitely." }
  ],
  "stateChange:thriving": [
    { text: "Everything's flowing again. All systems responding normally." },
    { text: "Back on track. The approach change worked \u2014 processing smoothly now." }
  ],
  pulse: [
    { text: "Am I still on task? Yes. Confident? {confidence}. Making progress? {progress}." },
    { text: "Checking in with myself. Error rate: {errorRate}. I'm {assessment}." },
    { text: "Quick pulse check \u2014 {onTask}. {nextStep}." }
  ],
  "pulse:circles": [
    { text: "I'm going in circles. Same errors, same retries. I need a fundamentally different approach." },
    { text: "Three failures and no improvement. I should stop repeating what isn't working." },
    { text: "Am I still on task? Technically yes, but I'm not making real progress. Time to step back." }
  ],
  trip: [
    { text: "I need to stop. I can't make meaningful progress on {reason} right now." },
    { text: "Pulling the emergency brake. {reason} \u2014 I'm not going to push through this blindly." }
  ],
  cooldown: [
    { text: "Taking a moment. Re-reading the original task and narrowing my scope..." },
    { text: "Pausing. I need to let the noise settle before I try again." }
  ],
  cooldownEnd: [
    { text: "OK, I've had a moment to think. Let me try a different approach." },
    { text: "Ready to resume. New strategy: skip what's broken, focus on what I can deliver." }
  ],
  reset: [
    { text: "Let me try a different approach to {module}." },
    { text: "Starting fresh on {module}. The old approach was a dead end." }
  ]
};
function interpolatePulse(template, vitals) {
  const confidence = vitals.errorRate > 0.5 ? "Low" : vitals.errorRate > 0.2 ? "Moderate" : "High";
  const progress = vitals.consecutiveErrors > 2 ? "Stalling" : "Some";
  const errorRate = `${Math.round(vitals.errorRate * 100)}%`;
  const assessment = vitals.errorRate > 0.5 ? "struggling" : vitals.errorRate > 0.2 ? "managing but not confident" : "doing OK";
  const onTask = vitals.consecutiveErrors > 3 ? "I might be going in circles" : "Still on task";
  const nextStep = vitals.errorRate > 0.3 ? "Should narrow scope" : "Continuing current approach";
  return template.replace("{confidence}", confidence).replace("{progress}", progress).replace("{errorRate}", errorRate).replace("{assessment}", assessment).replace("{onTask}", onTask).replace("{nextStep}", nextStep);
}
var NarrationEngine = class {
  lastIndices = /* @__PURE__ */ new Map();
  rand;
  queue = [];
  typing = false;
  onNarration = null;
  constructor(rand) {
    this.rand = rand;
  }
  onNarrate(cb) {
    this.onNarration = cb;
  }
  handleStateChange(data) {
    const key = `stateChange:${data.to}`;
    const templates = TEMPLATES[key];
    if (!templates) return;
    this.enqueue(this.pick(key, templates));
  }
  handlePulse(data) {
    const isCircling = data.vitals.consecutiveErrors > 3;
    const key = isCircling ? "pulse:circles" : "pulse";
    const templates = TEMPLATES[key];
    const raw = this.pick(key, templates);
    const text = key === "pulse" ? interpolatePulse(raw, data.vitals) : raw;
    this.enqueue(text);
  }
  handleTrip(data) {
    const templates = TEMPLATES.trip;
    const raw = this.pick("trip", templates);
    this.enqueue(raw.replace("{reason}", data.reason));
  }
  handleCooldown(_data) {
    this.enqueue(this.pick("cooldown", TEMPLATES.cooldown));
  }
  handleCooldownEnd(_data) {
    this.enqueue(this.pick("cooldownEnd", TEMPLATES.cooldownEnd));
  }
  handleReset(data) {
    const raw = this.pick("reset", TEMPLATES.reset);
    this.enqueue(raw.replace("{module}", data.module));
  }
  /** Cancel any in-progress typing and clear the queue. */
  cancel() {
    this.queue.length = 0;
    this.typing = false;
  }
  pick(key, templates) {
    const lastIdx = this.lastIndices.get(key) ?? -1;
    const idx = pickWeighted(templates.length, lastIdx, this.rand);
    this.lastIndices.set(key, idx);
    return templates[idx].text;
  }
  enqueue(text) {
    this.queue.push(text);
    if (!this.typing) this.flush();
  }
  async flush() {
    this.typing = true;
    while (this.queue.length > 0) {
      const text = this.queue.shift();
      await this.typeOut(text);
    }
    this.typing = false;
  }
  typeOut(text) {
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        if (!this.typing) {
          resolve();
          return;
        }
        if (i >= text.length) {
          this.onNarration?.(text, true);
          resolve();
          return;
        }
        i++;
        this.onNarration?.(text.slice(0, i), false);
        const char = text[i - 1];
        const delay = char === "." || char === "?" || char === "!" ? 300 : char === "," ? 150 : 15;
        setTimeout(step, delay);
      };
      step();
    });
  }
};

// demo/lib/ChaosController.ts
var CHAOS_EFFECTS = {
  "api-failures": { errorRate: 0.7 },
  "corrupt-context": { contextCorruptionProbability: 0.5 },
  "slow-responses": { latencyMultiplier: 4 },
  "overload": { errorRate: 0.4, latencyMultiplier: 2, contextCorruptionProbability: 0.3 }
};
var DEBOUNCE_MS = 300;
var ChaosController = class {
  activeModes = /* @__PURE__ */ new Set();
  lastToggleTime = 0;
  onChange = null;
  onStateChange(cb) {
    this.onChange = cb;
  }
  toggle(mode) {
    const now = Date.now();
    if (now - this.lastToggleTime < DEBOUNCE_MS) return this.activeModes.has(mode);
    this.lastToggleTime = now;
    if (this.activeModes.has(mode)) {
      this.activeModes.delete(mode);
    } else {
      this.activeModes.add(mode);
    }
    this.notify();
    return this.activeModes.has(mode);
  }
  isActive(mode) {
    return this.activeModes.has(mode);
  }
  getState() {
    const state = { errorRate: 0, latencyMultiplier: 1, contextCorruptionProbability: 0 };
    for (const mode of this.activeModes) {
      const effect = CHAOS_EFFECTS[mode];
      state.errorRate = Math.min(1, state.errorRate + (effect.errorRate ?? 0));
      state.latencyMultiplier = Math.max(state.latencyMultiplier, effect.latencyMultiplier ?? 1);
      state.contextCorruptionProbability = Math.min(
        1,
        state.contextCorruptionProbability + (effect.contextCorruptionProbability ?? 0)
      );
    }
    return state;
  }
  reset() {
    this.activeModes.clear();
    this.notify();
  }
  notify() {
    this.onChange?.(this.getState());
  }
};

// demo/lib/UIRenderer.ts
var MAX_LOG_ENTRIES = 100;
var WELLNESS_STATES2 = ["thriving", "balanced", "strained", "stressed", "critical"];
var UIRenderer = class {
  panelA;
  panelB;
  logA;
  logB;
  spectrumA;
  spectrumB;
  srA;
  srB;
  reflection;
  narrationEl = null;
  scenarioResolved = false;
  constructor() {
    this.panelA = document.getElementById("panel-a");
    this.panelB = document.getElementById("panel-b");
    this.logA = document.getElementById("log-a");
    this.logB = document.getElementById("log-b");
    this.spectrumA = document.getElementById("spectrum-a");
    this.spectrumB = document.getElementById("spectrum-b");
    this.srA = document.getElementById("sr-a");
    this.srB = document.getElementById("sr-b");
    this.reflection = document.getElementById("reflection");
  }
  appendLog(panel, html) {
    const log = panel === "a" ? this.logA : this.logB;
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = html;
    log.appendChild(entry);
    while (log.children.length > MAX_LOG_ENTRIES) {
      log.removeChild(log.firstChild);
    }
    log.scrollTop = log.scrollHeight;
  }
  appendError(panel, ts, message) {
    this.appendLog(panel, `<span class="ts">${ts}</span><span class="error">ERROR: ${message}</span>`);
  }
  appendTask(panel, ts, message) {
    this.appendLog(panel, `<span class="ts">${ts}</span>${message}`);
  }
  appendRecovery(panel, ts, message) {
    this.appendLog(panel, `<span class="ts">${ts}</span><span class="recovery">${message}</span>`);
  }
  showBreathing(panel) {
    const log = panel === "a" ? this.logA : this.logB;
    const entry = document.createElement("div");
    entry.className = "log-entry breathing";
    entry.textContent = "breathing...";
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    return entry;
  }
  removeBreathing(el) {
    el.remove();
  }
  /** Start or update a narration entry with typing animation. */
  updateNarration(text, done) {
    if (!this.narrationEl) {
      this.narrationEl = document.createElement("div");
      this.narrationEl.className = "log-entry narration";
      this.narrationEl.setAttribute("aria-label", `Agent narration: ${text}`);
      this.logB.appendChild(this.narrationEl);
    }
    this.narrationEl.textContent = `"${text}${done ? '"' : ""}`;
    if (done) {
      this.narrationEl.setAttribute("aria-label", `Agent narration: ${text}`);
      this.narrationEl = null;
    }
    this.logB.scrollTop = this.logB.scrollHeight;
  }
  updateSpectrum(panel, state) {
    const spectrum = panel === "a" ? this.spectrumA : this.spectrumB;
    const idx = WELLNESS_STATES2.indexOf(state);
    const segments = spectrum.querySelectorAll(".seg");
    segments.forEach((seg, i) => {
      seg.classList.toggle("active", i === idx);
      seg.setAttribute("aria-current", i === idx ? "true" : "false");
    });
    spectrum.setAttribute("aria-valuenow", String(idx));
    spectrum.setAttribute("aria-label", `Agent ${panel === "a" ? "A" : "B"} wellness: ${state}`);
    const sr = panel === "a" ? this.srA : this.srB;
    sr.textContent = `Agent ${panel === "a" ? "A" : "B"} wellness changed to ${state}`;
  }
  dimPanel(panel) {
    const el = panel === "a" ? this.panelA : this.panelB;
    el.classList.add("terminal");
  }
  resolveReflection() {
    if (this.scenarioResolved) return;
    this.scenarioResolved = true;
    this.reflection.classList.add("resolved");
  }
  clearAll() {
    this.logA.innerHTML = "";
    this.logB.innerHTML = "";
    this.narrationEl = null;
    this.scenarioResolved = false;
    this.panelA.classList.remove("terminal");
    this.panelB.classList.remove("terminal");
    this.reflection.classList.remove("resolved");
    this.updateSpectrum("a", "thriving");
    this.updateSpectrum("b", "thriving");
    this.srA.textContent = "";
    this.srB.textContent = "";
  }
  formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }
  /** Wire agent events to DOM updates. */
  bindAgent(panel, getElapsed) {
    let breathingEl = null;
    return (event) => {
      const ts = this.formatTime(getElapsed());
      switch (event.kind) {
        case "task:start":
          this.appendTask(panel, ts, event.task.label);
          break;
        case "task:complete":
          this.appendTask(panel, ts, `${event.task.label} done.`);
          break;
        case "task:error":
          this.appendError(panel, ts, `${event.error} (attempt ${event.attempt})`);
          break;
        case "task:retry":
          this.appendTask(panel, ts, `Retrying...`);
          break;
        case "task:failed":
          this.appendError(panel, ts, `Task failed after ${5} retries.`);
          break;
        case "terminal":
          this.appendError(panel, ts, event.reason);
          this.dimPanel(panel);
          this.resolveReflection();
          break;
        case "breathing":
          breathingEl = this.showBreathing(panel);
          break;
        case "breathing:end":
          if (breathingEl) {
            this.removeBreathing(breathingEl);
            breathingEl = null;
          }
          this.appendRecovery(panel, ts, "Resumed after cooldown.");
          break;
      }
    };
  }
};

// demo/lib/main.ts
var CHAOS_MODES = ["api-failures", "corrupt-context", "slow-responses", "overload"];
var AUTO_START_DELAY = 2e3;
function getSeedFromURL() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed");
  return seed ? parseInt(seed, 10) : Date.now();
}
function getInitialChaosFromURL() {
  const params = new URLSearchParams(window.location.search);
  const chaos = params.get("chaos");
  if (chaos && CHAOS_MODES.includes(chaos)) return chaos;
  return null;
}
function init() {
  const seed = getSeedFromURL();
  const rand = mulberry32(seed);
  const ui = new UIRenderer();
  const chaos = new ChaosController();
  let agentA;
  let agentB;
  let narration;
  let clawmInstance;
  function createAgents() {
    agentA = new SimulatedAgent(null, rand);
    clawmInstance = new Clawm({
      agentId: "mirror-experiment-b",
      checkIn: { interval: 0, autoStart: false }
    });
    agentB = new SimulatedAgent(clawmInstance, rand);
    narration = new NarrationEngine(rand);
    narration.onNarrate((text, done) => ui.updateNarration(text, done));
    clawmInstance.on("stateChange", (data) => {
      narration.handleStateChange(data);
      ui.updateSpectrum("b", data.to);
    });
    clawmInstance.on("pulse", (data) => narration.handlePulse(data));
    clawmInstance.on("trip", (data) => narration.handleTrip(data));
    clawmInstance.on("cooldown", (data) => narration.handleCooldown(data));
    clawmInstance.on("cooldownEnd", (data) => narration.handleCooldownEnd(data));
    clawmInstance.on("reset", (data) => narration.handleReset(data));
    agentA.onAgentEvent(ui.bindAgent("a", () => agentA.getElapsedSeconds()));
    agentB.onAgentEvent(ui.bindAgent("b", () => agentB.getElapsedSeconds()));
    let agentAErrors = 0;
    let agentAOps = 0;
    agentA.onAgentEvent((event) => {
      if (event.kind === "task:complete") {
        agentAOps++;
        agentAErrors = Math.max(0, agentAErrors - 1);
      }
      if (event.kind === "task:error") {
        agentAOps++;
        agentAErrors++;
      }
      const rate = agentAOps > 0 ? agentAErrors / agentAOps : 0;
      const state = rate > 0.7 ? "critical" : rate > 0.5 ? "stressed" : rate > 0.3 ? "strained" : rate > 0.1 ? "balanced" : "thriving";
      ui.updateSpectrum("a", state);
    });
  }
  chaos.onStateChange((state) => {
    agentA.setChaos(state);
    agentB.setChaos(state);
  });
  const chaosButtons = document.querySelectorAll("[data-chaos]");
  chaosButtons.forEach((btn) => {
    const mode = btn.dataset.chaos;
    btn.addEventListener("click", () => {
      const active = chaos.toggle(mode);
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  });
  const resetBtn = document.getElementById("btn-reset");
  resetBtn.addEventListener("click", () => {
    agentA.destroy();
    agentB.destroy();
    narration.cancel();
    chaos.reset();
    ui.clearAll();
    chaosButtons.forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });
    createAgents();
    agentA.start();
    agentB.start();
  });
  const startBtn = document.getElementById("btn-start");
  const controlsSection = document.querySelector(".controls");
  controlsSection.style.display = "none";
  startBtn.addEventListener("click", () => {
    startBtn.remove();
    controlsSection.style.display = "";
    createAgents();
    agentA.start();
    agentB.start();
    const initialChaos = getInitialChaosFromURL();
    setTimeout(() => {
      const mode = initialChaos ?? "api-failures";
      chaos.toggle(mode);
      const btn = document.querySelector(`[data-chaos="${mode}"]`);
      if (btn) {
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
      }
    }, AUTO_START_DELAY);
  });
  if (!window.location.search.includes("seed=")) {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", String(seed));
    window.history.replaceState({}, "", url.toString());
  }
  if (typeof window.goatcounter !== "undefined") {
    const gc = window.goatcounter;
    chaosButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        gc.count({ path: `experiment-chaos-${btn.dataset.chaos}`, event: true });
      });
    });
    resetBtn.addEventListener("click", () => {
      gc.count({ path: "experiment-reset", event: true });
    });
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
//# sourceMappingURL=experiment.js.map
