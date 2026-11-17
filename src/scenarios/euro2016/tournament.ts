/**
 * Pełny przebieg Euro 2016 w symulowanym świecie:
 * eliminacje (9 grup, prawdziwy terminarz) → ranking 3. miejsc → baraże (dwumecze) →
 * losowanie turnieju (koszyki) → 6 grup → ranking 3. miejsc → 1/8 → … → finał.
 *
 * Współczynnik UEFA (rozstawienia, ostatnie kryterium w tabelach) zastępujemy rankingiem Elo
 * liczonym na żywo z wyników w symulowanym świecie.
 */
import { EloTable } from '../../data/elo';
import { simulateMatch } from '../../engine/match';
import type { Rng } from '../../engine/rng';
import type { MatchContext, MatchEvent, MatchResult, MatchTeamInput } from '../../engine/types';
import {
  EURO2016_FINALS_RULES, EURO2016_QUALIFYING_RULES, rankAcrossGroups, rankGroup,
  type PlayedMatch, type StandingRow,
} from '../../competition/standings';
import { HOLDER, HOST, type Fixture, type Group } from './data';

export type Stage =
  | 'qualifyingGroup' // odpadł w grupie eliminacyjnej
  | 'playoff'         // przegrał baraż
  | 'finalsGroup'     // odpadł w grupie turnieju
  | 'R16' | 'QF' | 'SF' | 'final' | 'champion';

export const STAGE_ORDER: Stage[] = ['qualifyingGroup', 'playoff', 'finalsGroup', 'R16', 'QF', 'SF', 'final', 'champion'];

export interface SimMatch extends PlayedMatch {
  date: string;
  stage: string;
  result: MatchResult;
}

export interface EuroWorld {
  /** Kadry na eliminacje (siła z Elo 2014-09-01). */
  qualifyingTeams: Map<string, MatchTeamInput>;
  /** Kadry na turniej (siła z Elo 2016-06-01). */
  finalsTeams: Map<string, MatchTeamInput>;
  /** Elo na start eliminacji (początek rankingu na żywo). */
  eloStart: Record<string, number>;
  qualifyingGroups: Group[];
  /** Prawdziwe grupy turnieju (używane, gdy awansowały te same drużyny i włączono `realDraw`). */
  realFinalsGroups: Group[];
}

export interface EuroOptions {
  /** Pomiń eliminacje: prawdziwe 24 drużyny i prawdziwe losowanie. */
  finalsOnly?: boolean;
  /** Gdy awansują te same drużyny co naprawdę, użyj prawdziwego losowania. */
  realDraw?: boolean;
  /** Zapisuj wszystkie mecze ze zdarzeniami (dla pojedynczego przebiegu). */
  keepMatches?: boolean;
}

export interface EuroRun {
  stage: Map<string, Stage>;
  qualifyingTables: { letter: string; rows: StandingRow[] }[];
  thirdPlaceQualifying: StandingRow[];
  playoffs: { first: SimMatch; second: SimMatch; winner: string }[];
  finalsGroups: { letter: string; rows: StandingRow[] }[];
  thirdPlaceFinals: StandingRow[];
  knockout: SimMatch[];
  champion: string;
  matches: SimMatch[];
  goals: Map<string, { team: string; goals: number }>;
  elo: EloTable;
}

const fairPlay = (events: MatchEvent[], side: 'home' | 'away') =>
  events.reduce((s, e) => (e.kind === 'card' && e.side === side ? s + (e.card === 'yellow' ? 1 : e.card === 'secondYellow' ? 2 : 3) : s), 0);

