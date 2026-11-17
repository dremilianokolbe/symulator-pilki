/**
 * Parser infoboksu „Infobox football biography” z Wikipedii:
 * pozycje (dokładne, z kolejnością), data urodzenia, klub w danym dniu, występy w kadrze.
 */
import type { Position } from '../engine/attributes';

export interface InfoboxData {
  positions: Partial<Record<Position, number>>;
  primary: Position | null;
  positionText: string;
  birthDate: string | null;
  /** Kluby z latami: [od, do] (do = null dla „obecnie”). */
  clubs: { from: number; to: number | null; club: string; loan: boolean }[];
  /** Seniorska reprezentacja: lata i występy z całej kariery (stan obecny). */
  national: { team: string; from: number | null; to: number | null; caps: number | null; goals: number | null } | null;
}

/** Wartość pola infoboksu, także wieloliniowa (do następnego `|` na najwyższym poziomie). */
function field(box: string, name: string): string {
  const m = new RegExp(`\\|\\s*${name}\\s*=`, 'i').exec(box);
  if (!m) return '';
  let depth = 0;
  let i = m.index + m[0].length;
  const start = i;
  for (; i < box.length; i++) {
    const two = box.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; i++; continue; }
    if (two === '}}' || two === ']]') {
      if (depth === 0) break; // koniec infoboksu
      depth--; i++; continue;
    }
    if (depth === 0 && box[i] === '|' ) break;
  }
  return box.slice(start, i).trim();
}

/** Usuwa znaczniki wiki: [[a|b]] → b, {{…}} → '', <ref>…</ref> → ''. */
export function stripWiki(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .trim();
}

