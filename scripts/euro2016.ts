/**
 * Euro 2016 w trybie sandbox.
 *
 * Jeden przebieg z tabelami i drabinką:
 *   npm run euro -- --raz [--seed 7] [--tylko-turniej]
 * Monte Carlo (szanse każdej drużyny), równolegle na wszystkich rdzeniach:
 *   npm run euro -- --symulacje 10000 [--tylko-turniej]
 */
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { createRng } from '../src/engine/rng';
import { runEuro2016, STAGE_ORDER, type EuroRun, type Stage } from '../src/scenarios/euro2016/tournament';
import { loadEuroWorld } from '../src/node/load';
import { plName } from '../src/scenarios/euro2016/world';

interface Job {
  from: number;
  count: number;
  finalsOnly: boolean;
}

type Tally = Record<string, { stages: Record<Stage, number>; playoff: number; groupWin: number; scorers: number }>;

function runJob(job: Job): Tally {
  const { world } = loadEuroWorld();
  const tally: Tally = {};
  for (let i = 0; i < job.count; i++) {
    const run = runEuro2016(world, createRng(1_000_003 * (job.from + i) + 17), { finalsOnly: job.finalsOnly, realDraw: true });
    for (const [team, stage] of run.stage) {
      const t = (tally[team] ??= { stages: Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<Stage, number>, playoff: 0, groupWin: 0, scorers: 0 });
      t.stages[stage]++;
    }
    for (const p of run.playoffs) for (const team of [p.first.home, p.first.away]) tally[team]!.playoff++;
    for (const g of run.finalsGroups) tally[g.rows[0]!.team]!.groupWin++;
  }
  return tally;
}

async function main() {
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const finalsOnly = process.argv.includes('--tylko-turniej');

  if (process.argv.includes('--raz')) {
    const seed = Number(arg('--seed') ?? Date.now() % 100000);
    const loaded = loadEuroWorld();
    const run = runEuro2016(loaded.world, createRng(seed), { finalsOnly, realDraw: true, keepMatches: true });
    printRun(run, loaded.players, seed, finalsOnly);
    return;
  }

  const total = Number(arg('--symulacje') ?? 1000);
  const workers = Math.min(cpus().length, total);
  const per = Math.ceil(total / workers);
  const t0 = performance.now();
  console.log(`Euro 2016: ${total} symulacji${finalsOnly ? ' (tylko turniej, prawdziwe losowanie)' : ' (eliminacje + turniej)'} na ${workers} rdzeniach…`);
  const tallies = await Promise.all(
    Array.from({ length: workers }, (_, w) => {
      const job: Job = { from: w * per, count: Math.max(0, Math.min(per, total - w * per)), finalsOnly };
      return new Promise<Tally>((resolve, reject) => {
        const worker = new Worker(new URL('./tsx-worker.mjs', import.meta.url), { workerData: { ...job, __file: fileURLToPath(import.meta.url) } });
        worker.once('message', resolve);
        worker.once('error', reject);
      });
    }),
  );
  const merged: Tally = {};
  for (const t of tallies) {
    for (const [team, v] of Object.entries(t)) {
      const m = (merged[team] ??= { stages: Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<Stage, number>, playoff: 0, groupWin: 0, scorers: 0 });
      for (const s of STAGE_ORDER) m.stages[s] += v.stages[s];
      m.playoff += v.playoff;
      m.groupWin += v.groupWin;
    }
  }
  printTally(merged, total, finalsOnly, (performance.now() - t0) / 1000);
}

/** Prawdziwy etap 2016 (do porównania). */
const REAL_STAGE: Record<string, Stage> = {
  Portugal: 'champion', France: 'final', Germany: 'SF', Wales: 'SF', Poland: 'QF', Belgium: 'QF', Italy: 'QF',
  Iceland: 'QF', Switzerland: 'R16', Croatia: 'R16', 'Northern Ireland': 'R16', Slovakia: 'R16', Hungary: 'R16',
  England: 'R16', Spain: 'R16', 'Republic of Ireland': 'R16', Albania: 'finalsGroup', Romania: 'finalsGroup',
  Russia: 'finalsGroup', Ukraine: 'finalsGroup', Turkey: 'finalsGroup', 'Czech Republic': 'finalsGroup',
  Sweden: 'finalsGroup', Austria: 'finalsGroup', 'Bosnia and Herzegovina': 'playoff', Denmark: 'playoff',
  Norway: 'playoff', Slovenia: 'playoff',
};
const STAGE_PL: Record<Stage, string> = {
  qualifyingGroup: 'grupa el.', playoff: 'baraże', finalsGroup: 'grupa', R16: '1/8', QF: '1/4', SF: '1/2', final: 'finał', champion: 'MISTRZ',
};

