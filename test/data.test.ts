import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/data/csv';
import { deriveSquad, type SquadPlayer } from '../src/data/derive';
import { EloTable, expectedScore, goalDiffMultiplier, kFactor } from '../src/data/elo';
import { positionRating } from '../src/engine/attributes';

describe('CSV', () => {
  it('obsługuje cudzysłowy i przecinki w polach', () => {
    const rows = parseCsv('a,b\n"x, y",2\n"z ""q""",3\n');
    expect(rows).toEqual([{ a: 'x, y', b: '2' }, { a: 'z "q"', b: '3' }]);
  });
});

describe('Elo', () => {
  it('waga meczu zależy od rangi', () => {
    expect(kFactor('FIFA World Cup')).toBe(60);
    expect(kFactor('UEFA Euro')).toBe(50);
    expect(kFactor('UEFA Euro qualification')).toBe(40);
    expect(kFactor('Friendly')).toBe(20);
  });

  it('mnożnik za różnicę bramek', () => {
    expect(goalDiffMultiplier(1)).toBe(1);
    expect(goalDiffMultiplier(-2)).toBe(1.5);
    expect(goalDiffMultiplier(3)).toBe(1.75);
  });

  it('gospodarz ma przewagę 100 punktów', () => {
    expect(expectedScore(1500, 1500, true)).toBeCloseTo(0.5);
    expect(expectedScore(1500, 1500, false)).toBeCloseTo(0.64, 2);
  });

  it('zwycięzca zyskuje tyle, ile traci przegrany', () => {
    const t = new EloTable();
    t.update({ date: '2015-01-01', home: 'A', away: 'B', homeScore: 2, awayScore: 0, tournament: 'Friendly', neutral: true });
    expect(t.get('A') + t.get('B')).toBeCloseTo(3000);
    expect(t.get('A')).toBeGreaterThan(1500);
  });
});

describe('wyliczanie kadry', () => {
  const player = (no: number, pos: SquadPlayer['pos'], caps: number, club: string, clubNation: string): SquadPlayer => ({
    team: 'Test', no, pos, name: `Gracz ${no}`, shortName: `G${no}`, birthDate: '1988-01-01',
    caps, goals: pos === 'FW' ? Math.round(caps / 3) : 0, club, clubNation, captain: no === 1,
  });
  const squad = [
    player(1, 'GK', 60, 'Bayern Munich', 'GER'),
    player(2, 'DF', 40, 'Juventus', 'ITA'),
    player(3, 'DF', 5, 'Klub', 'POL'),
    player(4, 'MF', 50, 'Sevilla', 'ESP'),
    player(5, 'MF', 3, 'Klub', 'POL'),
    player(6, 'FW', 70, 'Bayern Munich', 'GER'),
    player(7, 'FW', 2, 'Klub', 'POL'),
  ];

  it('jest deterministyczne', () => {
    const a = deriveSquad(squad, { teamOvr: 75, refDate: '2016-06-10', nationCode: 'TST' });
    const b = deriveSquad(squad, { teamOvr: 75, refDate: '2016-06-10', nationCode: 'TST' });
    expect(a).toEqual(b);
  });

  it('zawodnik czołowego klubu z wieloma występami jest wyżej niż debiutant z słabszej ligi', () => {
    const players = deriveSquad(squad, { teamOvr: 75, refDate: '2016-06-10', nationCode: 'TST' });
    const star = players.find((p) => p.id === 'TST-6')!;
    const rookie = players.find((p) => p.id === 'TST-7')!;
    expect(positionRating(star.attributes, 'ST', 100)).toBeGreaterThan(positionRating(rookie.attributes, 'ST', 100) + 5);
  });

  it('kapitan ma wysokie przywództwo', () => {
    const players = deriveSquad(squad, { teamOvr: 75, refDate: '2016-06-10', nationCode: 'TST' });
    expect(players.find((p) => p.id === 'TST-1')!.attributes.leadership).toBeGreaterThanOrEqual(80);
  });
});
