/**
 * Kluby zawodników z puli 30 drużyn spoza Euro 2016 w sezonie 2014/15 (Wikidata, CC0):
 * klub, kraj i liga → data/raw/wikidata/kluby-2015.json.
 * Uruchom: npx tsx scripts/dane/pobierz-kluby.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'data/raw/wikidata/kluby-2015.json';
const done: Record<string, unknown> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const pool = (JSON.parse(readFileSync('data/raw/wikidata/kadry-2014-16.json', 'utf8')) as { players: { team: string; wikidata: string }[] }).players;
// Cała pula (także szerokie kadry finalistów); pomijamy już pobranych.
const qids = [...new Set(pool.map((p) => p.wikidata))].filter((q) => !(q in done));
console.log(`Zawodników do sprawdzenia: ${qids.length}`);

const out = done as Record<string, { club: string; country: string; league: string | null; start: string | null }[]>;
for (let i = 0; i < qids.length; i += 150) {
  const batch = qids.slice(i, i + 150);
  const query = `
SELECT ?p ?clubLabel ?countryLabel ?leagueLabel ?start WHERE {
  VALUES ?p { ${batch.map((q) => `wd:${q}`).join(' ')} }
  ?p p:P54 ?st. ?st ps:P54 ?club.
  ?club wdt:P31 wd:Q476028.
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
  FILTER(!BOUND(?start) || ?start <= "2015-03-01"^^xsd:dateTime)
  FILTER(!BOUND(?end) || ?end >= "2015-01-01"^^xsd:dateTime)
  OPTIONAL { ?club wdt:P17 ?country }
  OPTIONAL { ?club wdt:P118 ?league }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}`;
  let res!: Response;
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { 'User-Agent': 'symulator-pilki/0.1 (personal project)', Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query }),
    });
    if (res.ok) break;
    console.warn(`  ${res.status} (próba ${attempt})`);
    await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
  if (!res.ok) throw new Error(`Wikidata: ${res.status}`);
  const json = (await res.json()) as { results: { bindings: Record<string, { value: string }>[] } };
  for (const b of json.results.bindings) {
    const q = b.p!.value.split('/').pop()!;
    (out[q] ??= []).push({
      club: b.clubLabel?.value ?? '',
      country: b.countryLabel?.value ?? '',
      league: b.leagueLabel?.value ?? null,
      start: b.start?.value.slice(0, 10) ?? null,
    });
  }
  console.log(`  ${Math.min(i + 150, qids.length)}/${qids.length}`);
  await new Promise((r) => setTimeout(r, 2000));
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`Zawodnicy z klubem: ${Object.keys(out).length}/${qids.length}`);
