/** Budowa świata Euro 2016 z przetworzonych danych (kadry, Elo, terminarze). */
import { readFileSync } from 'node:fs';
import type { SquadPlayer } from '../../data/derive';
import type { MatchTeamInput, Player } from '../../engine/types';
import { buildEuroTeam, TEAM_NAME_PL } from '../euro2016';
import { finalsGroups, qualifyingGroups, type EuroMatch } from './data';
import type { EuroWorld } from './tournament';

export interface LoadedWorld {
  world: EuroWorld;
  /** Wszyscy zawodnicy po id (do nazwisk w raportach). */
  players: Map<string, Player>;
  realMatches: EuroMatch[];
}

export function loadEuroWorld(dir = 'data/processed/euro2016'): LoadedWorld {
  const squads = JSON.parse(readFileSync(`${dir}/kadry-pelne.json`, 'utf8')) as SquadPlayer[];
  const elo = JSON.parse(readFileSync(`${dir}/elo.json`, 'utf8')) as Record<string, Record<string, number>>;
  const realMatches = JSON.parse(readFileSync(`${dir}/mecze.json`, 'utf8')) as EuroMatch[];
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
      qualifyingGroups: qualifyingGroups(realMatches),
      realFinalsGroups: finalsGroups(realMatches),
    },
    players,
    realMatches,
  };
}

export const plName = (team: string) => TEAM_NAME_PL[team] ?? team;
