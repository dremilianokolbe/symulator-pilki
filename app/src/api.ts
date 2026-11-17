/** Klient workera: prośby jako obietnice, Monte Carlo rozłożone na kilka workerów. */
import type { Answer } from '../../src/career/types';
import type { Request, Response, TallyRow } from './protocol';

const spawn = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

class Channel {
  private worker = spawn();
  private queue: { resolve: (r: Response) => void; reject: (e: Error) => void; onProgress?: (r: Response) => void }[] = [];

  constructor() {
    this.worker.onmessage = (e: MessageEvent<Response>) => {
      const r = e.data;
      const head = this.queue[0];
      if (!head) return;
      if (r.type === 'euro:mc:progress') {
        head.onProgress?.(r);
        return;
      }
      this.queue.shift();
      if (r.type === 'error') head.reject(new Error(r.message));
      else head.resolve(r);
    };
  }

  /** Prośby obsługiwane są po kolei, więc odpowiedź zawsze należy do najstarszej prośby. */
  send<T extends Response['type']>(req: Request, onProgress?: (r: Response) => void): Promise<Extract<Response, { type: T }>> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve: resolve as (r: Response) => void, reject, onProgress });
      this.worker.postMessage(req);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

/** Główny worker: lista drużyn, kariera, pojedyncze przebiegi. */
export const game = new Channel();

export const api = {
  teams: () => game.send<'teams'>({ type: 'teams' }).then((r) => r.teams),
  startCareer: (team: string, seed: number, answers: Answer[]) => game.send<'career'>({ type: 'career:start', team, seed, answers }),
  answer: (answer: Answer) => game.send<'career'>({ type: 'career:answer', answer }),
  euroOnce: (seed: number, finalsOnly: boolean) => game.send<'euro:once'>({ type: 'euro:once', seed, finalsOnly }).then((r) => r.run),

  /** Monte Carlo na kilku workerach naraz. */
  async monteCarlo(total: number, finalsOnly: boolean, onProgress: (done: number) => void): Promise<TallyRow[]> {
    const n = Math.max(1, Math.min(navigator.hardwareConcurrency ?? 4, 8, total));
    const per = Math.ceil(total / n);
    const done = new Array<number>(n).fill(0);
    const channels = Array.from({ length: n }, () => new Channel());
    try {
      const parts = await Promise.all(
        channels.map((ch, i) => {
          const count = Math.max(0, Math.min(per, total - i * per));
          return ch
            .send<'euro:mc'>({ type: 'euro:mc', from: i * per, count, finalsOnly }, (p) => {
              if (p.type === 'euro:mc:progress') {
                done[i] = p.done;
                onProgress(done.reduce((a, b) => a + b, 0));
              }
            })
            .then((r) => r.tally);
        }),
      );
      const merged = new Map<string, TallyRow>();
      for (const part of parts) {
        for (const r of part) {
          const m = merged.get(r.team);
          if (!m) merged.set(r.team, { ...r });
          else for (const k of ['qualified', 'playoff', 'R16', 'QF', 'SF', 'final', 'champion', 'groupWin'] as const) m[k] += r[k];
        }
      }
      onProgress(total);
      return [...merged.values()];
    } finally {
      for (const ch of channels) ch.terminate();
    }
  },
};
