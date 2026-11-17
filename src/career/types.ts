/**
 * Kariera selekcjonera: decyzje, które silnik kariery zadaje graczowi, i stan kariery.
 * Silnik nie zna interfejsu – terminal dziś, aplikacja jutro odpowiadają na te same decyzje.
 */
import type { Position } from '../engine/attributes';
import type { FormationId, MatchEvent, Player, Tactics } from '../engine/types';

// ---------------------------------------------------------------------------
// Decyzje (pytania do gracza) i odpowiedzi
// ---------------------------------------------------------------------------

export interface Option {
  id: string;
  label: string;
  hint?: string;
}

export interface PlayerRow {
  id: string;
  name: string;
  position: Position;
  positionsLabel: string;
  age: number;
  rating: number;
  form: number;
  morale: number;
  club: string;
  caps: number;
  /** Np. „kontuzja 12 dni”, „zawieszony”, „2 żółte”. */
  status: string;
  available: boolean;
}

export type Decision =
  /** Informacja do przeczytania (tabela, raport, wiadomości). Odpowiedź: brak. */
  | { kind: 'info'; title: string; lines: string[] }
  /** Wybór jednej z opcji. Odpowiedź: id opcji. */
  | { kind: 'choice'; title: string; text: string; options: Option[] }
  /** Powołania. Odpowiedź: lista id (dokładnie `size`). */
  | { kind: 'callup'; title: string; pool: PlayerRow[]; suggested: string[]; size: number }
  /** Skład przed meczem. Odpowiedź: LineupAction. */
  | {
      kind: 'lineup';
      title: string;
      formation: FormationId;
      style: StylePreset;
      starters: (PlayerRow & { slot: Position })[];
      bench: PlayerRow[];
      report: string[];
    }
  /** Przerwa w meczu na żywo. Odpowiedź: LiveAction. */
  | {
      kind: 'live';
      title: string;
      minuteLabel: string;
      score: [number, number];
      lines: string[];
      onPitch: (PlayerRow & { slot: Position; condition: number })[];
      bench: PlayerRow[];
      subsLeft: number;
      style: StylePreset;
      advice?: string;
    };

export type LineupAction =
  | { type: 'accept' }
  | { type: 'formation'; formation: FormationId }
  | { type: 'style'; style: StylePreset }
  | { type: 'swap'; outId: string; inId: string };

export type LiveAction =
  | { type: 'continue' }
  | { type: 'toEnd' }
  | { type: 'sub'; outId: string; inId: string }
  | { type: 'style'; style: StylePreset };

export type Answer = string | string[] | LineupAction | LiveAction | undefined;

// ---------------------------------------------------------------------------
// Style gry (gotowe ustawienia suwaków)
// ---------------------------------------------------------------------------

export const STYLE_PRESETS = {
  balanced: { label: 'Zrównoważony', mentality: 50, pressing: 50, tempo: 50, defensiveLine: 50, width: 50, directness: 50 },
  attacking: { label: 'Ofensywny', mentality: 75, pressing: 60, tempo: 65, defensiveLine: 62, width: 60, directness: 50 },
  defensive: { label: 'Defensywny', mentality: 25, pressing: 40, tempo: 40, defensiveLine: 30, width: 45, directness: 55 },
  pressing: { label: 'Wysoki pressing', mentality: 60, pressing: 85, tempo: 70, defensiveLine: 72, width: 55, directness: 45 },
  counter: { label: 'Kontratak', mentality: 40, pressing: 45, tempo: 70, defensiveLine: 35, width: 50, directness: 75 },
  possession: { label: 'Posiadanie piłki', mentality: 55, pressing: 60, tempo: 40, defensiveLine: 58, width: 60, directness: 20 },
} as const;
export type StylePreset = keyof typeof STYLE_PRESETS;

export function styleTactics(formation: FormationId, style: StylePreset): Tactics {
  const { label: _label, ...sliders } = STYLE_PRESETS[style];
  return { formation, ...sliders };
}

// ---------------------------------------------------------------------------
// Stan kariery
// ---------------------------------------------------------------------------

export interface PlayerStatus {
  injuryDays: number;
  injuryType?: string;
  /** Żółte kartki w bieżącej fazie (eliminacje / turniej). */
  yellows: number;
  /** Mecze zawieszenia do odbycia (tylko mecze o punkty). */
  suspended: number;
  /** Forma −20..+20. */
  form: number;
  /** Morale 0–100. */
  morale: number;
  careerCaps: number;
  careerGoals: number;
  /** Ostatnia kondycja po meczu (do drugiego meczu w oknie). */
  condition: number;
}

export interface StaffMember {
  role: 'assistant' | 'analyst' | 'fitness';
  name: string;
  rating: number;
}

export interface CareerState {
  team: string;
  teamPl: string;
  code: string;
  date: string;
  /** Kadra na eliminacje / na turniej (te same id). */
  pool: Map<string, Player>;
  clubs: Map<string, string>;
  status: Map<string, PlayerStatus>;
  calledUp: string[];
  formation: FormationId;
  style: StylePreset;
  /** Zaufanie federacji 0–100. Poniżej progu – zwolnienie. */
  trust: number;
  /** Nastroje mediów 0–100. */
  media: number;
  expectation: { label: string; maxPosition: number };
  /** Czy cel bieżącej fazy został osiągnięty (null = jeszcze nie wiadomo). */
  goalMet: boolean | null;
  staff: Record<StaffMember['role'], StaffMember>;
  record: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number };
  headlines: string[];
  sacked: boolean;
  lastMatchDate: string | null;
  /** Zdarzenia z ostatniego meczu gracza (do relacji). */
  lastEvents: MatchEvent[];
}
