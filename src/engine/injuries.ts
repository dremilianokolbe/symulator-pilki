import type { InjuryInfo } from './types';
import type { Rng } from './rng';

interface InjuryType {
  type: string;
  /** Względna częstość wśród urazów meczowych. */
  weight: number;
  minDays: number;
  maxDays: number;
  severity: InjuryInfo['severity'];
}

/**
 * Typy urazów meczowych z orientacyjną częstością i czasem przerwy.
 * Proporcje wzorowane na badaniach UEFA Elite Club Injury Study (urazy mięśniowe najczęstsze).
 */
export const INJURY_TYPES: readonly InjuryType[] = [
  { type: 'Stłuczenie', weight: 30, minDays: 0, maxDays: 5, severity: 'light' },
  { type: 'Naderwanie mięśnia dwugłowego uda', weight: 16, minDays: 14, maxDays: 35, severity: 'medium' },
  { type: 'Skręcenie stawu skokowego', weight: 14, minDays: 7, maxDays: 28, severity: 'medium' },
  { type: 'Uraz mięśnia przywodziciela', weight: 9, minDays: 10, maxDays: 24, severity: 'medium' },
  { type: 'Naderwanie mięśnia łydki', weight: 8, minDays: 14, maxDays: 30, severity: 'medium' },
  { type: 'Uraz więzadła pobocznego kolana', weight: 5, minDays: 28, maxDays: 56, severity: 'medium' },
  { type: 'Uraz barku', weight: 3, minDays: 14, maxDays: 42, severity: 'medium' },
  { type: 'Wstrząśnienie mózgu', weight: 3, minDays: 7, maxDays: 14, severity: 'medium' },
  { type: 'Złamanie kości śródstopia', weight: 3, minDays: 42, maxDays: 75, severity: 'severe' },
  { type: 'Zerwanie więzadła krzyżowego', weight: 2, minDays: 180, maxDays: 270, severity: 'severe' },
  { type: 'Złamanie nogi', weight: 1, minDays: 120, maxDays: 200, severity: 'severe' },
];

export function rollInjury(rng: Rng): InjuryInfo {
  const t = rng.weighted(INJURY_TYPES, (i) => i.weight);
  return { type: t.type, days: rng.int(t.minDays, t.maxDays), severity: t.severity };
}
