/** Wiadomości między interfejsem a workerem z logiką gry. */
import type { Answer, Decision } from '../../src/career/types';

export interface TeamInfo {
  team: string;
  pl: string;
  elo: number;
  group: string;
}

export interface CareerStatus {
  teamPl: string;
  team: string;
  date: string;
  trust: number;
  media: number;
  expectation: string;
  record: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number };
}

export interface TableRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface MatchSummary {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  extra: string;
  scorers: string[];
  round?: string;
}

export interface EuroRunView {
  seed: number;
  finalsOnly: boolean;
  qualifying: { letter: string; rows: TableRow[] }[];
  bestThird?: string;
  playoffs: (MatchSummary & { winner: string; firstLeg: string })[];
  groups: { letter: string; rows: TableRow[] }[];
  knockout: MatchSummary[];
  champion: string;
  scorers: { name: string; team: string; goals: number }[];
}

export interface TallyRow {
  team: string;
  /** Liczba przebiegów, w których drużyna dotarła co najmniej do danego etapu. */
  qualified: number;
  playoff: number;
  R16: number;
  QF: number;
  SF: number;
  final: number;
  champion: number;
  groupWin: number;
}

export type Request =
  | { type: 'teams' }
  | { type: 'career:start'; team: string; seed: number; answers: Answer[] }
  | { type: 'career:answer'; answer: Answer }
  | { type: 'euro:once'; seed: number; finalsOnly: boolean }
  | { type: 'euro:mc'; from: number; count: number; finalsOnly: boolean };

export type Response =
  | { type: 'teams'; teams: TeamInfo[] }
  | { type: 'career'; decision: Decision | null; status: CareerStatus | null; done: boolean }
  | { type: 'euro:once'; run: EuroRunView }
  | { type: 'euro:mc:progress'; done: number }
  | { type: 'euro:mc'; tally: TallyRow[] }
  | { type: 'error'; message: string };
