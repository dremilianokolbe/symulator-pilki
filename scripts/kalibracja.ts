/**
 * Kalibracja silnika: tysiące meczów vs realne średnie.
 * Uruchom: npm run kalibracja [-- --mecze 20000]
 */
import { simulateMatch } from '../src/engine/match';
import { createRng } from '../src/engine/rng';
import type { MatchResult, MatchTeamInput } from '../src/engine/types';
import { generateTeam } from '../src/generator/players';
import { paramsFromArgs } from './params-cli';

const argIdx = process.argv.indexOf('--mecze');
const N = argIdx > 0 ? Number(process.argv[argIdx + 1]) : 20000;
const params = paramsFromArgs();

interface Target {
  label: string;
  value: number;
  lo: number;
  hi: number;
  fmt?: (v: number) => string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number) => v.toFixed(2);

function report(title: string, targets: Target[]) {
  console.log(`\n${title}`);
  console.log('─'.repeat(72));
  for (const t of targets) {
    const f = t.fmt ?? num;
    const ok = t.value >= t.lo && t.value <= t.hi;
    console.log(`${ok ? '✓' : '✗'} ${t.label.padEnd(34)} ${f(t.value).padStart(8)}   cel ${f(t.lo)}–${f(t.hi)}`);
  }
}

// ---------------------------------------------------------------------------
// 1. „Liga”: drużyny o zbliżonej, ale zróżnicowanej sile, mecz u siebie / na wyjeździe
// ---------------------------------------------------------------------------

const rng = createRng(2016);
const LEAGUE_SIZE = 20;
const league: MatchTeamInput[] = [];
for (let i = 0; i < LEAGUE_SIZE; i++) {
  const quality = 70 + rng.normal(0, 4);
  league.push(generateTeam(rng, { id: `T${i}`, name: `Drużyna ${i}`, quality }).input);
}

const results: MatchResult[] = [];
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const h = rng.int(0, LEAGUE_SIZE - 1);
  let a = rng.int(0, LEAGUE_SIZE - 2);
  if (a >= h) a++;
  results.push(simulateMatch({ seed: i + 1, home: league[h]!, away: league[a]! }, { params }));
}
const ms = performance.now() - t0;

const avg = (f: (r: MatchResult) => number) => results.reduce((s, r) => s + f(r), 0) / results.length;
const goals = avg((r) => r.score[0] + r.score[1]);
const homeWin = avg((r) => (r.score[0] > r.score[1] ? 1 : 0));
const draw = avg((r) => (r.score[0] === r.score[1] ? 1 : 0));
const awayWin = avg((r) => (r.score[0] < r.score[1] ? 1 : 0));
const nilNil = avg((r) => (r.score[0] + r.score[1] === 0 ? 1 : 0));
const shots = avg((r) => (r.stats.home.shots + r.stats.away.shots) / 2);
const sot = avg((r) => r.stats.home.shotsOnTarget + r.stats.away.shotsOnTarget) / avg((r) => r.stats.home.shots + r.stats.away.shots);
const xg = avg((r) => r.stats.home.xg + r.stats.away.xg);
const corners = avg((r) => (r.stats.home.corners + r.stats.away.corners) / 2);
const fouls = avg((r) => (r.stats.home.fouls + r.stats.away.fouls) / 2);
const yellow = avg((r) => r.stats.home.yellow + r.stats.away.yellow);
const red = avg((r) => r.stats.home.red + r.stats.away.red);
const pens = avg((r) => r.stats.home.penalties + r.stats.away.penalties);
const offsides = avg((r) => (r.stats.home.offsides + r.stats.away.offsides) / 2);
const subs = avg((r) => r.events.filter((e) => e.kind === 'sub').length / 2);
const injuries = avg((r) => r.events.filter((e) => e.kind === 'injury').length);

let penGoals = 0;
let penMisses = 0;
let headed = 0;
let setPiece = 0;
let assisted = 0;
let openGoals = 0;
let allGoals = 0;
const scoreFreq = new Map<string, number>();
for (const r of results) {
  const key = `${r.score[0]}:${r.score[1]}`;
  scoreFreq.set(key, (scoreFreq.get(key) ?? 0) + 1);
  for (const e of r.events) {
    if (e.kind === 'penaltyMiss') penMisses++;
    if (e.kind !== 'goal') continue;
    allGoals++;
    if (e.shot === 'penalty') penGoals++;
    if (e.shot === 'cross' || e.shot === 'corner') headed++;
    if (e.shot === 'corner' || e.shot === 'freeKick' || e.shot === 'penalty') setPiece++;
    if (e.shot !== 'penalty' && !e.ownGoal) {
      openGoals++;
      if (e.assistId) assisted++;
    }
  }
}

