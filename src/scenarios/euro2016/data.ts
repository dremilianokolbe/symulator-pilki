/**
 * Struktura prawdziwego Euro 2016 wyczytana z danych: grupy eliminacji z terminarzem,
 * grupy turnieju finałowego z terminarzem, prawdziwe wyniki (do testów i porównań).
 */

export interface EuroMatch {
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

export interface Fixture {
  date: string;
  home: string;
  away: string;
  neutral: boolean;
}

export interface Group {
  letter: string;
  teams: string[];
  fixtures: Fixture[];
}

export const HOST = 'France';
export const HOLDER = 'Spain';
export const QUALIFYING_END = '2015-10-31';
export const FINALS_GROUP_END = '2016-06-22';

/** Litera grupy eliminacji wg jednego z członków. */
const QUALIFYING_LETTER: Record<string, string> = {
  'Czech Republic': 'A', Belgium: 'B', Spain: 'C', Germany: 'D', England: 'E', 'Northern Ireland': 'F',
  Austria: 'G', Italy: 'H', Portugal: 'I',
};
const FINALS_LETTER: Record<string, string> = {
  France: 'A', England: 'B', Germany: 'C', Spain: 'D', Italy: 'E', Portugal: 'F',
};

/**
 * Mecz przerwany w 33. minucie (raca w bramkarza Rosji), walkower 0:3 – brak w zbiorze wyników.
 * W symulacji rozgrywamy go normalnie.
 */
export const MISSING_QUALIFIER: EuroMatch = {
  date: '2015-03-27', home: 'Montenegro', away: 'Russia', homeScore: 0, awayScore: 3,
  tournament: 'UEFA Euro qualification', neutral: false, eloHome: 0, eloAway: 0,
};

/**
 * Kary punktowe w prawdziwej tabeli: Serbia −3 (zamieszki w meczu z Albanią),
 * Chorwacja −1 (swastyka na murawie przed meczem z Włochami).
 */
export const REAL_POINTS_ADJUSTMENT: Record<string, number> = { Serbia: -3, Croatia: -1 };

function groupsFrom(matches: EuroMatch[], letters: Record<string, string>): Group[] {
  // Spójne składowe grafu „kto grał z kim”.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x)!;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  for (const m of matches) parent.set(find(m.home), find(m.away));
  const byRoot = new Map<string, Group>();
  for (const m of matches) {
    const root = find(m.home);
    let g = byRoot.get(root);
    if (!g) {
      g = { letter: '?', teams: [], fixtures: [] };
      byRoot.set(root, g);
    }
    for (const t of [m.home, m.away]) if (!g.teams.includes(t)) g.teams.push(t);
    g.fixtures.push({ date: m.date, home: m.home, away: m.away, neutral: m.neutral });
  }
  const groups = [...byRoot.values()];
  for (const g of groups) {
    g.letter = g.teams.map((t) => letters[t]).find(Boolean) ?? '?';
    g.fixtures.sort((a, b) => a.date.localeCompare(b.date));
    g.teams.sort();
  }
  return groups.sort((a, b) => a.letter.localeCompare(b.letter));
}

export function qualifierMatches(all: EuroMatch[]): EuroMatch[] {
  return [
    ...all.filter((m) => m.tournament === 'UEFA Euro qualification' && m.date <= QUALIFYING_END),
    MISSING_QUALIFIER,
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function qualifyingGroups(all: EuroMatch[]): Group[] {
  return groupsFrom(qualifierMatches(all), QUALIFYING_LETTER);
}

export function finalsGroups(all: EuroMatch[]): Group[] {
  return groupsFrom(
    all.filter((m) => m.tournament === 'UEFA Euro' && m.date <= FINALS_GROUP_END),
    FINALS_LETTER,
  );
}
