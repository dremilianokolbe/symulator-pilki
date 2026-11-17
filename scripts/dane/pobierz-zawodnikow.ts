/**
 * Pobiera dane zawodników do data/raw:
 * 1. Wikidata (CC0): kto grał w 54 reprezentacjach w latach 2014–16 → data/raw/wikidata/kadry-2014-16.json
 * 2. Wikipedia (CC BY-SA): infoboksy zawodników (pozycja, data urodzenia, kluby) → data/raw/wikipedia/infoboksy.json
 * Uruchom: npx tsx scripts/dane/pobierz-zawodnikow.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const UA = 'symulator-pilki/0.1 (personal project)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, params: Record<string, string>): Promise<unknown> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok) return await res.json();
      console.warn(`  ${res.status} (próba ${attempt})`);
    } catch (e) {
      console.warn(`  błąd sieci (próba ${attempt}): ${(e as Error).message}`);
    }
    await sleep(10000 * attempt);
  }
  throw new Error(`Nie udało się pobrać: ${u.toString().slice(0, 120)}`);
}

interface WikiPage {
  title: string;
  missing?: boolean;
  pageprops?: { wikibase_item?: string };
  revisions?: { slots: { main: { content: string } } }[];
}
interface WikiQuery {
  query: { pages: WikiPage[]; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] };
}

const wiki = (params: Record<string, string>) =>
  getJson('https://en.wikipedia.org/w/api.php', { action: 'query', format: 'json', formatversion: '2', redirects: '1', ...params }) as Promise<WikiQuery>;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Mapa: tytuł pytany → tytuł docelowy (po normalizacji i przekierowaniach). */
function resolveMap(q: WikiQuery, asked: string[]): Map<string, string> {
  const norm = new Map((q.query.normalized ?? []).map((n) => [n.from, n.to]));
  const redir = new Map((q.query.redirects ?? []).map((r) => [r.from, r.to]));
  const out = new Map<string, string>();
  for (const a of asked) {
    let t = norm.get(a) ?? a;
    t = redir.get(t) ?? t;
    out.set(a, t);
  }
  return out;
}

mkdirSync('data/raw/wikidata', { recursive: true });

// ---------------------------------------------------------------------------
// 1. Identyfikatory reprezentacji w Wikidata
// ---------------------------------------------------------------------------

type PoolPlayer = { team: string; wikidata: string; title: string; birth: string; start: string | null; end: string | null; caps: number | null };
const WIKIDATA_OUT = 'data/raw/wikidata/kadry-2014-16.json';
const cached = existsSync(WIKIDATA_OUT) ? (JSON.parse(readFileSync(WIKIDATA_OUT, 'utf8')) as { players: PoolPlayer[] }) : null;

const teams = cached ? [] : Object.keys(JSON.parse(readFileSync('data/processed/euro2016/elo.json', 'utf8'))['2014-09-01']);
const teamQids = new Map<string, string>();
for (const batch of chunks(teams, 40)) {
  const titles = batch.map((t) => `${t} national football team`);
  const q = await wiki({ prop: 'pageprops', ppprop: 'wikibase_item', titles: titles.join('|') });
  const resolved = resolveMap(q, titles);
  for (const t of batch) {
    const target = resolved.get(`${t} national football team`);
    const page = q.query.pages.find((p) => p.title === target);
    if (page?.pageprops?.wikibase_item) teamQids.set(t, page.pageprops.wikibase_item);
    else console.warn(`Brak Wikidata dla: ${t}`);
  }
  await sleep(1000);
}
// ---------------------------------------------------------------------------
// 2. Zawodnicy reprezentacji 2014–16 (Wikidata)
// ---------------------------------------------------------------------------

const pool: PoolPlayer[] = cached?.players ?? (await fetchPool());
console.log(`Zawodnicy z Wikidata: ${pool.length}${cached ? ' (z pliku)' : ''}`);

