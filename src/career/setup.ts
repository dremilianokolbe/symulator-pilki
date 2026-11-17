/** Przygotowanie konfiguracji kariery z danych Euro 2016. */
import { readFileSync } from 'node:fs';
import type { SquadPlayer } from '../data/derive';
import { loadEuroWorld } from '../scenarios/euro2016/world';
import type { CareerConfig } from './flow';

export function loadCareerConfig(team: string, seed: number, dir = 'data/processed/euro2016'): CareerConfig {
  const { world } = loadEuroWorld(dir);
  const squads = JSON.parse(readFileSync(`${dir}/kadry-pelne.json`, 'utf8')) as SquadPlayer[];
  const reserves = JSON.parse(readFileSync(`${dir}/rezerwy.json`, 'utf8')) as SquadPlayer[];
  const elo = JSON.parse(readFileSync(`${dir}/elo.json`, 'utf8')) as Record<string, Record<string, number>>;
  return {
    team,
    seed,
    world,
    squads: [...squads, ...reserves].filter((p) => p.team === team),
    eloQualifying: elo['2014-09-01']!,
    eloFinals: elo['2016-06-01']!,
  };
}

export function careerTeams(dir = 'data/processed/euro2016'): { team: string; elo: number }[] {
  const elo = JSON.parse(readFileSync(`${dir}/elo.json`, 'utf8')) as Record<string, Record<string, number>>;
  return Object.entries(elo['2014-09-01']!).map(([team, e]) => ({ team, elo: e })).sort((a, b) => b.elo - a.elo);
}
