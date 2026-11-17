import { useState } from 'react';
import { STYLE_PRESETS, type Decision, type LineupAction, type StylePreset } from '../../../src/career/types';
import type { Position } from '../../../src/engine/attributes';
import { FORMATIONS, type FormationId } from '../../../src/engine/types';
import { ActionBar } from './ActionBar';
import { PlayerItem } from './PlayerItem';

/** Pozycje na boisku (x, y w %), atak w górę. */
const BASE: Record<Position, [number, number]> = {
  GK: [50, 90], DL: [15, 72], DC: [50, 75], DR: [85, 72], WBL: [11, 57], WBR: [89, 57], DM: [50, 61],
  ML: [14, 44], MC: [50, 47], MR: [86, 44], AML: [18, 28], AMC: [50, 31], AMR: [82, 28], ST: [50, 13],
};
const SPREAD: Record<number, number[]> = { 1: [0], 2: [-16, 16], 3: [-24, 0, 24] };

export function slotCoords(slots: Position[]): [number, number][] {
  const seen = new Map<Position, number>();
  return slots.map((pos) => {
    const total = slots.filter((p) => p === pos).length;
    const i = seen.get(pos) ?? 0;
    seen.set(pos, i + 1);
    const [x, y] = BASE[pos];
    return [x + (SPREAD[total]?.[i] ?? 0), y];
  });
}

export function LineupView({ d, onAction, busy }: { d: Extract<Decision, { kind: 'lineup' }>; onAction: (a: LineupAction) => void; busy: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const coords = slotCoords(d.starters.map((s) => s.slot));

  return (
    <>
      <div className="card">
        <h2>{d.title}</h2>
        {d.report.map((l, i) => (
          <p key={i} className={i === 0 ? 'small muted' : 'small'} style={{ margin: '2px 0' }}>
            {l}
          </p>
        ))}
      </div>

      <h3 className="small muted">FORMACJA</h3>
      <div className="segments">
        {(Object.keys(FORMATIONS) as FormationId[]).map((f) => (
          <button key={f} className={`segment${f === d.formation ? ' active' : ''}`} disabled={busy} onClick={() => f !== d.formation && onAction({ type: 'formation', formation: f })}>
            {f}
          </button>
        ))}
      </div>
      <h3 className="small muted">STYL GRY</h3>
      <div className="segments">
        {(Object.keys(STYLE_PRESETS) as StylePreset[]).map((s) => (
          <button key={s} className={`segment${s === d.style ? ' active' : ''}`} disabled={busy} onClick={() => s !== d.style && onAction({ type: 'style', style: s })}>
            {STYLE_PRESETS[s].label}
          </button>
        ))}
      </div>

      <div className="pitch">
        {d.starters.map((s, i) => (
          <button
            key={s.id}
            className={`slot${picked === s.id ? ' selected' : ''}`}
            style={{ left: `${coords[i]![0]}%`, top: `${coords[i]![1]}%` }}
            onClick={() => setPicked(picked === s.id ? null : s.id)}
          >
            <span className="dot">{s.rating}</span>
            <span className="label">{s.name.split(' ').slice(-1)[0]}</span>
          </button>
        ))}
      </div>
      <p className="small muted">
        {picked ? 'Wybierz rezerwowego, który ma wejść za zaznaczonego zawodnika.' : 'Dotknij zawodnika na boisku, a potem rezerwowego, żeby ich zamienić.'}
      </p>

      <div className="card" style={{ padding: '12px 12px 4px' }}>
        <h3>Ławka</h3>
        <ul className="list">
          {d.bench.map((p) => (
            <PlayerItem
              key={p.id}
              p={p}
              onClick={() => {
                if (!picked || busy) return;
                onAction({ type: 'swap', outId: picked, inId: p.id });
                setPicked(null);
              }}
            />
          ))}
        </ul>
      </div>

      <div className="card" style={{ padding: '12px 12px 4px' }}>
        <h3>Wyjściowa jedenastka</h3>
        <ul className="list">
          {d.starters.map((s) => (
            <PlayerItem key={s.id} p={s} pos={s.slot} selected={picked === s.id} onClick={() => setPicked(picked === s.id ? null : s.id)} />
          ))}
        </ul>
      </div>

      <ActionBar>
        <button className="btn primary" disabled={busy} onClick={() => onAction({ type: 'accept' })}>
          Rozpocznij mecz
        </button>
      </ActionBar>
    </>
  );
}
