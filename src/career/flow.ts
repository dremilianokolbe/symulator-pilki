/**
 * Przebieg kariery selekcjonera (Euro 2016): generator decyzji.
 *
 * Świat (wszystkie mecze eliminacji i turnieju) toczy się w euro2016Flow; kariera przejmuje
 * sterowanie przy meczach drużyny gracza i w ważnych momentach. Między oknami reprezentacyjnymi
 * płynie czas: forma w klubach, kontuzje, zdarzenia losowe. Przed meczem: powołania, konferencja,
 * skład; mecz na żywo z przerwami na decyzje; po meczu: oceny, media, zaufanie federacji.
 *
 * Wszystko jest deterministyczne: ten sam seed i te same odpowiedzi dają ten sam przebieg
 * (zapis gry = seed + lista odpowiedzi).
 */
import { describe as describeEvent, minuteLabel } from '../commentary/pl';
import { deriveSquad, type SquadPlayer } from '../data/derive';
import { expectedScore } from '../data/elo';
import { rollInjury } from '../engine/injuries';
import { getResult, makeSubstitution, setTactics, startMatch, stepMinute, type MatchState } from '../engine/match';
import { createRng, type Rng } from '../engine/rng';
import { POSITION_LABEL, positionRating, type Position } from '../engine/attributes';
import type { FormationId, MatchEvent, MatchResult, MatchTeamInput, Player, Side } from '../engine/types';
import { buildTeamInput } from '../generator/players';
import { EURO2016_CODES, eloToOvr, plAcc, plWith, TEAM_NAME_PL } from '../scenarios/euro2016';
import { euro2016Flow, type EuroHook, type EuroRun, type EuroWorld, type Phase, STAGE_ORDER, type Stage } from '../scenarios/euro2016/tournament';
import { EVENTS, outlet, PRESS_QUESTIONS, STAFF_LABEL, staffCandidates } from './content';
import {
  STYLE_PRESETS, styleTactics, type Answer, type CareerState, type Decision, type LineupAction, type LiveAction,
  type PlayerRow, type PlayerStatus, type StaffMember, type StylePreset,
} from './types';

export interface CareerConfig {
  team: string;
  seed: number;
  world: EuroWorld;
  /** Kadry (z rezerwami) i Elo z danych. */
  squads: SquadPlayer[];
  eloQualifying: Record<string, number>;
  eloFinals: Record<string, number>;
}

export interface CareerSummary {
  state: CareerState;
  stage: Stage | 'sacked';
  run: EuroRun | null;
}

