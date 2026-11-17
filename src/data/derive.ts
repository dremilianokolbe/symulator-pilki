/**
 * Wyliczanie atrybutów prawdziwych zawodników z dostępnych danych
 * (pozycja, wiek, występy i gole w kadrze, liga i klub, siła reprezentacji).
 *
 * Siła reprezentacji (Elo) wyznacza poziom kadry; dane zawodnika wyznaczają jego miejsce w kadrze.
 * Wyniki to punkt startu: edytor w grze służy do poprawek.
 */
import type { Position } from '../engine/attributes';
import { createRng } from '../engine/rng';
import type { Player } from '../engine/types';
import { generatePlayer } from '../generator/players';

export interface SquadPlayer {
  team: string;
  no: number;
  pos: 'GK' | 'DF' | 'MF' | 'FW';
  name: string;
  shortName: string;
  birthDate: string;
  caps: number;
  goals: number;
  club: string;
  clubNation: string;
  captain: boolean;
}

/**
 * SZACUNEK do czasu działania API ClubElo: siła ligi (0–1) wg rankingu krajowego UEFA ok. 2015/16.
 * Kluby walijskie grają w lidze angielskiej. Pozostałe kraje: 0,3.
 */
export const LEAGUE_STRENGTH: Record<string, number> = {
  ESP: 1, GER: 0.93, ENG: 0.93, ITA: 0.88, FRA: 0.8, POR: 0.72, RUS: 0.65, UKR: 0.6, NED: 0.6, BEL: 0.58,
  TUR: 0.56, WAL: 0.8, SUI: 0.5, GRE: 0.48, AUT: 0.45, CZE: 0.45, DEN: 0.44, ROU: 0.42, CRO: 0.42, SWE: 0.42,
  POL: 0.4, SCO: 0.4, ISR: 0.4, CYP: 0.38, BLR: 0.36, NOR: 0.38, HUN: 0.34, SVK: 0.34, IRL: 0.28, NIR: 0.25,
  ISL: 0.25, ALB: 0.25, USA: 0.4, CHN: 0.42, QAT: 0.32, KSA: 0.32, UAE: 0.32, JPN: 0.35, BRA: 0.5, ARG: 0.5,
};

/** SZACUNEK: czołowe kluby Europy ok. 2015/16 (premia ponad siłę ligi). */
const ELITE_CLUBS: Record<string, number> = {
  'Real Madrid': 0.25, 'Barcelona': 0.25, 'Bayern Munich': 0.25, 'Juventus': 0.2, 'Atlético Madrid': 0.18,
  'Paris Saint-Germain': 0.18, 'Chelsea': 0.15, 'Manchester City': 0.15, 'Manchester United': 0.12, 'Arsenal': 0.12,
  'Borussia Dortmund': 0.15, 'Napoli': 0.1, 'Roma': 0.1, 'Sevilla': 0.1, 'Valencia': 0.06, 'Tottenham Hotspur': 0.1,
  'Liverpool': 0.08, 'Porto': 0.12, 'Benfica': 0.12, 'Zenit Saint Petersburg': 0.12, 'Shakhtar Donetsk': 0.12,
  'Bayer Leverkusen': 0.08, 'Schalke 04': 0.06, 'Wolfsburg': 0.06, 'Internazionale': 0.06, 'Milan': 0.04,
  'Fiorentina': 0.04, 'Basel': 0.1, 'Sporting CP': 0.08, 'Leicester City': 0.06, 'Villarreal': 0.05,
  'Borussia Mönchengladbach': 0.05, 'Lazio': 0.04, 'Monaco': 0.06, 'Lyon': 0.05, 'Galatasaray': 0.05,
  'Fenerbahçe': 0.04, 'Beşiktaş': 0.04, 'CSKA Moscow': 0.06, 'Dynamo Kyiv': 0.06, 'Ajax': 0.08, 'PSV Eindhoven': 0.06,
  'Olympiacos': 0.08, 'Anderlecht': 0.04, 'Club Brugge': 0.04,
};

