/**
 * Pełny przebieg Euro 2016 w symulowanym świecie:
 * eliminacje (9 grup, prawdziwy terminarz) → ranking 3. miejsc → baraże (dwumecze) →
 * losowanie turnieju (koszyki) → 6 grup → ranking 3. miejsc → 1/8 → … → finał.
 *
 * Przebieg jest generatorem: gdy podano drużynę gracza, każdy jej mecz i ważne momenty
 * (koniec eliminacji, losowania, koniec fazy grupowej) są oddawane na zewnątrz jako „punkty
 * zaczepienia” – kariera rozgrywa wtedy mecz po swojemu (na żywo) i zwraca wynik.
 * Bez drużyny gracza nic nie jest oddawane i przebieg działa jak zwykła symulacja.
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
  /** Drużyna gracza: jej mecze i kluczowe momenty są oddawane na zewnątrz. */
  userTeam?: string;
}

export type Phase = 'qualifying' | 'playoff' | 'finals' | 'knockout';

/** Punkty zaczepienia dla kariery. */
export type EuroHook =
  | {
      kind: 'match';
      phase: Phase;
      fixture: Fixture & { stage: string };
      /** Kontekst meczu (bez składów i seeda): teren, mecz pucharowy, pierwszy mecz dwumeczu. */
      context: Omit<MatchContext, 'home' | 'away' | 'seed'>;
      /** Kadry przeciwników w tej fazie. */
      teams: Map<string, MatchTeamInput>;
    }
  | { kind: 'qualifyingDone'; tables: { letter: string; rows: StandingRow[] }[]; thirds: StandingRow[] }
  | { kind: 'playoffDraw'; pairs: [string, string][] }
  | { kind: 'finalsDraw'; groups: Group[] }
  | { kind: 'groupsDone'; tables: { letter: string; rows: StandingRow[] }[]; thirds: StandingRow[] }
  | { kind: 'knockoutDone'; match: SimMatch; round: Stage };

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

export const fairPlay = (events: MatchEvent[], side: 'home' | 'away') =>
  events.reduce((s, e) => (e.kind === 'card' && e.side === side ? s + (e.card === 'yellow' ? 1 : e.card === 'secondYellow' ? 2 : 3) : s), 0);

/** Zwykła symulacja bez drużyny gracza (Monte Carlo, pojedynczy przebieg). */
export function runEuro2016(world: EuroWorld, rng: Rng, opts: EuroOptions = {}): EuroRun {
  const flow = euro2016Flow(world, rng, { ...opts, userTeam: undefined });
  let step = flow.next();
  while (!step.done) step = flow.next(undefined);
  return step.value;
}

