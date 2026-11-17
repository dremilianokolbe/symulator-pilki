/**
 * Tabele grupowe z konfigurowalnymi kryteriami rozstrzygania (regulaminy UEFA/FIFA różnych lat).
 *
 * Algorytm UEFA: przy równej liczbie punktów najpierw mini-tabela meczów bezpośrednich
 * (punkty, bilans, gole, gole na wyjeździe). Jeśli to rozdzieli część drużyn, dla pozostałych
 * remisujących liczy się ją od nowa tylko między nimi. Gdy mecze bezpośrednie nic nie rozstrzygają,
 * decydują kryteria ogólne (bilans, gole, …), na końcu współczynnik.
 */

export interface PlayedMatch {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  /** Punkty fair play (żółta = 1, czerwona = 3); mniej = lepiej. */
  homeFairPlay?: number;
  awayFairPlay?: number;
}

export interface StandingRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  awayGoals: number;
  awayWins: number;
  fairPlay: number;
}

export type Criterion =
  | 'points' | 'goalDiff' | 'goals' | 'awayGoals' | 'wins' | 'awayWins' | 'fairPlay';

export interface TiebreakRules {
  /** Kryteria meczów bezpośrednich (stosowane ponownie dla mniejszej grupy). Puste = bez meczów bezpośrednich. */
  headToHead: Criterion[];
  /** Kryteria ogólne, gdy mecze bezpośrednie nie rozstrzygają. */
  overall: Criterion[];
  /** Ostatnie kryterium (np. współczynnik UEFA); wyżej = lepiej. */
  coefficient: (team: string) => number;
}

/** Regulamin eliminacji Euro 2016 (art. 14.01). */
export const EURO2016_QUALIFYING_RULES = (coefficient: (t: string) => number): TiebreakRules => ({
  headToHead: ['points', 'goalDiff', 'goals', 'awayGoals'],
  overall: ['goalDiff', 'goals', 'awayGoals', 'wins', 'awayWins', 'fairPlay'],
  coefficient,
});

/** Regulamin turnieju finałowego Euro 2016 (art. 18.01). */
export const EURO2016_FINALS_RULES = (coefficient: (t: string) => number): TiebreakRules => ({
  headToHead: ['points', 'goalDiff', 'goals'],
  overall: ['goalDiff', 'goals', 'fairPlay'],
  coefficient,
});

export function buildTable(teams: string[], matches: PlayedMatch[], pointsAdjustment: Record<string, number> = {}): Map<string, StandingRow> {
  const rows = new Map<string, StandingRow>();
  for (const team of teams) {
    rows.set(team, {
      team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
      points: pointsAdjustment[team] ?? 0, awayGoals: 0, awayWins: 0, fairPlay: 0,
    });
  }
  for (const m of matches) {
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.goalsFor += m.homeGoals;
    h.goalsAgainst += m.awayGoals;
    a.goalsFor += m.awayGoals;
    a.goalsAgainst += m.homeGoals;
    a.awayGoals += m.awayGoals;
    h.fairPlay += m.homeFairPlay ?? 0;
    a.fairPlay += m.awayFairPlay ?? 0;
    if (m.homeGoals > m.awayGoals) {
      h.won++;
      h.points += 3;
      a.lost++;
    } else if (m.homeGoals < m.awayGoals) {
      a.won++;
      a.awayWins++;
      a.points += 3;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }
  for (const r of rows.values()) r.goalDiff = r.goalsFor - r.goalsAgainst;
  return rows;
}

function value(row: StandingRow, c: Criterion): number {
  switch (c) {
    case 'points': return row.points;
    case 'goalDiff': return row.goalDiff;
    case 'goals': return row.goalsFor;
    case 'awayGoals': return row.awayGoals;
    case 'wins': return row.won;
    case 'awayWins': return row.awayWins;
    // Fair play: mniej punktów karnych = lepiej, więc odwracamy znak.
    case 'fairPlay': return -row.fairPlay;
  }
}

/** Dzieli drużyny na grupy o równych wartościach kryteriów, od najlepszej. */
function partition(teams: string[], rows: Map<string, StandingRow>, criteria: Criterion[]): string[][] {
  const key = (t: string) => criteria.map((c) => value(rows.get(t)!, c));
  const sorted = [...teams].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i]! - ka[i]!;
    return 0;
  });
  const groups: string[][] = [];
  for (const t of sorted) {
    const last = groups[groups.length - 1];
    if (last && key(last[0]!).every((v, i) => v === key(t)[i])) last.push(t);
    else groups.push([t]);
  }
  return groups;
}

export interface RankOptions {
  rules: TiebreakRules;
  pointsAdjustment?: Record<string, number>;
}

/** Tabela grupy posortowana wg regulaminu. */
export function rankGroup(teams: string[], matches: PlayedMatch[], opts: RankOptions): StandingRow[] {
  const table = buildTable(teams, matches, opts.pointsAdjustment);
  const order = partition(teams, table, ['points']).flatMap((tied) => resolveTie(tied, matches, table, opts.rules));
  return order.map((t) => table.get(t)!);
}

function resolveTie(tied: string[], matches: PlayedMatch[], table: Map<string, StandingRow>, rules: TiebreakRules): string[] {
  if (tied.length <= 1) return tied;
  if (rules.headToHead.length > 0) {
    const set = new Set(tied);
    const between = matches.filter((m) => set.has(m.home) && set.has(m.away));
    const mini = buildTable(tied, between);
    const groups = partition(tied, mini, rules.headToHead);
    // Mecze bezpośrednie coś rozstrzygnęły: dla pozostałych remisów liczymy je od nowa.
    if (groups.length > 1) return groups.flatMap((g) => resolveTie(g, matches, table, rules));
  }
  return partition(tied, table, rules.overall).flatMap((g) =>
    g.length === 1 ? g : [...g].sort((a, b) => rules.coefficient(b) - rules.coefficient(a)),
  );
}

/** Ranking drużyn z różnych grup (np. najlepsze trzecie miejsca) wg podanych kryteriów. */
export function rankAcrossGroups(rows: StandingRow[], criteria: Criterion[], coefficient: (t: string) => number): StandingRow[] {
  return [...rows].sort((a, b) => {
    for (const c of criteria) {
      const d = value(b, c) - value(a, c);
      if (d !== 0) return d;
    }
    return coefficient(b.team) - coefficient(a.team);
  });
}
