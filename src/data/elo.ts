/**
 * Ranking Elo reprezentacji wg formuły World Football Elo (eloratings.net):
 * waga meczu K zależy od rangi, mnożnik za różnicę bramek, +100 dla gospodarza.
 * Używany do siły kadr w scenariuszach i (później) do rankingu na żywo w grze.
 */
export interface IntlMatch {
  date: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  tournament: string;
  neutral: boolean;
}

export const INITIAL_ELO = 1500;
export const HOME_ADVANTAGE = 100;

export function kFactor(tournament: string): number {
  if (tournament === 'FIFA World Cup') return 60;
  if (['UEFA Euro', 'Copa América', 'African Cup of Nations', 'AFC Asian Cup', 'Gold Cup', 'Confederations Cup'].includes(tournament)) return 50;
  if (tournament.includes('qualification')) return 40;
  if (tournament === 'Friendly') return 20;
  return 30;
}

export function goalDiffMultiplier(diff: number): number {
  const d = Math.abs(diff);
  if (d <= 1) return 1;
  if (d === 2) return 1.5;
  return (11 + d) / 8;
}

/** Oczekiwany wynik gospodarza (wygrana = 1, remis = 0,5). */
export function expectedScore(homeElo: number, awayElo: number, neutral: boolean): number {
  const dr = homeElo - awayElo + (neutral ? 0 : HOME_ADVANTAGE);
  return 1 / (1 + Math.pow(10, -dr / 400));
}

export class EloTable {
  readonly ratings = new Map<string, number>();

  get(team: string): number {
    return this.ratings.get(team) ?? INITIAL_ELO;
  }

  /** Aktualizuje ranking po meczu; zwraca rankingi sprzed meczu. */
  update(m: IntlMatch): { home: number; away: number } {
    const home = this.get(m.home);
    const away = this.get(m.away);
    const we = expectedScore(home, away, m.neutral);
    const w = m.homeScore > m.awayScore ? 1 : m.homeScore === m.awayScore ? 0.5 : 0;
    const delta = kFactor(m.tournament) * goalDiffMultiplier(m.homeScore - m.awayScore) * (w - we);
    this.ratings.set(m.home, home + delta);
    this.ratings.set(m.away, away - delta);
    return { home, away };
  }
}

export function toIntlMatches(rows: Record<string, string>[]): IntlMatch[] {
  return rows
    .filter((r) => r.home_score !== 'NA' && r.home_score !== '')
    .map((r) => ({
      date: r.date!,
      home: r.home_team!,
      away: r.away_team!,
      homeScore: Number(r.home_score),
      awayScore: Number(r.away_score),
      tournament: r.tournament!,
      neutral: r.neutral === 'TRUE',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
