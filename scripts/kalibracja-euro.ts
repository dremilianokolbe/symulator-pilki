/**
 * Kalibracja na prawdziwych meczach: 267 meczów eliminacji Euro 2016.
 * Przed każdym meczem silnik zna tylko ranking Elo obu drużyn sprzed meczu (zamieniony na OVR).
 * Porównujemy przewidywania z rzeczywistymi wynikami i z prostymi modelami odniesienia.
 * Uruchom: npx tsx scripts/kalibracja-euro.ts [-- --sym 100]
 */
import { readFileSync } from 'node:fs';
import { expectedScore } from '../src/data/elo';
import { simulateMatch } from '../src/engine/match';
import { createRng } from '../src/engine/rng';
import type { MatchTeamInput, Player } from '../src/engine/types';
import { generateTeam } from '../src/generator/players';

interface EuroMatch {
  date: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  tournament: string;
  neutral: boolean;
  eloHome: number;
  eloAway: number;
}

const argIdx = process.argv.indexOf('--sym');
const SIMS = argIdx > 0 ? Number(process.argv[argIdx + 1]) : 100;
const gridIdx = process.argv.indexOf('--przeliczniki');
const GRID = gridIdx > 0 ? process.argv[gridIdx + 1]!.split(',').map(Number) : [30, 40, 45];
const DETAIL = GRID.includes(45) ? 45 : GRID[0]!;
const matches = (JSON.parse(readFileSync('data/processed/euro2016/mecze.json', 'utf8')) as EuroMatch[])
  .filter((m) => m.tournament === 'UEFA Euro qualification');

/** Elo → OVR: 1700 Elo = 70 OVR, `perPoint` punktów Elo na punkt OVR. */
const toOvr = (elo: number, perPoint: number) => 70 + (elo - 1700) / perPoint;

// Każda drużyna ma stały „kształt” kadry (wygenerowany raz), przesuwany do aktualnej siły.
const shapes = new Map<string, MatchTeamInput>();
const shapeRng = createRng(54);
function shape(team: string): MatchTeamInput {
  let s = shapes.get(team);
  if (!s) {
    s = generateTeam(shapeRng, { id: team, name: team, quality: 70 }).input;
    shapes.set(team, s);
  }
  return s;
}

function shifted(input: MatchTeamInput, delta: number): MatchTeamInput {
  const shift = (p: Player): Player => {
    const attributes = { ...p.attributes };
    for (const k of Object.keys(attributes) as (keyof typeof attributes)[]) {
      attributes[k] = Math.round(Math.min(99, Math.max(1, attributes[k] + delta)));
    }
    return { ...p, attributes };
  };
  return {
    ...input,
    starters: input.starters.map((s) => ({ ...s, player: shift(s.player) })),
    bench: input.bench.map(shift),
  };
}

interface Prediction {
  pH: number;
  pD: number;
  pA: number;
  goals: number;
  bigMargin: number;
}

function predict(m: EuroMatch, perPoint: number, matchIdx: number): Prediction {
  const home = shifted(shape(m.home), toOvr(m.eloHome, perPoint) - 70);
  const away = shifted(shape(m.away), toOvr(m.eloAway, perPoint) - 70);
  let h = 0, d = 0, a = 0, goals = 0, big = 0;
  for (let s = 0; s < SIMS; s++) {
    const r = simulateMatch({ seed: matchIdx * 1000 + s, home, away, neutral: m.neutral, importance: 60 });
    const [hg, ag] = r.score;
    if (hg > ag) h++;
    else if (hg === ag) d++;
    else a++;
    goals += hg + ag;
    if (Math.abs(hg - ag) >= 3) big++;
  }
  return { pH: h / SIMS, pD: d / SIMS, pA: a / SIMS, goals: goals / SIMS, bigMargin: big / SIMS };
}

const outcome = (m: EuroMatch) => (m.homeScore > m.awayScore ? 'H' : m.homeScore === m.awayScore ? 'D' : 'A');
const eps = 0.01;

