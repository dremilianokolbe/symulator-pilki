/**
 * Silnik meczu v1.
 *
 * Symulacja minuta po minucie: siły formacji (kontrola, kreowanie, obrona, pressing, gra w powietrzu,
 * szybkość) wynikają z atrybutów zawodników na boisku, ich znajomości pozycji, kondycji i formy,
 * a taktyka i warunki meczu je modyfikują. Z sił wynika posiadanie i liczba groźnych akcji;
 * z akcji – strzały z xG; ze strzału – gol albo nie, zależnie od strzelca i bramkarza.
 *
 * API krokowe (startMatch → stepMinute → getResult) służy do meczu na żywo;
 * simulateMatch robi wszystko naraz (Monte Carlo, symulacja w tle).
 */
import {
  type Attr,
  type Attributes,
  type Position,
  familiarityFactor,
  positionRating,
  weightedAverage,
} from './attributes';
import { rollInjury } from './injuries';
import { DEFAULT_PARAMS, type EngineParams } from './params';
import { createRng, type Rng } from './rng';
import {
  FORMATIONS,
  type MatchContext,
  type MatchEvent,
  type MatchResult,
  type MatchTeamInput,
  type Player,
  type PlayerMatchStats,
  type ShotKind,
  type Side,
  type Tactics,
  type TeamStats,
} from './types';

// ---------------------------------------------------------------------------
// Role pozycji w poszczególnych „jednostkach” siły drużyny
// ---------------------------------------------------------------------------

type RoleTable = Partial<Record<Position, number>>;

const CONTROL_ROLE: RoleTable = { GK: 0.15, DC: 0.45, DL: 0.55, DR: 0.55, WBL: 0.6, WBR: 0.6, DM: 1, MC: 1, ML: 0.7, MR: 0.7, AMC: 0.9, AML: 0.6, AMR: 0.6, ST: 0.35 };
const CREATION_ROLE: RoleTable = { DC: 0.1, DL: 0.3, DR: 0.3, WBL: 0.5, WBR: 0.5, DM: 0.35, MC: 0.6, ML: 0.7, MR: 0.7, AMC: 1, AML: 1, AMR: 1, ST: 0.85 };
const DEFENCE_ROLE: RoleTable = { DC: 1, DL: 0.8, DR: 0.8, WBL: 0.65, WBR: 0.65, DM: 0.85, MC: 0.45, ML: 0.35, MR: 0.35, AMC: 0.15, AML: 0.2, AMR: 0.2, ST: 0.1 };
const PRESS_ROLE: RoleTable = { DC: 0.5, DL: 0.8, DR: 0.8, WBL: 0.9, WBR: 0.9, DM: 0.9, MC: 1, ML: 1, MR: 1, AMC: 1, AML: 1, AMR: 1, ST: 1 };
const WIDE_ROLE: RoleTable = { DL: 0.5, DR: 0.5, WBL: 1, WBR: 1, ML: 1, MR: 1, AML: 0.9, AMR: 0.9 };
const ATTACKER_ROLE: RoleTable = { ST: 1, AML: 1, AMR: 1, AMC: 0.9, ML: 0.6, MR: 0.6, MC: 0.3, WBL: 0.3, WBR: 0.3 };
const PACE_DEF_ROLE: RoleTable = { DC: 1, DL: 0.7, DR: 0.7, WBL: 0.6, WBR: 0.6, DM: 0.3 };
const AERIAL_DEF_ROLE: RoleTable = { DC: 1, DL: 0.5, DR: 0.5, WBL: 0.4, WBR: 0.4, DM: 0.6, MC: 0.3, ST: 0.3 };
const SHOT_ROLE: RoleTable = { DC: 0.05, DL: 0.08, DR: 0.08, WBL: 0.12, WBR: 0.12, DM: 0.12, MC: 0.3, ML: 0.35, MR: 0.35, AMC: 0.7, AML: 0.65, AMR: 0.65, ST: 1 };
const LONGSHOT_ROLE: RoleTable = { DC: 0.1, DL: 0.25, DR: 0.25, WBL: 0.3, WBR: 0.3, DM: 0.6, MC: 1, ML: 0.6, MR: 0.6, AMC: 1, AML: 0.8, AMR: 0.8, ST: 0.5 };
const HEADER_ROLE: RoleTable = { DC: 0.25, DL: 0.1, DR: 0.1, WBL: 0.12, WBR: 0.12, DM: 0.2, MC: 0.3, ML: 0.25, MR: 0.25, AMC: 0.4, AML: 0.35, AMR: 0.35, ST: 1 };
const SETPIECE_HEADER_ROLE: RoleTable = { DC: 1, DL: 0.3, DR: 0.3, WBL: 0.3, WBR: 0.3, DM: 0.5, MC: 0.4, ML: 0.3, MR: 0.3, AMC: 0.3, AML: 0.2, AMR: 0.2, ST: 0.9 };
const CREATOR_ROLE: RoleTable = { DL: 0.3, DR: 0.3, WBL: 0.5, WBR: 0.5, DM: 0.4, MC: 0.8, ML: 0.8, MR: 0.8, AMC: 1, AML: 0.9, AMR: 0.9, ST: 0.6 };

type Weights = Partial<Record<Attr, number>>;

const CONTROL_W: Weights = { passing: 3, firstTouch: 2, technique: 2, decisions: 2, teamwork: 2, vision: 1, composure: 1 };
const CREATION_W: Weights = { vision: 3, passing: 2, dribbling: 2, offTheBall: 2, flair: 1, technique: 1, agility: 1, acceleration: 1 };
const DEFENCE_W: Weights = { tackling: 3, marking: 3, positioning: 3, anticipation: 2, concentration: 1, strength: 1, pace: 1, bravery: 1, decisions: 1, aggression: 0.5 };
const PRESS_W: Weights = { workRate: 3, teamwork: 2, stamina: 1, aggression: 1, pace: 1, acceleration: 1 };
const AERIAL_ATT_W: Weights = { heading: 3, jumping: 2, strength: 1, bravery: 1 };
const AERIAL_DEF_W: Weights = { heading: 2, jumping: 2, strength: 1, marking: 2, positioning: 1 };
const PACE_W: Weights = { pace: 2, acceleration: 1 };
const DRIBBLE_W: Weights = { dribbling: 3, agility: 1, flair: 1, acceleration: 1 };
const CROSS_W: Weights = { crossing: 1 };
const LONGSHOT_W: Weights = { longShots: 1 };
const GK_SHOT_W: Weights = { reflexes: 3, handling: 2, oneOnOnes: 2, positioning: 2, agility: 1, concentration: 1 };
const GK_AIR_W: Weights = { aerialReach: 2, commandOfArea: 2, handling: 1 };

