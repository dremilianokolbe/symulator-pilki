/** Przygotowanie konfiguracji kariery z danych Euro 2016. Bez zależności od Node. */
import type { Euro2016Files, LoadedWorld } from '../scenarios/euro2016/world';
import type { CareerConfig } from './flow';

export function careerConfig(files: Euro2016Files, loaded: LoadedWorld, team: string, seed: number): CareerConfig {
  return {
    team,
    seed,
    world: loaded.world,
    squads: [...files.squads, ...files.reserves].filter((p) => p.team === team),
    eloQualifying: files.elo['2014-09-01']!,
    eloFinals: files.elo['2016-06-01']!,
  };
}

export function careerTeams(files: Pick<Euro2016Files, 'elo'>): { team: string; elo: number }[] {
  return Object.entries(files.elo['2014-09-01']!).map(([team, e]) => ({ team, elo: e })).sort((a, b) => b.elo - a.elo);
}
