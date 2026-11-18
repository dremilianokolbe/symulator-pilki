/**
 * Kalibracja na prawdziwych meczach: 267 meczów eliminacji Euro 2016.
 * Przed każdym meczem silnik zna tylko ranking Elo obu drużyn sprzed meczu (zamieniony na OVR).
 * Porównujemy przewidywania z rzeczywistymi wynikami i z prostymi modelami odniesienia.
 * Uruchom: npx tsx scripts/kalibracja-euro.ts [-- --sym 100]
 */
import { readFileSync } from 'node:fs';
import { expectedScore } from '../src/data/elo';
import { simulateMatch } from '../src/engine/match';
import { paramsFromArgs } from './params-cli';
import { createRng } from '../src/engine/rng';
import type { MatchTeamInput, Player } from '../src/engine/types';
import { generateTeam } from '../src/generator/players';
import { buildEuroTeam, type Euro2016Data } from '../src/scenarios/euro2016';

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
// --param klucz=wartość (można powtarzać): próba innych parametrów bez zmiany kodu.
const params = paramsFromArgs();
const matches = (JSON.parse(readFileSync('data/processed/euro2016/mecze.json', 'utf8')) as EuroMatch[])
  .filter((m) => m.tournament === 'UEFA Euro qualification');

/** Elo → OVR: 1700 Elo = 70 OVR, `perPoint` punktów Elo na punkt OVR. */
const toOvr = (elo: number, perPoint: number) => 70 + (elo - 1700) / perPoint;

// Każda drużyna ma stały „kształt” kadry, przesuwany do aktualnej siły z Elo.
// --kadry: prawdziwe kadry (wyliczone atrybuty), inaczej kadry wygenerowane.
const REAL = process.argv.includes('--kadry');
const euroData: Euro2016Data | null = REAL
  ? { squads: JSON.parse(readFileSync('data/processed/euro2016/kadry-pelne.json', 'utf8')), elo: {}, refDate: '2015-06-01' }
  : null;
const shapes = new Map<string, MatchTeamInput>();
const shapeRng = createRng(54);
function shape(team: string): MatchTeamInput {
  let s = shapes.get(team);
  if (!s) {
    s = euroData ? buildEuroTeam(euroData, team, {}, 70).input : generateTeam(shapeRng, { id: team, name: team, quality: 70 }).input;
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
  homeGoals: number;
  awayGoals: number;
}

function predict(m: EuroMatch, perPoint: number, matchIdx: number): Prediction {
  const home = shifted(shape(m.home), toOvr(m.eloHome, perPoint) - 70);
  const away = shifted(shape(m.away), toOvr(m.eloAway, perPoint) - 70);
  let h = 0, d = 0, a = 0, goals = 0, big = 0, hGoals = 0;
  for (let s = 0; s < SIMS; s++) {
    const r = simulateMatch({ seed: matchIdx * 1000 + s, home, away, neutral: m.neutral, international: true, importance: 60 }, { params });
    const [hg, ag] = r.score;
    if (hg > ag) h++;
    else if (hg === ag) d++;
    else a++;
    goals += hg + ag;
    hGoals += hg;
    if (Math.abs(hg - ag) >= 3) big++;
  }
  return {
    pH: h / SIMS, pD: d / SIMS, pA: a / SIMS, goals: goals / SIMS, bigMargin: big / SIMS,
    homeGoals: hGoals / SIMS, awayGoals: (goals - hGoals) / SIMS,
  };
}

const outcome = (m: EuroMatch) => (m.homeScore > m.awayScore ? 'H' : m.homeScore === m.awayScore ? 'D' : 'A');

/**
 * Log-loss i Brier. Częstości z symulacji wygładzamy (+0,5 do każdego wyniku), żeby wynik,
 * który akurat nie padł w N próbach, nie dostawał zerowego prawdopodobieństwa.
 */
function score(preds: { pH: number; pD: number; pA: number }[], sims = 0) {
  let logLoss = 0;
  let brier = 0;
  const smooth = (p: number) => (sims ? (p * sims + 0.5) / (sims + 1.5) : Math.max(0.01, p));
  preds.forEach((p, i) => {
    const o = outcome(matches[i]!);
    const probs = { H: smooth(p.pH), D: smooth(p.pD), A: smooth(p.pA) };
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
console.log(`Kalibracja na eliminacjach Euro 2016: ${matches.length} meczów × ${SIMS} symulacji, kadry: ${REAL ? "prawdziwe" : "wygenerowane"}\n`);
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
  const s = score(preds, SIMS);
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
    printBuckets(preds);
    console.log();
  }
}

/**
 * Rozbicie według różnicy siły (Elo z atutem gospodarza): średnie gole faworyta i słabszego
 * oraz wygrana/remis/porażka faworyta – rzeczywistość vs silnik.
 */
function printBuckets(preds: Prediction[]) {
  console.log('\n  Według różnicy Elo (z atutem gospodarza): gole faworyta:słabszego, wygrana/remis/porażka faworyta');
  console.log('  Różnica    meczów   rzeczywistość                silnik');
  for (const [lo, hi] of [[0, 100], [100, 200], [200, 350], [350, 500], [500, 9999]] as const) {
    const rows = matches.map((m, i) => {
      const diff = m.eloHome + (m.neutral ? 0 : 100) - m.eloAway;
      const favHome = diff >= 0;
      const p = preds[i]!;
      return {
        diff: Math.abs(diff),
        real: favHome ? [m.homeScore, m.awayScore] : [m.awayScore, m.homeScore],
        sim: favHome ? [p.homeGoals, p.awayGoals] : [p.awayGoals, p.homeGoals],
        simWDL: favHome ? [p.pH, p.pD, p.pA] : [p.pA, p.pD, p.pH],
      };
    }).filter((r) => r.diff >= lo && r.diff < hi);
    if (!rows.length) continue;
    const n = rows.length;
    const mean = (f: (r: (typeof rows)[number]) => number) => rows.reduce((acc, r) => acc + f(r), 0) / n;
    const rw = mean((r) => (r.real[0]! > r.real[1]! ? 1 : 0));
    const rd = mean((r) => (r.real[0] === r.real[1] ? 1 : 0));
    const real = `${mean((r) => r.real[0]!).toFixed(2)}:${mean((r) => r.real[1]!).toFixed(2)}  ${pct(rw)}/${pct(rd)}/${pct(1 - rw - rd)}`;
    const sim = `${mean((r) => r.sim[0]!).toFixed(2)}:${mean((r) => r.sim[1]!).toFixed(2)}  ${pct(mean((r) => r.simWDL[0]!))}/${pct(mean((r) => r.simWDL[1]!))}/${pct(mean((r) => r.simWDL[2]!))}`;
    console.log(`  ${`${lo}–${hi === 9999 ? '' : hi}`.padEnd(10)} ${String(n).padStart(5)}   ${real.padEnd(29)}${sim}`);
  }
}
