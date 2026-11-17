import type { Attributes, Personality, Position } from './attributes';

export const TRAITS = [
  'shootsFromDistance', // strzela z dystansu
  'cutsInside',         // schodzi do środka
  'getsForward',        // włącza się do ataku
  'staysBack',          // zostaje z tyłu
  'playsShortPasses',   // gra krótko
  'triesKillerBalls',   // szuka prostopadłych podań
  'runsWithBall',       // biega z piłką
  'divesIntoTackles',   // ostro wchodzi w odbiór
] as const;
export type Trait = (typeof TRAITS)[number];

export const TRAIT_LABEL: Record<Trait, string> = {
  shootsFromDistance: 'Strzela z dystansu',
  cutsInside: 'Schodzi do środka',
  getsForward: 'Włącza się do ataku',
  staysBack: 'Zostaje z tyłu',
  playsShortPasses: 'Gra krótko',
  triesKillerBalls: 'Szuka prostopadłych podań',
  runsWithBall: 'Biega z piłką',
  divesIntoTackles: 'Ostro wchodzi w odbiór',
};

export type Foot = 'L' | 'R' | 'B';

export interface Player {
  id: string;
  name: string;
  /** Nazwisko do relacji, np. „Lewandowski”. */
  shortName: string;
  nation: string;
  age: number;
  foot: Foot;
  /** Znajomość pozycji 0–100 (90+ = naturalna). Brak wpisu = 0. */
  positions: Partial<Record<Position, number>>;
  attributes: Attributes;
  personality: Personality;
  traits: Trait[];
}

export const FORMATIONS = {
  '4-4-2': ['GK', 'DL', 'DC', 'DC', 'DR', 'ML', 'MC', 'MC', 'MR', 'ST', 'ST'],
  '4-3-3': ['GK', 'DL', 'DC', 'DC', 'DR', 'MC', 'DM', 'MC', 'AML', 'ST', 'AMR'],
  '4-2-3-1': ['GK', 'DL', 'DC', 'DC', 'DR', 'DM', 'DM', 'AML', 'AMC', 'AMR', 'ST'],
  '4-1-4-1': ['GK', 'DL', 'DC', 'DC', 'DR', 'DM', 'ML', 'MC', 'MC', 'MR', 'ST'],
  '3-5-2': ['GK', 'DC', 'DC', 'DC', 'WBL', 'MC', 'DM', 'MC', 'WBR', 'ST', 'ST'],
  '5-3-2': ['GK', 'WBL', 'DC', 'DC', 'DC', 'WBR', 'MC', 'MC', 'MC', 'ST', 'ST'],
  '3-4-3': ['GK', 'DC', 'DC', 'DC', 'ML', 'MC', 'MC', 'MR', 'AML', 'ST', 'AMR'],
} as const satisfies Record<string, readonly Position[]>;
export type FormationId = keyof typeof FORMATIONS;

/** Taktyka: formacja + suwaki stylu (0–100, 50 = neutralnie). */
export interface Tactics {
  formation: FormationId;
  /** Nastawienie: defensywne ↔ ofensywne. */
  mentality: number;
  /** Intensywność pressingu. */
  pressing: number;
  /** Tempo gry. */
  tempo: number;
  /** Wysokość linii obrony. */
  defensiveLine: number;
  /** Szerokość gry. */
  width: number;
  /** Bezpośredniość: krótkie podania ↔ długie piłki. */
  directness: number;
}

export const DEFAULT_TACTICS: Tactics = {
  formation: '4-4-2',
  mentality: 50,
  pressing: 50,
  tempo: 50,
  defensiveLine: 50,
  width: 50,
  directness: 50,
};

export interface Starter {
  player: Player;
  position: Position;
}

export interface MatchTeamInput {
  id: string;
  name: string;
  shortName: string;
  tactics: Tactics;
  /** Dokładnie 11, w kolejności slotów formacji. */
  starters: Starter[];
  bench: Player[];
  captainId?: string;
  penaltyTakerId?: string;
  freeKickTakerId?: string;
  cornerTakerId?: string;
  /** Kondycja przed meczem 0–100 (domyślnie 100). */
  condition?: Record<string, number>;
  /** Forma -20..+20 (domyślnie 0); wpływa na skuteczność w tym meczu. */
  form?: Record<string, number>;
}

