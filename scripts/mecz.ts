/**
 * Podgląd jednego meczu w terminalu: relacja, statystyki, oceny.
 * Uruchom: npm run mecz [-- --seed 123 --puchar --pogoda heat]
 */
import { describe, minuteLabel } from '../src/commentary/pl';
import { POSITION_LABEL } from '../src/engine/attributes';
import { simulateMatch } from '../src/engine/match';
import { createRng } from '../src/engine/rng';
import type { Player, Weather } from '../src/engine/types';
import { generateTeam } from '../src/generator/players';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const seed = Number(arg('--seed') ?? Date.now() % 100000);
const knockout = process.argv.includes('--puchar');
const weather = (arg('--pogoda') ?? 'clear') as Weather;

// Drużyny demonstracyjne (fikcyjni zawodnicy), dopóki nie mamy danych Euro 2016.
const rng = createRng(2016);
const home = generateTeam(rng, { id: 'POL', name: 'Polska', shortName: 'POL', quality: 74, formation: '4-4-2' });
const away = generateTeam(rng, { id: 'GER', name: 'Niemcy', shortName: 'GER', quality: 80, formation: '4-2-3-1' });

const players = new Map<string, Player>();
for (const p of [...home.squad, ...away.squad]) players.set(p.id, p);
const names = {
  player: (id: string) => players.get(id)?.shortName ?? id,
  team: (side: 'home' | 'away') => (side === 'home' ? home.input.name : away.input.name),
};

const r = simulateMatch({
  seed,
  home: home.input,
  away: away.input,
  knockout,
  weather,
  importance: 70,
  referee: { name: 'Sędzia', strictness: 55, penaltyTendency: 50 },
});

console.log(`\n${home.input.name} – ${away.input.name}   (seed ${seed}${knockout ? ', mecz pucharowy' : ''}, pogoda: ${weather})\n`);
r.events.forEach((e, i) => {
  const line = describe(e, names, seed + i);
  if (line) console.log(`${minuteLabel(e).padStart(7)}  ${line}`);
});

const [hg, ag] = r.score;
let final = `${home.input.name} ${hg}:${ag} ${away.input.name}`;
if (r.extraTime) final += ' (po dogrywce)';
if (r.shootout) final += `, karne ${r.shootout.home}:${r.shootout.away}`;
console.log(`\nWYNIK: ${final}\n`);

const h = r.stats.home;
const a = r.stats.away;
const row = (label: string, x: string | number, y: string | number) =>
  console.log(`${String(x).padStart(8)}  ${label.padEnd(16)}  ${String(y)}`);
row('Posiadanie', `${h.possession}%`, `${a.possession}%`);
row('xG', h.xg.toFixed(2), a.xg.toFixed(2));
row('Strzały', h.shots, a.shots);
row('Celne', h.shotsOnTarget, a.shotsOnTarget);
row('Rzuty rożne', h.corners, a.corners);
row('Faule', h.fouls, a.fouls);
row('Spalone', h.offsides, a.offsides);
row('Żółte kartki', h.yellow, a.yellow);
row('Czerwone kartki', h.red, a.red);

for (const side of ['home', 'away'] as const) {
  const input = side === 'home' ? home.input : away.input;
  console.log(`\nOceny – ${input.name}`);
  const starterPos = new Map(input.starters.map((s) => [s.player.id, s.position]));
  for (const p of r.players.filter((p) => p.side === side)) {
    const pos = starterPos.get(p.playerId);
    const extras = [
      p.goals ? `⚽×${p.goals}` : '',
      p.assists ? `🅰×${p.assists}` : '',
      p.yellow ? '🟨' : '',
      p.red ? '🟥' : '',
    ].filter(Boolean).join(' ');
    console.log(
      `  ${p.rating.toFixed(1)}  ${(pos ? POSITION_LABEL[pos] : 'rez').padEnd(4)} ${names.player(p.playerId).padEnd(14)} ${String(p.minutes).padStart(3)}'  kondycja ${String(p.condition).padStart(3)}%  ${extras}`,
    );
  }
}
