/** Budowa świata Euro 2016 z przetworzonych danych (kadry, Elo, terminarze). Bez zależności od Node. */
import type { SquadPlayer } from '../../data/derive';
import type { MatchTeamInput, Player } from '../../engine/types';
import { buildEuroTeam, TEAM_NAME_PL } from '../euro2016';
import { finalsGroups, qualifyingGroups, type EuroMatch } from './data';
import type { EuroWorld } from './tournament';

/** Przetworzone dane scenariusza (data/processed/euro2016). */
export interface Euro2016Files {
  squads: SquadPlayer[];
  reserves: SquadPlayer[];
  elo: Record<string, Record<string, number>>;
  matches: EuroMatch[];
}

export interface LoadedWorld {
  world: EuroWorld;
  /** Wszyscy zawodnicy po id (do nazwisk w raportach). */
  players: Map<string, Player>;
  realMatches: EuroMatch[];
}

export function buildEuroWorld(files: Euro2016Files): LoadedWorld {
  const { squads, elo, matches } = files;
  const teams = Object.keys(elo['2014-09-01']!);
  const players = new Map<string, Player>();

  const build = (eloAt: Record<string, number>, refDate: string) => {
    const map = new Map<string, MatchTeamInput>();
    for (const t of teams) {
      const { input, squad } = buildEuroTeam({ squads, elo: eloAt, refDate }, t);
      map.set(t, input);
      for (const p of squad) players.set(p.id, p);
    }
    return map;
  };

  return {
    world: {
      qualifyingTeams: build(elo['2014-09-01']!, '2015-06-01'),
      finalsTeams: build(elo['2016-06-01']!, '2016-06-10'),
      eloStart: elo['2014-09-01']!,
      qualifyingGroups: qualifyingGroups(matches),
      realFinalsGroups: finalsGroups(matches),
    },
    players,
    realMatches: matches,
  };
}

export const plName = (team: string) => TEAM_NAME_PL[team] ?? team;
