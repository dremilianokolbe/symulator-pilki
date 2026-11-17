/**
 * Regulamin sprawdzany na prawdziwej historii: z prawdziwych wyników muszą wyjść prawdziwe tabele.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EURO2016_FINALS_RULES, EURO2016_QUALIFYING_RULES, rankAcrossGroups, rankGroup, type PlayedMatch,
} from '../src/competition/standings';
import { createRng } from '../src/engine/rng';
import {
  finalsGroups, qualifierMatches, qualifyingGroups, REAL_POINTS_ADJUSTMENT, type EuroMatch,
} from '../src/scenarios/euro2016/data';
import { assignThirds, drawFinals } from '../src/scenarios/euro2016/tournament';

const all = JSON.parse(readFileSync('data/processed/euro2016/mecze.json', 'utf8')) as EuroMatch[];
const played = (ms: EuroMatch[]): PlayedMatch[] =>
  ms.map((m) => ({ home: m.home, away: m.away, homeGoals: m.homeScore, awayGoals: m.awayScore }));
const coef = () => 0;

describe('eliminacje Euro 2016 na prawdziwych wynikach', () => {
  const groups = qualifyingGroups(all);
  const results = played(qualifierMatches(all));
  const tables = groups.map((g) => ({
    letter: g.letter,
    rows: rankGroup(g.teams, results.filter((m) => g.teams.includes(m.home)), {
      rules: EURO2016_QUALIFYING_RULES(coef),
      pointsAdjustment: REAL_POINTS_ADJUSTMENT,
    }),
  }));

  it('9 grup, 260 meczów grupowych (z dopisanym meczem Czarnogóra–Rosja)', () => {
    expect(groups).toHaveLength(9);
    expect(groups.reduce((s, g) => s + g.fixtures.length, 0)).toBe(260);
  });

  it.each([
    ['A', 'Czech Republic', 'Iceland', 'Turkey'],
    ['B', 'Belgium', 'Wales', 'Bosnia and Herzegovina'],
    ['C', 'Spain', 'Slovakia', 'Ukraine'],
    ['D', 'Germany', 'Poland', 'Republic of Ireland'],
    ['E', 'England', 'Switzerland', 'Slovenia'],
    ['F', 'Northern Ireland', 'Romania', 'Hungary'],
    ['G', 'Austria', 'Russia', 'Sweden'],
    ['H', 'Italy', 'Croatia', 'Norway'],
    ['I', 'Portugal', 'Albania', 'Denmark'],
  ])('grupa %s: %s, %s, %s', (letter, first, second, third) => {
    const rows = tables.find((t) => t.letter === letter)!.rows;
    expect(rows.slice(0, 3).map((r) => r.team)).toEqual([first, second, third]);
  });

  it('Turcja najlepszą trzecią drużyną (bez meczów z 6. drużyną grupy)', () => {
    const thirds = tables.map((t) => {
      const sixth = t.rows[5]?.team;
      const teams = t.rows.map((r) => r.team).filter((x) => x !== sixth);
      const ms = results.filter((m) => teams.includes(m.home) && teams.includes(m.away));
      return rankGroup(teams, ms, { rules: EURO2016_QUALIFYING_RULES(coef), pointsAdjustment: REAL_POINTS_ADJUSTMENT })
        .find((r) => r.team === t.rows[2]!.team)!;
    });
    const ranked = rankAcrossGroups(thirds, ['points', 'goalDiff', 'goals', 'awayGoals', 'wins', 'awayWins', 'fairPlay'], coef);
    expect(ranked[0]!.team).toBe('Turkey');
  });

  it('Serbia z karą −3 za Danią', () => {
    const rows = tables.find((t) => t.letter === 'I')!.rows;
    expect(rows.findIndex((r) => r.team === 'Serbia')).toBeGreaterThan(rows.findIndex((r) => r.team === 'Denmark'));
  });
});

describe('turniej Euro 2016 na prawdziwych wynikach', () => {
  const groups = finalsGroups(all);
  const results = played(all.filter((m) => m.tournament === 'UEFA Euro'));
  const tables = groups.map((g) => ({
    letter: g.letter,
    rows: rankGroup(g.teams, results.filter((m) => g.teams.includes(m.home) && g.teams.includes(m.away)), { rules: EURO2016_FINALS_RULES(coef) }),
  }));

  it.each([
    ['A', ['France', 'Switzerland', 'Albania', 'Romania']],
    ['B', ['Wales', 'England', 'Slovakia', 'Russia']],
    ['C', ['Germany', 'Poland', 'Northern Ireland', 'Ukraine']],
    ['D', ['Croatia', 'Spain', 'Turkey', 'Czech Republic']],
    ['E', ['Italy', 'Belgium', 'Republic of Ireland', 'Sweden']],
    ['F', ['Hungary', 'Iceland', 'Portugal', 'Austria']],
  ])('grupa %s', (letter, expected) => {
    expect(tables.find((t) => t.letter === letter)!.rows.map((r) => r.team)).toEqual(expected);
  });

  it('awans 4 najlepszych trzecich: Słowacja, Irlandia Płn., Irlandia, Portugalia', () => {
    const thirds = tables.map((t) => ({ ...t.rows[2]!, group: t.letter }));
    const best = rankAcrossGroups(thirds, ['points', 'goalDiff', 'goals', 'fairPlay'], coef).slice(0, 4);
    expect(best.map((r) => r.team).sort()).toEqual(['Northern Ireland', 'Portugal', 'Republic of Ireland', 'Slovakia']);
  });

  it('pary 1/8 z trzecimi miejscami jak w 2016', () => {
    expect(assignThirds(['B', 'C', 'E', 'F'])).toEqual({ A: 'E', B: 'C', C: 'B', D: 'F' });
  });

  it('każda z 15 kombinacji trzecich miejsc ma przydział', () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    let combos = 0;
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      const four = letters.filter((_, k) => k !== i && k !== j);
      expect(() => assignThirds(four)).not.toThrow();
      combos++;
    }
    expect(combos).toBe(15);
  });

  it('losowanie: gospodarz w A, Rosja i Ukraina osobno, po jednej drużynie z koszyka', () => {
    const teams = groups.flatMap((g) => g.teams);
    const rank = new Map(teams.map((t, i) => [t, 100 - i]));
    for (let s = 0; s < 50; s++) {
      const drawn = drawFinals(createRng(s), teams, (t) => rank.get(t) ?? 0);
      expect(drawn[0]!.teams[0]).toBe('France');
      expect(drawn.every((g) => g.teams.length === 4 && g.fixtures.length === 6)).toBe(true);
      expect(drawn.some((g) => g.teams.includes('Russia') && g.teams.includes('Ukraine'))).toBe(false);
    }
  });
});