const pl = (t: string) => TEAM_NAME_PL[t] ?? t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export function* careerFlow(cfg: CareerConfig): Generator<Decision, CareerSummary, Answer> {
  const rng = createRng(cfg.seed);
  const worldRng = createRng(cfg.seed * 7 + 1);
  const state = initState(cfg, rng);

  // -------------------------------------------------------------------------
  // Start: przywitanie i sztab
  // -------------------------------------------------------------------------

  const group = cfg.world.qualifyingGroups.find((g) => g.teams.includes(cfg.team));
  yield {
    kind: 'info',
    title: `Selekcjoner: ${state.teamPl}`,
    lines: [
      `Wrzesień 2014. Obejmujesz reprezentację: ${state.teamPl}.`,
      group ? `Eliminacje Euro 2016, grupa ${group.letter}: ${group.teams.map(pl).join(', ')}.` : 'Jesteś gospodarzem Euro 2016: grasz tylko mecze towarzyskie, a potem turniej.',
      `Oczekiwania federacji: ${state.expectation.label}.`,
      'Najpierw skompletuj sztab.',
    ],
  };
  for (const role of ['assistant', 'analyst', 'fitness'] as const) {
    const cands = staffCandidates(rng, role);
    const trade = [
      { hint: 'najlepszy, ale drogi – federacja kręci nosem (zaufanie −3)', trust: -3, morale: 0 },
      { hint: 'solidny, bez kosztów', trust: 0, morale: 0 },
      { hint: 'słabszy fachowo, ale były kadrowicz lubiany przez zawodników (morale +5)', trust: 0, morale: 5 },
    ];
    const answer = yield {
      kind: 'choice',
      title: STAFF_LABEL[role],
      text: 'Wybierz kandydata:',
      options: cands.map((c, i) => ({ id: String(i), label: `${c.name} (${c.rating}/100)`, hint: trade[i]!.hint })),
    };
    const i = Number(answer ?? 1);
    state.staff[role] = cands[i] ?? cands[1]!;
    state.trust = clamp(state.trust + (trade[i]?.trust ?? 0), 0, 100);
    for (const st of state.status.values()) st.morale = clamp(st.morale + (trade[i]?.morale ?? 0), 0, 100);
  }

  // -------------------------------------------------------------------------
  // Świat: przebieg Euro z punktami zaczepienia
  // -------------------------------------------------------------------------

  const world = euro2016Flow(cfg.world, worldRng, { userTeam: cfg.team, realDraw: true, keepMatches: false });
  let step = world.next();
  let phaseOfPool: 'qualifying' | 'finals' = 'qualifying';
  let eliminated = false;
  let finalStage: Stage | 'sacked' | null = null;

  while (!step.done) {
    const hook: EuroHook = step.value;
    let reply: MatchResult | undefined;

    if (state.sacked || eliminated) {
      // Kariera skończona: świat dogrywa się bez gracza (mecze gracza symulujemy).
      reply = hook.kind === 'match' ? simulateAi(hook, cfg, worldRng) : undefined;
      step = world.next(reply);
      continue;
    }

    switch (hook.kind) {
      case 'match': {
        if ((hook.phase === 'finals' || hook.phase === 'knockout') && phaseOfPool === 'qualifying') {
          switchPoolToFinals(state, cfg);
          phaseOfPool = 'finals';
        }
        const newWindow = !state.lastMatchDate || !isDate(hook.fixture.date) || daysBetween(state.lastMatchDate, hook.fixture.date) > 12;
        if (newWindow && hook.phase !== 'knockout') {
          yield* windowPrelude(state, cfg, rng, hook);
          if (state.sacked) {
            reply = simulateAi(hook, cfg, worldRng);
            break;
          }
        }
        reply = yield* playUserMatch(state, cfg, rng, hook);
        yield* afterMatch(state, cfg, hook, reply);
        if (state.trust < 12 && hook.phase === 'qualifying') {
          state.sacked = true;
          finalStage = 'sacked';
          yield { kind: 'info', title: 'Zwolnienie', lines: [`Federacja traci cierpliwość. Zaufanie: ${state.trust}/100.`, 'Zostajesz zwolniony ze stanowiska selekcjonera.'] };
        }
        break;
      }
      case 'qualifyingDone': {
        const table = hook.tables.find((t) => t.rows.some((r) => r.team === cfg.team));
        if (table) {
          const position = table.rows.findIndex((r) => r.team === cfg.team) + 1;
          yield { kind: 'info', title: `Koniec eliminacji – grupa ${table.letter}`, lines: formatTable(table.rows, cfg.team) };
          const best3 = hook.thirds[0]?.team === cfg.team;
          const verdict = position <= state.expectation.maxPosition ? (position < state.expectation.maxPosition ? 15 : 8) : -25;
          state.goalMet = position <= state.expectation.maxPosition;
          state.trust = clamp(state.trust + verdict, 0, 100);
          const where = position <= 2 || best3 ? 'Awans na Euro 2016!' : position === 3 ? 'Trzecie miejsce: czekają baraże.' : 'Koniec marzeń o Euro.';
          yield {
            kind: 'info',
            title: 'Ocena federacji',
            lines: [where, `Cel: ${state.expectation.label}. Miejsce: ${position}.`, `Zaufanie federacji: ${state.trust}/100 (${verdict > 0 ? '+' : ''}${verdict}).`],
          };
          if (position > 3) {
            eliminated = true;
            finalStage = 'qualifyingGroup';
          }
        }
        break;
      }
      case 'playoffDraw': {
        const pair = hook.pairs.find((p) => p.includes(cfg.team));
        if (pair) yield { kind: 'info', title: 'Losowanie baraży', lines: [`Rywal: ${pl(pair[0] === cfg.team ? pair[1] : pair[0])}. Pierwszy mecz: ${pair[0] === cfg.team ? 'u siebie' : 'na wyjeździe'}.`] };
        break;
      }
      case 'finalsDraw': {
        const g = hook.groups.find((x) => x.teams.includes(cfg.team));
        if (!g) {
          eliminated = true;
          finalStage = finalStage ?? 'playoff';
          yield { kind: 'info', title: 'Bez Euro', lines: ['Twoja drużyna nie zagra na Euro 2016.'] };
          break;
        }
        yield {
          kind: 'info',
          title: 'Losowanie Euro 2016 (12 grudnia 2015, Paryż)',
          lines: hook.groups.map((x) => `Grupa ${x.letter}: ${x.teams.map((t) => (t === cfg.team ? `[${pl(t)}]` : pl(t))).join(', ')}`),
        };
        state.expectation = finalsExpectation(cfg, g.teams);
        yield { kind: 'info', title: 'Cel na turniej', lines: [`Federacja oczekuje: ${state.expectation.label}.`] };
        break;
      }
      case 'groupsDone': {
        const t = hook.tables.find((x) => x.rows.some((r) => r.team === cfg.team));
        if (t) {
          yield { kind: 'info', title: `Euro 2016 – grupa ${t.letter} (koniec)`, lines: formatTable(t.rows, cfg.team) };
          const pos = t.rows.findIndex((r) => r.team === cfg.team) + 1;
          const third = hook.thirds.slice(0, 4).some((r) => r.team === cfg.team);
          if (pos === 4 || (pos === 3 && !third)) {
            eliminated = true;
            finalStage = 'finalsGroup';
            yield { kind: 'info', title: 'Odpadamy z turnieju', lines: ['Koniec przygody z Euro 2016 na fazie grupowej.'] };
          }
        }
        break;
      }
      case 'knockoutDone': {
        const m = hook.match;
        if (m.home === cfg.team || m.away === cfg.team) {
          const won = (m.result.winner === 'home') === (m.home === cfg.team);
          if (!won) {
            eliminated = true;
            finalStage = hook.round;
          } else if (hook.round === 'final') {
            finalStage = 'champion';
          }
        }
        break;
      }
    }
    step = world.next(reply);
  }

  const run = step.value;
  const stage: Stage | 'sacked' = finalStage ?? run.stage.get(cfg.team) ?? 'qualifyingGroup';
  yield summaryDecision(state, run, stage, cfg);
  return { state, stage, run };
}

// ---------------------------------------------------------------------------
// Stan początkowy
// ---------------------------------------------------------------------------

function initState(cfg: CareerConfig, rng: Rng): CareerState {
  const code = EURO2016_CODES[cfg.team] ?? cfg.team.slice(0, 3).toUpperCase();
  const pool = buildPool(cfg, cfg.eloQualifying, '2015-06-01');
  const status = new Map<string, PlayerStatus>();
  for (const p of pool.players) {
    status.set(p.id, { injuryDays: 0, yellows: 0, suspended: 0, form: Math.round(rng.normal(0, 5)), morale: 60, careerCaps: 0, careerGoals: 0, condition: 100 });
  }
  return {
    team: cfg.team,
    teamPl: pl(cfg.team),
    code,
    date: '2014-09-01',
    pool: new Map(pool.players.map((p) => [p.id, p])),
    clubs: pool.clubs,
    status,
    calledUp: [],
    formation: '4-4-2',
    style: 'balanced',
    trust: 60,
    media: 55,
    expectation: qualifyingExpectation(cfg),
    goalMet: null,
    staff: {
      assistant: { role: 'assistant', name: '—', rating: 60 },
      analyst: { role: 'analyst', name: '—', rating: 60 },
      fitness: { role: 'fitness', name: '—', rating: 60 },
    },
    record: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 },
    headlines: [],
    sacked: false,
    lastMatchDate: null,
    lastEvents: [],
  };
}