function score(preds: { pH: number; pD: number; pA: number }[]) {
  let logLoss = 0;
  let brier = 0;
  preds.forEach((p, i) => {
    const o = outcome(matches[i]!);
    const probs = { H: Math.max(eps, p.pH), D: Math.max(eps, p.pD), A: Math.max(eps, p.pA) };
    const total = probs.H + probs.D + probs.A;
    logLoss -= Math.log(probs[o] / total);
    brier += (p.pH - (o === 'H' ? 1 : 0)) ** 2 + (p.pD - (o === 'D' ? 1 : 0)) ** 2 + (p.pA - (o === 'A' ? 1 : 0)) ** 2;
  });
  return { logLoss: logLoss / preds.length, brier: brier / preds.length };
}

// Rzeczywistość
const actualGoals = matches.reduce((s, m) => s + m.homeScore + m.awayScore, 0) / matches.length;
const actualDraws = matches.filter((m) => outcome(m) === 'D').length / matches.length;
const actualBig = matches.filter((m) => Math.abs(m.homeScore - m.awayScore) >= 3).length / matches.length;
const actualHome = matches.filter((m) => outcome(m) === 'H').length / matches.length;

// Modele odniesienia
const baseRates = matches.map(() => ({ pH: actualHome, pD: actualDraws, pA: 1 - actualHome - actualDraws }));
const eloModel = matches.map((m) => {
  const we = expectedScore(m.eloHome, m.eloAway, m.neutral);
  const pD = Math.max(0.04, 0.3 * (1 - Math.abs(2 * we - 1) ** 1.6));
  return { pH: we - pD / 2, pD, pA: 1 - we - pD / 2 };
});

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
console.log(`Kalibracja na eliminacjach Euro 2016: ${matches.length} meczów × ${SIMS} symulacji\n`);
console.log(`Rzeczywistość: gole/mecz ${actualGoals.toFixed(2)}, remisy ${pct(actualDraws)}, wygrane gospodarzy ${pct(actualHome)}, różnica ≥3 goli ${pct(actualBig)}\n`);
console.log('Model                         Log-loss  Brier   Gole/mecz  Remisy   Różn.≥3');
console.log('─'.repeat(78));
const line = (label: string, s: { logLoss: number; brier: number }, extra = '') =>
  console.log(`${label.padEnd(30)}${s.logLoss.toFixed(3).padStart(8)}  ${s.brier.toFixed(3)}  ${extra}`);
line('Częstości (bez wiedzy o sile)', score(baseRates));
line('Elo + prosty model remisów', score(eloModel));

for (const perPoint of GRID) {
  const t0 = performance.now();
  const preds = matches.map((m, i) => predict(m, perPoint, i));
  const s = score(preds);
  const goals = preds.reduce((acc, p) => acc + p.goals, 0) / preds.length;
  const draws = preds.reduce((acc, p) => acc + p.pD, 0) / preds.length;
  const big = preds.reduce((acc, p) => acc + p.bigMargin, 0) / preds.length;
  line(`Silnik, ${perPoint} Elo/pkt OVR`, s, `${goals.toFixed(2).padStart(9)}  ${pct(draws).padStart(6)}  ${pct(big).padStart(7)}   (${((performance.now() - t0) / 1000).toFixed(0)} s)`);

  if (perPoint === DETAIL) {
    // Kalibracja przedziałów: gdy silnik daje gospodarzom X%, jak często faktycznie wygrywali?
    console.log(`\n  Przedziały pewności (silnik ${DETAIL} Elo/pkt): przewidziana szansa wygranej gospodarzy vs rzeczywistość`);
    for (const [lo, hi] of [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.01]] as const) {
      const idx = preds.map((p, i) => [p, i] as const).filter(([p]) => p.pH >= lo && p.pH < hi);
      if (!idx.length) continue;
      const predicted = idx.reduce((acc, [p]) => acc + p.pH, 0) / idx.length;
      const real = idx.filter(([, i]) => outcome(matches[i]!) === 'H').length / idx.length;
      console.log(`  ${pct(lo).padStart(6)}–${pct(Math.min(hi, 1)).padEnd(7)} meczów ${String(idx.length).padStart(3)}: przewidziano ${pct(predicted).padStart(6)}, było ${pct(real).padStart(6)}`);
    }
    console.log();
  }
}
