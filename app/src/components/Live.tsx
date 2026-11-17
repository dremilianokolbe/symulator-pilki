import { useEffect, useRef, useState } from 'react';
import { STYLE_PRESETS, type Decision, type LiveAction, type StylePreset } from '../../../src/career/types';
import { POSITION_LABEL } from '../../../src/engine/attributes';
import { ActionBar } from './ActionBar';
import { PlayerItem } from './PlayerItem';

type Sheet = null | 'sub-out' | { inFor: string } | 'style';

export function LiveView({ d, feed, onAction, busy }: { d: Extract<Decision, { kind: 'live' }>; feed: string[]; onAction: (a: LiveAction) => void; busy: boolean }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const end = useRef<HTMLLIElement>(null);
  const [home, away] = d.title.split(' – ');

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [feed.length]);

  const act = (a: LiveAction) => {
    setSheet(null);
    onAction(a);
  };

  return (
    <>
      <div className="scoreboard">
        <div className="team">{home}</div>
        <div>
          <div className="score">
            {d.score[0]}:{d.score[1]}
          </div>
          <div className="minute">{d.minuteLabel}</div>
        </div>
        <div className="team">{away}</div>
      </div>

      <div className="card" style={{ padding: '4px 12px' }}>
        <ul className="feed">
          {feed.length === 0 && <li><span /> <span className="muted">Mecz się zaczyna…</span></li>}
          {feed.map((l, i) => {
            const m = l.match(/^\s*(\S+)\s{2}(.*)$/);
            const min = m ? m[1] : '';
            const text = m ? m[2]! : l.trim();
            return (
              <li key={i} className={text.includes('GOL!') ? 'goal' : ''}>
                <span className="min">{min}</span>
                <span>{text}</span>
              </li>
            );
          })}
          <li ref={end} style={{ display: 'none' }} />
        </ul>
      </div>
      {d.advice && <div className="advice">{d.advice}</div>}
      <p className="small muted">
        Styl: {STYLE_PRESETS[d.style].label} · zmiany: {d.subsLeft}
      </p>

      <ActionBar>
        <button className="btn" disabled={busy || d.subsLeft <= 0} onClick={() => setSheet('sub-out')}>
          Zmiana
        </button>
        <button className="btn" disabled={busy} onClick={() => setSheet('style')}>
          Styl
        </button>
        <button className="btn" disabled={busy} onClick={() => act({ type: 'toEnd' })}>
          ⏩
        </button>
        <button className="btn primary" disabled={busy} onClick={() => act({ type: 'continue' })}>
          Dalej
        </button>
      </ActionBar>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {sheet === 'style' && (
              <>
                <h2>Styl gry</h2>
                {(Object.keys(STYLE_PRESETS) as StylePreset[]).map((s) => (
                  <button key={s} className={`btn option${s === d.style ? ' primary' : ''}`} onClick={() => act({ type: 'style', style: s })}>
                    {STYLE_PRESETS[s].label}
                  </button>
                ))}
              </>
            )}
            {sheet === 'sub-out' && (
              <>
                <h2>Kto schodzi?</h2>
                <ul className="list">
                  {d.onPitch.map((p) => (
                    <PlayerItem key={p.id} p={p} pos={p.slot} extra={`kondycja ${p.condition}%`} onClick={() => setSheet({ inFor: p.id })} />
                  ))}
                </ul>
              </>
            )}
            {typeof sheet === 'object' && sheet && 'inFor' in sheet && (
              <>
                <h2>Kto wchodzi?</h2>
                <p className="small muted">
                  Schodzi: {d.onPitch.find((p) => p.id === sheet.inFor)?.name}. Wchodzący zagra na pozycji{' '}
                  {POSITION_LABEL[d.onPitch.find((p) => p.id === sheet.inFor)?.slot ?? 'MC']}.
                </p>
                <ul className="list">
                  {d.bench.map((p) => (
                    <PlayerItem key={p.id} p={p} onClick={() => act({ type: 'sub', outId: sheet.inFor, inId: p.id })} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
