import type { Decision } from '../../../src/career/types';
import { ActionBar } from './ActionBar';

/** Linie tabel (np. „1. ▶ Polska …”) pokazujemy czcionką o stałej szerokości. */
const isTableLine = (l: string) => /^\s*\d+\.\s/.test(l) || /^Grupa [A-F]:/.test(l);

export function InfoView({ d, onNext, busy }: { d: Extract<Decision, { kind: 'info' }>; onNext: () => void; busy: boolean }) {
  const table = d.lines.filter(isTableLine).length >= 3;
  return (
    <>
      <div className="card">
        <h2>{d.title}</h2>
        {table ? (
          <div className="mono">{d.lines.join('\n')}</div>
        ) : (
          <div className="lines">
            {d.lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        )}
      </div>
      <ActionBar>
        <button className="btn primary" onClick={onNext} disabled={busy}>
          Dalej
        </button>
      </ActionBar>
    </>
  );
}

export function ChoiceView({ d, onPick, busy }: { d: Extract<Decision, { kind: 'choice' }>; onPick: (id: string) => void; busy: boolean }) {
  return (
    <div className="card">
      <h2>{d.title}</h2>
      <p>{d.text}</p>
      {d.options.map((o) => (
        <button key={o.id} className="btn option" onClick={() => onPick(o.id)} disabled={busy}>
          {o.label}
          {o.hint && <span className="hint">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}