export function* euro2016Flow(world: EuroWorld, rng: Rng, opts: EuroOptions = {}): Generator<EuroHook, EuroRun, MatchResult | undefined> {
  const elo = new EloTable();
  for (const [t, r] of Object.entries(world.eloStart)) elo.ratings.set(t, r);
  const coefficient = (t: string) => elo.get(t);
  const stage = new Map<string, Stage>();
  const matches: SimMatch[] = [];
  const goals = new Map<string, { team: string; goals: number }>();
  const user = opts.userTeam;

  function* play(
    f: Fixture & { stage: string },
    phase: Phase,
    teams: Map<string, MatchTeamInput>,
    extra: Partial<MatchContext> = {},
  ): Generator<EuroHook, SimMatch, MatchResult | undefined> {
    const tournament = phase === 'finals' || phase === 'knockout' ? 'UEFA Euro' : 'UEFA Euro qualification';
    const context = { neutral: f.neutral, importance: phase === 'qualifying' ? 60 : 85, ...extra };
    let result: MatchResult | undefined;
    if (user && (f.home === user || f.away === user)) {
      result = yield { kind: 'match', phase, fixture: f, context, teams };
      if (!result) throw new Error('Kariera nie zwróciła wyniku meczu');
    } else {
      const home = teams.get(f.home);
      const away = teams.get(f.away);
      if (!home || !away) throw new Error(`Brak kadry: ${f.home} / ${f.away}`);
      result = simulateMatch({ seed: rng.int(0, 2 ** 31), home, away, ...context });
    }
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
  }

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
      const m = yield* play(f, 'qualifying', world.qualifyingTeams);
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
    if (user) yield { kind: 'qualifyingDone', tables: qualifyingTables, thirds: thirdPlaceQualifying };

    // Baraże: rozstawienie wg współczynnika (Elo na żywo), losowanie par i gospodarza 1. meczu.
    const playoffTeams = thirdPlaceQualifying.slice(1).map((r) => r.team).sort((a, b) => coefficient(b) - coefficient(a));
    const seeded = shuffle(rng, playoffTeams.slice(0, 4));
    const unseeded = shuffle(rng, playoffTeams.slice(4));
    const pairs = seeded.map((s, i) => (rng.chance(0.5) ? [s, unseeded[i]!] : [unseeded[i]!, s]) as [string, string]);
    if (user) yield { kind: 'playoffDraw', pairs };
    const playoffWinners: string[] = [];
    for (const [a, b] of pairs) {
      const first = yield* play({ date: '2015-11-13', home: a, away: b, neutral: false, stage: 'PO' }, 'playoff', world.qualifyingTeams);
      const second = yield* play(
        { date: '2015-11-16', home: b, away: a, neutral: false, stage: 'PO' },
        'playoff',
        world.qualifyingTeams,
        { knockout: true, firstLeg: { homeGoals: first.awayGoals, awayGoals: first.homeGoals } },
      );
      const winner = second.result.winner === 'home' ? b : a;
      stage.set(winner === a ? b : a, 'playoff');
      playoffWinners.push(winner);
      playoffs.push({ first, second, winner });
    }

    qualified = [HOST, ...direct, bestThird, ...playoffWinners];
  }

  // -------------------------------------------------------------------------
  // Losowanie turnieju
  // -------------------------------------------------------------------------

  const realSet = new Set(world.realFinalsGroups.flatMap((g) => g.teams));
  const useReal = opts.finalsOnly || (opts.realDraw && qualified.length === realSet.size && qualified.every((t) => realSet.has(t)));
  const groups: Group[] = useReal ? world.realFinalsGroups : drawFinals(rng, qualified, coefficient);
  if (user) yield { kind: 'finalsDraw', groups };

  // -------------------------------------------------------------------------
  // Faza grupowa turnieju
  // -------------------------------------------------------------------------

  const finalsRules = EURO2016_FINALS_RULES(coefficient);
  const finalsGroups: EuroRun['finalsGroups'] = [];
  const thirds: (StandingRow & { group: string })[] = [];
  const pos = new Map<string, string>(); // np. "1A" → drużyna
  // Mecze grupowe kolejkami (wszystkie grupy), żeby ranking i kalendarz szły chronologicznie.
  const groupMatches = new Map<string, SimMatch[]>();
  const byMatchday = groups.flatMap((g) => g.fixtures.map((f, i) => ({ f: finalsFixture(f), letter: g.letter, order: i })));
  byMatchday.sort((a, b) => a.f.date.localeCompare(b.f.date) || a.order - b.order || a.letter.localeCompare(b.letter));
  for (const { f, letter } of byMatchday) {
    const m = yield* play({ ...f, stage: `F${letter}` }, 'finals', world.finalsTeams);
    groupMatches.set(letter, [...(groupMatches.get(letter) ?? []), m]);
  }
  for (const g of groups) {
    const rows = rankGroup(g.teams, groupMatches.get(g.letter) ?? [], { rules: finalsRules });
    finalsGroups.push({ letter: g.letter, rows });
    rows.forEach((r, i) => pos.set(`${i + 1}${g.letter}`, r.team));
    thirds.push({ ...rows[2]!, group: g.letter });
    stage.set(rows[3]!.team, 'finalsGroup');
  }
  const thirdPlaceFinals = rankAcrossGroups(thirds, ['points', 'goalDiff', 'goals', 'fairPlay'], coefficient) as (StandingRow & { group: string })[];
  for (const r of thirdPlaceFinals.slice(4)) stage.set(r.team, 'finalsGroup');
  if (user) yield { kind: 'groupsDone', tables: finalsGroups, thirds: thirdPlaceFinals };
  const thirdSlots = assignThirds(thirdPlaceFinals.slice(0, 4).map((r) => r.group));
  for (const [winner, group] of Object.entries(thirdSlots)) pos.set(`3vs${winner}`, pos.get(`3${group}`)!);

  // -------------------------------------------------------------------------
  // Faza pucharowa (numeracja meczów jak w 2016)
  // -------------------------------------------------------------------------

  const knockout: SimMatch[] = [];
  const winners = new Map<number, string>();
  function* ko(no: number, home: string, away: string, round: Stage): Generator<EuroHook, void, MatchResult | undefined> {
    const f = finalsFixture({ date: KO_DATES[no] ?? `KO${no}`, home, away, neutral: true });
    const m = yield* play({ ...f, stage: `M${no}` }, 'knockout', world.finalsTeams, { knockout: true });
    knockout.push(m);
    const w = m.result.winner === 'home' ? f.home : f.away;
    winners.set(no, w);
    stage.set(w === f.home ? f.away : f.home, round);
    if (user) yield { kind: 'knockoutDone', match: m, round };
  }
  const t = (k: string) => pos.get(k)!;
  yield* ko(37, t('2A'), t('2C'), 'R16');
  yield* ko(38, t('1B'), t('3vsB'), 'R16');
  yield* ko(39, t('1D'), t('3vsD'), 'R16');
  yield* ko(40, t('1A'), t('3vsA'), 'R16');
  yield* ko(41, t('1C'), t('3vsC'), 'R16');
  yield* ko(42, t('1F'), t('2E'), 'R16');
  yield* ko(43, t('1E'), t('2D'), 'R16');
  yield* ko(44, t('2B'), t('2F'), 'R16');
  const w = (n: number) => winners.get(n)!;
  yield* ko(45, w(37), w(39), 'QF');
  yield* ko(46, w(38), w(42), 'QF');
  yield* ko(47, w(41), w(43), 'QF');
  yield* ko(48, w(40), w(44), 'QF');
  yield* ko(49, w(45), w(46), 'SF');
  yield* ko(50, w(47), w(48), 'SF');
  yield* ko(51, w(49), w(50), 'final');
  const champion = w(51);
  stage.set(champion, 'champion');

  return {
    stage, qualifyingTables, thirdPlaceQualifying, playoffs, finalsGroups, thirdPlaceFinals,
    knockout, champion, matches, goals, elo,
  };
}

