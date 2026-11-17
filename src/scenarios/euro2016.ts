/**
 * Scenariusz Euro 2016: budowa prawdziwych kadr finalistów z przetworzonych danych.
 */
import { deriveSquad, type SquadPlayer } from '../data/derive';
import type { MatchTeamInput, Player, Tactics } from '../engine/types';
import { DEFAULT_TACTICS, type FormationId } from '../engine/types';
import { positionRating } from '../engine/attributes';
import { buildTeamInput } from '../generator/players';

/** Punkty Elo na punkt OVR (z kalibracji na eliminacjach Euro 2016, docs/KALIBRACJA.md). */
export const ELO_PER_OVR = 45;
export const eloToOvr = (elo: number) => 70 + (elo - 1700) / ELO_PER_OVR;

/** Formacje brane pod uwagę przy automatycznym wyborze. */
const AUTO_FORMATIONS: FormationId[] = ['4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1'];

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
  const build = (formation: FormationId) =>
    buildTeamInput(code, TEAM_NAME_PL[team] ?? team, code, squad, { ...DEFAULT_TACTICS, ...tactics, formation: tactics.formation ?? formation });
  // Bez narzuconej formacji: ta z czwórką obrońców (standard 2016), w której najlepsza jedenastka
  // ma najwyższą sumę ocen. Trójkę z tyłu można ustawić ręcznie.
  const strength = (input: MatchTeamInput) =>
    input.starters.reduce((s, st) => s + positionRating(st.player.attributes, st.position, st.player.positions[st.position] ?? 0), 0);
  const input = tactics.formation
    ? build(tactics.formation)
    : AUTO_FORMATIONS.map(build).reduce((a, b) => (strength(b) > strength(a) ? b : a));
  const captain = players.find((p) => p.captain);
  if (captain) input.captainId = `${code}-${captain.no}`;
  return { squad, input, ovr };
}

/** Narzędnik („z kim?”): „remis z Niemcami”. */
export const TEAM_NAME_PL_WITH: Record<string, string> = {
  France: 'Francją', Romania: 'Rumunią', Albania: 'Albanią', Switzerland: 'Szwajcarią', England: 'Anglią',
  Russia: 'Rosją', Wales: 'Walią', Slovakia: 'Słowacją', Germany: 'Niemcami', Ukraine: 'Ukrainą', Poland: 'Polską',
  'Northern Ireland': 'Irlandią Płn.', Spain: 'Hiszpanią', 'Czech Republic': 'Czechami', Turkey: 'Turcją',
  Croatia: 'Chorwacją', Belgium: 'Belgią', Italy: 'Włochami', 'Republic of Ireland': 'Irlandią', Sweden: 'Szwecją',
  Portugal: 'Portugalią', Iceland: 'Islandią', Austria: 'Austrią', Hungary: 'Węgrami', Andorra: 'Andorą',
  Armenia: 'Armenią', Azerbaijan: 'Azerbejdżanem', Belarus: 'Białorusią', 'Bosnia and Herzegovina': 'Bośnią i Hercegowiną',
  Bulgaria: 'Bułgarią', Cyprus: 'Cyprem', Denmark: 'Danią', Estonia: 'Estonią', 'Faroe Islands': 'Wyspami Owczymi',
  Finland: 'Finlandią', Georgia: 'Gruzją', Gibraltar: 'Gibraltarem', Greece: 'Grecją', Israel: 'Izraelem',
  Kazakhstan: 'Kazachstanem', Latvia: 'Łotwą', Liechtenstein: 'Liechtensteinem', Lithuania: 'Litwą',
  Luxembourg: 'Luksemburgiem', Malta: 'Maltą', Moldova: 'Mołdawią', Montenegro: 'Czarnogórą', Netherlands: 'Holandią',
  'North Macedonia': 'Macedonią', Norway: 'Norwegią', 'San Marino': 'San Marino', Scotland: 'Szkocją', Serbia: 'Serbią',
  Slovenia: 'Słowenią',
};

/** Biernik („kogo?”): „pokonuje Hiszpanię”. */
export const TEAM_NAME_PL_ACC: Record<string, string> = {
  France: 'Francję', Romania: 'Rumunię', Albania: 'Albanię', Switzerland: 'Szwajcarię', England: 'Anglię',
  Russia: 'Rosję', Wales: 'Walię', Slovakia: 'Słowację', Germany: 'Niemcy', Ukraine: 'Ukrainę', Poland: 'Polskę',
  'Northern Ireland': 'Irlandię Płn.', Spain: 'Hiszpanię', 'Czech Republic': 'Czechy', Turkey: 'Turcję',
  Croatia: 'Chorwację', Belgium: 'Belgię', Italy: 'Włochy', 'Republic of Ireland': 'Irlandię', Sweden: 'Szwecję',
  Portugal: 'Portugalię', Iceland: 'Islandię', Austria: 'Austrię', Hungary: 'Węgry', Andorra: 'Andorę',
  Armenia: 'Armenię', Azerbaijan: 'Azerbejdżan', Belarus: 'Białoruś', 'Bosnia and Herzegovina': 'Bośnię i Hercegowinę',
  Bulgaria: 'Bułgarię', Cyprus: 'Cypr', Denmark: 'Danię', Estonia: 'Estonię', 'Faroe Islands': 'Wyspy Owcze',
  Finland: 'Finlandię', Georgia: 'Gruzję', Gibraltar: 'Gibraltar', Greece: 'Grecję', Israel: 'Izrael',
  Kazakhstan: 'Kazachstan', Latvia: 'Łotwę', Liechtenstein: 'Liechtenstein', Lithuania: 'Litwę',
  Luxembourg: 'Luksemburg', Malta: 'Maltę', Moldova: 'Mołdawię', Montenegro: 'Czarnogórę', Netherlands: 'Holandię',
  'North Macedonia': 'Macedonię', Norway: 'Norwegię', 'San Marino': 'San Marino', Scotland: 'Szkocję', Serbia: 'Serbię',
  Slovenia: 'Słowenię',
};

export const plWith = (team: string) => TEAM_NAME_PL_WITH[team] ?? TEAM_NAME_PL[team] ?? team;
export const plAcc = (team: string) => TEAM_NAME_PL_ACC[team] ?? TEAM_NAME_PL[team] ?? team;
