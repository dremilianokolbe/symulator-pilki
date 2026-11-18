/**
 * Surowe dane → data/processed/euro2016:
 * - mecze.json: eliminacje i turniej Euro 2016 z rankingiem Elo obu drużyn sprzed meczu,
 * - elo.json: ranking 53 uczestników na start eliminacji (2014-09-01) i przed turniejem (2016-06-01),
 * - kadry.json: 24 kadry finalistów z Wikipedii.
 * Uruchom: npx tsx scripts/dane/przetworz.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '../../src/data/csv';
import type { SquadPlayer } from '../../src/data/derive';
import { EloTable, officialMatches, toIntlMatches } from '../../src/data/elo';

const RAW = 'data/raw';
const OUT = 'data/processed/euro2016';
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Mecze + Elo
// ---------------------------------------------------------------------------

// Tylko mecze członków FIFA (bez Island Games itp.) – patrz officialMatches.
const matches = officialMatches(toIntlMatches(parseCsv(readFileSync(`${RAW}/international_results/results.csv`, 'utf8'))));
const START = '2014-08-01';
const END = '2016-07-11';
const elo = new EloTable();
const snapshots: Record<string, Record<string, number>> = {};
const SNAPSHOT_DATES = ['2014-09-01', '2016-06-01'];
const euroMatches: unknown[] = [];

for (const m of matches) {
  for (const d of SNAPSHOT_DATES) {
    if (!snapshots[d] && m.date >= d) snapshots[d] = Object.fromEntries(elo.ratings);
  }
  if (m.date > END) break;
  const before = elo.update(m);
  if (m.date >= START && (m.tournament === 'UEFA Euro qualification' || m.tournament === 'UEFA Euro')) {
    euroMatches.push({ ...m, eloHome: Math.round(before.home), eloAway: Math.round(before.away) });
  }
}

const teams = new Set<string>(['France']);
for (const m of euroMatches as { home: string; away: string; tournament: string }[]) {
  if (m.tournament === 'UEFA Euro qualification') {
    teams.add(m.home);
    teams.add(m.away);
  }
}

const eloOut: Record<string, Record<string, number>> = {};
for (const d of SNAPSHOT_DATES) {
  eloOut[d] = Object.fromEntries(
    [...teams].map((t) => [t, Math.round(snapshots[d]?.[t] ?? 1500)] as const).sort((a, b) => b[1] - a[1]),
  );
}

writeFileSync(`${OUT}/mecze.json`, JSON.stringify(euroMatches, null, 1));
writeFileSync(`${OUT}/elo.json`, JSON.stringify(eloOut, null, 1));

// ---------------------------------------------------------------------------
// Kadry z Wikipedii
// ---------------------------------------------------------------------------

const wikitext = readFileSync(`${RAW}/wikipedia/euro2016_squads.wikitext`, 'utf8');
const squads: SquadPlayer[] = [];
let team = '';
for (const line of wikitext.split('\n')) {
  const header = line.match(/^===\s*([^=]+?)\s*===\s*$/);
  if (header) {
    team = header[1]!.trim();
    continue;
  }
  if (!line.includes('{{nat fs g player')) continue;
  const field = (key: string) => {
    const m = line.match(new RegExp(`\\|${key}=((?:\\{\\{[^}]*\\}\\}|\\[\\[[^\\]]*\\]\\]|[^|}])*)`));
    return m ? m[1]!.trim() : '';
  };
  const { name, shortName } = parseName(field('name'));
  const birth = field('age').match(/\|(\d{4})\|(\d{1,2})\|(\d{1,2})\|(\d{4})\|(\d{1,2})\|(\d{1,2})/);
  squads.push({
    team,
    no: Number(field('no')),
    pos: field('pos') as SquadPlayer['pos'],
    name,
    shortName,
    birthDate: birth ? `${birth[4]}-${birth[5]!.padStart(2, '0')}-${birth[6]!.padStart(2, '0')}` : '',
    caps: Number(field('caps')) || 0,
    goals: Number(field('goals')) || 0,
    club: parseLink(field('club')),
    clubNation: field('clubnat'),
    captain: /captain/i.test(field('other')),
  });
}

function parseLink(s: string): string {
  const m = s.match(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/);
  return (m ? m[1]! : s).trim();
}

function parseName(s: string): { name: string; shortName: string } {
  const sort = s.match(/\{\{sortname\|([^|}]*)\|([^|}]*)/i);
  if (sort) {
    const first = sort[1]!.trim();
    const last = sort[2]!.trim();
    return { name: first ? `${first} ${last}` : last, shortName: last || first };
  }
  const plain = parseLink(s);
  return { name: plain, shortName: plain.split(' ').slice(-1)[0] ?? plain };
}

writeFileSync(`${OUT}/kadry.json`, JSON.stringify(squads, null, 1));

// ---------------------------------------------------------------------------
// Podsumowanie
// ---------------------------------------------------------------------------

const q = (euroMatches as { tournament: string; homeScore: number; awayScore: number }[]).filter((m) => m.tournament === 'UEFA Euro qualification');
const goals = q.reduce((s, m) => s + m.homeScore + m.awayScore, 0);
console.log(`Mecze eliminacji: ${q.length}, gole/mecz: ${(goals / q.length).toFixed(2)}`);
console.log(`Mecze turnieju: ${euroMatches.length - q.length}`);
console.log(`Uczestnicy: ${teams.size}`);
console.log(`Kadry: ${new Set(squads.map((p) => p.team)).size} drużyn, ${squads.length} zawodników`);
console.log('Elo na start eliminacji (top 5 i dół 3):');
const start = Object.entries(eloOut['2014-09-01']!);
for (const [t, r] of [...start.slice(0, 5), ...start.slice(-3)]) console.log(`  ${t.padEnd(22)} ${r}`);
const bad = squads.filter((p) => !p.birthDate || !p.club || !p.pos);
if (bad.length) console.log(`Uwaga: ${bad.length} zawodników z niepełnymi danymi:`, bad.slice(0, 5).map((p) => p.name));