function printTally(t: Tally, total: number, finalsOnly: boolean, seconds: number) {
  const reached = (team: string, s: Stage) => {
    const idx = STAGE_ORDER.indexOf(s);
    return STAGE_ORDER.slice(idx).reduce((acc, st) => acc + t[team]!.stages[st], 0) / total;
  };
  const pct = (v: number) => (v === 0 ? '–' : v < 0.001 ? '<0,1%' : `${(v * 100).toFixed(1).replace('.', ',')}%`);
  const rows = Object.keys(t).sort((a, b) =>
    reached(b, 'champion') - reached(a, 'champion') || reached(b, 'SF') - reached(a, 'SF') || reached(b, 'finalsGroup') - reached(a, 'finalsGroup'));
  const header = finalsOnly
    ? 'Drużyna                   1. w gr.   1/8     1/4     1/2    Finał  Mistrz   Naprawdę'
    : 'Drużyna                   Awans  Baraże   1/8     1/4     1/2    Finał  Mistrz   Naprawdę';
  console.log(`\n${header}\n${'─'.repeat(header.length)}`);
  for (const team of rows) {
    const cols = finalsOnly
      ? [t[team]!.groupWin / total, reached(team, 'R16'), reached(team, 'QF'), reached(team, 'SF'), reached(team, 'final'), reached(team, 'champion')]
      : [reached(team, 'finalsGroup'), t[team]!.playoff / total, reached(team, 'R16'), reached(team, 'QF'), reached(team, 'SF'), reached(team, 'final'), reached(team, 'champion')];
    const real = REAL_STAGE[team] ? STAGE_PL[REAL_STAGE[team]!] : finalsOnly ? '' : 'grupa el.';
    console.log(`${plName(team).padEnd(24)} ${cols.map((c) => pct(c).padStart(7)).join(' ')}   ${real}`);
  }
  console.log(`\n${total} symulacji w ${seconds.toFixed(0)} s.`);
}

function printRun(run: EuroRun, players: Map<string, { shortName: string }>, seed: number, finalsOnly: boolean) {
  const n = (t: string) => plName(t);
  const table = (rows: EuroRun['finalsGroups'][number]['rows']) =>
    rows.map((r, i) => `  ${i + 1}. ${n(r.team).padEnd(22)} ${String(r.played).padStart(2)} ${String(r.won).padStart(2)} ${String(r.drawn).padStart(2)} ${String(r.lost).padStart(2)}  ${String(r.goalsFor).padStart(2)}:${String(r.goalsAgainst).padEnd(2)} ${String(r.points).padStart(3)} pkt`).join('\n');

  console.log(`\nEURO 2016 – symulacja (seed ${seed})`);
  if (!finalsOnly) {
    console.log('\n═══ ELIMINACJE ═══');
    for (const g of run.qualifyingTables) console.log(`\nGrupa ${g.letter}\n${table(g.rows)}`);
    console.log(`\nNajlepsza 3. drużyna: ${n(run.thirdPlaceQualifying[0]!.team)}`);
    console.log('\nBaraże:');
    for (const p of run.playoffs) {
      const agg = (team: string) => (p.first.home === team ? p.first.homeGoals : p.first.awayGoals) + (p.second.home === team ? p.second.homeGoals : p.second.awayGoals);
      const a = p.first.home;
      const b = p.first.away;
      const extra = p.second.result.shootout ? ` (karne ${p.second.result.shootout.home}:${p.second.result.shootout.away})` : p.second.result.extraTime ? ' (po dogr.)' : '';
      console.log(`  ${n(a)} – ${n(b)}  ${p.first.homeGoals}:${p.first.awayGoals}, ${p.second.awayGoals}:${p.second.homeGoals}${extra}  (dwumecz ${agg(a)}:${agg(b)}) → ${n(p.winner)}`);
    }
  }
  console.log('\n═══ TURNIEJ FINAŁOWY ═══');
  for (const g of run.finalsGroups) console.log(`\nGrupa ${g.letter}\n${table(g.rows)}`);
  console.log(`\nAwans z 3. miejsc: ${run.thirdPlaceFinals.slice(0, 4).map((r) => n(r.team)).join(', ')}`);
  const ROUND: Record<number, string> = { 37: '1/8', 45: '1/4', 49: '1/2', 51: 'Finał' };
  for (const m of run.knockout) {
    const no = Number(m.stage.slice(1));
    if (ROUND[no]) console.log(`\n${ROUND[no]}`);
    const r = m.result;
    const extra = r.shootout ? ` (k. ${r.shootout.home}:${r.shootout.away})` : r.extraTime ? ' (dogr.)' : '';
    const scorers = r.events.filter((e) => e.kind === 'goal').map((e) => (e.kind === 'goal' ? `${players.get(e.playerId)?.shortName ?? '?'} ${e.minute}'${e.ownGoal ? ' (s)' : ''}` : '')).join(', ');
    console.log(`  ${n(m.home)} – ${n(m.away)}  ${m.homeGoals}:${m.awayGoals}${extra}${scorers ? `   [${scorers}]` : ''}`);
  }
  console.log(`\n🏆 MISTRZ EUROPY: ${n(run.champion).toUpperCase()}`);
  const top = [...run.goals].filter(([, g]) => true).sort((a, b) => b[1].goals - a[1].goals).slice(0, 5);
  console.log(`\nNajlepsi strzelcy (eliminacje + turniej): ${top.map(([id, g]) => `${players.get(id)?.shortName} (${n(g.team)}) ${g.goals}`).join(', ')}`);
}

// Start na końcu pliku: stałe wyżej muszą być już zainicjalizowane.
if (!isMainThread) {
  parentPort!.postMessage(runJob(workerData as Job));
} else {
  await main();
}