/** Kadra z rezerwami (szeroka kadra) wyliczona dla danej siły reprezentacji. */
function buildPool(cfg: CareerConfig, elo: Record<string, number>, refDate: string) {
  const records = cfg.squads.filter((p) => p.team === cfg.team);
  const code = EURO2016_CODES[cfg.team] ?? cfg.team.slice(0, 3).toUpperCase();
  const players = deriveSquad(records, { teamOvr: eloToOvr(elo[cfg.team] ?? 1700), refDate, nationCode: code });
  const clubs = new Map(players.map((p, i) => [p.id, records[i]!.club]));
  return { players, clubs };
}

/** Na turniej: te same osoby (te same id), siła wg Elo z czerwca 2016. Status zostaje. */
function switchPoolToFinals(state: CareerState, cfg: CareerConfig) {
  const pool = buildPool(cfg, cfg.eloFinals, '2016-06-10');
  state.pool = new Map(pool.players.map((p) => [p.id, p]));
  // Kartki z eliminacji nie przechodzą na turniej.
  for (const st of state.status.values()) {
    st.yellows = 0;
    st.suspended = 0;
  }
}

function groupRank(cfg: CareerConfig): number {
  const g = cfg.world.qualifyingGroups.find((x) => x.teams.includes(cfg.team));
  if (!g) return 1;
  const sorted = [...g.teams].sort((a, b) => (cfg.eloQualifying[b] ?? 0) - (cfg.eloQualifying[a] ?? 0));
  return sorted.indexOf(cfg.team) + 1;
}

function qualifyingExpectation(cfg: CareerConfig): CareerState['expectation'] {
  const r = groupRank(cfg);
  if (r === 1) return { label: 'awans z 1. miejsca w grupie', maxPosition: 1 };
  if (r === 2) return { label: 'bezpośredni awans (top 2)', maxPosition: 2 };
  if (r === 3) return { label: 'co najmniej baraże (3. miejsce)', maxPosition: 3 };
  if (r === 4) return { label: 'walka o 3. miejsce (4. miejsce to minimum)', maxPosition: 4 };
  return { label: 'godna postawa, jak najwyżej w tabeli', maxPosition: 5 };
}

function finalsExpectation(cfg: CareerConfig, groupTeams: string[]): CareerState['expectation'] {
  const sorted = [...groupTeams].sort((a, b) => (cfg.eloFinals[b] ?? 0) - (cfg.eloFinals[a] ?? 0));
  const r = sorted.indexOf(cfg.team) + 1;
  if (r === 1) return { label: 'wyjście z grupy z 1. miejsca i ćwierćfinał', maxPosition: 1 };
  if (r <= 3) return { label: 'wyjście z grupy', maxPosition: 3 };
  return { label: 'walka o wyjście z grupy', maxPosition: 4 };
}

// ---------------------------------------------------------------------------
// Okno reprezentacyjne: czas, zdarzenia, raport, powołania, sparing, konferencja
// ---------------------------------------------------------------------------

function* windowPrelude(state: CareerState, cfg: CareerConfig, rng: Rng, hook: Extract<EuroHook, { kind: 'match' }>): Generator<Decision, void, Answer> {
  const date = isDate(hook.fixture.date) ? hook.fixture.date : state.date;
  const days = Math.max(0, daysBetween(state.date, date));
  const news = passTime(state, rng, days);
  state.date = date;

  // Zdarzenie losowe (ok. 70% okien).
  if (rng.chance(0.7)) {
    const candidates = EVENTS.filter((e) => e.applies(state));
    if (candidates.length) {
      const ev = rng.pick(candidates);
      const pid = ev.player?.(state, rng);
      const name = pid ? state.pool.get(pid)?.name ?? '' : '';
      const answer = yield { kind: 'choice', title: ev.title, text: ev.text(state, name), options: ev.options.map(({ effect: _e, ...o }) => o) };
      const opt = ev.options.find((o) => o.id === answer) ?? ev.options[0]!;
      applyEffect(state, opt.effect, pid);
      if (opt.id === 'wiecej' && state.expectation.maxPosition > 1) {
        // Obietnica podnosi poprzeczkę.
        state.expectation = { label: `${state.expectation.label} – a obiecałeś więcej`, maxPosition: state.expectation.maxPosition - 1 };
      }
      yield { kind: 'info', title: ev.title, lines: [opt.effect.text] };
    }
  }

  // Raport z klubów (obserwacja).
  yield { kind: 'info', title: `Obserwacja zawodników – ${formatDate(date)}`, lines: news };

  // Powołania.
  const size = hook.phase === 'finals' ? 23 : 23;
  const pool = [...state.pool.values()].map((p) => row(state, p));
  const suggested = suggestCallup(state, rng, size);
  const answer = yield {
    kind: 'callup',
    title: hook.phase === 'finals' ? 'Kadra na Euro 2016 (23 zawodników)' : `Powołania na zgrupowanie (${formatDate(date)})`,
    pool,
    suggested,
    size,
  };
  const chosen = Array.isArray(answer) && answer.length === size ? answer : suggested;
  const before = new Set(state.calledUp);
  state.calledUp = chosen;
  for (const [id, st] of state.status) {
    if (chosen.includes(id)) st.morale = clamp(st.morale + (before.has(id) ? 1 : 6), 0, 100);
    else if (before.has(id)) st.morale = clamp(st.morale - 8, 0, 100);
  }

  // Sparing w oknie, w którym gramy tylko jeden mecz o punkty (albo przed turniejem).
  const opponents = friendlyOptions(cfg, hook, rng);
  if (opponents.length) {
    const ans = yield {
      kind: 'choice',
      title: 'Mecz towarzyski',
      text: hook.phase === 'finals' ? 'Ostatni sprawdzian przed Euro. Z kim gramy?' : 'W tym oknie jest wolny termin na sparing.',
      options: [
        ...opponents.map((o) => ({ id: o, label: `${pl(o)} (siła ${Math.round(eloToOvr((hook.phase === 'finals' ? cfg.eloFinals : cfg.eloQualifying)[o] ?? 1700))})` })),
        { id: 'brak', label: 'Bez sparingu – więcej treningu' },
      ],
    };
    if (typeof ans === 'string' && ans !== 'brak') {
      // Sparing kilka dni przed meczem o punkty.
      const friendlyDate = new Date(Date.parse(date) - 3 * 86_400_000).toISOString().slice(0, 10);
      const fake: Extract<EuroHook, { kind: 'match' }> = {
        kind: 'match',
        phase: hook.phase === 'finals' ? 'finals' : 'qualifying',
        fixture: { date: friendlyDate, home: cfg.team, away: ans, neutral: hook.phase === 'finals' && cfg.team !== 'France', stage: 'TOW' },
        context: { neutral: false, importance: 10 },
        teams: hook.teams,
      };
      const res = yield* playUserMatch(state, cfg, rng, fake, true);
      yield* afterMatch(state, cfg, fake, res, true);
    } else {
      for (const id of state.calledUp) state.status.get(id)!.form += 1;
    }
  }

  // Konferencja prasowa.
  const opp = hook.fixture.home === cfg.team ? hook.fixture.away : hook.fixture.home;
  const q = rng.pick(PRESS_QUESTIONS.filter((x) => x.applies?.(state) ?? true));
  const ans = yield { kind: 'choice', title: 'Konferencja prasowa', text: q.text(state, { opponent: pl(opp) }), options: q.answers.map(({ effect: _e, ...o }) => o) };
  const a = q.answers.find((x) => x.id === ans) ?? q.answers[0]!;
  applyEffect(state, a.effect);
  yield { kind: 'info', title: 'Po konferencji', lines: [a.effect.text, `Nastroje mediów: ${state.media}/100.`] };
}

