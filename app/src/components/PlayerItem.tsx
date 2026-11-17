import type { PlayerRow } from '../../../src/career/types';
import { POSITION_LABEL, type Position } from '../../../src/engine/attributes';

interface Props {
  p: PlayerRow;
  pos?: Position;
  selected?: boolean;
  check?: boolean;
  extra?: string;
  onClick?: () => void;
}

export function PlayerItem({ p, pos, selected, check, extra, onClick }: Props) {
  const form = p.form >= 6 ? <span className="form-up">▲ forma</span> : p.form <= -6 ? <span className="form-down">▼ forma</span> : null;
  return (
    <li className={`player${selected ? ' selected' : ''}${p.available ? '' : ' unavailable'}`} onClick={onClick}>
      {check ? <span className="check">{selected ? '✓' : ''}</span> : <span className="pos">{POSITION_LABEL[pos ?? p.position]}</span>}
      <div style={{ minWidth: 0 }}>
        <div className="name">
          {p.name}
          {p.status && <span className={`chip ${p.available ? 'warn' : 'danger'}`}>{p.status}</span>}
        </div>
        <div className="meta">
          {check && `${POSITION_LABEL[p.position]} · `}
          {p.age} l. · {p.club || '—'} {form && <> · {form}</>} {extra && ` · ${extra}`}
        </div>
      </div>
      <span className="rating">{p.rating}</span>
    </li>
  );
}
