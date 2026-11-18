import { TEAM_NAME_PL } from '../../src/scenarios/euro2016';

/** Flagi jako emoji (Anglia/Szkocja/Walia mają osobne znaki; Irlandia Płn. – brytyjska). */
const ISO: Record<string, string> = {
  Germany: 'DE', Netherlands: 'NL', Spain: 'ES', France: 'FR', Portugal: 'PT', Belgium: 'BE', Italy: 'IT',
  Switzerland: 'CH', Ukraine: 'UA', Greece: 'GR', Croatia: 'HR', Russia: 'RU', 'Bosnia and Herzegovina': 'BA',
  Sweden: 'SE', Serbia: 'RS', Denmark: 'DK', 'Czech Republic': 'CZ', Turkey: 'TR', Romania: 'RO',
  'Republic of Ireland': 'IE', Finland: 'FI', Austria: 'AT', Hungary: 'HU', Poland: 'PL', Slovenia: 'SI',
  Bulgaria: 'BG', Slovakia: 'SK', Israel: 'IL', Norway: 'NO', Belarus: 'BY', Gibraltar: 'GI', Montenegro: 'ME',
  Armenia: 'AM', Iceland: 'IS', 'North Macedonia': 'MK', Albania: 'AL', Georgia: 'GE', Estonia: 'EE', Moldova: 'MD',
  Lithuania: 'LT', Azerbaijan: 'AZ', Latvia: 'LV', Cyprus: 'CY', Kazakhstan: 'KZ', Malta: 'MT', 'Faroe Islands': 'FO',
  Luxembourg: 'LU', Liechtenstein: 'LI', Andorra: 'AD', 'San Marino': 'SM', 'Northern Ireland': 'GB',
};
const SUBDIVISION: Record<string, string> = {
  England: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  Scotland: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  Wales: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
};

export function flag(team: string): string {
  if (SUBDIVISION[team]) return SUBDIVISION[team]!;
  const iso = ISO[team];
  if (!iso) return '🏳️';
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const pl = (team: string) => TEAM_NAME_PL[team] ?? team;

export const pct = (v: number) => (v <= 0 ? '–' : v < 0.001 ? '<0,1%' : `${(v * 100).toFixed(v < 0.1 ? 1 : 0).replace('.', ',')}%`);

// ---------------------------------------------------------------------------
// Zapis kariery w przeglądarce
// ---------------------------------------------------------------------------

import type { Answer } from '../../src/career/types';

/** Wersja zapisu: zapis = seed + odpowiedzi, więc działa tylko z tą samą logiką gry. */
export const SAVE_VERSION = 3;
const KEY = 'selekcjoner:kariera';

export interface CareerSave {
  version: number;
  team: string;
  seed: number;
  answers: Answer[];
  updatedAt: number;
}

export function loadSave(): CareerSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as CareerSave;
    return s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

export function writeSave(s: CareerSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Brak miejsca albo tryb prywatny: gra działa dalej bez zapisu.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignorujemy
  }
}
