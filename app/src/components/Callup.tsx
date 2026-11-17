import { useState } from 'react';
import type { Decision, PlayerRow } from '../../../src/career/types';
import type { Position } from '../../../src/engine/attributes';
import { ActionBar } from './ActionBar';
import { PlayerItem } from './PlayerItem';

const GROUPS: { label: string; positions: Position[] }[] = [
  { label: 'Bramkarze', positions: ['GK'] },
  { label: 'Obrońcy', positions: ['DC', 'DL', 'DR', 'WBL', 'WBR'] },
  { label: 'Pomocnicy', positions: ['DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR'] },
  { label: 'Napastnicy', positions: ['ST'] },
];

export function CallupView({ d, onConfirm, busy }: { d: Extract<Decision, { kind: 'callup' }>; onConfirm: (ids: string[]) => void; busy: boolean }) {
  const [chosen, setChosen] = useState(() => new Set(d.suggested));
  const toggle = (p: PlayerRow) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(p.id)) n.delete(p.id);
      else n.add(p.id);
      return n;
    });
  const count = chosen.size;
  const inGroup = (g: (typeof GROUPS)[number]) => d.pool.filter((p) => g.positions.includes(p.position)).sort((a, b) => b.rating - a.rating);

  return (
    <>
      <div className="card">
        <h2>{d.title}</h2>
        <p className="muted small">Asystent zaznaczył swoją propozycję. Dotknij zawodnika, żeby go dodać albo usunąć.</p>
        <button className="btn ghost small" onClick={() => setChosen(new Set(d.suggested))}>
          ↺ Przywróć sugestię asystenta
        </button>
      </div>
      {GROUPS.map((g) => {
        const players = inGroup(g);
        const n = players.filter((p) => chosen.has(p.id)).length;
        return (
          <div key={g.label} className="card" style={{ padding: '12px 12px 4px' }}>
            <h3>
              {g.label} · {n}
            </h3>
            <ul className="list">
              {players.map((p) => (
                <PlayerItem key={p.id} p={p} check selected={chosen.has(p.id)} onClick={() => toggle(p)} />
              ))}
            </ul>
          </div>
        );
      })}
      <ActionBar>
        <button className="btn primary" disabled={busy || count !== d.size} onClick={() => onConfirm([...chosen])}>
          {count === d.size ? `Powołaj ${count} zawodników` : `Powołanych ${count}/${d.size}`}
        </button>
      </ActionBar>
    </>
  );
}
