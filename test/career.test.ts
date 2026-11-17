import { describe, expect, it } from 'vitest';
import { careerFlow, type CareerSummary } from '../src/career/flow';
import { loadCareerConfig } from '../src/node/load';
import type { Answer, Decision } from '../src/career/types';

/** Automatyczny gracz: pierwsza opcja, sugestie asystenta, mecze do końca. */
function autoAnswer(d: Decision): Answer {
  switch (d.kind) {
    case 'info': return undefined;
    case 'choice': return d.options[0]!.id;
    case 'callup': return d.suggested;
    case 'lineup': return { type: 'accept' };
    case 'live': return { type: 'toEnd' };
  }
}

function playCareer(team: string, seed: number): { summary: CareerSummary; decisions: Decision[] } {
  const flow = careerFlow(loadCareerConfig(team, seed));
  const decisions: Decision[] = [];
  let step = flow.next();
  while (!step.done) {
    decisions.push(step.value);
    step = flow.next(autoAnswer(step.value));
  }
  return { summary: step.value, decisions };
}

describe('kariera selekcjonera', () => {
  it('Polska: pełna kampania od eliminacji do końca Euro', () => {
    const { summary, decisions } = playCareer('Poland', 42);
    expect(summary.run?.champion).toBeTruthy();
    expect(summary.state.record.played).toBeGreaterThanOrEqual(10);
    // Każde powołanie ma dokładnie 23 zawodników.
    for (const d of decisions) if (d.kind === 'callup') expect(d.suggested).toHaveLength(23);
    // Zawieszony ani kontuzjowany zawodnik nie wychodzi w składzie meczu o punkty.
    for (const d of decisions) {
      if (d.kind !== 'lineup' || d.title.startsWith('Mecz towarzyski')) continue;
      for (const s of d.starters) {
        expect(s.status.includes('zawieszony')).toBe(false);
        expect(s.available).toBe(true);
      }
    }
  }, 120_000);

  it('Francja (gospodarz): bez eliminacji, od razu turniej', () => {
    const { summary, decisions } = playCareer('France', 7);
    expect(decisions.some((d) => d.kind === 'lineup' && d.title.includes('Eliminacje'))).toBe(false);
    expect(decisions.some((d) => d.kind === 'lineup' && d.title.includes('Euro 2016'))).toBe(true);
    expect(summary.stage).not.toBe('qualifyingGroup');
  }, 120_000);

  it('ten sam seed i te same odpowiedzi dają ten sam przebieg (zapis gry)', () => {
    const a = playCareer('Gibraltar', 3);
    const b = playCareer('Gibraltar', 3);
    expect(a.summary.state.record).toEqual(b.summary.state.record);
    expect(a.summary.run?.champion).toBe(b.summary.run?.champion);
    expect(a.decisions.length).toBe(b.decisions.length);
  }, 120_000);
});