console.log(`Kalibracja silnika: ${N} meczów ligowych (${(ms / N).toFixed(2)} ms/mecz)`);

report('Wyniki', [
  { label: 'Gole na mecz', value: goals, lo: 2.55, hi: 2.85 },
  { label: 'Wygrane gospodarzy', value: homeWin, lo: 0.43, hi: 0.48, fmt: pct },
  { label: 'Remisy', value: draw, lo: 0.24, hi: 0.28, fmt: pct },
  { label: 'Wygrane gości', value: awayWin, lo: 0.27, hi: 0.31, fmt: pct },
  { label: 'Wynik 0:0', value: nilNil, lo: 0.06, hi: 0.09, fmt: pct },
]);

report('Statystyki meczu', [
  { label: 'Strzały na drużynę', value: shots, lo: 11.5, hi: 13.5 },
  { label: 'Celność strzałów', value: sot, lo: 0.31, hi: 0.37, fmt: pct },
  { label: 'Gole / xG', value: goals / xg, lo: 0.95, hi: 1.05 },
  { label: 'Rzuty rożne na drużynę', value: corners, lo: 4.5, hi: 5.5 },
  { label: 'Faule na drużynę', value: fouls, lo: 11, hi: 13 },
  { label: 'Żółte kartki na mecz', value: yellow, lo: 3.3, hi: 4.3 },
  { label: 'Czerwone kartki na mecz', value: red, lo: 0.08, hi: 0.16 },
  { label: 'Rzuty karne na mecz', value: pens, lo: 0.22, hi: 0.34 },
  { label: 'Skuteczność karnych', value: penGoals / Math.max(1, penGoals + penMisses), lo: 0.72, hi: 0.8, fmt: pct },
  { label: 'Spalone na drużynę', value: offsides, lo: 1.8, hi: 2.6 },
  { label: 'Zmiany na drużynę', value: subs, lo: 2.6, hi: 3.0 },
]);

report('Struktura goli', [
  { label: 'Gole głową (dośr. + rożne)', value: headed / allGoals, lo: 0.13, hi: 0.2, fmt: pct },
  { label: 'Gole ze stałych fragmentów', value: setPiece / allGoals, lo: 0.22, hi: 0.32, fmt: pct },
  { label: 'Gole z asystą (bez karnych)', value: assisted / Math.max(1, openGoals), lo: 0.7, hi: 0.8, fmt: pct },
]);

console.log(`\nKontuzje na mecz: ${injuries.toFixed(2)} (informacyjnie)`);
const topScores = [...scoreFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`Najczęstsze wyniki: ${topScores.map(([s, n]) => `${s} ${pct(n / N)}`).join(', ')}`);

// ---------------------------------------------------------------------------
// 2. Krzywa siły: faworyt vs słabsza drużyna na neutralnym terenie
// ---------------------------------------------------------------------------

console.log('\nKrzywa siły (teren neutralny, 3000 meczów na wiersz)');
console.log('─'.repeat(72));
console.log('Różnica OVR  Wygrana  Remis  Porażka  Gole fav  Gole słab.  Wynik oczek.  Elo/pkt OVR');
const curveRng = createRng(99);
for (const diff of [0, 3, 6, 10, 15, 20, 30]) {
  const M = 3000;
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  const favs = Array.from({ length: 6 }, (_, i) => generateTeam(curveRng, { id: `F${i}`, name: 'Faworyt', quality: 72 + diff / 2 }).input);
  const dogs = Array.from({ length: 6 }, (_, i) => generateTeam(curveRng, { id: `S${i}`, name: 'Słabszy', quality: 72 - diff / 2 }).input);
  for (let i = 0; i < M; i++) {
    const fav = favs[i % 6]!;
    const dog = dogs[(i * 7) % 6]!;
    const favHome = i % 2 === 0;
    const r = simulateMatch({ seed: 100000 + i + diff * 7919, home: favHome ? fav : dog, away: favHome ? dog : fav, neutral: true }, { params });
    const [f, s] = favHome ? r.score : [r.score[1], r.score[0]];
    gf += f;
    ga += s;
    if (f > s) w++;
    else if (f === s) d++;
    else l++;
  }
  const expected = (w + d / 2) / M;
  const elo = expected > 0.5 && expected < 1 ? -400 * Math.log10(1 / expected - 1) : 0;
  const perPoint = diff > 0 ? (elo / diff).toFixed(0) : '–';
  console.log(
    `${String(diff).padStart(10)}  ${pct(w / M).padStart(7)}  ${pct(d / M).padStart(5)}  ${pct(l / M).padStart(7)}  ${(gf / M).toFixed(2).padStart(8)}  ${(ga / M).toFixed(2).padStart(10)}  ${expected.toFixed(3).padStart(12)}  ${String(perPoint).padStart(11)}`,
  );
}
