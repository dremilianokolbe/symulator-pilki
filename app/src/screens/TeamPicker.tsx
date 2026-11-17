import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TeamInfo } from '../protocol';
import { flag } from '../util';

interface Props {
  onBack: () => void;
  onPick: (team: string) => void;
}

export function TeamPicker({ onBack, onPick }: Props) {
  const [teams, setTeams] = useState<TeamInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.teams().then(setTeams, (e: Error) => setError(e.message));
  }, []);

  const max = teams?.[0]?.elo ?? 2100;
  const min = teams?.[teams.length - 1]?.elo ?? 800;
  const shown = (teams ?? []).filter((t) => t.pl.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Wstecz">←</button>
        <h1>Wybierz reprezentację</h1>
      </div>
      {error && <div className="card">{error}</div>}
      {!teams && !error && (
        <div className="center">
          <div>
            <div className="spinner" />
            <div className="muted">Buduję świat: 54 reprezentacje, ok. 2000 zawodników…</div>
          </div>
        </div>
      )}
      {teams && (
        <>
          <p className="muted small">Ranking Elo z września 2014, przed startem eliminacji. Im niżej, tym trudniej – i tym ciekawiej.</p>
          <input className="search" placeholder="Szukaj…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="list card" style={{ padding: '4px 12px' }}>
            {shown.map((t) => (
              <li key={t.team} className="player" onClick={() => onPick(t.team)}>
                <span style={{ fontSize: 24 }}>{flag(t.team)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="name">{t.pl}</div>
                  <div className="meta">{t.group === 'gospodarz' ? 'Gospodarz Euro – bez eliminacji' : `Eliminacje: grupa ${t.group}`}</div>
                  <div className="bar" style={{ maxWidth: 160 }}>
                    <span style={{ width: `${Math.round(((t.elo - min) / (max - min)) * 100)}%` }} />
                  </div>
                </div>
                <span className="rating">{t.elo}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
