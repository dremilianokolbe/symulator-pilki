import { useEffect, useRef, useState } from 'react';
import type { Answer, Decision } from '../../../src/career/types';
import { api } from '../api';
import { CallupView } from '../components/Callup';
import { ChoiceView, InfoView } from '../components/Basic';
import { LineupView } from '../components/Lineup';
import { LiveView } from '../components/Live';
import type { CareerStatus } from '../protocol';
import { flag, writeSave, type CareerSave } from '../util';

interface Props {
  save: CareerSave;
  onExit: () => void;
}

export function Career({ save, onExit }: Props) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [status, setStatus] = useState<CareerStatus | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<string[]>([]);
  const saveRef = useRef(save);

  const apply = (r: { decision: Decision | null; status: CareerStatus | null; done: boolean }) => {
    if (r.status) setStatus(r.status);
    setDone(r.done);
    if (r.decision?.kind === 'lineup') setFeed([]);
    const d = r.decision;
    if (d?.kind === 'live') setFeed((f) => [...f, ...d.lines]);
    // Końcówka meczu przewiniętego do końca przychodzi jako informacja z tytułem meczu.
    if (d?.kind === 'info' && / – /.test(d.title) && !d.title.startsWith('Po meczu')) setFeed((f) => [...f, ...d.lines]);
    setDecision(r.decision);
    setBusy(false);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    let cancelled = false;
    api.startCareer(save.team, save.seed, save.answers).then(
      (r) => !cancelled && apply(r),
      (e: Error) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (a: Answer) => {
    if (busy) return;
    setBusy(true);
    const next: CareerSave = { ...saveRef.current, answers: [...saveRef.current.answers, a], updatedAt: Date.now() };
    saveRef.current = next;
    writeSave(next);
    api.answer(a).then(apply, (e: Error) => setError(e.message));
  };

  const r = status?.record;
  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Menu">☰</button>
        <h1>
          {flag(save.team)} {status?.teamPl ?? ''}
        </h1>
        {status && <span className="muted small">{formatDate(status.date)}</span>}
      </div>

      {status && decision?.kind !== 'live' && (
        <div className="card">
          <div className="meters">
            <Meter label="Zaufanie federacji" value={status.trust} />
            <Meter label="Media" value={status.media} />
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>
            Cel: {status.expectation}
            {r && r.played > 0 && ` · bilans ${r.won}-${r.drawn}-${r.lost}, bramki ${r.goalsFor}:${r.goalsAgainst}`}
          </div>
        </div>
      )}

      {error && (
        <div className="card">
          <h2>Coś poszło nie tak</h2>
          <p className="mono">{error}</p>
        </div>
      )}

      {!decision && !done && !error && (
        <div className="center">
          <div>
            <div className="spinner" />
            <div className="muted">{save.answers.length ? 'Wczytuję zapis…' : 'Przygotowuję świat Euro 2016…'}</div>
          </div>
        </div>
      )}

      {decision?.kind === 'info' && <InfoView d={decision} onNext={() => answer(undefined)} busy={busy} />}
      {decision?.kind === 'choice' && <ChoiceView d={decision} onPick={answer} busy={busy} />}
      {decision?.kind === 'callup' && <CallupView key={decision.title} d={decision} onConfirm={answer} busy={busy} />}
      {decision?.kind === 'lineup' && <LineupView d={decision} onAction={answer} busy={busy} />}
      {decision?.kind === 'live' && <LiveView d={decision} feed={feed} onAction={answer} busy={busy} />}

      {done && (
        <div className="card">
          <h2>Koniec kadencji</h2>
          <p className="muted">Możesz zacząć nową karierę albo pobawić się symulacjami.</p>
          <button className="btn primary block" onClick={onExit}>Menu główne</button>
        </div>
      )}
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const cls = value < 25 ? 'bar danger' : value < 45 ? 'bar warn' : 'bar';
  return (
    <div className="meter">
      <div className="label">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className={cls}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function formatDate(d: string) {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}
