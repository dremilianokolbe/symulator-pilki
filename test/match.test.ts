import { describe, expect, it } from 'vitest';
import { getResult, makeSubstitution, simulateMatch, startMatch, stepMinute } from '../src/engine/match';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { createRng } from '../src/engine/rng';
import type { MatchContext, MatchTeamInput } from '../src/engine/types';
import { generateTeam } from '../src/generator/players';

function teams(qHome = 72, qAway = 72, seed = 1): [MatchTeamInput, MatchTeamInput] {
  const rng = createRng(seed);
  return [
    generateTeam(rng, { id: 'H', name: 'Gospodarze', quality: qHome }).input,
    generateTeam(rng, { id: 'A', name: 'Goście', quality: qAway }).input,
  ];
}

describe('silnik meczu', () => {
  it('ten sam seed daje identyczny mecz', () => {
    const [home, away] = teams();
    const a = simulateMatch({ seed: 42, home, away });
    const b = simulateMatch({ seed: 42, home, away });
    expect(a).toEqual(b);
  });

  it('różne seedy dają różne mecze', () => {
    const [home, away] = teams();
    const scores = new Set<string>();
    for (let s = 0; s < 30; s++) scores.add(simulateMatch({ seed: s, home, away }).score.join(':'));
    expect(scores.size).toBeGreaterThan(5);
  });

  it('liczba goli w zdarzeniach zgadza się z wynikiem', () => {
    const [home, away] = teams();
    for (let s = 0; s < 200; s++) {
      const r = simulateMatch({ seed: s, home, away });
      const homeGoals = r.events.filter((e) => e.kind === 'goal' && e.side === 'home').length;
      const awayGoals = r.events.filter((e) => e.kind === 'goal' && e.side === 'away').length;
      expect([homeGoals, awayGoals]).toEqual(r.score);
      expect(r.stats.home.goals).toBe(r.score[0]);
    }
  });

  it('nigdy więcej niż 11 na boisku i nie więcej zmian niż limit', () => {
    const [home, away] = teams();
    for (let s = 0; s < 200; s++) {
      const state = startMatch({ seed: s, home, away, maxSubs: 3 });
      while (!state.finished) {
        stepMinute(state);
        expect(state.teams.home.active.length).toBeLessThanOrEqual(11);
        expect(state.teams.away.active.length).toBeLessThanOrEqual(11);
      }
      const r = getResult(state);
      for (const side of ['home', 'away'] as const) {
        expect(r.events.filter((e) => e.kind === 'sub' && e.side === side).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('komputer cofa słabszą drużynę i ośmiela mocniejszą, ale nie rusza ustawienia gracza', () => {
    const [strong, weak] = teams(80, 62, 7);
    const ai = startMatch({ seed: 1, home: strong, away: weak });
    expect(ai.teams.home.tactics.mentality).toBeGreaterThan(50);
    expect(ai.teams.away.tactics.mentality).toBeLessThan(50);
    expect(ai.teams.away.tactics.defensiveLine).toBeLessThan(50);
    const manual = startMatch({ seed: 1, home: strong, away: weak }, { manualSides: ['away'] });
    expect(manual.teams.away.tactics).toEqual(weak.tactics);
  });

  it('słabsza drużyna broniąca się nisko oddaje mniej strzałów', () => {
    const [strong, weak] = teams(80, 62, 7);
    const shots = (aiAdaptation: number) => {
      let n = 0;
      for (let s = 0; s < 300; s++) n += simulateMatch({ seed: s, home: strong, away: weak }, { params: { ...DEFAULT_PARAMS, aiAdaptation } }).stats.away.shots;
      return n / 300;
    };
    expect(shots(150)).toBeLessThan(shots(0));
  });

  it('w meczach reprezentacji pada mniej goli niż w lidze', () => {
    const [home, away] = teams();
    const goals = (international: boolean) => {
      let n = 0;
      for (let s = 0; s < 400; s++) n += simulateMatch({ seed: s, home, away, international }).score.reduce((a, b) => a + b);
      return n / 400;
    };
    expect(goals(true)).toBeLessThan(goals(false) * 0.95);
  });

  it('mocniejsza drużyna wygrywa wyraźnie częściej', () => {
    const [strong, weak] = teams(80, 65, 7);
    let wins = 0;
    let losses = 0;
    for (let s = 0; s < 400; s++) {
      const r = simulateMatch({ seed: s, home: strong, away: weak, neutral: true });
      if (r.winner === 'home') wins++;
      if (r.winner === 'away') losses++;
    }
    expect(wins).toBeGreaterThan(losses * 4);
  });

  it('mecz pucharowy zawsze ma zwycięzcę', () => {
    const [home, away] = teams(72, 72, 3);
    for (let s = 0; s < 300; s++) {
      const ctx: MatchContext = { seed: s, home, away, knockout: true, neutral: true };
      const r = simulateMatch(ctx);
      expect(r.winner).not.toBeNull();
      if (r.shootout) {
        expect(r.extraTime).toBe(true);
        expect(r.score[0]).toBe(r.score[1]);
      }
    }
  });

  it('rewanż rozstrzyga dwumecz: suma, bramki na wyjeździe, dogrywka, karne', () => {
    const [home, away] = teams(72, 72, 4);
    for (let s = 0; s < 300; s++) {
      // Pierwszy mecz 1:1 => gospodarz rewanżu strzelił 1 na wyjeździe.
      const r = simulateMatch({ seed: s, home, away, knockout: true, firstLeg: { homeGoals: 1, awayGoals: 1 } });
      expect(r.winner).not.toBeNull();
      const [h, a] = r.scoreAfter90;
      if (!r.extraTime) {
        // Bez dogrywki: dwumecz rozstrzygnięty po 90 minutach.
        const decided = h !== a || a !== 1;
        expect(decided).toBe(true);
        if (h !== a) expect(r.winner).toBe(h > a ? 'home' : 'away');
        else expect(r.winner).toBe(a > 1 ? 'away' : 'home'); // 0:0 => gospodarz (1 na wyjeździe), 2:2 => gość
      } else {
        // Dogrywka tylko przy 1:1 w rewanżu (wszystko równe).
        expect([h, a]).toEqual([1, 1]);
      }
    }
  });

  it('zawodnik z czerwoną kartką nie wraca na boisko', () => {
    const [home, away] = teams();
    for (let s = 0; s < 400; s++) {
      const r = simulateMatch({ seed: s, home, away });
      for (const red of r.events.filter((e) => e.kind === 'card' && e.card !== 'yellow')) {
        if (red.kind !== 'card') continue;
        const later = r.events.filter((e) => e.kind === 'goal' && e.playerId === red.playerId && e.minute > red.minute && !e.ownGoal);
        expect(later).toHaveLength(0);
      }
    }
  });

  it('gracz może zrobić zmianę w trakcie meczu', () => {
    const [home, away] = teams();
    const state = startMatch({ seed: 5, home, away }, { manualSides: ['home'] });
    for (let i = 0; i < 60; i++) stepMinute(state);
    const outId = state.teams.home.active.find((ps) => ps.position === 'ST')!.player.id;
    const inId = state.teams.home.bench[0]!.id;
    expect(makeSubstitution(state, 'home', outId, inId)).toBeNull();
    expect(state.teams.home.active.some((ps) => ps.player.id === inId)).toBe(true);
    expect(state.teams.home.active.some((ps) => ps.player.id === outId)).toBe(false);
  });

  it('upał męczy zawodników bardziej', () => {
    const [home, away] = teams();
    const avgCondition = (weather: 'clear' | 'heat') => {
      let sum = 0;
      let n = 0;
      for (let s = 0; s < 50; s++) {
        const r = simulateMatch({ seed: s, home, away, weather });
        for (const p of r.players) if (p.minutes >= 90) { sum += p.condition; n++; }
      }
      return sum / n;
    };
    expect(avgCondition('heat')).toBeLessThan(avgCondition('clear') - 3);
  });
});