/** Znajomość pozycji przy zgrubnych pozycjach z Wikipedii (GK/DF/MF/FW). */
const COARSE_POSITIONS: Record<SquadPlayer['pos'], { primary: Position; positions: Partial<Record<Position, number>> }> = {
  GK: { primary: 'GK', positions: { GK: 100 } },
  DF: { primary: 'DC', positions: { DC: 90, DL: 75, DR: 75, WBL: 65, WBR: 65, DM: 40 } },
  MF: { primary: 'MC', positions: { MC: 90, DM: 75, ML: 75, MR: 75, AMC: 75, AML: 60, AMR: 60 } },
  FW: { primary: 'ST', positions: { ST: 95, AML: 70, AMR: 70, AMC: 60 } },
};

export function ageAt(birthDate: string, refDate: string): number {
  const b = new Date(birthDate);
  const r = new Date(refDate);
  let age = r.getFullYear() - b.getFullYear();
  if (r.getMonth() < b.getMonth() || (r.getMonth() === b.getMonth() && r.getDate() < b.getDate())) age--;
  return age;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Wynik „statusu” zawodnika (0–1+): klub, regularność gry w kadrze, wiek. */
export function statusScore(p: SquadPlayer, refDate: string): number {
  const age = ageAt(p.birthDate, refDate);
  const club = (LEAGUE_STRENGTH[p.clubNation] ?? 0.3) + (ELITE_CLUBS[p.club] ?? 0);
  const capsPerYear = p.caps / Math.max(1, age - 19);
  const caps = Math.min(1, capsPerYear / 7);
  const prime = age >= 24 && age <= 30 ? 1 : age < 24 ? 0.6 + (age - 18) * 0.07 : Math.max(0.4, 1 - (age - 30) * 0.1);
  return 0.5 * club + 0.3 * caps + 0.2 * prime;
}

export interface DeriveOptions {
  /** Średnia ocena pierwszej jedenastki kadry (z Elo). */
  teamOvr: number;
  refDate: string;
  nationCode: string;
}

/** Wylicza zawodników całej kadry (ranking wewnątrz kadry potrzebuje wszystkich naraz). */
export function deriveSquad(players: SquadPlayer[], opts: DeriveOptions): Player[] {
  const scores = players.map((p) => statusScore(p, opts.refDate));
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length) || 1;

  return players.map((p, i) => {
    const z = (scores[i]! - mean) / sd;
    // Najlepsza jedenastka ≈ ocena kadry; rezerwowi niżej.
    const quality = opts.teamOvr - 1.5 + 4 * z;
    const age = ageAt(p.birthDate, opts.refDate);
    const coarse = COARSE_POSITIONS[p.pos];
    const rng = createRng(hash(p.name + p.birthDate));
    const base = generatePlayer(rng, { id: `${opts.nationCode}-${p.no}`, position: coarse.primary, quality, age });
    const a = { ...base.attributes };
    const pers = { ...base.personality };

    // Wiek: po 30. spada fizyczność, rośnie doświadczenie; młodzi mniej dojrzali mentalnie.
    if (age > 30) {
      const y = age - 30;
      a.pace -= 2 * y;
      a.acceleration -= 2 * y;
      a.stamina -= 1.5 * y;
      a.decisions += y;
      a.positioning += y;
      a.composure += y;
    } else if (age <= 21) {
      a.decisions -= 4;
      a.composure -= 4;
      a.concentration -= 3;
    }

    // Skuteczność w kadrze (dla pomocników i napastników).
    if ((p.pos === 'FW' || p.pos === 'MF') && p.caps >= 5) {
      const gpc = p.goals / p.caps;
      const bonus = Math.max(-8, Math.min(10, (gpc - (p.pos === 'FW' ? 0.3 : 0.1)) * 25));
      a.finishing += bonus;
      a.offTheBall += bonus / 2;
      a.composure += bonus / 3;
    }

    // Doświadczenie i rola w kadrze.
    if (p.captain) pers.temperament += 5;
    if (p.captain) a.leadership = Math.max(a.leadership, 80);
    if (p.caps >= 70) {
      a.leadership += 8;
      pers.bigMatch += 10;
      pers.pressure += 8;
      pers.consistency += 8;
    }

    for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] = Math.round(Math.min(99, Math.max(1, a[k])));
    for (const k of Object.keys(pers) as (keyof typeof pers)[]) pers[k] = Math.round(Math.min(99, Math.max(1, pers[k])));

    return {
      ...base,
      name: p.name,
      shortName: p.shortName,
      nation: opts.nationCode,
      age,
      positions: coarse.positions,
      attributes: a,
      personality: pers,
    };
  });
}