export type Weather = 'clear' | 'rain' | 'heat' | 'cold' | 'snow';
export type Pitch = 'good' | 'average' | 'poor' | 'artificial';

export interface Referee {
  name: string;
  /** Surowość przy kartkach 0–100. */
  strictness: number;
  /** Skłonność do dyktowania karnych 0–100. */
  penaltyTendency: number;
}

export interface MatchContext {
  seed: number;
  home: MatchTeamInput;
  away: MatchTeamInput;
  /** Mecz na neutralnym terenie (turniej): brak przewagi gospodarza. */
  neutral?: boolean;
  /** Siła atutu własnego boiska 0–2 (1 = typowa; 0 = mecz bez kibiców). */
  crowdFactor?: number;
  weather?: Weather;
  pitch?: Pitch;
  /** Wysokość n.p.m. w metrach. */
  altitude?: number;
  referee?: Referee;
  /** Waga meczu 0–100 (towarzyski ~10, eliminacje ~60, finał ~100). */
  importance?: number;
  /** Mecz pucharowy: dogrywka i karne przy remisie. */
  knockout?: boolean;
  /** Limit zmian (2016: 3). */
  maxSubs?: number;
}

export type Side = 'home' | 'away';

export type ShotKind = 'open' | 'cross' | 'through' | 'solo' | 'long' | 'counter' | 'corner' | 'freeKick' | 'penalty';

/** Zdarzenie meczu. `added` = minuta doliczonego czasu (np. 90+2 => minute 90, added 2). */
export type MatchEvent = MatchEventBody & { added?: number };

type MatchEventBody =
  | { kind: 'goal'; minute: number; side: Side; playerId: string; assistId?: string; shot: ShotKind; xg: number; ownGoal?: boolean; score: [number, number] }
  | { kind: 'shot'; minute: number; side: Side; playerId: string; shot: ShotKind; xg: number; outcome: 'saved' | 'off' | 'blocked' | 'woodwork' }
  | { kind: 'penaltyMiss'; minute: number; side: Side; playerId: string; saved: boolean }
  | { kind: 'card'; minute: number; side: Side; playerId: string; card: 'yellow' | 'secondYellow' | 'red' }
  | { kind: 'injury'; minute: number; side: Side; playerId: string; injury: InjuryInfo }
  | { kind: 'sub'; minute: number; side: Side; outId: string; inId: string; reason: 'tactical' | 'fatigue' | 'injury' }
  | { kind: 'period'; minute: number; period: 'kickoff' | 'halftime' | 'fulltime' | 'extraTimeStart' | 'extraTimeEnd' }
  | { kind: 'shootoutKick'; side: Side; playerId: string; scored: boolean; round: number };

export interface InjuryInfo {
  type: string;
  /** Dni przerwy. */
  days: number;
  severity: 'light' | 'medium' | 'severe';
}

export interface TeamStats {
  goals: number;
  xg: number;
  shots: number;
  shotsOnTarget: number;
  possession: number;
  corners: number;
  fouls: number;
  yellow: number;
  red: number;
  offsides: number;
  penalties: number;
}

export interface PlayerMatchStats {
  playerId: string;
  side: Side;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  keyPasses: number;
  tackles: number;
  saves: number;
  fouls: number;
  yellow: number;
  red: number;
  rating: number;
  /** Kondycja na koniec meczu. */
  condition: number;
}

export interface MatchResult {
  score: [number, number];
  /** Wynik po 90 minutach (różni się od score tylko po dogrywce). */
  scoreAfter90: [number, number];
  extraTime: boolean;
  shootout?: { home: number; away: number; winner: Side };
  winner: Side | null;
  events: MatchEvent[];
  stats: { home: TeamStats; away: TeamStats };
  players: PlayerMatchStats[];
}
