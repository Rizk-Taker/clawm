import type { Clawm } from '../../src/clawm.js';
import type { WellnessState } from '../../src/types.js';
import type { ChaosState } from './ChaosController.js';

export type TaskType = 'local-processing' | 'api-call' | 'context-heavy' | 'multi-step';

export interface Task {
  id: number;
  type: TaskType;
  label: string;
}

export type AgentEvent =
  | { kind: 'task:start'; task: Task }
  | { kind: 'task:complete'; task: Task }
  | { kind: 'task:error'; task: Task; error: string; attempt: number }
  | { kind: 'task:retry'; task: Task; attempt: number }
  | { kind: 'task:failed'; task: Task }
  | { kind: 'terminal'; reason: string }
  | { kind: 'breathing' }
  | { kind: 'breathing:end' };

const TASK_QUEUE: Task[] = [
  { id: 1, type: 'local-processing', label: 'Loading configuration...' },
  { id: 2, type: 'local-processing', label: 'Parsing input documents...' },
  { id: 3, type: 'api-call', label: 'Calling external API...' },
  { id: 4, type: 'context-heavy', label: 'Analyzing document context...' },
  { id: 5, type: 'local-processing', label: 'Processing document 5/12...' },
  { id: 6, type: 'api-call', label: 'Fetching remote data...' },
  { id: 7, type: 'local-processing', label: 'Processing document 7/12...' },
  { id: 8, type: 'api-call', label: 'Calling external API...' },
  { id: 9, type: 'context-heavy', label: 'Deep analysis pass...' },
  { id: 10, type: 'local-processing', label: 'Processing document 10/12...' },
  { id: 11, type: 'multi-step', label: 'Multi-step aggregation...' },
  { id: 12, type: 'local-processing', label: 'Finalizing output...' },
];

const MAX_RETRIES = 5;
const MAX_TASK_FAILURES = 3;

export class SimulatedAgent {
  private queue: Task[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chaos: ChaosState = { errorRate: 0, latencyMultiplier: 1, contextCorruptionProbability: 0 };
  private taskFailures = 0;
  private currentRetries = 0;
  private running = false;
  private terminal = false;
  private rand: () => number;
  private onEvent: ((event: AgentEvent) => void) | null = null;
  private clawm: Clawm | null;
  private skippedApiTasks: Task[] = [];
  private inCooldown = false;
  private startTime = 0;

  constructor(clawm: Clawm | null, rand: () => number) {
    this.clawm = clawm;
    this.rand = rand;
    this.queue = [...TASK_QUEUE];

    if (clawm) {
      // Listen for state changes to adapt strategy
      clawm.on('stateChange', ({ to }) => this.onStateChange(to));
    }
  }

  onAgentEvent(cb: (event: AgentEvent) => void): void {
    this.onEvent = cb;
  }

  setChaos(state: ChaosState): void {
    this.chaos = state;
  }

  getElapsedSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = Date.now();
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.stop();
    this.clawm?.windDown();
  }

  isTerminal(): boolean {
    return this.terminal;
  }

  private scheduleNext(): void {
    if (!this.running || this.terminal) return;
    this.timer = setTimeout(() => this.processNext(), 2000);
  }

  private async processNext(): Promise<void> {
    if (!this.running || this.terminal) return;

    if (this.queue.length === 0) {
      // All tasks done
      return;
    }

    const task = this.queue[0];

    // Agent B with Clawm: skip API-dependent tasks when strained+
    if (this.clawm) {
      const vitals = this.clawm.pulse();
      if (
        (vitals.state === 'strained' || vitals.state === 'stressed' || vitals.state === 'critical') &&
        (task.type === 'api-call' || task.type === 'multi-step')
      ) {
        this.queue.shift();
        this.skippedApiTasks.push(task);
        // Process next local task instead
        this.scheduleNext();
        return;
      }

      // Trigger cooldown at stressed
      if (vitals.state === 'stressed' && !this.inCooldown) {
        this.inCooldown = true;
        this.onEvent?.({ kind: 'breathing' });
        await this.clawm.breathe.cooldown(3000);
        this.inCooldown = false;
        this.onEvent?.({ kind: 'breathing:end' });
        this.scheduleNext();
        return;
      }
    }

    this.onEvent?.({ kind: 'task:start', task });

    const success = this.simulateTask(task);

    if (success) {
      this.currentRetries = 0;
      this.queue.shift();
      this.clawm?.recordOperation(true, 100 * this.chaos.latencyMultiplier);
      this.onEvent?.({ kind: 'task:complete', task });
      this.scheduleNext();
    } else {
      this.currentRetries++;
      const latency = 200 * this.chaos.latencyMultiplier;
      this.clawm?.recordOperation(false, latency);

      const errorMsg = this.getErrorMessage(task);
      this.onEvent?.({ kind: 'task:error', task, error: errorMsg, attempt: this.currentRetries });

      if (this.clawm) {
        // Agent B: Clawm handles retries through state-driven strategy
        if (this.currentRetries >= 3) {
          // After 3 retries, skip this task
          this.queue.shift();
          this.skippedApiTasks.push(task);
          this.currentRetries = 0;
          this.scheduleNext();
        } else {
          this.onEvent?.({ kind: 'task:retry', task, attempt: this.currentRetries });
          this.scheduleNext();
        }
      } else {
        // Agent A: blind retry up to MAX_RETRIES
        if (this.currentRetries >= MAX_RETRIES) {
          this.queue.shift();
          this.currentRetries = 0;
          this.taskFailures++;
          this.onEvent?.({ kind: 'task:failed', task });

          if (this.taskFailures >= MAX_TASK_FAILURES) {
            this.terminal = true;
            this.running = false;
            this.onEvent?.({ kind: 'terminal', reason: 'Unrecoverable. Too many failed tasks.' });
            return;
          }
        } else {
          this.onEvent?.({ kind: 'task:retry', task, attempt: this.currentRetries });
        }
        this.scheduleNext();
      }
    }
  }

  private simulateTask(task: Task): boolean {
    // Local tasks rarely fail even under chaos
    if (task.type === 'local-processing') {
      return this.rand() > this.chaos.errorRate * 0.2;
    }
    // API tasks are highly affected by chaos
    if (task.type === 'api-call') {
      return this.rand() > this.chaos.errorRate;
    }
    // Context-heavy tasks fail on corruption
    if (task.type === 'context-heavy') {
      return this.rand() > this.chaos.contextCorruptionProbability;
    }
    // Multi-step fails on any chaos
    return this.rand() > Math.max(this.chaos.errorRate, this.chaos.contextCorruptionProbability) * 0.8;
  }

  private getErrorMessage(task: Task): string {
    if (task.type === 'api-call') return 'API timeout';
    if (task.type === 'context-heavy') return 'Context degraded';
    if (task.type === 'multi-step') return 'Step failed — partial result';
    return 'Processing error';
  }

  private onStateChange(to: WellnessState): void {
    // Strategy changes happen in processNext() based on current state
    if (to === 'critical') {
      // SOS: stop and escalate
      this.terminal = true;
      this.running = false;
      this.onEvent?.({
        kind: 'terminal',
        reason: 'SOS triggered. Escalating to human review.',
      });
    }
  }
}
