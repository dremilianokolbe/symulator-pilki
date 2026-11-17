import { flag, pl, type CareerSave } from '../util';

interface Props {
  save: CareerSave | null;
  onContinue: (save: CareerSave) => void;
  onNew: () => void;
  onSandbox: () => void;
}

export function Home({ save, onContinue, onNew, onSandbox }: Props) {
  return (
    <div className="app">
      <div className="hero">
        <h1>Selekcjoner</h1>
        <p>Symulator piłki nożnej · Euro 2016</p>
      </div>

      {save && (
        <button className="card tile" onClick={() => onContinue(save)}>
          <div className="title">
            {flag(save.team)} Kontynuuj karierę: {pl(save.team)}
          </div>
          <div className="desc">
            {save.answers.length} decyzji · zapisano {new Date(save.updatedAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </button>
      )}

      <button className="card tile" onClick={onNew}>
        <div className="title">🧑‍💼 Nowa kariera selekcjonera</div>
        <div className="desc">
          Dowolna z 54 reprezentacji, od eliminacji we wrześniu 2014 do finału Euro 2016. Powołania, sparingi, konferencje,
          mecz na żywo, federacja patrzy Ci na ręce.
        </div>
        {save && <div className="desc small">Nowa kariera zastąpi obecny zapis.</div>}
      </button>

      <button className="card tile" onClick={onSandbox}>
        <div className="title">🎲 Euro 2016: symulacje</div>
        <div className="desc">Całe eliminacje i turniej jednym przyciskiem albo tysiące przebiegów z szansami każdej drużyny.</div>
      </button>

      <p className="muted small">
        Dane: wyniki reprezentacji (martj42/international_results, CC0), kadry i pozycje z Wikipedii (CC BY-SA 4.0), zawodnicy i kluby z
        Wikidata (CC0). Atrybuty zawodników są wyliczane z danych, nie są oficjalne.
      </p>
    </div>
  );
}