const FINISH_W: Weights = { finishing: 3, composure: 1, firstTouch: 1, technique: 0.5 };
const BIG_CHANCE_W: Weights = { finishing: 3, composure: 2, firstTouch: 1 };
const HEADER_FINISH_W: Weights = { heading: 3, jumping: 1, strength: 1 };
const LONG_FINISH_W: Weights = { longShots: 2, technique: 1 };
const FREEKICK_W: Weights = { freeKicks: 2, technique: 1 };

const SHOT_PROB: Record<'open' | 'through' | 'cross' | 'solo' | 'long' | 'counter', number> = {
  open: 0.5, through: 0.55, cross: 0.42, solo: 0.5, long: 1, counter: 0.6,
};
const XG_MEAN: Record<ShotKind, number> = {
  open: 0.095, through: 0.21, cross: 0.085, solo: 0.12, long: 0.035, counter: 0.19,
  corner: 0.08, freeKick: 0.065, penalty: 0.76,
};
const BLOCK_PROB: Record<ShotKind, number> = {
  open: 0.28, through: 0.1, cross: 0.1, solo: 0.25, long: 0.35, counter: 0.12,
  corner: 0.15, freeKick: 0.3, penalty: 0,
};

/** Pamięć podręczna średnich ważonych: atrybuty zawodnika są niezmienne (edycja tworzy nowy obiekt). */
const avgCache = new WeakMap<Attributes, Map<Weights, number>>();
function avg(attrs: Attributes, w: Weights): number {
  let m = avgCache.get(attrs);
  if (!m) {
    m = new Map();
    avgCache.set(attrs, m);
  }
  let v = m.get(w);
  if (v === undefined) {
    v = weightedAverage(attrs, w);
    m.set(w, v);
  }
  return v;
}

const PENALTY_W: Weights = { penalties: 2, composure: 1 };

// ---------------------------------------------------------------------------
// Stan meczu
// ---------------------------------------------------------------------------

interface PlayerState {
  player: Player;
  side: Side;
  position: Position;
  familiarity: number;
  condition: number;
  formMult: number;
  booked: boolean;
  out: boolean; // zszedł / czerwona / kontuzja
  onTick: number;
  offTick?: number;
  conceded: number;
  stats: Omit<PlayerMatchStats, 'playerId' | 'side' | 'minutes' | 'rating' | 'condition'>;
}

interface Units {
  control: number;
  creation: number;
  defence: number;
  press: number;
  aerialAtt: number;
  aerialDef: number;
  paceAtt: number;
  paceDef: number;
  dribble: number;
  crossing: number;
  longShots: number;
  aggression: number;
  concentration: number;
  gkShot: number;
  gkAir: number;
}

interface TeamState {
  side: Side;
  input: MatchTeamInput;
  tactics: Tactics;
  /** Zawodnicy na boisku. */
  active: PlayerState[];
  /** Wszyscy, którzy zagrali (także zmienieni). */
  all: PlayerState[];
  bench: Player[];
  subsUsed: number;
  units: Units;
  nominal: Record<'control' | 'creation' | 'defence' | 'press', number>;
  stats: TeamStats;
  possessionSum: number;
  shockUntil: number;
  ai: boolean;
  /** Minuty planowanych zmian (AI). */
  subPlan: number[];
}

export interface MatchState {
  ctx: MatchContext;
  params: EngineParams;
  rng: Rng;
  teams: Record<Side, TeamState>;
  events: MatchEvent[];
  score: [number, number];
  scoreAfter90: [number, number];
  period: 1 | 2 | 3 | 4;
  minute: number;
  added: number;
  stoppage: number;
  tick: number;
  started: boolean;
  finished: boolean;
  extraTime: boolean;
  shootout?: { home: number; away: number; winner: Side };
  dirty: boolean;
}

export interface StartOptions {
  params?: EngineParams;
  /** Strony prowadzone przez gracza: silnik nie robi za nie zmian taktycznych (kontuzje nadal tak). */
  manualSides?: Side[];
}

const PERIOD_END: Record<1 | 2 | 3 | 4, number> = { 1: 45, 2: 90, 3: 105, 4: 120 };
const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Suwak 0–100 → -1..1. */
const t = (slider: number) => (clamp(slider, 0, 100) - 50) / 50;

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export function startMatch(ctx: MatchContext, options: StartOptions = {}): MatchState {
  const rng = createRng(ctx.seed);
  const params = options.params ?? DEFAULT_PARAMS;
  const manual = new Set(options.manualSides ?? []);
  const importance = ctx.importance ?? 50;

  const makeTeam = (side: Side, input: MatchTeamInput): TeamState => {
    if (input.starters.length !== 11) {
      throw new Error(`${input.name}: wymagane 11 zawodników w składzie, jest ${input.starters.length}`);
    }
    const all = input.starters.map((s) =>
      makePlayerState(s.player, side, s.position, input, rng, importance, 0),
    );
    const team: TeamState = {
      side,
      input,
      tactics: { ...input.tactics },
      active: [...all],
      all,
      bench: [...input.bench],
      subsUsed: 0,
      units: emptyUnits(),
      nominal: { control: 1, creation: 1, defence: 1, press: 1 },
      stats: emptyTeamStats(),
      possessionSum: 0,
      shockUntil: -1,
      ai: !manual.has(side),
      subPlan: [rng.int(55, 68), rng.int(64, 78), rng.chance(0.85) ? rng.int(74, 88) : 999],
    };
    team.nominal = nominalFor(team.tactics);
    return team;
  };

  const state: MatchState = {
    ctx,
    params,
    rng,
    teams: { home: makeTeam('home', ctx.home), away: makeTeam('away', ctx.away) },
    events: [],
    score: [0, 0],
    scoreAfter90: [0, 0],
    period: 1,
    minute: 1,
    added: 0,
    stoppage: rng.int(1, 3),
    tick: 0,
    started: false,
    finished: false,
    extraTime: false,
    dirty: true,
  };
  return state;
}

function makePlayerState(
  player: Player,
  side: Side,
  position: Position,
  input: MatchTeamInput,
  rng: Rng,
  importance: number,
  tick: number,
): PlayerState {
  const form = input.form?.[player.id] ?? 0;
  const p = player.personality;
  const sd = 0.07 * (1.4 - p.consistency / 100);
  const bigMatch = ((p.bigMatch - 50) / 100) * 0.06 * (importance / 100);
  const formMult = clamp(1 + (form / 100) * 0.5 + rng.normal(0, sd) + bigMatch, 0.75, 1.2);
  return {
    player,
    side,
    position,
    familiarity: player.positions[position] ?? 0,
    condition: input.condition?.[player.id] ?? 100,
    formMult,
    booked: false,
    out: false,
    onTick: tick,
    conceded: 0,
    stats: { goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, keyPasses: 0, tackles: 0, saves: 0, fouls: 0, yellow: 0, red: 0 },
  };
}

function emptyUnits(): Units {
  return {
    control: 0, creation: 0, defence: 0, press: 0, aerialAtt: 0, aerialDef: 0, paceAtt: 0, paceDef: 0,
    dribble: 0, crossing: 0, longShots: 0, aggression: 0, concentration: 0, gkShot: 0, gkAir: 0,
  };
}