async function fetchPool(): Promise<PoolPlayer[]> {
console.log(`Reprezentacje w Wikidata: ${teamQids.size}/${teams.length}`);
const values = [...teamQids.values()].map((q) => `wd:${q}`).join(' ');
const sparql = `
SELECT ?team ?p ?title ?birth ?start ?end ?caps WHERE {
  VALUES ?team { ${values} }
  ?p p:P54 ?st. ?st ps:P54 ?team.
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?st pq:P1350 ?caps }
  ?p wdt:P569 ?birth. FILTER(YEAR(?birth) >= 1974 && YEAR(?birth) <= 1999)
  FILTER(!BOUND(?start) || YEAR(?start) <= 2016)
  FILTER(!BOUND(?end) || YEAR(?end) >= 2014)
  ?art schema:about ?p; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title.
}`;
const sq = (await getJson('https://query.wikidata.org/sparql', { query: sparql, format: 'json' })) as {
  results: { bindings: Record<string, { value: string }>[] };
};
const qidToTeam = new Map([...teamQids].map(([t, q]) => [q, t]));
const fetched: PoolPlayer[] = sq.results.bindings.map((b) => ({
  team: qidToTeam.get(b.team!.value.split('/').pop()!)!,
  wikidata: b.p!.value.split('/').pop()!,
  title: b.title!.value,
  birth: b.birth!.value.slice(0, 10),
  start: b.start?.value.slice(0, 10) ?? null,
  end: b.end?.value.slice(0, 10) ?? null,
  caps: b.caps ? Number(b.caps.value) : null,
}));
writeFileSync(WIKIDATA_OUT, JSON.stringify({ teams: Object.fromEntries(teamQids), players: fetched }, null, 1));
return fetched;
}

// ---------------------------------------------------------------------------
// 3. Infoboksy Wikipedii (pula Wikidata + finaliści Euro 2016)
// ---------------------------------------------------------------------------

const squadsWikitext = readFileSync('data/raw/wikipedia/euro2016_squads.wikitext', 'utf8');
const finalistTitles: string[] = [];
for (const line of squadsWikitext.split('\n')) {
  if (!line.includes('{{nat fs g player')) continue;
  const name = line.match(/\|name=((?:\{\{[^}]*\}\}|\[\[[^\]]*\]\]|[^|}])*)/)?.[1] ?? '';
  const sort = name.match(/\{\{sortname\|([^|}]*)\|([^|}]*)(?:\|([^|}]*))?/i);
  if (sort) finalistTitles.push(sort[3]?.trim() || `${sort[1]!.trim()} ${sort[2]!.trim()}`.trim());
  else {
    const link = name.match(/\[\[([^|\]]+)/);
    if (link) finalistTitles.push(link[1]!.trim());
  }
}

const OUT = 'data/raw/wikipedia/infoboksy.json';
const infoboxes: Record<string, { title: string; infobox: string | null }> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
// Finaliści mają składy z Euro; z puli Wikidata potrzebne są tylko drużyny spoza turnieju.
const FINALISTS = new Set(['France', 'Romania', 'Albania', 'Switzerland', 'England', 'Russia', 'Wales', 'Slovakia', 'Germany', 'Ukraine', 'Poland', 'Northern Ireland', 'Spain', 'Czech Republic', 'Turkey', 'Croatia', 'Belgium', 'Italy', 'Republic of Ireland', 'Sweden', 'Portugal', 'Iceland', 'Austria', 'Hungary']);
const nonFinalistPool = pool.filter((p) => !FINALISTS.has(p.team));
const allTitles = [...new Set([...finalistTitles, ...nonFinalistPool.map((p) => p.title)])].filter((t) => !(t in infoboxes));
console.log(`Infoboksy do pobrania: ${allTitles.length} (finaliści: ${finalistTitles.length})`);

function extractInfobox(text: string): string | null {
  const start = text.search(/\{\{\s*Infobox football biography/i);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
    else if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

let done = 0;
for (const batch of chunks(allTitles, 50)) {
  const q = await wiki({ prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: batch.join('|') });
  const resolved = resolveMap(q, batch);
  for (const asked of batch) {
    const page = q.query.pages.find((p) => p.title === resolved.get(asked));
    const content = page?.revisions?.[0]?.slots.main.content;
    infoboxes[asked] = { title: page?.title ?? asked, infobox: content ? extractInfobox(content) : null };
  }
  done += batch.length;
  writeFileSync(OUT, JSON.stringify(infoboxes));
  process.stdout.write(`\r  ${done}/${allTitles.length}`);
  await sleep(2500);
}
const missing = Object.values(infoboxes).filter((v) => !v.infobox).length;
console.log(`\nInfoboksy: ${Object.keys(infoboxes).length}, bez infoboksu: ${missing}`);
