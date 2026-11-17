/**
 * Kariera selekcjonera w terminalu.
 *
 *   npm run kariera                         wybór drużyny i nowa gra
 *   npm run kariera -- --druzyna Poland     od razu wybrana drużyna
 *   npm run kariera -- --wczytaj saves/Poland-123.json   wczytanie zapisu
 *   npm run kariera -- --druzyna Poland --auto           cała kariera automatycznie (test)
 *
 * Zapis gry = drużyna + seed + lista odpowiedzi (data/saves/…), zapisywany po każdej decyzji.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { careerFlow } from '../src/career/flow';
import { careerTeams } from '../src/career/setup';
import { loadCareerConfig, readEuro2016Files } from '../src/node/load';
import { STYLE_PRESETS, type Answer, type Decision, type PlayerRow, type StylePreset } from '../src/career/types';
import { POSITION_LABEL } from '../src/engine/attributes';
import { FORMATIONS, type FormationId } from '../src/engine/types';
import { TEAM_NAME_PL } from '../src/scenarios/euro2016';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const AUTO = process.argv.includes('--auto');
// Kolejka linii: wpisane (albo wklejone) z wyprzedzeniem nie przepadają.
const rl = AUTO ? null : createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const lines: string[] = [];
const waiting: ((line: string) => void)[] = [];
let inputClosed = false;
rl?.on('line', (line) => {
  const w = waiting.shift();
  if (w) w(line);
  else lines.push(line);
});
rl?.on('close', () => {
  inputClosed = true;
  for (const w of waiting.splice(0)) w('');
});
const ask = async (q: string): Promise<string> => {
  if (!rl) return '';
  process.stdout.write(q);
  const queued = lines.shift();
  if (queued !== undefined) {
    if (!process.stdin.isTTY) process.stdout.write(`${queued}\n`);
    return queued.trim();
  }
  if (inputClosed) {
    console.log('\nKoniec wejścia – gra zapisana.');
    process.exit(0);
  }
  const line = await new Promise<string>((resolve) => waiting.push(resolve));
  if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
  return line.trim();
};

const C = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

interface Save {
  team: string;
  seed: number;
  answers: Answer[];
}

async function main() {
  let save: Save;
  const loadPath = arg('--wczytaj');
  if (loadPath) {
    save = JSON.parse(readFileSync(loadPath, 'utf8')) as Save;
    console.log(`Wczytano zapis: ${TEAM_NAME_PL[save.team] ?? save.team}, ${save.answers.length} decyzji.`);
  } else {
    const team = arg('--druzyna') ?? (await chooseTeam());
    save = { team, seed: Number(arg('--seed') ?? Date.now() % 1_000_000), answers: [] };
  }
  mkdirSync('data/saves', { recursive: true });
  const savePath = loadPath ?? `data/saves/${save.team.replace(/\s+/g, '_')}-${save.seed}.json`;

  console.log(C.dim('Wczytywanie świata…'));
  const flow = careerFlow(loadCareerConfig(save.team, save.seed));
  const replay = [...save.answers];
  let step = flow.next();
  while (!step.done) {
    const decision = step.value;
    let answer: Answer;
    if (replay.length) {
      answer = replay.shift();
    } else {
      answer = await render(decision);
      save.answers.push(answer);
      if (!AUTO) writeFileSync(savePath, JSON.stringify(save));
    }
    step = flow.next(answer);
  }
  if (!AUTO) console.log(C.dim(`\nZapis gry: ${savePath}`));
  rl?.close();
}

async function chooseTeam(): Promise<string> {
  const teams = careerTeams(readEuro2016Files());
  console.log(C.bold('\nWybierz reprezentację (ranking Elo, wrzesień 2014):\n'));
  teams.forEach((t, i) => {
    const cell = `${String(i + 1).padStart(2)}. ${(TEAM_NAME_PL[t.team] ?? t.team).padEnd(22)} ${t.elo}`;
    process.stdout.write(cell.padEnd(36) + (i % 3 === 2 ? '\n' : ''));
  });
  for (;;) {
    const a = await ask('\nNumer albo nazwa: ');
    const n = Number(a);
    const found = Number.isInteger(n) && n >= 1 && n <= teams.length
      ? teams[n - 1]!.team
      : teams.find((t) => t.team.toLowerCase() === a.toLowerCase() || (TEAM_NAME_PL[t.team] ?? '').toLowerCase() === a.toLowerCase())?.team;
    if (found) return found;
  }
}

// ---------------------------------------------------------------------------
// Wyświetlanie decyzji i zbieranie odpowiedzi
// ---------------------------------------------------------------------------

async function render(d: Decision): Promise<Answer> {
  switch (d.kind) {
    case 'info':
      console.log(`\n${C.bold(`═══ ${d.title} ═══`)}`);
      for (const l of d.lines) console.log(l);
      if (!AUTO) await ask(C.dim('[Enter]'));
      return undefined;

    case 'choice': {
      console.log(`\n${C.bold(`═══ ${d.title} ═══`)}\n${d.text}`);
      d.options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}${o.hint ? C.dim(` – ${o.hint}`) : ''}`));
      if (AUTO) return d.options[0]!.id;
      for (;;) {
        const n = Number(await ask('Wybór: '));
        if (n >= 1 && n <= d.options.length) return d.options[n - 1]!.id;
      }
    }

    case 'callup':
      return callup(d);

    case 'lineup':
      return lineup(d);

    case 'live':
      return live(d);
  }
}

const GROUP_ORDER = ['GK', 'DC', 'DL', 'DR', 'WBL', 'WBR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'];
const fmtForm = (f: number) => (f >= 8 ? C.green(`+${f}`) : f <= -8 ? C.yellow(String(f)) : f > 0 ? `+${f}` : String(f));

function playerLine(p: PlayerRow, n: number, mark = ' '): string {
  return `${mark}${String(n).padStart(2)}. ${POSITION_LABEL[p.position].padEnd(4)} ${p.name.padEnd(26).slice(0, 26)} ${String(p.age).padStart(2)} l. ` +
    `ocena ${String(p.rating).padStart(2)}  forma ${fmtForm(p.form).padStart(3)}  morale ${String(p.morale).padStart(3)}  ${C.dim(p.club.slice(0, 24))}` +
    (p.status ? `  ${C.yellow(p.status)}` : '');
}

async function callup(d: Extract<Decision, { kind: 'callup' }>): Promise<Answer> {
  if (AUTO) return d.suggested;
  const pool = [...d.pool].sort((a, b) => GROUP_ORDER.indexOf(a.position) - GROUP_ORDER.indexOf(b.position) || b.rating - a.rating);
  const chosen = new Set(d.suggested);
  for (;;) {
    console.log(`\n${C.bold(`═══ ${d.title} ═══`)}  ${C.dim('(✓ = powołany, sugestia asystenta)')}`);
    pool.forEach((p, i) => console.log(playerLine(p, i + 1, chosen.has(p.id) ? C.green('✓') : ' ')));
    console.log(`\nPowołanych: ${chosen.size}/${d.size}. Komendy: ${C.bold('-12 +30')} (usuń/dodaj), ${C.bold('ok')} (zatwierdź).`);
    const a = await ask('> ');
    if (a === 'ok' || a === '') {
      if (chosen.size === d.size) return [...chosen];
      console.log(C.yellow(`Potrzeba dokładnie ${d.size} zawodników.`));
      continue;
    }
    for (const tok of a.split(/\s+/)) {
      const m = tok.match(/^([+-])(\d+)$/);
      const p = m ? pool[Number(m[2]) - 1] : undefined;
      if (!m || !p) continue;
      if (m[1] === '+') chosen.add(p.id);
      else chosen.delete(p.id);
    }
  }
}

const STYLE_IDS = Object.keys(STYLE_PRESETS) as StylePreset[];
const styleList = () => STYLE_IDS.map((s) => `${s} (${STYLE_PRESETS[s].label})`).join(', ');

async function lineup(d: Extract<Decision, { kind: 'lineup' }>): Promise<Answer> {
  console.log(`\n${C.bold(`═══ ${d.title} ═══`)}`);
  for (const l of d.report) console.log(C.dim(l));
  console.log(`\nFormacja ${C.bold(d.formation)}, styl ${C.bold(STYLE_PRESETS[d.style].label)}`);
  d.starters.forEach((p, i) => console.log(playerLine({ ...p, position: p.slot }, i + 1)));
  console.log(C.dim('Ławka:'));
  d.bench.forEach((p, i) => console.log(playerLine(p, i + 1, 'R')));
  if (AUTO) return { type: 'accept' };
  console.log(`\nKomendy: ${C.bold('Enter')} (gramy), ${C.bold('f 4-3-3')} (formacja: ${Object.keys(FORMATIONS).join(', ')}), ${C.bold('s counter')} (styl), ${C.bold('z 9 R3')} (zamień 9. z 3. rezerwowym).`);
  for (;;) {
    const a = await ask('> ');
    if (a === '' || a === 'ok') return { type: 'accept' };
    const [cmd, x, y] = a.split(/\s+/);
    if (cmd === 'f' && x && x in FORMATIONS) return { type: 'formation', formation: x as FormationId };
    if (cmd === 's' && x && STYLE_IDS.includes(x as StylePreset)) return { type: 'style', style: x as StylePreset };
    if (cmd === 'z' && x && y) {
      const out = d.starters[Number(x) - 1];
      const inn = d.bench[Number(y.replace(/^R/i, '')) - 1];
      if (out && inn) return { type: 'swap', outId: out.id, inId: inn.id };
    }
    console.log(C.yellow(`Nie rozumiem. Style: ${styleList()}`));
  }
}

async function live(d: Extract<Decision, { kind: 'live' }>): Promise<Answer> {
  for (const l of d.lines) console.log(l);
  console.log(`\n${C.bold(`${d.title}  ${d.score[0]}:${d.score[1]}`)}  ${C.dim(d.minuteLabel)}  ·  styl: ${STYLE_PRESETS[d.style].label}  ·  zmiany: ${d.subsLeft}`);
  if (d.advice) console.log(C.dim(d.advice));
  if (AUTO) return { type: 'toEnd' };
  console.log(`Komendy: ${C.bold('Enter')} (dalej), ${C.bold('k')} (do końca), ${C.bold('z')} (zmiana), ${C.bold('s ofensywny…')} (styl: ${STYLE_IDS.join('/')}).`);
  for (;;) {
    const a = await ask('> ');
    if (a === '') return { type: 'continue' };
    if (a === 'k') return { type: 'toEnd' };
    const [cmd, x] = a.split(/\s+/);
    if (cmd === 's' && x && STYLE_IDS.includes(x as StylePreset)) return { type: 'style', style: x as StylePreset };
    if (cmd === 'z') {
      if (d.subsLeft <= 0) {
        console.log(C.yellow('Brak zmian.'));
        continue;
      }
      d.onPitch.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${POSITION_LABEL[p.slot].padEnd(4)} ${p.name.padEnd(24)} kondycja ${p.condition}%`));
      const out = d.onPitch[Number(await ask('Schodzi (nr): ')) - 1];
      d.bench.forEach((p, i) => console.log(playerLine(p, i + 1, 'R')));
      const inn = d.bench[Number(await ask('Wchodzi (nr): ')) - 1];
      if (out && inn) return { type: 'sub', outId: out.id, inId: inn.id };
    }
  }
}

if (!existsSync('data/processed/euro2016/rezerwy.json')) {
  console.error('Brak danych: uruchom najpierw npm run dane:przetworz');
  process.exit(1);
}
await main();