function emptyTeamStats(): TeamStats {
  return { goals: 0, xg: 0, shots: 0, shotsOnTarget: 0, possession: 50, corners: 0, fouls: 0, yellow: 0, red: 0, offsides: 0, penalties: 0 };
}

function nominalFor(tactics: Tactics) {
  const slots = FORMATIONS[tactics.formation];
  const sum = (table: RoleTable) => slots.reduce((acc, pos) => acc + (table[pos] ?? 0), 0);
  return { control: sum(CONTROL_ROLE), creation: sum(CREATION_ROLE), defence: sum(DEFENCE_ROLE), press: sum(PRESS_ROLE) };
}

// ---------------------------------------------------------------------------
// Siły drużyny
// ---------------------------------------------------------------------------

function conditionFactor(condition: number): number {
  return condition >= 90 ? 1 : 1 - (90 - condition) * 0.0055;
}

function effectiveness(ps: PlayerState): number {
  return familiarityFactor(ps.familiarity) * conditionFactor(ps.condition) * ps.formMult;
}

function traitMult(ps: PlayerState, unit: 'control' | 'creation'): number {
  const traits = ps.player.traits;
  let m = 1;
  if (unit === 'control') {
    if (traits.includes('playsShortPasses')) m *= 1.05;
    if (traits.includes('triesKillerBalls')) m *= 0.97;
  } else {
    if (traits.includes('triesKillerBalls')) m *= 1.06;
    if (traits.includes('runsWithBall')) m *= 1.03;
    if (traits.includes('getsForward')) m *= 1.1;
    if (traits.includes('staysBack')) m *= 0.85;
  }
  return m;
}

/** Zmniejsza różnice w jakości technicznej (deszcz, zła murawa, śnieg). */
function conditionsCompression(ctx: MatchContext): number {
  let c = 1;
  if (ctx.weather === 'rain') c *= 0.88;
  if (ctx.weather === 'snow') c *= 0.75;
  if (ctx.pitch === 'average') c *= 0.95;
  if (ctx.pitch === 'poor') c *= 0.85;
  return c;
}

function computeUnits(team: TeamState, ctx: MatchContext): Units {
  const active = team.active;
  const sumUnit = (role: RoleTable, w: Weights, nominal: number, trait?: 'control' | 'creation') => {
    let s = 0;
    for (const ps of active) {
      const r = role[ps.position] ?? 0;
      if (r === 0) continue;
      s += r * avg(ps.player.attributes, w) * effectiveness(ps) * (trait ? traitMult(ps, trait) : 1);
    }
    return s / nominal;
  };
  const avgUnit = (role: RoleTable, w: Weights) => {
    let s = 0;
    let n = 0;
    for (const ps of active) {
      const r = role[ps.position] ?? 0;
      if (r === 0) continue;
      s += r * avg(ps.player.attributes, w) * effectiveness(ps);
      n += r;
    }
    return n > 0 ? s / n : 30;
  };
  const gk = active.find((ps) => ps.position === 'GK');
  const gkVal = (w: Weights) => (gk ? avg(gk.player.attributes, w) * effectiveness(gk) : 25);

  const comp = conditionsCompression(ctx);
  const squash = (v: number) => 65 + (v - 65) * comp;

  const outfield = active.filter((ps) => ps.position !== 'GK');
  const mean = (f: (a: Attributes) => number) =>
    outfield.length ? outfield.reduce((acc, ps) => acc + f(ps.player.attributes), 0) / outfield.length : 50;

  return {
    control: squash(sumUnit(CONTROL_ROLE, CONTROL_W, team.nominal.control, 'control')),
    creation: squash(sumUnit(CREATION_ROLE, CREATION_W, team.nominal.creation, 'creation')),
    defence: sumUnit(DEFENCE_ROLE, DEFENCE_W, team.nominal.defence),
    press: sumUnit(PRESS_ROLE, PRESS_W, team.nominal.press),
    aerialAtt: avgUnit(SETPIECE_HEADER_ROLE, AERIAL_ATT_W),
    aerialDef: avgUnit(AERIAL_DEF_ROLE, AERIAL_DEF_W),
    paceAtt: avgUnit(ATTACKER_ROLE, PACE_W),
    paceDef: avgUnit(PACE_DEF_ROLE, PACE_W),
    dribble: squash(avgUnit(ATTACKER_ROLE, DRIBBLE_W)),
    crossing: avgUnit(WIDE_ROLE, CROSS_W),
    longShots: avgUnit(LONGSHOT_ROLE, LONGSHOT_W),
    aggression: mean((a) => a.aggression),
    concentration: mean((a) => a.concentration),
    gkShot: gkVal(GK_SHOT_W),
    gkAir: gkVal(GK_AIR_W),
  };
}

// ---------------------------------------------------------------------------
// Krok symulacji
// ---------------------------------------------------------------------------

/** Rozgrywa jedną minutę. Zwraca zdarzenia, które w niej zaszły. */
export function stepMinute(state: MatchState): MatchEvent[] {
  if (state.finished) return [];
  const from = state.events.length;
  if (!state.started) {
    state.started = true;
    push(state, { kind: 'period', minute: 0, period: 'kickoff' });
  }

  playMinute(state);
  state.tick++;
  advanceClock(state);

  return state.events.slice(from);
}

function push(state: MatchState, event: MatchEvent) {
  if (state.added > 0 && event.kind !== 'shootoutKick') event.added = state.added;
  state.events.push(event);
}

function advanceClock(state: MatchState) {
  const end = PERIOD_END[state.period];
  if (state.added === 0 && state.minute < end) {
    state.minute++;
    return;
  }
  if (state.added < state.stoppage) {
    state.added++;
    return;
  }
  endPeriod(state);
}

function endPeriod(state: MatchState) {
  const { rng, ctx } = state;
  // Zdarzenia końca części dostają doliczony czas tej części (np. 90+4').
  if (state.period === 1) {
    push(state, { kind: 'period', minute: 45, period: 'halftime' });
    state.added = 0;
    recover(state, 4);
    state.period = 2;
    state.minute = 46;
    state.stoppage = rng.int(3, 6);
    return;
  }
  if (state.period === 2) {
    state.scoreAfter90 = [...state.score];
    if (ctx.knockout && decideWinner(state) === null) {
      state.extraTime = true;
      push(state, { kind: 'period', minute: 90, period: 'extraTimeStart' });
      state.added = 0;
      recover(state, 2);
      state.period = 3;
      state.minute = 91;
      state.stoppage = rng.int(0, 2);
      return;
    }
    finish(state);
    return;
  }
  if (state.period === 3) {
    state.added = 0;
    state.period = 4;
    state.minute = 106;
    state.stoppage = rng.int(0, 3);
    return;
  }
  push(state, { kind: 'period', minute: 120, period: 'extraTimeEnd' });
  if (decideWinner(state) === null) playShootout(state);
  finish(state);
}