/** Upływ czasu między oknami: leczenie kontuzji, forma w klubach, nowe urazy. */
function passTime(state: CareerState, rng: Rng, days: number): string[] {
  const lines: string[] = [];
  const fitness = state.staff.fitness.rating;
  const recovered: string[] = [];
  const injured: string[] = [];
  const hot: { name: string; form: number }[] = [];
  for (const [id, st] of state.status) {
    const p = state.pool.get(id)!;
    if (st.injuryDays > 0) {
      st.injuryDays = Math.max(0, st.injuryDays - days);
      if (st.injuryDays === 0) recovered.push(p.name);
    }
    // Forma w klubie: błądzenie losowe, mniejsze wahania u regularnych.
    const sd = 7 * (1.3 - p.personality.consistency / 100) * Math.min(1, days / 30 + 0.3);
    st.form = clamp(Math.round(st.form * 0.5 + rng.normal(0, sd)), -20, 20);
    st.condition = 100;
    if (st.form >= 10) hot.push({ name: p.name, form: st.form });
    // Kontuzje w klubie: ok. 6% na miesiąc, zależnie od podatności i trenera przygotowania.
    // Moment urazu losowy w trakcie przerwy – liczy się tylko to, co trwa jeszcze w dniu zgrupowania.
    const p30 = 0.06 * (0.5 + p.personality.injuryProneness / 100) * (1.25 - fitness / 200);
    if (st.injuryDays === 0 && days > 0 && rng.chance(1 - Math.pow(1 - p30, days / 30))) {
      const inj = rollInjury(rng);
      const remaining = inj.days - rng.int(0, days);
      if (remaining > 3) {
        st.injuryDays = remaining;
        st.injuryType = inj.type;
        injured.push(`${p.name} (${inj.type.toLowerCase()}, jeszcze ok. ${remaining} dni)`);
      }
    }
    // Morale wraca powoli do neutralnego.
    st.morale = Math.round(st.morale + (60 - st.morale) * 0.15);
  }
  if (injured.length) lines.push(`Kontuzje w klubach: ${injured.join(', ')}.`);
  else lines.push('Brak nowych kontuzji w klubach.');
  if (recovered.length) lines.push(`Wrócili do zdrowia: ${recovered.join(', ')}.`);
  const top = hot.sort((a, b) => b.form - a.form).slice(0, 4);
  if (top.length) lines.push(`W świetnej formie: ${top.map((h) => h.name).join(', ')}.`);
  const cold = [...state.status].filter(([, st]) => st.form <= -10).map(([id]) => state.pool.get(id)!.name).slice(0, 4);
  if (cold.length) lines.push(`Wyraźnie bez formy: ${cold.join(', ')}.`);
  return lines;
}

function applyEffect(state: CareerState, e: { trust?: number; media?: number; morale?: number; playerMorale?: number; playerForm?: number }, playerId?: string) {
  state.trust = clamp(state.trust + (e.trust ?? 0), 0, 100);
  state.media = clamp(state.media + (e.media ?? 0), 0, 100);
  if (e.morale) for (const st of state.status.values()) st.morale = clamp(st.morale + e.morale, 0, 100);
  if (playerId) {
    const st = state.status.get(playerId);
    if (st) {
      st.morale = clamp(st.morale + (e.playerMorale ?? 0), 0, 100);
      st.form = clamp(st.form + (e.playerForm ?? 0), -20, 20);
    }
  }
}

function available(state: CareerState, id: string, competitive: boolean) {
  const st = state.status.get(id)!;
  return st.injuryDays === 0 && (!competitive || st.suspended === 0);
}

function bestPositionRating(p: Player): { pos: Position; rating: number } {
  let best: { pos: Position; rating: number } = { pos: 'MC', rating: 0 };
  for (const [pos, fam] of Object.entries(p.positions) as [Position, number][]) {
    const r = positionRating(p.attributes, pos, fam);
    if (r > best.rating) best = { pos, rating: r };
  }
  return best;
}

function row(state: CareerState, p: Player): PlayerRow {
  const st = state.status.get(p.id)!;
  const best = bestPositionRating(p);
  const flags: string[] = [];
  if (st.injuryDays > 0) flags.push(`kontuzja ${st.injuryDays} dni`);
  if (st.suspended > 0) flags.push('zawieszony');
  if (st.yellows > 0) flags.push(`${st.yellows}× żółta`);
  return {
    id: p.id,
    name: p.name,
    position: best.pos,
    positionsLabel: Object.entries(p.positions).filter(([, f]) => (f ?? 0) >= 85).map(([pos]) => POSITION_LABEL[pos as Position]).join('/'),
    age: p.age,
    rating: best.rating,
    form: st.form,
    morale: st.morale,
    club: state.clubs.get(p.id) ?? '',
    caps: st.careerCaps,
    status: flags.join(', '),
    available: st.injuryDays === 0,
  };
}

