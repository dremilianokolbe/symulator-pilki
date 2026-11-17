/** Pomiar szybkości silnika: npx tsx scripts/bench.ts */
import { simulateMatch } from '../src/engine/match';
import { createRng } from '../src/engine/rng';
import { generateTeam } from '../src/generator/players';

const rng = createRng(1);
const a = generateTeam(rng, { id: 'A', name: 'A', quality: 72 }).input;
const b = generateTeam(rng, { id: 'B', name: 'B', quality: 70 }).input;
for (let i = 0; i < 300; i++) simulateMatch({ seed: i, home: a, away: b }); // rozgrzewka
const N = 3000;
const t0 = performance.now();
for (let i = 0; i < N; i++) simulateMatch({ seed: 1000 + i, home: a, away: b });
console.log(`${((performance.now() - t0) / N).toFixed(3)} ms/mecz`);