/** Kolejne pozycje z tekstu (np. „Right-back, centre-back”). */
export function parsePositions(text: string): { primary: Position | null; positions: Partial<Record<Position, number>> } {
  // Listy {{hlist|a|b}}, {{flatlist|*a *b}}: rozbij na elementy przed usunięciem szablonów.
  const listed = text
    .replace(/\{\{\s*(?:hlist|flatlist|plainlist|ubl|unbulleted list)\s*\|/gi, '')
    .replace(/\}\}/g, '')
    .replace(/\|/g, ',')
    .replace(/\n\s*\*/g, ',');
  const parts = stripWiki(listed.replace(/\[\[(?:[^|\]]*,)?/g, '[[')).toLowerCase()
    .replace(/–/g, '-')
    .split(/\s*(?:,|\/|;|\bor\b|\band\b|\n|\*)\s*/)
    .filter(Boolean);
  const positions: Partial<Record<Position, number>> = {};
  let primary: Position | null = null;
  const set = (pos: Position, value: number) => {
    positions[pos] = Math.max(positions[pos] ?? 0, value);
  };
  parts.forEach((part, i) => {
    const main = i === 0 ? 100 : 85;
    const found = mapPart(part);
    found.forEach(([pos, factor], j) => {
      set(pos, Math.round(main * factor));
      if (i === 0 && j === 0) primary = pos;
    });
  });
  return { primary, positions };
}

/** Jedna nazwa pozycji → lista [pozycja, współczynnik znajomości]. */
function mapPart(p: string): [Position, number][] {
  if (/goal\s*keeper|goalie/.test(p)) return [['GK', 1]];
  if (/sweeper|centre[- ]?back|center[- ]?back|central defender|centre-half/.test(p)) return [['DC', 1]];
  if (/left[- ]?wing[- ]?back/.test(p)) return [['WBL', 1], ['DL', 0.9]];
  if (/right[- ]?wing[- ]?back/.test(p)) return [['WBR', 1], ['DR', 0.9]];
  if (/wing[- ]?back/.test(p)) return [['WBR', 1], ['WBL', 0.95], ['DR', 0.9], ['DL', 0.85]];
  if (/left[- ]?(?:back|full[- ]?back|defender)/.test(p)) return [['DL', 1], ['WBL', 0.85]];
  if (/right[- ]?(?:back|full[- ]?back|defender)/.test(p)) return [['DR', 1], ['WBR', 0.85]];
  if (/full[- ]?back/.test(p)) return [['DR', 1], ['DL', 0.9], ['WBR', 0.8], ['WBL', 0.75]];
  if (/defensive midfield|holding midfield|anchor/.test(p)) return [['DM', 1], ['MC', 0.85]];
  if (/attacking midfield|playmaker|number 10/.test(p)) return [['AMC', 1], ['MC', 0.8]];
  if (/left[- ]?wing|left midfield/.test(p)) return [['AML', 1], ['ML', 0.9], ['AMR', 0.75]];
  if (/right[- ]?wing|right midfield/.test(p)) return [['AMR', 1], ['MR', 0.9], ['AML', 0.75]];
  if (/wing|wide midfield/.test(p)) return [['AMR', 1], ['AML', 0.95], ['MR', 0.9], ['ML', 0.85]];
  if (/second striker|support striker|deep-lying forward/.test(p)) return [['ST', 1], ['AMC', 0.85]];
  if (/striker|centre[- ]?forward|center[- ]?forward|forward/.test(p)) return [['ST', 1]];
  if (/defender/.test(p)) return [['DC', 1], ['DR', 0.75], ['DL', 0.7]];
  if (/midfield/.test(p)) return [['MC', 1], ['DM', 0.8], ['AMC', 0.75]];
  return [];
}

function parseBirthDate(s: string): string | null {
  const m = s.match(/\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/);
  return m ? `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}` : null;
}

function parseYears(s: string): { from: number; to: number | null } | null {
  const clean = stripWiki(s);
  const m = clean.match(/(\d{4})\s*(?:[–-]\s*(\d{4})?)?/);
  if (!m) return null;
  const from = Number(m[1]);
  const hasDash = /[–-]/.test(clean);
  const to = m[2] ? Number(m[2]) : hasDash ? null : from;
  return { from, to };
}

export function parseInfobox(box: string): InfoboxData {
  const positionText = field(box, 'position');
  const { primary, positions } = parsePositions(positionText);
  const clubs: InfoboxData['clubs'] = [];
  for (let i = 1; i <= 30; i++) {
    const years = field(box, `years${i}`);
    const clubRaw = field(box, `clubs${i}`);
    if (!years || !clubRaw) continue;
    const range = parseYears(years);
    if (!range) continue;
    clubs.push({ ...range, club: stripWiki(clubRaw).replace(/^→\s*/, '').replace(/\s*\(loan\)\s*$/i, '').trim(), loan: /→|\(loan\)/i.test(clubRaw) });
  }
  // Seniorska reprezentacja: pierwsza drużyna narodowa, która nie jest młodzieżowa ani rezerwowa.
  let national: InfoboxData['national'] = null;
  for (let i = 1; i <= 12; i++) {
    const team = field(box, `national_team${i}`) || field(box, `nationalteam${i}`);
    if (!team) continue;
    if (/under-|\bU-?\d{2}\b|\bB\b|olympic|amateur/i.test(team)) continue;
    const years = parseYears(field(box, `national_years${i}`) || field(box, `nationalyears${i}`));
    const num = (s: string) => {
      const v = Number(stripWiki(s).replace(/[^\d]/g, ''));
      return Number.isFinite(v) && stripWiki(s) !== '' ? v : null;
    };
    national = {
      team: stripWiki(team),
      from: years?.from ?? null,
      to: years?.to ?? null,
      caps: num(field(box, `national_caps${i}`) || field(box, `nationalcaps${i}`)),
      goals: num(field(box, `national_goals${i}`) || field(box, `nationalgoals${i}`)),
    };
    break;
  }
  return {
    positions,
    primary,
    positionText: stripWiki(positionText),
    birthDate: parseBirthDate(field(box, 'birth_date')),
    clubs,
    national,
  };
}

/**
 * Szacunkowa liczba występów w kadrze w danym roku: występy z całej kariery rozłożone równo
 * na lata gry w kadrze (infoboks podaje stan obecny, nie historyczny).
 */
export function estimatedCapsAt(data: InfoboxData, year: number, currentYear = 2026): number | null {
  const n = data.national;
  if (!n || n.caps === null || n.from === null) return null;
  if (year < n.from) return 0;
  const end = n.to ?? currentYear;
  const span = Math.max(1, end - n.from + 1);
  return Math.round(n.caps * Math.min(1, (year - n.from + 0.5) / span));
}

/** Klub zawodnika w danym roku (wypożyczenie ma pierwszeństwo, potem najpóźniejszy transfer). */
export function clubInYear(data: InfoboxData, year: number): string | null {
  const active = data.clubs.filter((c) => c.from <= year && (c.to === null || c.to >= year));
  if (active.length === 0) return null;
  active.sort((a, b) => Number(b.loan) - Number(a.loan) || b.from - a.from);
  return active[0]!.club;
}
