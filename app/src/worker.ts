/// <reference lib="webworker" />
/**
 * Worker z całą logiką gry: świat Euro 2016, kariera (generator decyzji), symulacje.
 * Interfejs tylko wysyła prośby i rysuje odpowiedzi – ciężkie liczenie nie blokuje ekranu.
 */
import { careerFlow, type CareerSummary } from '../../src/career/flow';
import { careerConfig } from '../../src/career/setup';
import type { Answer, CareerState, Decision } from '../../src/career/types';
import { createRng } from '../../src/engine/rng';
import { runEuro2016, STAGE_ORDER, type EuroRun, type Stage } from '../../src/scenarios/euro2016/tournament';
import { buildEuroWorld, plName, type Euro2016Files, type LoadedWorld } from '../../src/scenarios/euro2016/world';
import squads from '../../data/processed/euro2016/kadry-pelne.json';
import reserves from '../../data/processed/euro2016/rezerwy.json';
import elo from '../../data/processed/euro2016/elo.json';
import matches from '../../data/processed/euro2016/mecze.json';
import type { EuroRunView, MatchSummary, Request, Response, TallyRow } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const files = { squads, reserves, elo, matches } as unknown as Euro2016Files;
let loaded: LoadedWorld | null = null;
const world = () => (loaded ??= buildEuroWorld(files));

let career: Generator<Decision, CareerSummary, Answer> | null = null;
const expose: { state?: CareerState } = {};

const reply = (r: Response) => self.postMessage(r);

self.onmessage = (e: MessageEvent<Request>) => {
  try {
    handle(e.data);
  } catch (err) {
    reply({ type: 'error', message: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err) });
  }
};

function handle(req: Request) {
  switch (req.type) {
    case 'teams': {
      const w = world();
      const groupOf = (t: string) => w.world.qualifyingGroups.find((g) => g.teams.includes(t))?.letter ?? 'gospodarz';
      const teams = Object.entries(files.elo['2014-09-01']!)
        .map(([team, e]) => ({ team, pl: plName(team), elo: e, group: groupOf(team) }))
        .sort((a, b) => b.elo - a.elo);
      reply({ type: 'teams', teams });
      return;
    }
    case 'career:start': {
      delete expose.state;
      career = careerFlow({ ...careerConfig(files, world(), req.team, req.seed), expose });
      let step = career.next();
      // Wczytanie zapisu: odtwórz odpowiedzi bez rysowania.
      for (const a of req.answers) {
        if (step.done) break;
        step = career.next(a);
      }
      sendCareer(step);
      return;
    }
    case 'career:answer': {
      if (!career) throw new Error('Brak aktywnej kariery');
      sendCareer(career.next(req.answer));
      return;
    }
    case 'euro:once': {
      const w = world();
      const run = runEuro2016(w.world, createRng(req.seed), { finalsOnly: req.finalsOnly, realDraw: true, keepMatches: true });
      reply({ type: 'euro:once', run: viewRun(run, w, req.seed, req.finalsOnly) });
      return;
    }
    case 'euro:mc': {
      const w = world();
      const tally = new Map<string, TallyRow>();
      const row = (team: string) => {
        let r = tally.get(team);
        if (!r) {
          r = { team, qualified: 0, playoff: 0, R16: 0, QF: 0, SF: 0, final: 0, champion: 0, groupWin: 0 };
          tally.set(team, r);
        }
        return r;
      };
      const reached = (s: Stage, target: Stage) => STAGE_ORDER.indexOf(s) >= STAGE_ORDER.indexOf(target);
      for (let i = 0; i < req.count; i++) {
        const run = runEuro2016(w.world, createRng(1_000_003 * (req.from + i) + 17), { finalsOnly: req.finalsOnly, realDraw: true });
        for (const [team, s] of run.stage) {
          const r = row(team);
          if (reached(s, 'finalsGroup')) r.qualified++;
          for (const st of ['R16', 'QF', 'SF', 'final', 'champion'] as const) if (reached(s, st)) r[st]++;
        }
        for (const p of run.playoffs) for (const t of [p.first.home, p.first.away]) row(t).playoff++;
        for (const g of run.finalsGroups) row(g.rows[0]!.team).groupWin++;
        if (i % 5 === 4) reply({ type: 'euro:mc:progress', done: i + 1 });
      }
      reply({ type: 'euro:mc', tally: [...tally.values()] });
      return;
    }
  }
}

function sendCareer(step: IteratorResult<Decision, CareerSummary>) {
  const s = expose.state;
  const status = s
    ? { team: s.team, teamPl: s.teamPl, date: s.date, trust: s.trust, media: s.media, expectation: s.expectation.label, record: { ...s.record } }
    : null;
  if (step.done) reply({ type: 'career', decision: null, status, done: true });
  else reply({ type: 'career', decision: step.value, status, done: false });
}

function viewRun(run: EuroRun, w: LoadedWorld, seed: number, finalsOnly: boolean): EuroRunView {
  const name = (id: string) => w.players.get(id)?.shortName ?? '?';
  const summary = (m: EuroRun['knockout'][number]): MatchSummary => {
    const r = m.result;
    return {
      home: m.home,
      away: m.away,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      extra: r.shootout ? `k. ${r.shootout.home}:${r.shootout.away}` : r.extraTime ? 'po dogr.' : '',
      scorers: r.events.flatMap((e) => (e.kind === 'goal' ? [`${name(e.playerId)} ${e.minute}'${e.ownGoal ? ' (s.)' : ''}`] : [])),
    };
  };
  const ROUND: Record<string, string> = { M37: '1/8 finału', M45: 'Ćwierćfinały', M49: 'Półfinały', M51: 'Finał' };
  return {
    seed,
    finalsOnly,
    qualifying: run.qualifyingTables,
    bestThird: run.thirdPlaceQualifying[0]?.team,
    playoffs: run.playoffs.map((p) => ({
      ...summary(p.second),
      winner: p.winner,
      firstLeg: `${p.first.homeGoals}:${p.first.awayGoals}`,
    })),
    groups: run.finalsGroups,
    knockout: run.knockout.map((m) => ({ ...summary(m), round: ROUND[m.stage] })),
    champion: run.champion,
    scorers: [...run.goals]
      .sort((a, b) => b[1].goals - a[1].goals)
      .slice(0, 10)
      .map(([id, g]) => ({ name: w.players.get(id)?.name ?? '?', team: g.team, goals: g.goals })),
  };
}