/** Sugestia asystenta: najlepsi zdrowi z każdej formacji (3 BR, 8 OBR, 8 POM, 4 NAP); słabszy asystent myli się częściej. */
function suggestCallup(state: CareerState, rng: Rng, size: number): string[] {
  const noise = (100 - state.staff.assistant.rating) / 12;
  const scored = [...state.pool.values()]
    .filter((p) => state.status.get(p.id)!.injuryDays === 0)
    .map((p) => {
      const st = state.status.get(p.id)!;
      return { p, pos: bestPositionRating(p).pos, score: bestPositionRating(p).rating + st.form * 0.3 + rng.normal(0, noise) };
    })
    .sort((a, b) => b.score - a.score);
  const group = (pos: Position) => (pos === 'GK' ? 'GK' : ['DC', 'DL', 'DR', 'WBL', 'WBR'].includes(pos) ? 'DF' : pos === 'ST' ? 'FW' : 'MF');
  const quota: Record<string, number> = { GK: 3, DF: 8, MF: 8, FW: 4 };
  const chosen: string[] = [];
  for (const s of scored) if (quota[group(s.pos)]! > 0) { quota[group(s.pos)]!--; chosen.push(s.p.id); }
  for (const s of scored) if (chosen.length < size && !chosen.includes(s.p.id)) chosen.push(s.p.id);
  return chosen.slice(0, size);
}

function friendlyOptions(cfg: CareerConfig, hook: Extract<EuroHook, { kind: 'match' }>, rng: Rng): string[] {
  // Okna z jednym meczem o punkty w rzeczywistości: listopad 2014, marzec 2015, czerwiec 2015; plus przed Euro.
  const d = hook.fixture.date;
  const single = ['2014-11', '2015-03', '2015-06'].some((m) => d.startsWith(m));
  if (!single && hook.phase !== 'finals') return [];
  const elo = hook.phase === 'finals' ? cfg.eloFinals : cfg.eloQualifying;
  const own = elo[cfg.team] ?? 1700;
  const others = Object.keys(elo).filter((t) => t !== cfg.team);
  const pickNear = (lo: number, hi: number) => {
    const c = others.filter((t) => (elo[t] ?? 0) - own >= lo && (elo[t] ?? 0) - own < hi);
    return c.length ? rng.pick(c) : undefined;
  };
  return [pickNear(100, 600), pickNear(-80, 80), pickNear(-600, -120)].filter((x): x is string => !!x);
}

// ---------------------------------------------------------------------------
// Mecz gracza: skład, mecz na żywo
// ---------------------------------------------------------------------------

function* playUserMatch(
  state: CareerState,
  cfg: CareerConfig,
  rng: Rng,
  hook: Extract<EuroHook, { kind: 'match' }>,
  friendly = false,
): Generator<Decision, MatchResult, Answer> {
  const f = hook.fixture;
  const userSide: Side = f.home === cfg.team ? 'home' : 'away';
  const oppName = userSide === 'home' ? f.away : f.home;
  const opponent = hook.teams.get(oppName);
  if (!opponent) throw new Error(`Brak kadry rywala: ${oppName}`);
  const competitive = !friendly;

  // Skład: sugestia asystenta, potem zmiany gracza.
  let input = buildUserInput(state, competitive);
  for (;;) {
    const report = scoutingReport(state, opponent, oppName, cfg, hook);
    const answer = yield {
      kind: 'lineup',
      title: `${friendly ? 'Mecz towarzyski' : phaseLabel(hook.phase)}: ${pl(f.home)} – ${pl(f.away)}${isDate(f.date) ? ` (${formatDate(f.date)})` : ''}`,
      formation: state.formation,
      style: state.style,
      starters: input.starters.map((s) => ({ ...row(state, s.player), slot: s.position, rating: positionRating(s.player.attributes, s.position, s.player.positions[s.position] ?? 0) })),
      bench: input.bench.map((p) => row(state, p)),
      report,
    };
    const action = (answer ?? { type: 'accept' }) as LineupAction;
    if (action.type === 'accept') break;
    if (action.type === 'formation') {
      state.formation = action.formation;
      input = buildUserInput(state, competitive);
    } else if (action.type === 'style') {
      state.style = action.style;
      input = { ...input, tactics: styleTactics(state.formation, state.style) };
    } else if (action.type === 'swap') {
      input = swapStarter(input, action.outId, action.inId);
    }
  }

  // Mecz na żywo.
  const ctx = {
    seed: rng.int(0, 2 ** 31),
    home: userSide === 'home' ? input : opponent,
    away: userSide === 'away' ? input : opponent,
    ...hook.context,
    importance: friendly ? 10 : hook.context.importance,
    referee: { name: 'Sędzia', strictness: rng.int(30, 75), penaltyTendency: rng.int(30, 70) },
  };
  const match = startMatch(ctx, { manualSides: [userSide] });
  yield* liveMatch(state, match, userSide, f.home, f.away);
  return getResult(match);
}

function buildUserInput(state: CareerState, competitive: boolean): MatchTeamInput {
  const ids = state.calledUp.filter((id) => available(state, id, competitive));
  const players = ids.map((id) => state.pool.get(id)!).filter(Boolean);
  const input = buildTeamInput(state.code, state.teamPl, state.code, players, styleTactics(state.formation, state.style), 12);
  input.condition = Object.fromEntries(ids.map((id) => [id, state.status.get(id)!.condition]));
  // Forma i morale działają razem na dyspozycję w meczu.
  input.form = Object.fromEntries(ids.map((id) => {
    const st = state.status.get(id)!;
    return [id, clamp(st.form + (st.morale - 60) / 5, -20, 20)];
  }));
  return input;
}

function swapStarter(input: MatchTeamInput, outId: string, inId: string): MatchTeamInput {
  const idx = input.starters.findIndex((s) => s.player.id === outId);
  const inPlayer = input.bench.find((p) => p.id === inId);
  if (idx < 0 || !inPlayer) return input;
  const outPlayer = input.starters[idx]!.player;
  const starters = input.starters.map((s, i) => (i === idx ? { ...s, player: inPlayer } : s));
  const bench = input.bench.map((p) => (p.id === inId ? outPlayer : p));
  return { ...input, starters, bench };
}