/**
 * Zwycięzca bez serii karnych: wynik meczu albo (w rewanżu) suma dwumeczu,
 * potem bramki na wyjeździe (liczone także w dogrywce, jak w 2016). null = nierozstrzygnięte.
 */
export function decideWinner(state: MatchState): Side | null {
  const [h, a] = state.score;
  const leg = state.ctx.firstLeg;
  if (!leg) return h > a ? 'home' : a > h ? 'away' : null;
  const aggHome = h + leg.homeGoals;
  const aggAway = a + leg.awayGoals;
  if (aggHome !== aggAway) return aggHome > aggAway ? 'home' : 'away';
  if (state.ctx.awayGoalsRule === false) return null;
  // Gospodarz rewanżu strzelał na wyjeździe w pierwszym meczu; gość – w tym meczu.
  if (leg.homeGoals !== a) return leg.homeGoals > a ? 'home' : 'away';
  return null;
}

function finish(state: MatchState) {
  const lastMinute = state.extraTime ? 120 : 90;
  const added = state.shootout ? 0 : state.added;
  state.events.push({ kind: 'period', minute: lastMinute, period: 'fulltime', added: added || undefined });
  state.added = 0;
  state.finished = true;
}

function recover(state: MatchState, amount: number) {
  for (const team of Object.values(state.teams)) {
    for (const ps of team.active) ps.condition = Math.min(100, ps.condition + amount);
  }
}

function playMinute(state: MatchState) {
  const { ctx, params: P, rng } = state;
  const home = state.teams.home;
  const away = state.teams.away;

  applyFatigue(state, home);
  applyFatigue(state, away);

  if (state.dirty || state.tick % 3 === 0) {
    home.units = computeUnits(home, ctx);
    away.units = computeUnits(away, ctx);
    state.dirty = false;
  }

  const share = possessionShare(state);
  home.possessionSum += share;
  away.possessionSum += 1 - share;

  for (const side of ['home', 'away'] as const) {
    const x = state.teams[side];
    const y = state.teams[other(side)];
    const xShare = side === 'home' ? share : 1 - share;
    if (rng.chance(attackRate(state, x, y, xShare))) resolveAttack(state, x, y);
    if (state.finished) return;
  }

  for (const side of ['home', 'away'] as const) {
    const x = state.teams[side]; // atakujący
    const y = state.teams[other(side)]; // broniący, fauluje
    const xShare = side === 'home' ? share : 1 - share;
    const ty = y.tactics;
    let pFoul = P.foulRate * Math.pow(xShare / 0.5, 0.7) * (1 + 0.25 * t(ty.pressing)) *
      Math.sqrt(y.units.aggression / 60) * Math.sqrt(x.units.dribble / 65);
    if (ctx.weather === 'rain' || ctx.weather === 'snow') pFoul *= 1.1;
    if (rng.chance(pFoul)) resolveFoul(state, x, y);

    const pOff = P.offsideRate * (1 + 0.5 * t(ty.defensiveLine)) * Math.sqrt(x.units.paceAtt / 65);
    if (rng.chance(pOff)) x.stats.offsides++;
  }

  rollInjuries(state);
  if (home.ai) aiSubstitutions(state, home);
  if (away.ai) aiSubstitutions(state, away);
}

function applyFatigue(state: MatchState, team: TeamState) {
  const { ctx, params: P } = state;
  const tac = team.tactics;
  let env = 1;
  if (ctx.weather === 'heat') env *= 1.35;
  if (ctx.weather === 'cold') env *= 0.95;
  if (ctx.weather === 'snow') env *= 1.1;
  if (team.side === 'away' && (ctx.altitude ?? 0) > 1500) env *= 1 + (ctx.altitude ?? 0) / 6000;
  const tacMult = 1 + 0.3 * t(tac.pressing) + 0.2 * t(tac.tempo);
  for (const ps of team.active) {
    const a = ps.player.attributes;
    const gkMult = ps.position === 'GK' ? 0.3 : 1;
    const drain = P.fatigueRate * (1.45 - (a.stamina / 100) * 0.9) * (1 - (a.naturalFitness - 50) / 400) *
      tacMult * (1 + (a.workRate - 50) / 250) * env * gkMult;
    ps.condition = Math.max(20, ps.condition - drain);
  }
}

function effectiveMentality(state: MatchState, team: TeamState): number {
  const own = state.score[team.side === 'home' ? 0 : 1];
  const opp = state.score[team.side === 'home' ? 1 : 0];
  const diff = clamp(own - opp, -3, 3);
  const late = state.minute >= 60 ? 1 : 0.4;
  // Remis w końcówce: obie strony ostrożniejsze, mniej ryzyka.
  const settle = diff === 0 && state.minute >= 70 ? 0.35 : 0;
  return clamp(t(team.tactics.mentality) - state.params.gameStateEffect * diff * late * 2 - settle, -1.3, 1.3);
}

function homeEdge(state: MatchState): number {
  return state.ctx.neutral ? 0 : clamp(state.ctx.crowdFactor ?? 1, 0, 2);
}

function possessionShare(state: MatchState): number {
  const { home, away } = state.teams;
  const P = state.params;
  const edge = homeEdge(state);
  const ctrl = (x: TeamState, y: TeamState, homeBonus: number) => {
    let c = x.units.control * (1 + homeBonus);
    c *= 1 - 0.06 * t(y.tactics.pressing) * (y.units.press / 65);
    c *= 1 - 0.05 * t(x.tactics.tempo);
    c *= 1 + 0.04 * t(x.tactics.defensiveLine);
    if (state.tick < x.shockUntil) c *= 0.95 + 0.05 * captainLeadership(x) / 100;
    return Math.max(1, c);
  };
  const ch = Math.pow(ctrl(home, away, 0.03 * edge), P.possessionExponent);
  const ca = Math.pow(ctrl(away, home, 0), P.possessionExponent);
  let share = ch / (ch + ca);
  share += 0.06 * (t(away.tactics.directness) - t(home.tactics.directness));
  share += 0.03 * (effectiveMentality(state, home) - effectiveMentality(state, away));
  return clamp(share, 0.22, 0.78);
}

function captainLeadership(team: TeamState): number {
  const cap = team.active.find((ps) => ps.player.id === team.input.captainId);
  return cap ? cap.player.attributes.leadership : 50;
}

function lateDefence(state: MatchState, y: TeamState): number {
  let d = y.units.defence;
  if (state.minute > 75) d *= 1 - (1 - y.units.concentration / 100) * 0.08;
  return Math.max(1, d);
}

/**
 * Nasycenie przewagi: powyżej ~20% różnicy jakości każda kolejna przewaga daje mniej
 * (słabsi bronią się głęboko, faworyt przy wysokim prowadzeniu zwalnia).
 */
