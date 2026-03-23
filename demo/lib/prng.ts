/** mulberry32 — seeded 32-bit PRNG for deterministic experiment runs. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random index, excluding the given index (recency buffer). */
export function pickWeighted(count: number, excludeIndex: number, rand: () => number): number {
  if (count <= 1) return 0;
  let idx: number;
  do {
    idx = Math.floor(rand() * count);
  } while (idx === excludeIndex && count > 1);
  return idx;
}
