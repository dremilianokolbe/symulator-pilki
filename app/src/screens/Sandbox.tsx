import { useState } from 'react';
import { api } from '../api';
import type { EuroRunView, TableRow, TallyRow } from '../protocol';
import { flag, pct, pl } from '../util';

type Tab = 'q' | 'po' | 'groups' | 'ko' | 'scorers';

export function Sandbox({ onBack }: { onBack: () => void }) {
  const [finalsOnly, setFinalsOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<EuroRunView | null>(null);
  const [tally, setTally] = useState<{ rows: TallyRow[]; total: number; finalsOnly: boolean } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [tab, setTab] = useState<Tab>('groups');
  const [error, setError] = useState<string | null>(null);
  const [mcSize, setMcSize] = useState(200);

  const once = async () => {
    setBusy(true);
    setError(null);
    setTally(null);
    try {
      const r = await api.euroOnce(Math.floor(Math.random() * 1e9), finalsOnly);
      setRun(r);
      setTab(finalsOnly ? 'groups' : 'q');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const monteCarlo = async () => {
    setBusy(true);
    setError(null);
    setRun(null);
    setProgress({ done: 0, total: mcSize });
    const started = performance.now();
    try {
      const rows = await api.monteCarlo(mcSize, finalsOnly, (done) => setProgress({ done, total: mcSize }));
      setTally({ rows, total: mcSize, finalsOnly });
      console.info(`Monte Carlo: ${mcSize} przebiegów w ${((performance.now() - started) / 1000).toFixed(1)} s`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const sizes = finalsOnly ? [200, 1000, 5000] : [50, 200, 1000];

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Wstecz">←</button>
        <h1>Euro 2016: symulacje</h1>
      </div>

      <div className="card">
        <div className="segments">
          <button className={`segment${!finalsOnly ? ' active' : ''}`} onClick={() => { setFinalsOnly(false); setMcSize(200); }} disabled={busy}>
            Eliminacje + turniej
          </button>
          <button className={`segment${finalsOnly ? ' active' : ''}`} onClick={() => { setFinalsOnly(true); setMcSize(1000); }} disabled={busy}>
            Tylko turniej (prawdziwe losowanie)
          </button>
        </div>
        <button className="btn primary block" onClick={once} disabled={busy} style={{ marginTop: 8 }}>
          ▶ Rozegraj raz
        </button>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn grow" onClick={monteCarlo} disabled={busy}>
            📊 Szanse: {mcSize} przebiegów
          </button>
          <div className="segments">
            {sizes.map((n) => (
              <button key={n} className={`segment${mcSize === n ? ' active' : ''}`} onClick={() => setMcSize(n)} disabled={busy}>
                {n}
              </button>
            ))}
          </div>
        </div>
        {!finalsOnly && <p className="small muted">Pełny przebieg to ok. 330 meczów; na telefonie 200 przebiegów zajmuje chwilę.</p>}
      </div>

      {error && <div className="card mono">{error}</div>}
      {busy && !progress && (
        <div className="center">
          <div>
            <div className="spinner" />
            <div className="muted">Gramy…</div>
          </div>
        </div>
      )}
      {progress && (
        <div className="card">
          <div className="row small muted">
            <span className="grow">Symulacje</span>
            <span>
              {progress.done}/{progress.total}
            </span>
          </div>
          <div className="progress" style={{ marginTop: 6 }}>
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {run && <RunView run={run} tab={tab} setTab={setTab} />}
      {tally && <TallyView {...tally} />}
    </div>
  );
}

function Standings({ rows, cut = 2 }: { rows: TableRow[]; cut?: number }) {
  return (
    <table className="standings">
      <thead>
        <tr>
          <th className="team">Drużyna</th>
          <th>M</th>
          <th>Bilans</th>
          <th>Bramki</th>
          <th>Pkt</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.team} className={i === cut ? 'cut' : ''}>
            <td className="team">
              {i + 1}. {flag(r.team)} {pl(r.team)}
            </td>
            <td>{r.played}</td>
            <td>
              {r.won}-{r.drawn}-{r.lost}
            </td>
            <td>
              {r.goalsFor}:{r.goalsAgainst}
            </td>
            <td>
              <b>{r.points}</b>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RunView({ run, tab, setTab }: { run: EuroRunView; tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: [Tab, string][] = run.finalsOnly
    ? [['groups', 'Grupy'], ['ko', 'Drabinka'], ['scorers', 'Strzelcy']]
    : [['q', 'Eliminacje'], ['po', 'Baraże'], ['groups', 'Grupy'], ['ko', 'Drabinka'], ['scorers', 'Strzelcy']];
  let round = '';
  return (
    <>
      <div className="card champion">
        🏆 {flag(run.champion)} {pl(run.champion)}
        <div className="small muted" style={{ fontWeight: 400 }}>
          Mistrz Europy w tym świecie · naprawdę: 🇵🇹 Portugalia
        </div>
      </div>
      <div className="segments">
        {tabs.map(([t, label]) => (
          <button key={t} className={`segment${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'q' &&
        run.qualifying.map((g) => (
          <div key={g.letter} className="card">
            <h3>Grupa {g.letter}</h3>
            <Standings rows={g.rows} />
          </div>
        ))}
      {tab === 'q' && run.bestThird && <p className="small muted">Najlepsza 3. drużyna (awans bez baraży): {pl(run.bestThird)}.</p>}

      {tab === 'po' && (
        <div className="card">
          <h3>Baraże (listopad 2015)</h3>
          {run.playoffs.map((p, i) => (
            <div key={i} className="match">
              <div className="line">
                <span>
                  {flag(p.away)} {pl(p.away)} – {flag(p.home)} {pl(p.home)}
                </span>
                <span className="sc">
                  {p.firstLeg}, {p.awayGoals}:{p.homeGoals}
                  {p.extra && ` (${p.extra})`}
                </span>
              </div>
              <div className="details">
                Awans: <b>{pl(p.winner)}</b>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'groups' &&
        run.groups.map((g) => (
          <div key={g.letter} className="card">
            <h3>Grupa {g.letter}</h3>
            <Standings rows={g.rows} />
          </div>
        ))}

      {tab === 'ko' && (
        <div className="card">
          {run.knockout.map((m, i) => {
            const header = m.round && m.round !== round ? m.round : null;
            if (m.round) round = m.round;
            return (
              <div key={i}>
                {header && <h3 style={{ marginTop: i ? 12 : 0 }}>{header}</h3>}
                <div className="match">
                  <div className="line">
                    <span>
                      {flag(m.home)} {pl(m.home)} – {flag(m.away)} {pl(m.away)}
                    </span>
                    <span className="sc">
                      {m.homeGoals}:{m.awayGoals}
                      {m.extra && ` (${m.extra})`}
                    </span>
                  </div>
                  {m.scorers.length > 0 && <div className="details">{m.scorers.join(', ')}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'scorers' && (
        <div className="card">
          <h3>Najlepsi strzelcy{run.finalsOnly ? '' : ' (eliminacje + turniej)'}</h3>
          <ul className="list">
            {run.scorers.map((s, i) => (
              <li key={i} className="player" style={{ cursor: 'default' }}>
                <span className="pos">{i + 1}</span>
                <div>
                  <div className="name">{s.name}</div>
                  <div className="meta">
                    {flag(s.team)} {pl(s.team)}
                  </div>
                </div>
                <span className="rating">{s.goals}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const REAL: Record<string, string> = {
  Portugal: 'mistrz', France: 'finał', Germany: '1/2', Wales: '1/2', Poland: '1/4', Belgium: '1/4', Italy: '1/4', Iceland: '1/4',
  Switzerland: '1/8', Croatia: '1/8', 'Northern Ireland': '1/8', Slovakia: '1/8', Hungary: '1/8', England: '1/8', Spain: '1/8',
  'Republic of Ireland': '1/8', Albania: 'grupa', Romania: 'grupa', Russia: 'grupa', Ukraine: 'grupa', Turkey: 'grupa',
  'Czech Republic': 'grupa', Sweden: 'grupa', Austria: 'grupa',
};

function TallyView({ rows, total, finalsOnly }: { rows: TallyRow[]; total: number; finalsOnly: boolean }) {
  const sorted = [...rows].sort((a, b) => b.champion - a.champion || b.SF - a.SF || b.qualified - a.qualified).filter((r) => r.qualified > 0 || !finalsOnly);
  const cols: [keyof TallyRow, string][] = finalsOnly
    ? [['groupWin', '1. gr.'], ['R16', '1/8'], ['QF', '1/4'], ['SF', '1/2'], ['final', 'Fin.'], ['champion', 'Mistrz']]
    : [['qualified', 'Euro'], ['R16', '1/8'], ['QF', '1/4'], ['SF', '1/2'], ['final', 'Fin.'], ['champion', 'Mistrz']];
  return (
    <div className="card" style={{ padding: '8px 10px', overflowX: 'auto' }}>
      <h3>Szanse ({total} przebiegów)</h3>
      <table className="prob">
        <thead>
          <tr>
            <th className="team">Drużyna</th>
            {cols.map(([, l]) => (
              <th key={l}>{l}</th>
            ))}
            <th>Naprawdę</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.team}>
              <td className="team">
                {flag(r.team)} {pl(r.team)}
              </td>
              {cols.map(([k]) => {
                const v = (r[k] as number) / total;
                return (
                  <td key={k} className={k === 'champion' && v >= 0.1 ? 'hot' : ''}>
                    {pct(v)}
                  </td>
                );
              })}
              <td className="muted">{REAL[r.team] ?? (finalsOnly ? '' : 'el.')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