function scoutingReport(state: CareerState, opp: MatchTeamInput, oppName: string, cfg: CareerConfig, hook: Extract<EuroHook, { kind: 'match' }>): string[] {
  const analyst = state.staff.analyst.rating;
  const ovr = (t: MatchTeamInput) => t.starters.reduce((s, x) => s + positionRating(x.player.attributes, x.position, x.player.positions[x.position] ?? 0), 0) / 11;
  const own = buildUserInput(state, hook.fixture.stage !== 'TOW');
  const diff = ovr(own) - ovr(opp);
  const lines = [`Analityk ${state.staff.analyst.name}:`];
  lines.push(`Rywal (${pl(oppName)}) gra ${opp.tactics.formation}. ${diff > 3 ? 'Jesteśmy faworytem.' : diff < -3 ? 'Rywal jest mocniejszy.' : 'Siły wyrównane.'}`);
  if (analyst >= 60) {
    const stars = [...opp.starters].sort((a, b) => positionRating(b.player.attributes, b.position, 100) - positionRating(a.player.attributes, a.position, 100)).slice(0, analyst >= 80 ? 3 : 2);
    lines.push(`Najgroźniejsi: ${stars.map((s) => `${s.player.shortName} (${POSITION_LABEL[s.position]})`).join(', ')}.`);
  }
  if (analyst >= 80) {
    const pace = opp.starters.filter((s) => ['DC', 'DL', 'DR'].includes(s.position)).reduce((a, s) => a + s.player.attributes.pace, 0) / 4;
    lines.push(pace < 60 ? 'Ich obrona jest wolna – warto grać za linię (kontratak, bezpośrednio).' : 'Szybka obrona rywala – lepiej budować akcje cierpliwie.');
  }
  return lines;
}

const DECISION_MINUTES = [60, 70, 80];

function* liveMatch(state: CareerState, match: MatchState, userSide: Side, home: string, away: string): Generator<Decision, void, Answer> {
  const names = {
    player: (id: string) => playerName(state, match, id),
    team: (side: Side) => pl(side === 'home' ? home : away),
  };
  let buffer: string[] = [];
  let toEnd = false;
  let lastStop = -1;
  const userTeam = () => match.teams[userSide];

  while (!match.finished) {
    const events = stepMinute(match);
    let stop = false;
    for (const e of events) {
      const line = describeEvent(e, names, match.tick);
      if (line) buffer.push(`${minuteLabel(e).padStart(6)}  ${line}`);
      if (isUserMoment(e, userSide)) stop = true;
    }
    const minute = match.minute;
    if (DECISION_MINUTES.includes(minute) && match.added === 0 && lastStop !== minute) stop = true;
    if (events.some((e) => e.kind === 'period' && (e.period === 'halftime' || e.period === 'extraTimeStart'))) stop = true;
    if (match.finished || toEnd || !stop) continue;
    lastStop = minute;

    for (;;) {
      const team = userTeam();
      const answer = yield {
        kind: 'live',
        title: `${pl(home)} – ${pl(away)}`,
        minuteLabel: match.added ? `${match.minute}+${match.added}'` : `${match.minute}'`,
        score: [...match.score] as [number, number],
        lines: buffer,
        onPitch: team.active.map((ps) => ({ ...row(state, ps.player), slot: ps.position, condition: Math.round(ps.condition) })),
        bench: team.bench.map((p) => row(state, p)),
        subsLeft: (match.ctx.maxSubs ?? 3) - team.subsUsed,
        style: state.style,
        advice: assistantAdvice(state, match, userSide),
      };
      buffer = [];
      const action = (answer ?? { type: 'continue' }) as LiveAction;
      if (action.type === 'continue') break;
      if (action.type === 'toEnd') {
        toEnd = true;
        break;
      }
      if (action.type === 'style') {
        state.style = action.style;
        setTactics(match, userSide, styleTactics(team.tactics.formation, action.style));
        buffer.push(`        Zmiana stylu: ${STYLE_PRESETS[action.style].label}.`);
      }
      if (action.type === 'sub') {
        const err = makeSubstitution(match, userSide, action.outId, action.inId);
        buffer.push(err ? `        ${err}` : `        🔄 ${names.player(action.inId)} za ${names.player(action.outId)}`);
      }
    }
  }
  // Końcówka relacji (gdy gracz przewinął do końca albo mecz się skończył).
  const result = getResult(match);
  const tail = buffer.length ? buffer : [];
  state.lastEvents = result.events;
  if (tail.length) yield { kind: 'info', title: `${pl(home)} – ${pl(away)}`, lines: tail };
}

function isUserMoment(e: MatchEvent, userSide: Side): boolean {
  if (e.kind === 'goal') return true;
  if (e.kind === 'card' && e.card !== 'yellow') return true;
  if (e.kind === 'injury' && e.side === userSide) return true;
  return false;
}

function playerName(state: CareerState, match: MatchState, id: string): string {
  const own = state.pool.get(id);
  if (own) return own.shortName;
  for (const t of [match.teams.home, match.teams.away]) {
    const p = [...t.all.map((x) => x.player), ...t.bench].find((x) => x.id === id);
    if (p) return p.shortName;
  }
  return id;
}

function assistantAdvice(state: CareerState, match: MatchState, side: Side): string | undefined {
  const team = match.teams[side];
  const tired = team.active.filter((ps) => ps.position !== 'GK' && ps.condition < 68).map((ps) => ps.player.shortName);
  const own = match.score[side === 'home' ? 0 : 1];
  const opp = match.score[side === 'home' ? 1 : 0];
  const parts: string[] = [];
  if (tired.length && state.staff.assistant.rating >= 55) parts.push(`zmęczeni: ${tired.join(', ')}`);
  if (match.minute >= 60 && own < opp) parts.push('przegrywamy – może bardziej ofensywnie?');
  if (match.minute >= 75 && own > opp) parts.push('prowadzimy – można zagrać bardziej defensywnie');
  return parts.length ? `Asystent: ${parts.join('; ')}.` : undefined;
}

// ---------------------------------------------------------------------------
// Po meczu: statystyki, kartki, kontuzje, forma, media, zaufanie
// ---------------------------------------------------------------------------

