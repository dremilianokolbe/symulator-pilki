/**
 * Treści kariery: media (prawdziwe tytuły), pytania na konferencjach, zdarzenia losowe, sztab.
 */
import type { Rng } from '../engine/rng';
import type { CareerState, Option, StaffMember } from './types';

/** Najważniejszy tytuł sportowy danego kraju (do nagłówków). */
export const OUTLETS: Record<string, string> = {
  Poland: 'Przegląd Sportowy', Germany: 'Kicker', England: 'The Sun', Spain: 'Marca', Italy: 'La Gazzetta dello Sport',
  France: "L'Équipe", Netherlands: 'De Telegraaf', Portugal: 'A Bola', Belgium: 'Het Nieuwsblad', Scotland: 'Daily Record',
  Wales: 'WalesOnline', Croatia: 'Sportske novosti', Russia: 'Sport-Express', Ukraine: 'Sport-Express Ukraina',
  Turkey: 'Fanatik', Sweden: 'Aftonbladet', 'Republic of Ireland': 'Irish Independent', 'Northern Ireland': 'Belfast Telegraph',
  Austria: 'Kronen Zeitung', Switzerland: 'Blick', 'Czech Republic': 'Sport', Iceland: 'Morgunblaðið', Hungary: 'Nemzeti Sport',
  Denmark: 'Ekstra Bladet', Norway: 'VG', Greece: 'Sport24', Serbia: 'Sportski žurnal', Romania: 'Gazeta Sporturilor',
};
export const outlet = (team: string) => OUTLETS[team] ?? 'Krajowa prasa sportowa';

export interface Effect {
  trust?: number;
  media?: number;
  /** Zmiana morale całej kadry. */
  morale?: number;
  /** Zmiana morale jednego zawodnika (wskazanego w zdarzeniu). */
  playerMorale?: number;
  playerForm?: number;
  text: string;
}

export interface PressQuestion {
  /** Czy pytanie ma sens teraz (domyślnie zawsze). */
  applies?: (s: CareerState) => boolean;
  text: (s: CareerState, ctx: { opponent: string }) => string;
  answers: (Option & { effect: Effect })[];
}

export const PRESS_QUESTIONS: PressQuestion[] = [
  {
    text: (s, c) => `${outlet(s.team)}: „Czy ${c.opponent} to rywal, którego trzeba pokonać bez dyskusji?”`,
    answers: [
      { id: 'pewnie', label: 'Tak, gramy o zwycięstwo i nic innego mnie nie interesuje.', effect: { media: 6, trust: 2, morale: 3, text: 'Kibice kupili tę pewność siebie.' } },
      { id: 'szacunek', label: 'Szanujemy każdego rywala, skupiamy się na sobie.', effect: { media: 0, text: 'Spokojna, wyważona odpowiedź.' } },
      { id: 'ostroznie', label: 'To trudny rywal, remis nie byłby złym wynikiem.', effect: { media: -6, trust: -3, morale: -2, text: 'Media uznały to za asekuranctwo.' } },
    ],
  },
  {
    applies: (s) => s.record.played >= 2 && s.record.goalsFor <= s.record.played * 1.5,
    text: () => `Dziennikarz pyta o krytykę taktyki: „Dlaczego drużyna gra tak zachowawczo?”`,
    answers: [
      { id: 'bron', label: 'Wyniki bronią się same. Mam plan i się go trzymam.', effect: { media: -2, trust: 2, text: 'Federacja doceniła konsekwencję, część mediów nie.' } },
      { id: 'zmiana', label: 'Słyszę głosy kibiców. Zobaczycie odważniejszą drużynę.', effect: { media: 5, morale: 2, text: 'Media zadowolone, zawodnicy zmotywowani.' } },
      { id: 'atak', label: 'Niech ci, co krytykują, sami spróbują poprowadzić kadrę.', effect: { media: -8, trust: -2, text: 'Ostra wymiana zdań trafiła na pierwsze strony.' } },
    ],
  },
  {
    text: (s) => `${outlet(s.team)}: „Czy kapitan ma zagwarantowane miejsce w składzie?”`,
    answers: [
      { id: 'tak', label: 'Kapitan jest liderem tej drużyny. Tak.', effect: { morale: 3, media: 1, text: 'Szatnia odebrała to jako jasny sygnał.' } },
      { id: 'forma', label: 'Nikt nie ma miejsca na stałe. Gra ten, kto jest w formie.', effect: { morale: -2, media: 3, trust: 1, text: 'Konkurencja w kadrze – media to lubią, szatnia mniej.' } },
    ],
  },
  {
    text: () => 'Pytanie o młodzież: „Kiedy zobaczymy w kadrze więcej młodych zawodników?”',
    answers: [
      { id: 'teraz', label: 'Młodzi dostaną szansę już w tym zgrupowaniu.', effect: { media: 4, trust: 1, text: 'Federacja i media chwalą odwagę.' } },
      { id: 'cierpliwosc', label: 'Teraz liczy się wynik. Na eksperymenty przyjdzie czas.', effect: { trust: 2, media: -2, text: 'Pragmatyczna odpowiedź.' } },
    ],
  },
];