function saturate(ratio: number): number {
  const l = Math.log(ratio);
  const knee = 0.18;
  if (Math.abs(l) <= knee) return ratio;
  return Math.exp(Math.sign(l) * (knee + (Math.abs(l) - knee) * 0.6));
}

function attackRate(state: MatchState, x: TeamState, y: TeamState, xShare: number): number {
  const P = state.params;
  const edge = homeEdge(state);
  const tx = x.tactics;
  const ty = y.tactics;
  const quality = saturate((x.units.creation * 0.6 + x.units.control * 0.4) / lateDefence(state, y));
  let rate = P.attackRate * Math.pow(xShare / 0.5, 0.6) * Math.pow(quality, P.strengthExponent);
  const homeMult = x.side === 'home' ? P.homeAttack : P.awayAttack;
  rate *= 1 + (homeMult - 1) * edge;
  rate *= 1 + 0.25 * effectiveMentality(state, x);
  rate *= 1 + 0.12 * effectiveMentality(state, y);
  rate *= 1 + 0.15 * t(tx.tempo) + 0.05 * t(ty.tempo);
  rate *= 1 + 0.08 * t(tx.directness);
  return clamp(rate, 0.01, 0.8);
}

// ---------------------------------------------------------------------------
// Akcje, strzały, stałe fragmenty
// ---------------------------------------------------------------------------

type AttackKind = 'open' | 'through' | 'cross' | 'solo' | 'long' | 'counter';

function resolveAttack(state: MatchState, x: TeamState, y: TeamState) {
  const { rng } = state;
  const tx = x.tactics;
  const ty = y.tactics;
  const paceRatio = x.units.paceAtt / Math.max(1, y.units.paceDef);
  const mx = effectiveMentality(state, x);
  const my = effectiveMentality(state, y);

  const kinds: { kind: AttackKind; w: number }[] = [
    { kind: 'open', w: 1.0 * (1 - 0.3 * t(tx.directness)) * (1 - 0.3 * t(tx.width)) },
    { kind: 'through', w: 0.55 * (1 + 0.4 * t(tx.directness)) * Math.pow(paceRatio, 1.5) * (1 + 0.5 * t(ty.defensiveLine)) },
    { kind: 'cross', w: 0.7 * (1 + 0.6 * t(tx.width)) * Math.pow(x.units.crossing / 65, 1.5) },
    { kind: 'solo', w: 0.35 * Math.pow(x.units.dribble / 65, 2) },
    { kind: 'long', w: 0.45 * Math.pow(x.units.longShots / 65, 1.5) * (1 - 0.3 * t(ty.defensiveLine)) },
    { kind: 'counter', w: 0.3 * Math.max(0.1, 1 + 0.6 * my) * paceRatio * Math.max(0.1, 1 - 0.3 * mx) },
  ];
  const kind = rng.weighted(kinds, (k) => k.w).kind;
  const quality = (x.units.creation * 0.6 + x.units.control * 0.4) / lateDefence(state, y);

  if (!rng.chance(SHOT_PROB[kind])) {
    // Akcja przerwana przez obronę.
    const defender = pickWeighted(rng, y.active, DEFENCE_ROLE, DEFENCE_W);
    if (defender) defender.stats.tackles++;
    const cornerChance = kind === 'cross' ? 0.5 : kind === 'open' || kind === 'solo' ? 0.24 : 0.15;
    if (rng.chance(cornerChance)) resolveCorner(state, x, y);
    else if (kind === 'through' && rng.chance(0.18)) x.stats.offsides++;
    else if (kind === 'cross' && rng.chance(0.006)) ownGoal(state, x, y);
    return;
  }

  const shooter = pickShooter(rng, x, kind);
  if (!shooter) return;
  // Część akcji kończy się bez asysty (dobitki, przechwyty, indywidualne zagrania).
  const assisted = kind === 'cross' || (kind !== 'solo' && kind !== 'long' && rng.chance(0.85));
  const assister = assisted ? pickAssister(rng, x, shooter, kind) : undefined;
  takeShot(state, x, y, kind, shooter, assister, quality);
}

function pickWeighted(rng: Rng, players: PlayerState[], role: RoleTable, w: Weights, exclude?: PlayerState) {
  const pool = players.filter((ps) => ps !== exclude && (role[ps.position] ?? 0) > 0);
  if (pool.length === 0) return undefined;
  return rng.weighted(pool, (ps) => (role[ps.position] ?? 0) * Math.pow(avg(ps.player.attributes, w) / 60, 2));
}

function pickShooter(rng: Rng, x: TeamState, kind: AttackKind): PlayerState | undefined {
  const pool = x.active.filter((ps) => ps.position !== 'GK');
  if (pool.length === 0) return undefined;
  return rng.weighted(pool, (ps) => {
    const a = ps.player.attributes;
    const tr = ps.player.traits;
    let w: number;
    if (kind === 'cross') {
      w = (HEADER_ROLE[ps.position] ?? 0) * Math.pow(avg(a, AERIAL_ATT_W) / 60, 2);
    } else if (kind === 'long') {
      w = (LONGSHOT_ROLE[ps.position] ?? 0) * Math.pow(a.longShots / 60, 2);
      if (tr.includes('shootsFromDistance')) w *= 1.8;
    } else {
      w = (SHOT_ROLE[ps.position] ?? 0) * Math.pow((a.finishing * 2 + a.offTheBall * 2 + a.composure) / 300, 2);
      if (tr.includes('cutsInside') && (ps.position === 'AML' || ps.position === 'AMR')) w *= 1.5;
    }
    if (tr.includes('getsForward')) w *= 1.8;
    if (tr.includes('staysBack')) w *= 0.4;
    return w;
  });
}

function pickAssister(rng: Rng, x: TeamState, shooter: PlayerState, kind: AttackKind) {
  const pool = x.active.filter((ps) => ps !== shooter && ps.position !== 'GK');
  if (pool.length === 0) return undefined;
  return rng.weighted(pool, (ps) => {
    const a = ps.player.attributes;
    if (kind === 'cross') return ((WIDE_ROLE[ps.position] ?? 0.1) + 0.05) * Math.pow(a.crossing / 60, 2);
    if (kind === 'counter') return (CREATOR_ROLE[ps.position] ?? 0.1) * Math.pow((a.pace + a.passing) / 120, 2);
    const w = (CREATOR_ROLE[ps.position] ?? 0.1) * Math.pow((a.vision + a.passing) / 120, 2);
    return ps.player.traits.includes('triesKillerBalls') ? w * 1.3 : w;
  });
}

function goalkeeper(team: TeamState): PlayerState | undefined {
  return team.active.find((ps) => ps.position === 'GK');
}