/** Daty meczów pucharowych Euro 2016. */
const KO_DATES: Record<number, string> = {
  37: '2016-06-25', 38: '2016-06-25', 39: '2016-06-25', 40: '2016-06-26', 41: '2016-06-26', 42: '2016-06-26',
  43: '2016-06-27', 44: '2016-06-27', 45: '2016-06-30', 46: '2016-07-01', 47: '2016-07-02', 48: '2016-07-03',
  49: '2016-07-06', 50: '2016-07-07', 51: '2016-07-10',
};

/** Gospodarz turnieju gra u siebie (i jako gospodarz meczu), pozostali na neutralnym terenie. */
function finalsFixture(f: Fixture): Fixture {
  const swapped = f.away === HOST ? { home: f.away, away: f.home } : {};
  return { ...f, ...swapped, neutral: f.home !== HOST && f.away !== HOST };
}

export function shuffle<T>(rng: Rng, items: T[]): T[] {
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
    { date: '2016-06-11', home: a, away: b, neutral: true },
    { date: '2016-06-11', home: c, away: d, neutral: true },
    { date: '2016-06-15', home: b, away: d, neutral: true },
    { date: '2016-06-15', home: a, away: c, neutral: true },
    { date: '2016-06-19', home: b, away: c, neutral: true },
    { date: '2016-06-19', home: d, away: a, neutral: true },
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
