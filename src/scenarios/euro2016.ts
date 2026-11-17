/**
 * Scenariusz Euro 2016: budowa prawdziwych kadr finalistów z przetworzonych danych.
 */
import { deriveSquad, type SquadPlayer } from '../data/derive';
import type { MatchTeamInput, Player, Tactics } from '../engine/types';
import { DEFAULT_TACTICS } from '../engine/types';
import { buildTeamInput } from '../generator/players';

/** Punkty Elo na punkt OVR (z kalibracji na eliminacjach Euro 2016, docs/KALIBRACJA.md). */
export const ELO_PER_OVR = 45;
export const eloToOvr = (elo: number) => 70 + (elo - 1700) / ELO_PER_OVR;

/** Kody FIFA finalistów (nazwy jak w danych). */
export const EURO2016_CODES: Record<string, string> = {
  France: 'FRA', Romania: 'ROU', Albania: 'ALB', Switzerland: 'SUI', England: 'ENG', Russia: 'RUS',
  Wales: 'WAL', Slovakia: 'SVK', Germany: 'GER', Ukraine: 'UKR', Poland: 'POL', 'Northern Ireland': 'NIR',
  Spain: 'ESP', 'Czech Republic': 'CZE', Turkey: 'TUR', Croatia: 'CRO', Belgium: 'BEL', Italy: 'ITA',
  'Republic of Ireland': 'IRL', Sweden: 'SWE', Portugal: 'POR', Iceland: 'ISL', Austria: 'AUT', Hungary: 'HUN',
  // Pozostałe drużyny eliminacji.
  Andorra: 'AND', Armenia: 'ARM', Azerbaijan: 'AZE', Belarus: 'BLR', 'Bosnia and Herzegovina': 'BIH',
  Bulgaria: 'BUL', Cyprus: 'CYP', Denmark: 'DEN', Estonia: 'EST', 'Faroe Islands': 'FRO', Finland: 'FIN',
  Georgia: 'GEO', Gibraltar: 'GIB', Greece: 'GRE', Israel: 'ISR', Kazakhstan: 'KAZ', Latvia: 'LVA',
  Liechtenstein: 'LIE', Lithuania: 'LTU', Luxembourg: 'LUX', Malta: 'MLT', Moldova: 'MDA', Montenegro: 'MNE',
  Netherlands: 'NED', 'North Macedonia': 'MKD', Norway: 'NOR', 'San Marino': 'SMR', Scotland: 'SCO',
  Serbia: 'SRB', Slovenia: 'SVN',
};

export const TEAM_NAME_PL: Record<string, string> = {
  France: 'Francja', Romania: 'Rumunia', Albania: 'Albania', Switzerland: 'Szwajcaria', England: 'Anglia',
  Russia: 'Rosja', Wales: 'Walia', Slovakia: 'Słowacja', Germany: 'Niemcy', Ukraine: 'Ukraina', Poland: 'Polska',
  'Northern Ireland': 'Irlandia Płn.', Spain: 'Hiszpania', 'Czech Republic': 'Czechy', Turkey: 'Turcja',
  Croatia: 'Chorwacja', Belgium: 'Belgia', Italy: 'Włochy', 'Republic of Ireland': 'Irlandia', Sweden: 'Szwecja',
  Portugal: 'Portugalia', Iceland: 'Islandia', Austria: 'Austria', Hungary: 'Węgry',
  Andorra: 'Andora', Armenia: 'Armenia', Azerbaijan: 'Azerbejdżan', Belarus: 'Białoruś',
  'Bosnia and Herzegovina': 'Bośnia i Hercegowina', Bulgaria: 'Bułgaria', Cyprus: 'Cypr', Denmark: 'Dania',
  Estonia: 'Estonia', 'Faroe Islands': 'Wyspy Owcze', Finland: 'Finlandia', Georgia: 'Gruzja',
  Gibraltar: 'Gibraltar', Greece: 'Grecja', Israel: 'Izrael', Kazakhstan: 'Kazachstan', Latvia: 'Łotwa',
  Liechtenstein: 'Liechtenstein', Lithuania: 'Litwa', Luxembourg: 'Luksemburg', Malta: 'Malta',
  Moldova: 'Mołdawia', Montenegro: 'Czarnogóra', Netherlands: 'Holandia', 'North Macedonia': 'Macedonia',
  Norway: 'Norwegia', 'San Marino': 'San Marino', Scotland: 'Szkocja', Serbia: 'Serbia', Slovenia: 'Słowenia',
};

export interface Euro2016Data {
  /** Kadry 54 drużyn (data/processed/euro2016/kadry-pelne.json). */
  squads: SquadPlayer[];
  /** Elo na moment scenariusza (np. 2014-09-01 eliminacje, 2016-06-01 turniej). */
  elo: Record<string, number>;
  /** Data, na którą liczymy wiek zawodników. */
  refDate?: string;
}

export function buildEuroTeam(
  data: Euro2016Data,
  team: string,
  tactics: Partial<Tactics> = {},
  ovrOverride?: number,
): { squad: Player[]; input: MatchTeamInput; ovr: number } {
  const players = data.squads.filter((p) => p.team === team);
  if (players.length === 0) throw new Error(`Brak kadry: ${team}`);
  const code = EURO2016_CODES[team] ?? team.slice(0, 3).toUpperCase();
  const ovr = ovrOverride ?? eloToOvr(data.elo[team] ?? 1700);
  const squad = deriveSquad(players, { teamOvr: ovr, refDate: data.refDate ?? '2016-06-10', nationCode: code });
  const input = buildTeamInput(code, TEAM_NAME_PL[team] ?? team, code, squad, { ...DEFAULT_TACTICS, ...tactics });
  const captain = players.find((p) => p.captain);
  if (captain) input.captainId = `${code}-${captain.no}`;
  return { squad, input, ovr };
}
