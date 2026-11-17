/**
 * Polska relacja tekstowa ze zdarzeń meczu. Warianty dobierane deterministycznie,
 * więc powtórka tego samego meczu ma tę samą relację.
 */
import type { MatchEvent, ShotKind } from '../engine/types';

export interface NameLookup {
  player(id: string): string;
  team(side: 'home' | 'away'): string;
}

const pick = (options: string[], key: number) => options[Math.abs(key) % options.length]!;

const GOAL_HOW: Record<ShotKind, string[]> = {
  open: ['płaskim strzałem z 12 metrów', 'precyzyjnie przy słupku', 'mocnym uderzeniem pod poprzeczkę'],
  through: ['po prostopadłym podaniu, sam na sam', 'wychodząc za plecy obrońców', 'mija bramkarza i trafia do pustej bramki'],
  cross: ['głową po dośrodkowaniu', 'wślizgiem po wrzutce z boku', 'głową na dalszym słupku'],
  solo: ['po indywidualnej akcji', 'mijając dwóch obrońców', 'po rajdzie przez pół boiska'],
  long: ['potężnym strzałem z dystansu', 'z 25 metrów, w samo okienko', 'zza pola karnego, bramkarz bez szans'],
  counter: ['po błyskawicznej kontrze', 'wykańczając kontratak', 'po szybkiej wymianie podań w kontrze'],
  corner: ['głową po rzucie rożnym', 'po zamieszaniu w polu karnym po rożnym', 'najwyżej wyskoczył po rożnym'],
  freeKick: ['bezpośrednio z rzutu wolnego', 'z wolnego nad murem', 'z rzutu wolnego, przy słupku'],
  penalty: ['z rzutu karnego', 'pewnie z jedenastu metrów', 'z karnego, bramkarz w przeciwnym rogu'],
};

const MISS: Record<'saved' | 'off' | 'blocked' | 'woodwork', string[]> = {
  saved: ['broni bramkarz', 'świetna parada bramkarza', 'bramkarz na posterunku'],
  off: ['obok słupka', 'nad poprzeczką', 'niecelnie'],
  blocked: ['zablokowany przez obrońcę', 'obrońca rzuca się pod strzał', 'blok w polu karnym'],
  woodwork: ['w słupek!', 'w poprzeczkę!', 'obija słupek!'],
};

export function minuteLabel(e: MatchEvent): string {
  if (e.kind === 'shootoutKick') return 'k.';
  return e.added ? `${e.minute}+${e.added}'` : `${e.minute}'`;
}

/** Zwraca linijkę relacji albo null, gdy zdarzenie nie jest warte relacji. */
export function describe(e: MatchEvent, names: NameLookup, key = 0): string | null {
  switch (e.kind) {
    case 'period':
      return {
        kickoff: 'Sędzia rozpoczyna mecz!',
        halftime: 'Koniec pierwszej połowy.',
        fulltime: 'Koniec meczu!',
        extraTimeStart: 'Remis po 90 minutach – będzie dogrywka.',
        extraTimeEnd: 'Koniec dogrywki.',
      }[e.period];
    case 'goal': {
      const score = `${e.score[0]}:${e.score[1]}`;
      if (e.ownGoal) return `⚽ GOL! Samobójcze trafienie – ${names.player(e.playerId)} pakuje piłkę do własnej bramki. ${score}`;
      const assist = e.assistId ? ` Asysta: ${names.player(e.assistId)}.` : '';
      return `⚽ GOL! ${names.player(e.playerId)} (${names.team(e.side)}) ${pick(GOAL_HOW[e.shot], key)}.${assist} ${score}`;
    }
    case 'shot':
      if (e.xg < 0.2 && e.outcome !== 'woodwork') return null;
      return `${e.xg >= 0.3 ? 'Wielka szansa! ' : ''}${names.player(e.playerId)} strzela – ${pick(MISS[e.outcome], key)}`;
    case 'penaltyMiss':
      return `${names.player(e.playerId)} nie wykorzystuje karnego – ${e.saved ? 'bramkarz broni!' : 'pudło!'}`;
    case 'card':
      if (e.card === 'yellow') return `🟨 Żółta kartka: ${names.player(e.playerId)} (${names.team(e.side)})`;
      if (e.card === 'secondYellow') return `🟥 Druga żółta i czerwona! ${names.player(e.playerId)} wylatuje z boiska.`;
      return `🟥 Czerwona kartka! ${names.player(e.playerId)} (${names.team(e.side)}) do szatni.`;
    case 'injury':
      return `🚑 ${names.player(e.playerId)} doznaje urazu: ${e.injury.type.toLowerCase()}${e.injury.days > 0 ? ` (ok. ${e.injury.days} dni przerwy)` : ''}.`;
    case 'sub': {
      const why = e.reason === 'injury' ? ' (uraz)' : e.reason === 'fatigue' ? ' (zmęczenie)' : '';
      return `🔄 ${names.team(e.side)}: ${names.player(e.inId)} za ${names.player(e.outId)}${why}`;
    }
    case 'shootoutKick':
      return `Karne, seria ${e.round}: ${names.player(e.playerId)} ${e.scored ? '✓ trafia' : '✗ nie trafia'}`;
  }
}