function* afterMatch(state: CareerState, cfg: CareerConfig, hook: Extract<EuroHook, { kind: 'match' }>, result: MatchResult, friendly = false): Generator<Decision, void, Answer> {
  const f = hook.fixture;
  const side: Side = f.home === cfg.team ? 'home' : 'away';
  const own = result.score[side === 'home' ? 0 : 1];
  const opp = result.score[side === 'home' ? 1 : 0];
  const oppName = side === 'home' ? f.away : f.home;
  if (isDate(f.date)) state.lastMatchDate = f.date;
  if (isDate(f.date)) state.date = f.date;

  const r = state.record;
  r.played++;
  r.goalsFor += own;
  r.goalsAgainst += opp;
  if (own > opp) r.won++;
  else if (own === opp) r.drawn++;
  else r.lost++;

  // Zawodnicy: występy, gole, kartki, kontuzje, kondycja, forma z oceny.
  const finals = hook.phase === 'finals' || hook.phase === 'knockout';
  const lines: string[] = [];
  // Zawieszeni w tym meczu pauzowali: kara odbyta (niezależnie od powołania). Sparingi się nie liczą.
  if (!friendly) for (const st of state.status.values()) if (st.suspended > 0) st.suspended--;
  for (const p of result.players.filter((x) => x.side === side)) {
    const st = state.status.get(p.playerId);
    if (!st) continue;
    st.careerCaps++;
    st.careerGoals += p.goals;
    st.condition = Math.min(100, p.condition + 25);
    st.form = clamp(Math.round(st.form * 0.7 + (p.rating - 6.5) * 6), -20, 20);
    st.morale = clamp(st.morale + (own > opp ? 4 : own < opp ? -4 : 0) + (p.rating >= 7.5 ? 3 : 0), 0, 100);
    if (!friendly) {
      st.yellows += p.yellow - p.red; // druga żółta liczona jako czerwona
      if (p.red > 0) {
        st.suspended += 1;
        lines.push(`🟥 ${state.pool.get(p.playerId)?.name} pauzuje w następnym meczu.`);
      } else if (p.yellow > 0 && yellowBan(st.yellows, finals)) {
        st.suspended += 1;
        lines.push(`🟨 ${state.pool.get(p.playerId)?.name}: ${st.yellows}. żółta kartka – pauza w następnym meczu.`);
      }
    }
  }
  for (const e of result.events) {
    if (e.kind !== 'injury' || e.side !== side) continue;
    const st = state.status.get(e.playerId);
    if (!st || e.injury.days <= 0) continue;
    st.injuryDays = Math.max(st.injuryDays, Math.round(e.injury.days * (1.15 - state.staff.fitness.rating / 400)));
    st.injuryType = e.injury.type;
    lines.push(`🚑 ${state.pool.get(e.playerId)?.name}: ${e.injury.type.toLowerCase()}, ok. ${st.injuryDays} dni przerwy.`);
  }
  // Kartki w turnieju kasowane po ćwierćfinale.
  if (hook.phase === 'knockout' && f.stage >= 'M45' && f.stage <= 'M48') for (const st of state.status.values()) st.yellows = 0;

  // Zaufanie federacji: wynik względem oczekiwań (Elo).
  const elo = finals ? cfg.eloFinals : cfg.eloQualifying;
  const we = expectedScore(elo[f.home] ?? 1700, elo[f.away] ?? 1700, f.neutral);
  const expected = side === 'home' ? we : 1 - we;
  const actual = own > opp ? 1 : own === opp ? 0.5 : 0;
  const weight = friendly ? 3 : finals ? 12 : 8;
  const dTrust = Math.round(weight * (actual - expected));
  state.trust = clamp(state.trust + dTrust, 0, 100);
  state.media = clamp(state.media + Math.round(dTrust * 0.8), 0, 100);

  // Media.
  const best = result.players.filter((p) => p.side === side).sort((a, b) => b.rating - a.rating)[0];
  const bestName = best ? state.pool.get(best.playerId)?.shortName ?? '' : '';
  const headline = makeHeadline(state, oppName, own, opp, actual - expected, bestName, friendly);
  state.headlines.push(headline);

  const ratings = result.players
    .filter((p) => p.side === side)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
    .map((p) => `${state.pool.get(p.playerId)?.shortName} ${p.rating.toFixed(1)}`);
  const s = result.stats[side];
  const o = result.stats[side === 'home' ? 'away' : 'home'];
  yield {
    kind: 'info',
    title: `Po meczu: ${pl(f.home)} ${result.score[0]}:${result.score[1]} ${pl(f.away)}${result.shootout ? ` (k. ${result.shootout.home}:${result.shootout.away})` : result.extraTime ? ' (dogr.)' : ''}`,
    lines: [
      `Posiadanie ${s.possession}% · strzały ${s.shots}:${o.shots} · celne ${s.shotsOnTarget}:${o.shotsOnTarget} · xG ${s.xg.toFixed(2)}:${o.xg.toFixed(2)}`,
      `Najlepsi: ${ratings.join(', ')}`,
      ...lines,
      `📰 ${outlet(state.team)}: „${headline}”`,
      `Zaufanie federacji: ${state.trust}/100 (${dTrust >= 0 ? '+' : ''}${dTrust}) · media: ${state.media}/100`,
    ],
  };
}

/** Zawieszenie za żółte: eliminacje – 3., 5., 7.…; turniej – 2., 4.… */
function yellowBan(yellows: number, finals: boolean) {
  return finals ? yellows >= 2 && yellows % 2 === 0 : yellows >= 3 && yellows % 2 === 1;
}

/**
 * Nagłówek po meczu. `surprise` = wynik (1 / 0,5 / 0) minus oczekiwany wynik z Elo:
 * wygrana przy oczekiwanych 25% to +0,75, porażka przy oczekiwanych 80% to −0,8.
 */
