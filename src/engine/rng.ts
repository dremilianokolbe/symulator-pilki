/**
 * Deterministyczny generator losowości (mulberry32).
 * Ten sam seed => ten sam przebieg. Stan da się zapisać i odtworzyć (zapis gry, mecz na żywo).
 */
export interface Rng {
  /** Liczba z [0, 1). */
  next(): number;
  /** Liczba całkowita z [min, max]. */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  normal(mean: number, sd: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  poisson(lambda: number): number;
  getState(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    normal: (mean, sd) => {
      // Box-Muller
      const u = Math.max(next(), 1e-12);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick: (items) => {
      if (items.length === 0) throw new Error('pick: pusta lista');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    weighted: (items, weight) => {
      if (items.length === 0) throw new Error('weighted: pusta lista');
      let total = 0;
      for (const item of items) total += Math.max(0, weight(item));
      if (total <= 0) return items[Math.floor(next() * items.length)]!;
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, weight(item));
        if (roll < 0) return item;
      }
      return items[items.length - 1]!;
    },
    poisson: (lambda) => {
      const limit = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > limit);
      return k - 1;
    },
    getState: () => state,
  };
}