function takeShot(
  state: MatchState,
  x: TeamState,
  y: TeamState,
  kind: ShotKind,
  shooter: PlayerState,
  assister: PlayerState | undefined,
  quality: number,
) {
  const { rng, params: P } = state;
  const mean = XG_MEAN[kind];
  const noise = Math.exp(rng.normal(0, 0.6) - 0.18);
  const xg = clamp(mean * noise * Math.pow(quality, P.chanceQualityExponent), 0.01, 0.92);

  const a = shooter.player.attributes;
  const isHeader = kind === 'cross' || kind === 'corner';
  const skillW = isHeader ? HEADER_FINISH_W : kind === 'long' ? LONG_FINISH_W : kind === 'freeKick' ? FREEKICK_W : xg > 0.25 ? BIG_CHANCE_W : FINISH_W;
  const skill = avg(a, skillW) * effectiveness(shooter);

  const gk = goalkeeper(y);
  const gkSkill = isHeader ? y.units.gkShot * 0.6 + y.units.gkAir * 0.4 : y.units.gkShot;
  const finMult = Math.max(0.3, 1 + (skill - 65) * P.finishingSkill);
  const keeperMult = Math.max(0.3, 1 + (gkSkill - 65) * P.keeperSkill);
  const pGoal = clamp((xg * finMult) / keeperMult, 0.003, 0.95);

  shooter.stats.shots++;
  shooter.stats.xg += xg;
  x.stats.shots++;
  x.stats.xg += xg;
  if (assister) assister.stats.keyPasses++;

  if (rng.chance(pGoal)) {
    scoreGoal(state, x, y, shooter, assister, kind, xg);
    return;
  }

  let outcome: 'saved' | 'off' | 'blocked' | 'woodwork';
  if (rng.chance(BLOCK_PROB[kind])) outcome = 'blocked';
  else if (rng.chance(0.36 * Math.sqrt(Math.max(skill, 20) / 65))) outcome = 'saved';
  else if (rng.chance(0.03)) outcome = 'woodwork';
  else outcome = 'off';

  if (outcome === 'saved') {
    shooter.stats.shotsOnTarget++;
    x.stats.shotsOnTarget++;
    if (gk) gk.stats.saves++;
  }
  push(state, { kind: 'shot', minute: state.minute, side: x.side, playerId: shooter.player.id, shot: kind, xg: round2(xg), outcome });
  if ((outcome === 'saved' && rng.chance(0.4)) || (outcome === 'blocked' && rng.chance(0.55))) {
    resolveCorner(state, x, y);
  }
}

function scoreGoal(
  state: MatchState,
  x: TeamState,
  y: TeamState,
  scorer: PlayerState,
  assister: PlayerState | undefined,
  kind: ShotKind,
  xg: number,
  ownGoal = false,
) {
  const idx = x.side === 'home' ? 0 : 1;
  state.score[idx]++;
  x.stats.goals++;
  if (!ownGoal) {
    scorer.stats.goals++;
    scorer.stats.shotsOnTarget++;
    x.stats.shotsOnTarget++;
    if (assister) assister.stats.assists++;
  }
  for (const ps of y.active) ps.conceded++;
  y.shockUntil = state.tick + 8;
  state.dirty = true;
  push(state, {
    kind: 'goal',
    minute: state.minute,
    side: x.side,
    playerId: scorer.player.id,
    assistId: assister?.player.id,
    shot: kind,
    xg: round2(xg),
    ownGoal: ownGoal || undefined,
    score: [...state.score],
  });
}

function ownGoal(state: MatchState, x: TeamState, y: TeamState) {
  const unlucky = pickWeighted(state.rng, y.active, AERIAL_DEF_ROLE, AERIAL_DEF_W);
  if (unlucky) scoreGoal(state, x, y, unlucky, undefined, 'cross', 0, true);
}

function resolveCorner(state: MatchState, x: TeamState, y: TeamState) {
  const { rng } = state;
  x.stats.corners++;
  const pShot = 0.33 * (x.units.aerialAtt / Math.max(1, y.units.aerialDef)) * (1 - (y.units.gkAir - 65) * 0.008);
  if (!rng.chance(clamp(pShot, 0.05, 0.6))) return;
  const shooter = pickWeighted(rng, x.active, SETPIECE_HEADER_ROLE, AERIAL_ATT_W);
  if (!shooter) return;
  const taker = setPieceTaker(x, x.input.cornerTakerId, CROSS_W, shooter);
  const quality = Math.pow(x.units.aerialAtt / Math.max(1, y.units.aerialDef), 1.5);
  takeShot(state, x, y, 'corner', shooter, taker, quality);
}

function setPieceTaker(team: TeamState, preferredId: string | undefined, w: Weights, exclude?: PlayerState) {
  const pool = team.active.filter((ps) => ps !== exclude && ps.position !== 'GK');
  const preferred = pool.find((ps) => ps.player.id === preferredId);
  if (preferred) return preferred;
  let best: PlayerState | undefined;
  let bestVal = -1;
  for (const ps of pool) {
    const v = avg(ps.player.attributes, w);
    if (v > bestVal) {
      bestVal = v;
      best = ps;
    }
  }
  return best;
}

function resolveFoul(state: MatchState, x: TeamState, y: TeamState) {
  const { rng, params: P, ctx } = state;
  const fouler = pickFouler(rng, y);
  if (!fouler) return;
  fouler.stats.fouls++;
  y.stats.fouls++;

  const a = fouler.player.attributes;
  const pers = fouler.player.personality;
  const strict = 0.6 + 0.8 * ((ctx.referee?.strictness ?? 50) / 100);
  const importance = 0.85 + (ctx.importance ?? 50) / 333;
  const temperFactor = (0.6 + a.aggression / 150) * (1.4 - pers.temperament / 150);

  if (rng.chance(P.redPerFoul * strict * temperFactor)) {
    sendOff(state, y, fouler, 'red');
  } else {
    let pYellow = P.yellowPerFoul * strict * importance * temperFactor;
    if (fouler.booked) pYellow *= 0.3; // ukarani grają ostrożniej
    if (fouler.player.traits.includes('divesIntoTackles')) pYellow *= 1.3;
    if (rng.chance(pYellow)) {
      if (fouler.booked) {
        sendOff(state, y, fouler, 'secondYellow');
      } else {
        fouler.booked = true;
        fouler.stats.yellow++;
        y.stats.yellow++;
        push(state, { kind: 'card', minute: state.minute, side: y.side, playerId: fouler.player.id, card: 'yellow' });
      }
    }
  }

  const penTend = 0.6 + 0.8 * ((ctx.referee?.penaltyTendency ?? 50) / 100);
  if (rng.chance(P.penaltyPerFoul * penTend * (x.units.dribble / 65))) {
    resolvePenalty(state, x, y);
  } else if (rng.chance(P.directFreeKickPerFoul)) {
    const taker = setPieceTaker(x, x.input.freeKickTakerId, FREEKICK_W);
    if (taker) takeShot(state, x, y, 'freeKick', taker, undefined, 1);
  }
}