function makeHeadline(state: CareerState, opp: string, own: number, against: number, surprise: number, best: string, friendly: boolean): string {
  const z = plWith(opp);
  const acc = plAcc(opp);
  if (friendly) return own > against ? `Udany sprawdzian z ${z}` : own === against ? `Remis w sparingu z ${z}` : `Sparing z ${z} do zapomnienia`;
  if (own > against && surprise > 0.65) return `SENSACJA! ${state.teamPl} pokonuje ${acc}!`;
  if (own > against && own - against >= 3) return `Pogrom! ${best} prowadzi drużynę do wysokiej wygranej z ${z}`;
  if (own > against) return `${best} bohaterem, wygrana z ${z}`;
  if (own === against && surprise > 0.15) return `Cenny remis z ${z}`;
  if (own === against && surprise > -0.15) return `Remis z ${z}, bez fajerwerków`;
  if (own === against) return `Tylko remis z ${z}. Kibice rozczarowani`;
  if (surprise < -0.55) return `Kompromitacja! ${state.teamPl} przegrywa z ${z}`;
  if (surprise > -0.3) return `Porażka z ${z}, ale bez wstydu`;
  return `Porażka z ${z}. Selekcjoner pod ostrzałem`;
}

function phaseLabel(phase: Phase): string {
  return { qualifying: 'Eliminacje Euro 2016', playoff: 'Baraż o Euro 2016', finals: 'Euro 2016 – faza grupowa', knockout: 'Euro 2016 – faza pucharowa' }[phase];
}

/** Mecz gracza, gdy kariera się skończyła (zwolnienie / odpadnięcie): zwykła symulacja. */
function simulateAi(hook: Extract<EuroHook, { kind: 'match' }>, _cfg: CareerConfig, rng: Rng): MatchResult {
  const home = hook.teams.get(hook.fixture.home)!;
  const away = hook.teams.get(hook.fixture.away)!;
  return getResultQuick({ seed: rng.int(0, 2 ** 31), home, away, ...hook.context });
}

function getResultQuick(ctx: Parameters<typeof startMatch>[0]): MatchResult {
  const m = startMatch(ctx);
  while (!m.finished) stepMinute(m);
  return getResult(m);
}

// ---------------------------------------------------------------------------
// Pomocnicze: tabele, daty, podsumowanie
// ---------------------------------------------------------------------------

function formatTable(rows: { team: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number }[], user: string): string[] {
  return rows.map((r, i) => {
    const name = r.team === user ? `▶ ${pl(r.team)}` : `  ${pl(r.team)}`;
    return `${i + 1}. ${name.padEnd(24)} ${r.played} ${r.won}-${r.drawn}-${r.lost}  ${r.goalsFor}:${r.goalsAgainst}  ${r.points} pkt`;
  });
}

const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

const STAGE_LABEL: Record<Stage | 'sacked', string> = {
  qualifyingGroup: 'odpadnięcie w eliminacjach', playoff: 'porażka w barażach', finalsGroup: 'faza grupowa Euro',
  R16: '1/8 finału Euro', QF: 'ćwierćfinał Euro', SF: 'półfinał Euro', final: 'finał Euro', champion: 'MISTRZOSTWO EUROPY', sacked: 'zwolnienie',
};

function summaryDecision(state: CareerState, run: EuroRun, stage: Stage | 'sacked', cfg: CareerConfig): Decision {
  const r = state.record;
  const scorers = [...state.status]
    .filter(([, st]) => st.careerGoals > 0)
    .sort((a, b) => b[1].careerGoals - a[1].careerGoals)
    .slice(0, 3)
    .map(([id, st]) => `${state.pool.get(id)?.name} ${st.careerGoals}`);
  // Cel turniejowy: faworyt grupy – ćwierćfinał, średniak – 1/8, outsider – sam udział i walka.
  let goalMet = state.goalMet;
  if (stage !== 'sacked' && STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf('finalsGroup')) {
    const target: Stage = state.expectation.maxPosition === 1 ? 'QF' : state.expectation.maxPosition <= 3 ? 'R16' : 'finalsGroup';
    goalMet = STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(target);
  }
  const verdict = stage === 'sacked'
    ? 'Federacja zakończyła współpracę przed czasem.'
    : goalMet
      ? state.trust >= 50
        ? 'Cel osiągnięty. Federacja proponuje przedłużenie kontraktu na eliminacje MŚ 2018.'
        : 'Cel osiągnięty, ale relacje z federacją są napięte. Krótki kontrakt i pełna kontrola.'
      : state.trust >= 85
        ? 'Cel nie został osiągnięty, ale federacja daje drugą szansę.'
        : 'Cel nie został osiągnięty. Federacja dziękuje za współpracę, kontrakt nie zostanie przedłużony.';
  const real = cfg.team;
  return {
    kind: 'info',
    title: 'Podsumowanie kadencji',
    lines: [
      `${state.teamPl}: ${STAGE_LABEL[stage]}.`,
      `Bilans: ${r.played} meczów, ${r.won}-${r.drawn}-${r.lost}, bramki ${r.goalsFor}:${r.goalsAgainst}.`,
      scorers.length ? `Najlepsi strzelcy: ${scorers.join(', ')}.` : 'Brak strzelców.',
      `Zaufanie federacji na koniec: ${state.trust}/100. ${verdict}`,
      `Mistrz Europy 2016 w tym świecie: ${pl(run.champion)}.`,
      `Naprawdę: Portugalia. Twoja drużyna naprawdę: ${REAL_RESULT[real] ?? 'nie zagrała na Euro'}.`,
    ],
  };
}

const REAL_RESULT: Record<string, string> = {
  Portugal: 'mistrzostwo', France: 'finał', Germany: 'półfinał', Wales: 'półfinał', Poland: 'ćwierćfinał', Belgium: 'ćwierćfinał',
  Italy: 'ćwierćfinał', Iceland: 'ćwierćfinał', Switzerland: '1/8 finału', Croatia: '1/8 finału', 'Northern Ireland': '1/8 finału',
  Slovakia: '1/8 finału', Hungary: '1/8 finału', England: '1/8 finału', Spain: '1/8 finału', 'Republic of Ireland': '1/8 finału',
  Albania: 'faza grupowa', Romania: 'faza grupowa', Russia: 'faza grupowa', Ukraine: 'faza grupowa', Turkey: 'faza grupowa',
  'Czech Republic': 'faza grupowa', Sweden: 'faza grupowa', Austria: 'faza grupowa',
  'Bosnia and Herzegovina': 'porażka w barażach', Denmark: 'porażka w barażach', Norway: 'porażka w barażach', Slovenia: 'porażka w barażach',
};

export { STAGE_ORDER };
