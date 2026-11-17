/**
 * Generator zawodników i kadr. Na razie do kalibracji i testów silnika;
 * później baza dla zawodników generowanych (po 2026) i uzupełniania braków w danych.
 */
import {
  ALL_ATTRS,
  GOALKEEPING,
  PERSONALITY,
  POSITION_WEIGHTS,
  type Attr,
  type Attributes,
  type Personality,
  type Position,
  positionRating,
} from '../engine/attributes';
import type { Rng } from '../engine/rng';
import { DEFAULT_TACTICS, FORMATIONS, TRAITS, type FormationId, type MatchTeamInput, type Player, type Tactics, type Trait } from '../engine/types';

const NAME_POOLS: Record<string, { first: string[]; last: string[] }> = {
  POL: {
    first: ['Jakub', 'Kamil', 'Piotr', 'Michał', 'Tomasz', 'Bartosz', 'Łukasz', 'Krzysztof', 'Marcin', 'Paweł', 'Adam', 'Mateusz', 'Damian', 'Rafał', 'Grzegorz', 'Szymon', 'Patryk', 'Dawid'],
    last: ['Nowak', 'Kowalczyk', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Krawczyk', 'Piotrowski', 'Grabowski', 'Pawlak', 'Michalski', 'Król', 'Wieczorek', 'Jabłoński', 'Majewski', 'Olszewski', 'Stępień', 'Malinowski', 'Adamczyk', 'Dudek', 'Sikora', 'Baran'],
  },
  GER: {
    first: ['Lukas', 'Jonas', 'Felix', 'Leon', 'Tim', 'Niklas', 'Julian', 'Florian', 'Jan', 'Maximilian', 'Tobias', 'Sebastian', 'Kevin', 'Marco', 'Dennis', 'Stefan', 'Moritz', 'Philipp'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Kaiser', 'Fuchs'],
  },
};

/** Pozycje pokrewne: znajomość drugiej pozycji. */
const RELATED: Partial<Record<Position, Partial<Record<Position, number>>>> = {
  DL: { WBL: 80, ML: 50 }, DR: { WBR: 80, MR: 50 }, DC: { DM: 45 }, DM: { MC: 75, DC: 45 },
  MC: { DM: 70, AMC: 65 }, ML: { AML: 70, WBL: 55 }, MR: { AMR: 70, WBR: 55 },
  AML: { ML: 70, AMR: 55, ST: 40 }, AMR: { MR: 70, AML: 55, ST: 40 }, AMC: { MC: 70, ST: 50 }, ST: { AMC: 45 },
  WBL: { DL: 80, ML: 60 }, WBR: { DR: 80, MR: 60 },
};

const clampAttr = (v: number) => Math.round(Math.min(99, Math.max(1, v)));

export interface GenerateOptions {
  id: string;
  position: Position;
  /** Docelowa ocena na pozycji (1–100). */
  quality: number;
  nation?: string;
  age?: number;
  /** Nazwiska już zajęte w kadrze (żeby się nie powtarzały). */
  usedNames?: Set<string>;
}

export function generatePlayer(rng: Rng, opts: GenerateOptions): Player {
  const { position, quality } = opts;
  const weights = POSITION_WEIGHTS[position];
  const isGk = position === 'GK';
  const attrs = {} as Attributes;
  for (const key of ALL_ATTRS) {
    const w = weights[key] ?? 0;
    const gkAttr = (GOALKEEPING as readonly string[]).includes(key);
    let base: number;
    if (gkAttr && !isGk) base = rng.normal(15, 5);
    else if (w > 0) base = quality + w * 1.5 - 4 + rng.normal(0, 6);
    else base = quality - 12 + rng.normal(0, 9);
    attrs[key] = clampAttr(base);
  }
  // Dociągnij ocenę na pozycji do docelowej jakości.
  for (let i = 0; i < 3; i++) {
    const diff = quality - positionRating(attrs, position, 100);
    for (const key of Object.keys(weights) as Attr[]) attrs[key] = clampAttr(attrs[key] + diff);
  }

  const personality = {} as Personality;
  for (const key of PERSONALITY) personality[key] = clampAttr(rng.normal(55, 15));

  const traits: Trait[] = [];
  for (const trait of TRAITS) if (rng.chance(traitChance(trait, position))) traits.push(trait);

  const positions: Partial<Record<Position, number>> = { [position]: 100, ...RELATED[position] };
  const pool = NAME_POOLS[opts.nation ?? ''] ?? NAME_POOLS.POL!;
  const first = rng.pick(pool.first);
  let last = rng.pick(pool.last);
  for (let i = 0; i < 20 && opts.usedNames?.has(last); i++) last = rng.pick(pool.last);
  opts.usedNames?.add(last);
  return {
    id: opts.id,
    name: `${first} ${last}`,
    shortName: last,
    nation: opts.nation ?? 'XXX',
    age: opts.age ?? rng.int(19, 33),
    foot: rng.chance(0.25) ? 'L' : rng.chance(0.05) ? 'B' : 'R',
    positions,
    attributes: attrs,
    personality,
    traits,
  };
}

function traitChance(trait: Trait, position: Position): number {
  const attacking = ['AML', 'AMR', 'AMC', 'ST'].includes(position);
  const defensive = ['DC', 'DL', 'DR', 'DM'].includes(position);
  switch (trait) {
    case 'shootsFromDistance': return attacking || position === 'MC' ? 0.15 : 0.03;
    case 'cutsInside': return position === 'AML' || position === 'AMR' ? 0.4 : 0;
    case 'getsForward': return ['DL', 'DR', 'WBL', 'WBR', 'MC'].includes(position) ? 0.2 : 0;
    case 'staysBack': return defensive ? 0.2 : 0;
    case 'playsShortPasses': return ['MC', 'DM', 'AMC'].includes(position) ? 0.25 : 0.05;
    case 'triesKillerBalls': return ['MC', 'AMC'].includes(position) ? 0.25 : 0.03;
    case 'runsWithBall': return attacking ? 0.3 : 0.03;
    case 'divesIntoTackles': return defensive ? 0.15 : 0.03;
  }
}

const SQUAD_TEMPLATE: Position[] = [
  'GK', 'GK', 'GK', 'DC', 'DC', 'DC', 'DC', 'DL', 'DL', 'DR', 'DR',
  'DM', 'DM', 'MC', 'MC', 'MC', 'ML', 'MR', 'AML', 'AMR', 'AMC', 'ST', 'ST',
];

export interface SquadOptions {
  id: string;
  name: string;
  shortName?: string;
  /** Średnia ocena pierwszej jedenastki. */
  quality: number;
  /** Rozrzut jakości w kadrze (odchylenie standardowe). */
  spread?: number;
  formation?: FormationId;
  tactics?: Partial<Tactics>;
}

/** Generuje kadrę 23 zawodników i gotowy skład meczowy. */
export function generateTeam(rng: Rng, opts: SquadOptions): { squad: Player[]; input: MatchTeamInput } {
  const spread = opts.spread ?? 4;
  const usedNames = new Set<string>();
  const squad = SQUAD_TEMPLATE.map((position, i) => {
    // Pierwszy zawodnik na każdej pozycji to zwykle podstawowy, kolejni nieco słabsi.
    const depth = SQUAD_TEMPLATE.slice(0, i).filter((p) => p === position).length;
    const quality = opts.quality + rng.normal(0, spread) - depth * 3;
    return generatePlayer(rng, { id: `${opts.id}-${i + 1}`, position, quality, nation: opts.id, usedNames });
  });
  const tactics: Tactics = { ...DEFAULT_TACTICS, formation: opts.formation ?? '4-4-2', ...opts.tactics };
  return { squad, input: buildTeamInput(opts.id, opts.name, opts.shortName ?? opts.name, squad, tactics) };
}

/** Wybiera najlepszą jedenastkę dla formacji (zachłannie: najpierw bramkarz, potem slot po slocie) i ławkę. */
export function buildTeamInput(id: string, name: string, shortName: string, squad: Player[], tactics: Tactics, benchSize = 12): MatchTeamInput {
  const slots = FORMATIONS[tactics.formation];
  const used = new Set<string>();
  const starters = slots.map((position) => {
    let best: Player | undefined;
    let bestVal = -1;
    for (const p of squad) {
      if (used.has(p.id)) continue;
      const v = positionRating(p.attributes, position, p.positions[position] ?? 0);
      if (v > bestVal) {
        bestVal = v;
        best = p;
      }
    }
    if (!best) throw new Error(`${name}: za mało zawodników na formację ${tactics.formation}`);
    used.add(best.id);
    return { player: best, position };
  });
  const bench = squad.filter((p) => !used.has(p.id)).slice(0, benchSize);
  const captain = starters.reduce((a, b) => (b.player.attributes.leadership > a.player.attributes.leadership ? b : a));
  return { id, name, shortName, tactics, starters, bench, captainId: captain.player.id };
}