export interface CareerEvent {
  /** Czy zdarzenie ma sens w tej chwili (np. wymaga gwiazdy w kadrze). */
  applies: (s: CareerState) => boolean;
  /** Wybiera zawodnika, którego dotyczy (opcjonalnie). */
  player?: (s: CareerState, rng: Rng) => string | undefined;
  title: string;
  text: (s: CareerState, playerName: string) => string;
  options: (Option & { effect: Effect })[];
}

const starOf = (s: CareerState, rng: Rng) => {
  const ids = [...s.pool.keys()].filter((id) => (s.status.get(id)?.injuryDays ?? 0) === 0);
  const top = ids.sort((a, b) => overall(s, b) - overall(s, a)).slice(0, 5);
  return top.length ? rng.pick(top) : undefined;
};
const benchwarmer = (s: CareerState, rng: Rng) => {
  const ids = s.calledUp.filter((id) => (s.status.get(id)?.morale ?? 50) < 55);
  return ids.length ? rng.pick(ids) : s.calledUp.length ? rng.pick(s.calledUp) : undefined;
};
const youngster = (s: CareerState, rng: Rng) => {
  const ids = [...s.pool.keys()].filter((id) => (s.pool.get(id)?.age ?? 30) <= 21 && !s.calledUp.includes(id));
  return ids.length ? rng.pick(ids) : undefined;
};
export function overall(s: CareerState, id: string): number {
  const p = s.pool.get(id);
  if (!p) return 0;
  const a = p.attributes;
  return (a.finishing + a.passing + a.tackling + a.positioning + a.pace + a.decisions + a.reflexes) / 7;
}