export function runEuro2016(world: EuroWorld, rng: Rng, opts: EuroOptions = {}): EuroRun {
  const elo = new EloTable();
  for (const [t, r] of Object.entries(world.eloStart)) elo.ratings.set(t, r);
  const coefficient = (t: string) => elo.get(t);
  const stage = new Map<string, Stage>();
  const matches: SimMatch[] = [];
  const goals = new Map<string, { team: string; goals: number }>();

  const play = (
    f: Fixture & { stage: string },
    teams: Map<string, MatchTeamInput>,
    extra: Partial<MatchContext> = {},
    tournament = 'UEFA Euro qualification',
  ): SimMatch => {
    const home = teams.get(f.home);
    const away = teams.get(f.away);
    if (!home || !away) throw new Error(`Brak kadry: ${f.home} / ${f.away}`);
    const result = simulateMatch({
      seed: rng.int(0, 2 ** 31),
      home,
      away,
      neutral: f.neutral,
      importance: f.stage.startsWith('Q') ? 60 : 85,
      ...extra,
    });
    const [hg, ag] = result.score;
    elo.update({ date: f.date, home: f.home, away: f.away, homeScore: hg, awayScore: ag, tournament, neutral: f.neutral });
    for (const e of result.events) {
      if (e.kind !== 'goal' || e.ownGoal) continue;
      const team = e.side === 'home' ? f.home : f.away;
      const g = goals.get(e.playerId) ?? { team, goals: 0 };
      g.goals++;
      goals.set(e.playerId, g);
    }
    const m: SimMatch = {
      ...f, homeGoals: hg, awayGoals: ag, result,
      homeFairPlay: fairPlay(result.events, 'home'), awayFairPlay: fairPlay(result.events, 'away'),
    };
    if (opts.keepMatches) matches.push(m);
    return m;
  };

  // -------------------------------------------------------------------------
  // Eliminacje
  // -------------------------------------------------------------------------

  let qualified: string[];
  const qualifyingTables: EuroRun['qualifyingTables'] = [];
  let thirdPlaceQualifying: StandingRow[] = [];
  const playoffs: EuroRun['playoffs'] = [];

  if (opts.finalsOnly) {
    qualified = world.realFinalsGroups.flatMap((g) => g.teams);
  } else {
    // Mecze w kolejności dat (wszystkie grupy razem), żeby ranking na żywo był chronologiczny.
    const all = world.qualifyingGroups.flatMap((g) => g.fixtures.map((f) => ({ ...f, stage: `Q${g.letter}` })));
    all.sort((a, b) => a.date.localeCompare(b.date));
    const played = new Map<string, SimMatch[]>();
    for (const f of all) {
      const m = play(f, world.qualifyingTeams);
      const list = played.get(f.stage) ?? [];
      list.push(m);
      played.set(f.stage, list);
    }

    const rules = EURO2016_QUALIFYING_RULES(coefficient);
    const thirds: StandingRow[] = [];
    const direct: string[] = [];
    for (const g of world.qualifyingGroups) {
      const groupMatches = played.get(`Q${g.letter}`) ?? [];
      const rows = rankGroup(g.teams, groupMatches, { rules });
      qualifyingTables.push({ letter: g.letter, rows });
      direct.push(rows[0]!.team, rows[1]!.team);
      for (const r of rows.slice(3)) stage.set(r.team, 'qualifyingGroup');
      // Ranking 3. miejsc: bez meczów z 6. drużyną grupy (grupa I miała 5 drużyn).
      const sixth = rows.length >= 6 ? rows[5]!.team : null;
      const third = rows[2]!.team;
      const considered = groupMatches.filter((m) => !sixth || (m.home !== sixth && m.away !== sixth));
      const thirdRow = rankGroup(g.teams.filter((t) => t !== sixth), considered, { rules }).find((r) => r.team === third)!;
      thirds.push(thirdRow);
    }
    thirdPlaceQualifying = rankAcrossGroups(thirds, ['points', 'goalDiff', 'goals', 'awayGoals', 'wins', 'awayWins', 'fairPlay'], coefficient);
    const bestThird = thirdPlaceQualifying[0]!.team;

    // Baraże: rozstawienie wg współczynnika (Elo na żywo), losowanie par i gospodarza 1. meczu.
    const playoffTeams = thirdPlaceQualifying.slice(1).map((r) => r.team).sort((a, b) => coefficient(b) - coefficient(a));
    const seeded = shuffle(rng, playoffTeams.slice(0, 4));
    const unseeded = shuffle(rng, playoffTeams.slice(4));
    const playoffWinners: string[] = [];
    seeded.forEach((s, i) => {
      const u = unseeded[i]!;
      const [a, b] = rng.chance(0.5) ? [s, u] : [u, s];
      const first = play({ date: '2015-11-13', home: a, away: b, neutral: false, stage: 'PO' }, world.qualifyingTeams);
      const second = play(
        { date: '2015-11-16', home: b, away: a, neutral: false, stage: 'PO' },
        world.qualifyingTeams,
        { knockout: true, firstLeg: { homeGoals: first.awayGoals, awayGoals: first.homeGoals } },
      );
      const winner = second.result.winner === 'home' ? b : a;
      const loser = winner === a ? b : a;
      stage.set(loser, 'playoff');
      playoffWinners.push(winner);
      playoffs.push({ first, second, winner });
    });

    qualified = [HOST, ...direct, bestThird, ...playoffWinners];
  }

  // -------------------------------------------------------------------------
  // Losowanie turnieju
  // -------------------------------------------------------------------------

  const realSet = new Set(world.realFinalsGroups.flatMap((g) => g.teams));
  const useReal = opts.finalsOnly || (opts.realDraw && qualified.length === realSet.size && qualified.every((t) => realSet.has(t)));
  const groups: Group[] = useReal ? world.realFinalsGroups : drawFinals(rng, qualified, coefficient);

  // -------------------------------------------------------------------------
  // Faza grupowa turnieju
  // -------------------------------------------------------------------------

  const finalsRules = EURO2016_FINALS_RULES(coefficient);
  const finalsGroups: EuroRun['finalsGroups'] = [];
  const thirds: (StandingRow & { group: string })[] = [];
  const pos = new Map<string, string>(); // np. "1A" → drużyna
  const finalsFixture = (f: Fixture): Fixture => ({
    ...f,
    // Gospodarz turnieju gra u siebie, pozostali na neutralnym terenie.
    neutral: f.home !== HOST && f.away !== HOST,
    ...(f.away === HOST ? { home: f.away, away: f.home } : {}),
  });
  for (const g of groups) {
    const ms = g.fixtures.map((f) => play({ ...finalsFixture(f), stage: `F${g.letter}` }, world.finalsTeams, {}, 'UEFA Euro'));
    const rows = rankGroup(g.teams, ms, { rules: finalsRules });
    finalsGroups.push({ letter: g.letter, rows });
    rows.forEach((r, i) => pos.set(`${i + 1}${g.letter}`, r.team));
    thirds.push({ ...rows[2]!, group: g.letter });
    stage.set(rows[3]!.team, 'finalsGroup');
  }
  const thirdPlaceFinals = rankAcrossGroups(thirds, ['points', 'goalDiff', 'goals', 'fairPlay'], coefficient) as (StandingRow & { group: string })[];
  for (const r of thirdPlaceFinals.slice(4)) stage.set(r.team, 'finalsGroup');
  const thirdSlots = assignThirds(thirdPlaceFinals.slice(0, 4).map((r) => r.group));
  for (const [winner, group] of Object.entries(thirdSlots)) pos.set(`3vs${winner}`, pos.get(`3${group}`)!);

  // -------------------------------------------------------------------------
  // Faza pucharowa (numeracja meczów jak w 2016)
  // -------------------------------------------------------------------------

  const knockout: SimMatch[] = [];
  const winners = new Map<number, string>();
  const ko = (no: number, home: string, away: string, round: Stage): void => {
    const f = finalsFixture({ date: `KO${no}`, home, away, neutral: true });
    const m = play({ ...f, stage: `M${no}` }, world.finalsTeams, { knockout: true }, 'UEFA Euro');
    knockout.push(m);
    const w = m.result.winner === 'home' ? f.home : f.away;
    const l = w === f.home ? f.away : f.home;
    winners.set(no, w);
    stage.set(l, round);
  };
  const t = (k: string) => pos.get(k)!;
  ko(37, t('2A'), t('2C'), 'R16');
  ko(38, t('1B'), t('3vsB'), 'R16');
  ko(39, t('1D'), t('3vsD'), 'R16');
  ko(40, t('1A'), t('3vsA'), 'R16');
  ko(41, t('1C'), t('3vsC'), 'R16');
  ko(42, t('1F'), t('2E'), 'R16');
  ko(43, t('1E'), t('2D'), 'R16');
  ko(44, t('2B'), t('2F'), 'R16');
  const w = (n: number) => winners.get(n)!;
  ko(45, w(37), w(39), 'QF');
  ko(46, w(38), w(42), 'QF');
  ko(47, w(41), w(43), 'QF');
  ko(48, w(40), w(44), 'QF');
  ko(49, w(45), w(46), 'SF');
  ko(50, w(47), w(48), 'SF');
  ko(51, w(49), w(50), 'final');
  const champion = w(51);
  stage.set(champion, 'champion');

  return {
    stage, qualifyingTables, thirdPlaceQualifying, playoffs, finalsGroups, thirdPlaceFinals,
    knockout, champion, matches, goals, elo,
  };
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Pary, których UEFA nie dopuszczała w jednej grupie (2016). */
const FORBIDDEN_PAIRS: [string, string][] = [['Russia', 'Ukraine']];

/**
 * Losowanie turnieju: koszyk 1 = gospodarz, obrońca tytułu i 4 najlepsze wg współczynnika,
 * dalej koszyki po 6 wg współczynnika. Gospodarz na pozycji A1.
 */
export function drawFinals(rng: Rng, teams: string[], coefficient: (t: string) => number): Group[] {
  const rest = teams.filter((t) => t !== HOST && t !== HOLDER).sort((a, b) => coefficient(b) - coefficient(a));
  const pot1Extra = teams.includes(HOLDER) ? [HOLDER] : [];
  const pot1 = [...pot1Extra, ...rest.splice(0, 5 - pot1Extra.length)];
  const pots = [pot1, rest.slice(0, 6), rest.slice(6, 12), rest.slice(12, 18)];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  for (let attempt = 0; attempt < 100; attempt++) {
    const groups = letters.map((letter) => ({ letter, teams: [] as string[] }));
    groups[0]!.teams.push(HOST);
    shuffle(rng, pots[0]!).forEach((team, i) => groups[i + 1]!.teams.push(team));
    for (const pot of pots.slice(1)) shuffle(rng, pot).forEach((team, i) => groups[i]!.teams.push(team));
    const ok = groups.every((g) => !FORBIDDEN_PAIRS.some(([a, b]) => g.teams.includes(a) && g.teams.includes(b)));
    if (!ok) continue;
    // Pozycje 2–4 w grupie losowe; gospodarz zostaje na A1.
    return groups.map((g) => {
      const teamsInGroup = [g.teams[0]!, ...shuffle(rng, g.teams.slice(1))];
      return { letter: g.letter, teams: teamsInGroup, fixtures: groupFixtures(teamsInGroup) };
    });
  }
  throw new Error('Nie udało się rozlosować grup');
}

/** Terminarz grupy wg pozycji (jak w 2016): 1–2, 3–4 / 2–4, 1–3 / 2–3, 4–1. */
function groupFixtures(t: string[]): Fixture[] {
  const [a, b, c, d] = t as [string, string, string, string];
  return [
    { date: 'MD1', home: a, away: b, neutral: true },
    { date: 'MD1', home: c, away: d, neutral: true },
    { date: 'MD2', home: b, away: d, neutral: true },
    { date: 'MD2', home: a, away: c, neutral: true },
    { date: 'MD3', home: b, away: c, neutral: true },
    { date: 'MD3', home: d, away: a, neutral: true },
  ];
}

/**
 * Przydział 4 najlepszych trzecich drużyn do zwycięzców grup A–D w 1/8.
 * Dozwolone grupy: 1A ← C/D/E, 1B ← A/C/D, 1C ← A/B/F, 1D ← B/E/F.
 * UEFA miała tabelę 15 kombinacji; tu wybieramy pierwszy pasujący przydział w kolejności A, B, C, D,
 * co zgadza się z przypadkiem z 2016 (trzecie z B, C, E, F).
 */
export function assignThirds(groups: string[]): Record<'A' | 'B' | 'C' | 'D', string> {
  const allowed: Record<'A' | 'B' | 'C' | 'D', string[]> = { A: ['C', 'D', 'E'], B: ['A', 'C', 'D'], C: ['A', 'B', 'F'], D: ['B', 'E', 'F'] };
  const order = ['A', 'B', 'C', 'D'] as const;
  const available = [...groups].sort();
  const result = {} as Record<'A' | 'B' | 'C' | 'D', string>;
  const solve = (i: number, used: Set<string>): boolean => {
    if (i === order.length) return true;
    const slot = order[i]!;
    for (const g of available) {
      if (used.has(g) || !allowed[slot].includes(g)) continue;
      result[slot] = g;
      used.add(g);
      if (solve(i + 1, used)) return true;
      used.delete(g);
    }
    return false;
  };
  if (!solve(0, new Set())) throw new Error(`Brak przydziału dla trzecich miejsc: ${groups.join('')}`);
  return result;
}