function pickFouler(rng: Rng, y: TeamState) {
  const pool = y.active.filter((ps) => ps.position !== 'GK');
  if (pool.length === 0) return undefined;
  return rng.weighted(pool, (ps) => {
    const a = ps.player.attributes;
    const w = ((DEFENCE_ROLE[ps.position] ?? 0) + 0.3) * ((a.aggression + (100 - ps.player.personality.temperament)) / 100);
    return ps.player.traits.includes('divesIntoTackles') ? w * 1.5 : w;
  });
}

function sendOff(state: MatchState, team: TeamState, ps: PlayerState, card: 'red' | 'secondYellow') {
  ps.stats.red++;
  team.stats.red++;
  if (card === 'secondYellow') {
    ps.stats.yellow++;
    team.stats.yellow++;
  }
  push(state, { kind: 'card', minute: state.minute, side: team.side, playerId: ps.player.id, card });
  removeFromPitch(state, team, ps);
  if (ps.position === 'GK') replaceGoalkeeper(state, team);
}

function removeFromPitch(state: MatchState, team: TeamState, ps: PlayerState) {
  ps.out = true;
  ps.offTick = state.tick;
  team.active = team.active.filter((p) => p !== ps);
  state.dirty = true;
}

/** Po czerwonej dla bramkarza: wchodzi rezerwowy bramkarz za zawodnika z pola albo ktoś z pola staje w bramce. */
function replaceGoalkeeper(state: MatchState, team: TeamState) {
  const maxSubs = state.ctx.maxSubs ?? 3;
  const benchGk = team.bench.find((p) => (p.positions.GK ?? 0) >= 50);
  const outfield = team.active.filter((p) => p.position !== 'GK');
  if (benchGk && team.subsUsed < maxSubs && outfield.length > 0) {
    const sacrificed = outfield.reduce((lo, p) => (p.position.startsWith('A') || p.position === 'ST' ? p : lo), outfield[0]!);
    substitute(state, team, sacrificed, benchGk, 'GK', 'tactical');
  } else if (outfield.length > 0) {
    const stand = outfield.reduce((best, p) => (p.player.attributes.handling > best.player.attributes.handling ? p : best), outfield[0]!);
    stand.position = 'GK';
    stand.familiarity = stand.player.positions.GK ?? 0;
    state.dirty = true;
  }
}

function resolvePenalty(state: MatchState, x: TeamState, y: TeamState) {
  const { rng } = state;
  x.stats.penalties++;
  const taker = setPieceTaker(x, x.input.penaltyTakerId, PENALTY_W);
  if (!taker) return;
  const scored = rng.chance(penaltyProbability(state, taker, y, 0.76));
  taker.stats.shots++;
  taker.stats.xg += 0.76;
  x.stats.shots++;
  x.stats.xg += 0.76;
  if (scored) {
    scoreGoal(state, x, y, taker, undefined, 'penalty', 0.76);
    return;
  }
  const saved = rng.chance(0.65);
  if (saved) {
    taker.stats.shotsOnTarget++;
    x.stats.shotsOnTarget++;
    const gk = goalkeeper(y);
    if (gk) gk.stats.saves++;
  }
  push(state, { kind: 'penaltyMiss', minute: state.minute, side: x.side, playerId: taker.player.id, saved });
}

function penaltyProbability(state: MatchState, taker: PlayerState, y: TeamState, base: number): number {
  const a = taker.player.attributes;
  const pressure = taker.player.personality.pressure;
  const importance = (state.ctx.importance ?? 50) / 100;
  const gk = goalkeeper(y);
  const gkSkill = gk ? (gk.player.attributes.oneOnOnes + gk.player.attributes.reflexes) / 2 : 30;
  const p = base * (1 + (a.penalties - 65) * 0.006 + (a.composure - 65) * 0.003 + (pressure - 60) * 0.004 * importance) /
    (1 + (gkSkill - 65) * 0.005);
  return clamp(p, 0.4, 0.95);
}

// ---------------------------------------------------------------------------
// Kontuzje i zmiany
// ---------------------------------------------------------------------------

function rollInjuries(state: MatchState) {
  const { rng, params: P, ctx } = state;
  for (const team of [state.teams.home, state.teams.away]) {
    const opp = state.teams[other(team.side)];
    for (const ps of [...team.active]) {
      const a = ps.player.attributes;
      let p = P.injuryRate * (0.5 + ps.player.personality.injuryProneness / 100) *
        (1 + Math.max(0, 75 - ps.condition) / 30) * (1 - (a.naturalFitness - 50) / 250) *
        Math.sqrt(opp.units.aggression / 60);
      if (ctx.pitch === 'artificial' || ctx.pitch === 'poor') p *= 1.1;
      if (!rng.chance(p)) continue;
      const injury = rollInjury(rng);
      push(state, { kind: 'injury', minute: state.minute, side: team.side, playerId: ps.player.id, injury });
      if (injury.severity === 'light' && rng.chance(0.5)) {
        ps.condition = Math.max(20, ps.condition - 15); // gra dalej, ale osłabiony
        state.dirty = true;
        continue;
      }
      const replacement = bestReplacement(team, ps.position);
      if (replacement && team.subsUsed < (ctx.maxSubs ?? 3)) {
        substitute(state, team, ps, replacement, ps.position, 'injury');
      } else {
        removeFromPitch(state, team, ps);
        if (ps.position === 'GK') replaceGoalkeeper(state, team);
      }
    }
  }
}

function bestReplacement(team: TeamState, position: Position): Player | undefined {
  let best: Player | undefined;
  let bestVal = -1;
  for (const p of team.bench) {
    if (position !== 'GK' && (p.positions.GK ?? 0) >= 50 && !Object.entries(p.positions).some(([k, v]) => k !== 'GK' && (v ?? 0) >= 50)) {
      continue; // bramkarz nie wchodzi w pole
    }
    const v = positionRating(p.attributes, position, p.positions[position] ?? 0);
    if (v > bestVal) {
      bestVal = v;
      best = p;
    }
  }
  return best;
}

function substitute(
  state: MatchState,
  team: TeamState,
  outPs: PlayerState,
  inPlayer: Player,
  position: Position,
  reason: 'tactical' | 'fatigue' | 'injury',
) {
  removeFromPitch(state, team, outPs);
  const importance = state.ctx.importance ?? 50;
  const ps = makePlayerState(inPlayer, team.side, position, team.input, state.rng, importance, state.tick);
  team.active.push(ps);
  team.all.push(ps);
  team.bench = team.bench.filter((p) => p.id !== inPlayer.id);
  team.subsUsed++;
  push(state, { kind: 'sub', minute: state.minute, side: team.side, outId: outPs.player.id, inId: inPlayer.id, reason });
}