export const EVENTS: CareerEvent[] = [
  {
    applies: (s) => s.calledUp.length > 0,
    player: benchwarmer,
    title: 'Zawodnik prosi o rozmowę',
    text: (_s, name) => `${name} jest niezadowolony z liczby minut w kadrze. Prosi o szczerą rozmowę.`,
    options: [
      { id: 'obietnica', label: 'Obiecaj mu więcej gry', effect: { playerMorale: 20, morale: -2, text: 'Zadowolony, ale reszta zauważyła, że głośniejsi dostają więcej.' } },
      { id: 'szczerze', label: 'Wyjaśnij szczerze jego rolę', effect: { playerMorale: 5, text: 'Rozmowa oczyściła atmosferę.' } },
      { id: 'zbyj', label: 'Zbyj go krótko', effect: { playerMorale: -15, media: -3, text: 'Wkrótce o konflikcie piszą gazety.' } },
    ],
  },
  {
    applies: () => true,
    player: starOf,
    title: 'Gwiazda krytykuje w wywiadzie',
    text: (s, name) => `${outlet(s.team)} publikuje wywiad z ${name}: „Ta drużyna gra za mało odważnie”.`,
    options: [
      { id: 'publicznie', label: 'Odpowiedz publicznie', effect: { playerMorale: -12, media: 4, trust: -2, text: 'Medialna burza. Autorytet obroniony, relacja nadszarpnięta.' } },
      { id: 'prywatnie', label: 'Rozmowa w cztery oczy', effect: { playerMorale: 6, morale: 2, text: 'Sprawa wyjaśniona bez rozgłosu.' } },
      { id: 'ignoruj', label: 'Zignoruj', effect: { media: -3, morale: -2, text: 'Część szatni uznała to za słabość.' } },
    ],
  },
  {
    applies: () => true,
    player: youngster,
    title: 'Młody talent puka do kadry',
    text: (_s, name) => `Media zachwycają się formą ${name} w klubie. Kibice pytają, czy dostanie szansę.`,
    options: [
      { id: 'powolaj', label: 'Zapowiedz powołanie', effect: { playerMorale: 20, playerForm: 4, media: 5, text: 'Młody piłkarz w siódmym niebie.' } },
      { id: 'obserwuj', label: 'Na razie obserwujemy', effect: { media: -1, text: 'Ostrożne podejście.' } },
    ],
  },
  {
    applies: () => true,
    title: 'Prezes federacji pyta o cele',
    text: (s) => `Prezes federacji chce usłyszeć Twoje cele na tę kampanię. Oczekiwania: ${s.expectation.label}.`,
    options: [
      { id: 'wiecej', label: 'Obiecaj więcej, niż oczekują', effect: { trust: 8, text: 'Prezes zachwycony. Teraz trzeba dowieźć.' } },
      { id: 'realnie', label: 'Potwierdź realne cele', effect: { trust: 2, text: 'Rzeczowa rozmowa.' } },
      { id: 'mniej', label: 'Studź oczekiwania', effect: { trust: -5, media: -3, text: 'Prezes niezadowolony z braku ambicji.' } },
    ],
  },
  {
    applies: () => true,
    title: 'Zaproszenie do telewizji',
    text: () => 'Największa stacja sportowa zaprasza Cię do wieczornego studia przed zgrupowaniem.',
    options: [
      { id: 'idz', label: 'Przyjmij zaproszenie', effect: { media: 6, morale: -1, text: 'Dobry występ. Część zawodników uważa, że trener za dużo mówi.' } },
      { id: 'odmow', label: 'Odmów, skup się na pracy', effect: { media: -2, text: 'Media trochę urażone.' } },
    ],
  },
  {
    applies: (s) => s.calledUp.length > 0,
    title: 'Konflikt w szatni',
    text: () => 'Dwaj zawodnicy pokłócili się na treningu. Inni słyszeli ostre słowa.',
    options: [
      { id: 'rozmowa', label: 'Rozmowa z obydwoma', effect: { morale: 3, text: 'Sprawa zażegnana.' } },
      { id: 'kara', label: 'Ukarz obu', effect: { morale: -3, trust: 2, text: 'Jasny sygnał: dyscyplina ponad wszystko.' } },
      { id: 'ignoruj', label: 'Niech sami to załatwią', effect: { morale: -5, text: 'Atmosfera się psuje.' } },
    ],
  },
];

const FIRST = ['Marek', 'Tomasz', 'Piotr', 'Andrzej', 'Jacek', 'Krzysztof', 'Paweł', 'Robert', 'Michał', 'Jan'];
const LAST = ['Nowicki', 'Kaczmarek', 'Zając', 'Sadowski', 'Wróbel', 'Ostrowski', 'Bielecki', 'Kubiak', 'Lis', 'Wilk'];
export const STAFF_LABEL: Record<StaffMember['role'], string> = {
  assistant: 'Asystent (sugestie składu i zmian)',
  analyst: 'Analityk (raport o rywalu)',
  fitness: 'Trener przygotowania (kontuzje, regeneracja)',
};

export function staffCandidates(rng: Rng, role: StaffMember['role']): StaffMember[] {
  return [rng.int(78, 92), rng.int(60, 75), rng.int(45, 60)].map((rating) => ({
    role,
    rating,
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
  }));
}
