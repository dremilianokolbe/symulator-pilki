/** Wczytywanie danych z dysku – tylko dla skryptów i testów w Node (przeglądarka importuje JSON). */
import { readFileSync } from 'node:fs';
import type { CareerConfig } from '../career/flow';
import { careerConfig } from '../career/setup';
import { buildEuroWorld, type Euro2016Files, type LoadedWorld } from '../scenarios/euro2016/world';

const DIR = 'data/processed/euro2016';

export function readEuro2016Files(dir = DIR): Euro2016Files {
  const read = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  return { squads: read('kadry-pelne.json'), reserves: read('rezerwy.json'), elo: read('elo.json'), matches: read('mecze.json') };
}

export function loadEuroWorld(dir = DIR): LoadedWorld {
  return buildEuroWorld(readEuro2016Files(dir));
}

export function loadCareerConfig(team: string, seed: number, dir = DIR): CareerConfig {
  const files = readEuro2016Files(dir);
  return careerConfig(files, buildEuroWorld(files), team, seed);
}
