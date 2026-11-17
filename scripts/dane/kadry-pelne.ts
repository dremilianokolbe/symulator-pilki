/**
 * Pełne kadry 54 reprezentacji na Euro 2016 (z eliminacjami) → data/processed/euro2016/kadry-pelne.json
 * - 24 finalistów: skład z Euro 2016 + dokładne pozycje z infoboksów,
 * - 30 pozostałych: 23 zawodników wybranych z puli kadry 2014–16 (Wikidata) wg występów i klubu.
 * Uruchom: npx tsx scripts/dane/kadry-pelne.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { positionGroup, statusScore, type SquadPlayer } from '../../src/data/derive';
import { clubInYear, estimatedCapsAt, parseInfobox, type InfoboxData } from '../../src/data/infobox';
import { leagueCode } from '../../src/data/leagues';
import type { Position } from '../../src/engine/attributes';

const finalists = JSON.parse(readFileSync('data/processed/euro2016/kadry.json', 'utf8')) as SquadPlayer[];
const boxes = JSON.parse(readFileSync('data/raw/wikipedia/infoboksy.json', 'utf8')) as Record<string, { title: string; infobox: string | null }>;
const wd = JSON.parse(readFileSync('data/raw/wikidata/kadry-2014-16.json', 'utf8')) as {
  players: { team: string; wikidata: string; title: string; birth: string }[];
};
const clubs: Record<string, { club: string; country: string; league: string | null; start: string | null }[]> =
  existsSync('data/raw/wikidata/kluby-2015.json') ? JSON.parse(readFileSync('data/raw/wikidata/kluby-2015.json', 'utf8')) : {};

const parsed = new Map<string, InfoboxData>();
for (const [title, v] of Object.entries(boxes)) if (v.infobox) parsed.set(title, parseInfobox(v.infobox));

// Tytuł artykułu zawodnika z wpisu w składzie (jak w pobierz-zawodnikow.ts).
const squadsWikitext = readFileSync('data/raw/wikipedia/euro2016_squads.wikitext', 'utf8');
const finalistTitles: string[] = [];
for (const line of squadsWikitext.split('\n')) {
  if (!line.includes('{{nat fs g player')) continue;
  const name = line.match(/\|name=((?:\{\{[^}]*\}\}|\[\[[^\]]*\]\]|[^|}])*)/)?.[1] ?? '';
  const sort = name.match(/\{\{sortname\|([^|}]*)\|([^|}]*)(?:\|([^|}]*))?/i);
  const link = name.match(/\[\[([^|\]]+)/);
  finalistTitles.push(sort ? sort[3]?.trim() || `${sort[1]!.trim()} ${sort[2]!.trim()}`.trim() : link?.[1]?.trim() ?? '');
}

const result: SquadPlayer[] = [];
let detailed = 0;

// ---------------------------------------------------------------------------
// Finaliści: składy z Euro + dokładne pozycje
// ---------------------------------------------------------------------------

finalists.forEach((p, i) => {
  const info = parsed.get(finalistTitles[i] ?? '');
  const out: SquadPlayer = { ...p, source: 'euro2016' };
  // Pozycja z infoboksu tylko, jeśli zgadza się z grupą ze składu (inaczej infoboks opisuje kogoś innego albo późniejszą rolę).
  if (info?.primary && positionGroup(info.primary) === p.pos) {
    out.primary = info.primary;
    out.positions = info.positions;
    detailed++;
  } else if (info?.primary) {
    // Zawodnik zmienił rolę (np. pomocnik → obrońca): zostaw grupę ze składu, dodaj pozycje z infoboksu jako drugorzędne.
    const fromGroup = Object.entries(info.positions).find(([pos]) => positionGroup(pos as Position) === p.pos);
    if (fromGroup) {
      out.primary = fromGroup[0] as Position;
      out.positions = { ...info.positions, [fromGroup[0]]: 100 };
      detailed++;
    }
  }
  result.push(out);
});
console.log(`Finaliści: ${finalists.length}, z dokładną pozycją: ${detailed}`);

// ---------------------------------------------------------------------------
// Pozostałe 30 drużyn: wybór 23 z puli
// ---------------------------------------------------------------------------

const FINALIST_TEAMS = new Set(finalists.map((p) => p.team));
const QUOTA: { group: (pos: Position) => boolean; n: number }[] = [
  { group: (p) => p === 'GK', n: 3 },
  { group: (p) => p === 'DC', n: 4 },
  { group: (p) => ['DL', 'WBL'].includes(p), n: 2 },
  { group: (p) => ['DR', 'WBR'].includes(p), n: 2 },
  { group: (p) => ['DM', 'MC'].includes(p), n: 4 },
  { group: (p) => ['ML', 'MR', 'AML', 'AMR', 'AMC'].includes(p), n: 4 },
  { group: (p) => p === 'ST', n: 4 },
];

const byTeam = new Map<string, typeof wd.players>();
for (const p of wd.players) {
  if (FINALIST_TEAMS.has(p.team)) continue;
  const list = byTeam.get(p.team) ?? [];
  if (!list.some((x) => x.title === p.title)) list.push(p);
  byTeam.set(p.team, list);
}

const report: string[] = [];
for (const [team, pool] of [...byTeam].sort()) {
  const candidates: (SquadPlayer & { score: number })[] = [];
  for (const p of pool) {
    const info = parsed.get(p.title);
    if (!info?.primary || !info.birthDate) continue;
    const n = info.national;
    // Grał w seniorskiej kadrze w trakcie eliminacji (2014–2015).
    if (!n || n.from === null || n.from > 2015 || (n.to !== null && n.to < 2014)) continue;
    const caps = estimatedCapsAt(info, 2015) ?? 0;
    const goals = n.caps && n.goals !== null ? Math.round((n.goals * caps) / Math.max(1, n.caps)) : 0;
    const clubInfo = (clubs[p.wikidata] ?? []).sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))[0];
    const sp: SquadPlayer = {
      team,
      no: 0,
      pos: positionGroup(info.primary),
      name: p.title.replace(/\s*\(.*\)$/, ''),
      shortName: p.title.replace(/\s*\(.*\)$/, '').split(' ').slice(1).join(' ') || p.title,
      birthDate: info.birthDate,
      caps,
      goals,
      club: clubInfo?.club || clubInYear(info, 2015) || '',
      clubNation: clubInfo ? leagueCode(clubInfo.country, clubInfo.league) ?? '' : '',
      captain: false,
      positions: info.positions,
      primary: info.primary,
      source: 'pula',
    };
    candidates.push({ ...sp, score: statusScore(sp, '2015-06-01') });
  }

  candidates.sort((a, b) => b.score - a.score);
  const chosen = new Set<(typeof candidates)[number]>();
  for (const q of QUOTA) {
    for (const c of candidates.filter((c) => q.group(c.primary!)).slice(0, q.n)) chosen.add(c);
  }
  for (const c of candidates) {
    if (chosen.size >= 23) break;
    chosen.add(c);
  }
  const squad = [...chosen].slice(0, 23);
  const captain = squad.reduce((a, b) => (b.caps > a.caps ? b : a), squad[0]!);
  squad.forEach((p, i) => {
    const { score: _score, ...rest } = p;
    result.push({ ...rest, no: i + 1, captain: p === captain });
  });
  const gk = squad.filter((p) => p.pos === 'GK').length;
  report.push(`${team} ${squad.length} (BR ${gk}, pula ${candidates.length})`);
}

console.log(`Pozostałe drużyny: ${byTeam.size}`);
console.log(report.join(', '));
writeFileSync('data/processed/euro2016/kadry-pelne.json', JSON.stringify(result, null, 1));
console.log(`Zapisano: ${result.length} zawodników, ${new Set(result.map((p) => p.team)).size} drużyn`);
