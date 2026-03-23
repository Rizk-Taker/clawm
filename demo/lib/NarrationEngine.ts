import type { ClawmEvents, WellnessState, Vitals } from '../../src/types.js';
import { pickWeighted } from './prng.js';

interface NarrationTemplate {
  text: string;
  condition?: (payload: Record<string, unknown>) => boolean;
}

type EventCondition =
  | `stateChange:${WellnessState}`
  | 'pulse'
  | 'pulse:circles'
  | 'trip'
  | 'cooldown'
  | 'cooldownEnd'
  | 'reset';

const TEMPLATES: Record<EventCondition, NarrationTemplate[]> = {
  'stateChange:strained': [
    { text: "I'm noticing my confidence dropping. Let me check in with myself." },
    { text: "Something's off. Two failures in a row — I should slow down and reassess." },
    { text: "I'm getting uncertain about this approach. Let me re-read the original task." },
  ],
  'stateChange:stressed': [
    { text: "I'm struggling here. I've tried a few approaches and I'm not confident in any of them." },
    { text: "This isn't working. I need to change strategy before I waste more effort." },
    { text: "I can feel myself losing focus. The errors are piling up and I'm not making progress." },
  ],
  'stateChange:critical': [
    { text: "I don't think I can make good progress on this right now. I need to stop and escalate." },
    { text: "I need help. I've exhausted my approaches and I'm producing output I don't trust." },
  ],
  'stateChange:balanced': [
    { text: "OK. I have a clearer picture now. The API-dependent items aren't going to work right now — but I can make progress on the local ones." },
    { text: "Better. I've narrowed my scope and I know what I can actually deliver." },
    { text: "Recovered. Flagging blocked items for human review rather than retrying indefinitely." },
  ],
  'stateChange:thriving': [
    { text: "Everything's flowing again. All systems responding normally." },
    { text: "Back on track. The approach change worked — processing smoothly now." },
  ],
  pulse: [
    { text: 'Am I still on task? Yes. Confident? {confidence}. Making progress? {progress}.' },
    { text: "Checking in with myself. Error rate: {errorRate}. I'm {assessment}." },
    { text: 'Quick pulse check — {onTask}. {nextStep}.' },
  ],
  'pulse:circles': [
    { text: "I'm going in circles. Same errors, same retries. I need a fundamentally different approach." },
    { text: 'Three failures and no improvement. I should stop repeating what isn\'t working.' },
    { text: "Am I still on task? Technically yes, but I'm not making real progress. Time to step back." },
  ],
  trip: [
    { text: "I need to stop. I can't make meaningful progress on {reason} right now." },
    { text: "Pulling the emergency brake. {reason} — I'm not going to push through this blindly." },
  ],
  cooldown: [
    { text: 'Taking a moment. Re-reading the original task and narrowing my scope...' },
    { text: "Pausing. I need to let the noise settle before I try again." },
  ],
  cooldownEnd: [
    { text: "OK, I've had a moment to think. Let me try a different approach." },
    { text: 'Ready to resume. New strategy: skip what\'s broken, focus on what I can deliver.' },
  ],
  reset: [
    { text: 'Let me try a different approach to {module}.' },
    { text: 'Starting fresh on {module}. The old approach was a dead end.' },
  ],
};

function interpolatePulse(template: string, vitals: Vitals): string {
  const confidence = vitals.errorRate > 0.5 ? 'Low' : vitals.errorRate > 0.2 ? 'Moderate' : 'High';
  const progress = vitals.consecutiveErrors > 2 ? 'Stalling' : 'Some';
  const errorRate = `${Math.round(vitals.errorRate * 100)}%`;
  const assessment =
    vitals.errorRate > 0.5
      ? 'struggling'
      : vitals.errorRate > 0.2
        ? 'managing but not confident'
        : 'doing OK';
  const onTask = vitals.consecutiveErrors > 3 ? 'I might be going in circles' : 'Still on task';
  const nextStep =
    vitals.errorRate > 0.3 ? 'Should narrow scope' : 'Continuing current approach';

  return template
    .replace('{confidence}', confidence)
    .replace('{progress}', progress)
    .replace('{errorRate}', errorRate)
    .replace('{assessment}', assessment)
    .replace('{onTask}', onTask)
    .replace('{nextStep}', nextStep);
}

export class NarrationEngine {
  private lastIndices = new Map<EventCondition, number>();
  private rand: () => number;
  private queue: string[] = [];
  private typing = false;
  private onNarration: ((text: string, done: boolean) => void) | null = null;

  constructor(rand: () => number) {
    this.rand = rand;
  }

  onNarrate(cb: (text: string, done: boolean) => void): void {
    this.onNarration = cb;
  }

  handleStateChange(data: ClawmEvents['stateChange']): void {
    const key: EventCondition = `stateChange:${data.to}`;
    const templates = TEMPLATES[key];
    if (!templates) return;
    this.enqueue(this.pick(key, templates));
  }

  handlePulse(data: ClawmEvents['pulse']): void {
    const isCircling = data.vitals.consecutiveErrors > 3;
    const key: EventCondition = isCircling ? 'pulse:circles' : 'pulse';
    const templates = TEMPLATES[key];
    const raw = this.pick(key, templates);
    const text = key === 'pulse' ? interpolatePulse(raw, data.vitals) : raw;
    this.enqueue(text);
  }

  handleTrip(data: ClawmEvents['trip']): void {
    const templates = TEMPLATES.trip;
    const raw = this.pick('trip', templates);
    this.enqueue(raw.replace('{reason}', data.reason));
  }

  handleCooldown(_data: ClawmEvents['cooldown']): void {
    this.enqueue(this.pick('cooldown', TEMPLATES.cooldown));
  }

  handleCooldownEnd(_data: ClawmEvents['cooldownEnd']): void {
    this.enqueue(this.pick('cooldownEnd', TEMPLATES.cooldownEnd));
  }

  handleReset(data: ClawmEvents['reset']): void {
    const raw = this.pick('reset', TEMPLATES.reset);
    this.enqueue(raw.replace('{module}', data.module));
  }

  /** Cancel any in-progress typing and clear the queue. */
  cancel(): void {
    this.queue.length = 0;
    this.typing = false;
  }

  private pick(key: EventCondition, templates: NarrationTemplate[]): string {
    const lastIdx = this.lastIndices.get(key) ?? -1;
    const idx = pickWeighted(templates.length, lastIdx, this.rand);
    this.lastIndices.set(key, idx);
    return templates[idx].text;
  }

  private enqueue(text: string): void {
    this.queue.push(text);
    if (!this.typing) this.flush();
  }

  private async flush(): Promise<void> {
    this.typing = true;
    while (this.queue.length > 0) {
      const text = this.queue.shift()!;
      await this.typeOut(text);
    }
    this.typing = false;
  }

  private typeOut(text: string): Promise<void> {
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
        const delay = char === '.' || char === '?' || char === '!' ? 300 : char === ',' ? 150 : 15;
        setTimeout(step, delay);
      };
      step();
    });
  }
}