function aiSubstitutions(state: MatchState, team: TeamState) {
  const { rng } = state;
  const maxSubs = state.ctx.maxSubs ?? 3;
  if (team.subsUsed >= maxSubs || state.minute < 55 || team.bench.length === 0) return;
  const outfield = team.active.filter((ps) => ps.position !== 'GK');
  if (outfield.length === 0) return;
  const tiredest = outfield.reduce((lo, ps) => (ps.condition < lo.condition ? ps : lo), outfield[0]!);

  // Trener ma plan zmian (ok. 60', 70', 80'); przegrywając zmienia wcześniej,
  // a wyraźnie zmęczony zawodnik schodzi niezależnie od planu.
  const own = state.score[team.side === 'home' ? 0 : 1];
  const opp = state.score[team.side === 'home' ? 1 : 0];
  const planned = (team.subPlan[team.subsUsed] ?? 999) - (own < opp ? 6 : 0);
  const due = state.minute >= planned || state.period >= 3;
  if (!due && !(tiredest.condition < 60 && rng.chance(0.15))) return;

  // Zmęczony albo z żółtą kartką – kandydat do zmiany.
  const candidate = outfield.reduce((lo, ps) => {
    const score = (ps: PlayerState) => ps.condition - (ps.booked ? 8 : 0) + ps.stats.goals * 10;
    return score(ps) < score(lo) ? ps : lo;
  }, outfield[0]!);
  const replacement = bestReplacement(team, candidate.position);
  if (!replacement) return;
  substitute(state, team, candidate, replacement, candidate.position, candidate.condition < 72 ? 'fatigue' : 'tactical');
}

// ---------------------------------------------------------------------------
// Sterowanie meczem na żywo
// ---------------------------------------------------------------------------

/** Zmiana dokonana przez gracza. Zwraca komunikat błędu albo null. */
export function makeSubstitution(state: MatchState, side: Side, outId: string, inId: string, position?: Position): string | null {
  const team = state.teams[side];
  if (team.subsUsed >= (state.ctx.maxSubs ?? 3)) return 'Wykorzystano już wszystkie zmiany.';
  const outPs = team.active.find((ps) => ps.player.id === outId);
  if (!outPs) return 'Tego zawodnika nie ma na boisku.';
  const inPlayer = team.bench.find((p) => p.id === inId);
  if (!inPlayer) return 'Tego zawodnika nie ma na ławce.';
  substitute(state, team, outPs, inPlayer, position ?? outPs.position, 'tactical');
  return null;
}

export function setTactics(state: MatchState, side: Side, tactics: Partial<Tactics>) {
  const team = state.teams[side];
  team.tactics = { ...team.tactics, ...tactics };
  team.nominal = nominalFor(team.tactics);
  state.dirty = true;
}

// ---------------------------------------------------------------------------
// Rzuty karne (seria)
// ---------------------------------------------------------------------------

function playShootout(state: MatchState) {
  const { rng } = state;
  // Najlepsi wykonawcy pierwsi, bramkarz na końcu kolejki.
  const order = (team: TeamState) =>
    [...team.active].sort((a, b) => {
      const v = (ps: PlayerState) =>
        ps.player.attributes.penalties * 2 + ps.player.attributes.composure + ps.player.personality.pressure -
        (ps.position === 'GK' ? 1000 : 0);
      return v(b) - v(a);
    });
  const takers = { home: order(state.teams.home), away: order(state.teams.away) };
  const goals = { home: 0, away: 0 };
  const kick = (side: Side, round: number) => {
    const list = takers[side];
    const taker = list[(round - 1) % list.length]!;
    const scored = rng.chance(penaltyProbability(state, taker, state.teams[other(side)], 0.73));
    if (scored) goals[side]++;
    state.events.push({ kind: 'shootoutKick', side, playerId: taker.player.id, scored, round });
  };
  for (let round = 1; round <= 5; round++) {
    kick('home', round);
    if (decided(goals, round, 'home')) break;
    kick('away', round);
    if (decided(goals, round, 'away')) break;
  }
  let round = 5;
  while (goals.home === goals.away) {
    round++;
    kick('home', round);
    kick('away', round);
  }
  state.shootout = { ...goals, winner: goals.home > goals.away ? 'home' : 'away' };
}

function decided(goals: { home: number; away: number }, round: number, lastKicker: Side): boolean {
  const homeLeft = 5 - round;
  const awayLeft = lastKicker === 'home' ? 5 - round + 1 : 5 - round;
  return goals.home > goals.away + awayLeft || goals.away > goals.home + homeLeft;
}

// ---------------------------------------------------------------------------
// Wynik
// ---------------------------------------------------------------------------

export function getResult(state: MatchState): MatchResult {
  const ticks = Math.max(1, state.tick);
  const fullMinutes = state.extraTime ? 120 : 90;
  // W rewanżu „winner” to drużyna, która awansuje (suma dwumeczu, bramki na wyjeździe, karne).
  let winner: Side | null = decideWinner(state);
  if (state.shootout) winner = state.shootout.winner;

  const players: PlayerMatchStats[] = [];
  for (const team of [state.teams.home, state.teams.away]) {
    const won = winner === team.side;
    const lost = winner !== null && winner !== team.side;
    for (const ps of team.all) {
      const played = (ps.offTick ?? ticks) - ps.onTick;
      const minutes = Math.max(1, Math.min(fullMinutes, Math.round((played / ticks) * fullMinutes)));
      players.push({
        playerId: ps.player.id,
        side: team.side,
        minutes,
        ...ps.stats,
        xg: round2(ps.stats.xg),
        rating: rating(ps, won, lost, state.rng),
        condition: Math.round(ps.condition),
      });
    }
  }

  const stats = (team: TeamState): TeamStats => ({
    ...team.stats,
    xg: round2(team.stats.xg),
    possession: Math.round((team.possessionSum / ticks) * 100),
  });

  return {
    score: [...state.score],
    scoreAfter90: state.extraTime ? state.scoreAfter90 : [...state.score],
    extraTime: state.extraTime,
    shootout: state.shootout,
    winner,
    events: state.events,
    stats: { home: stats(state.teams.home), away: stats(state.teams.away) },
    players,
  };
}

function rating(ps: PlayerState, won: boolean, lost: boolean, rng: Rng): number {
  const s = ps.stats;
  const defensive = ['GK', 'DC', 'DL', 'DR', 'WBL', 'WBR', 'DM'].includes(ps.position);
  let r = 6.3;
  r += s.goals * 1.0 + s.assists * 0.7 + s.keyPasses * 0.15 + s.shotsOnTarget * 0.1;
  r += s.tackles * 0.08 + s.saves * 0.25;
  if (defensive) r -= ps.conceded * 0.25;
  if (won) r += 0.3;
  if (lost) r -= 0.3;
  r -= s.yellow * 0.3 + s.red * 1.5;
  r += (ps.formMult - 1) * 5 + rng.normal(0, 0.3);
  return Math.round(clamp(r, 3, 10) * 10) / 10;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

// ---------------------------------------------------------------------------
// Całość naraz
// ---------------------------------------------------------------------------

export function simulateMatch(ctx: MatchContext, options: StartOptions = {}): MatchResult {
  const state = startMatch(ctx, options);
  while (!state.finished) stepMinute(state);
  return getResult(state);
}
