/**
 * Atrybuty zawodników (skala 1–100), pozycje i ocena ogólna per pozycja.
 * Każdy atrybut ma opis tego, co realnie napędza w silniku — atrybut bez wpływu to ozdoba.
 */

export const TECHNICAL = [
  'finishing', 'longShots', 'passing', 'crossing', 'dribbling', 'firstTouch',
  'technique', 'heading', 'tackling', 'marking', 'freeKicks', 'penalties',
] as const;

export const MENTAL = [
  'vision', 'decisions', 'composure', 'positioning', 'offTheBall', 'anticipation',
  'concentration', 'workRate', 'teamwork', 'aggression', 'bravery', 'leadership', 'flair',
] as const;

export const PHYSICAL = [
  'pace', 'acceleration', 'stamina', 'strength', 'agility', 'jumping', 'naturalFitness',
] as const;

export const GOALKEEPING = [
  'reflexes', 'handling', 'oneOnOnes', 'aerialReach', 'commandOfArea', 'kicking',
] as const;

/** Cechy ukryte / osobowość. Wszystkie 1–100, gdzie wyżej = więcej danej cechy. */
export const PERSONALITY = [
  'professionalism', 'ambition', 'loyalty', 'temperament', 'pressure',
  'injuryProneness', 'bigMatch', 'consistency',
] as const;

export type TechnicalAttr = (typeof TECHNICAL)[number];
export type MentalAttr = (typeof MENTAL)[number];
export type PhysicalAttr = (typeof PHYSICAL)[number];
export type GoalkeepingAttr = (typeof GOALKEEPING)[number];
export type Attr = TechnicalAttr | MentalAttr | PhysicalAttr | GoalkeepingAttr;
export type PersonalityTrait = (typeof PERSONALITY)[number];

export type Attributes = Record<Attr, number>;
export type Personality = Record<PersonalityTrait, number>;

export const ALL_ATTRS: readonly Attr[] = [...TECHNICAL, ...MENTAL, ...PHYSICAL, ...GOALKEEPING];

interface AttrInfo {
  label: string;
  /** Co atrybut napędza w silniku meczu (v1). */
  effect: string;
}

export const ATTR_INFO: Record<Attr | PersonalityTrait, AttrInfo> = {
  finishing: { label: 'Wykończenie', effect: 'Szansa, że strzał zamieni się w gola; waga przy wyborze strzelca.' },
  longShots: { label: 'Strzały z dystansu', effect: 'Częstotliwość i jakość strzałów spoza pola karnego.' },
  passing: { label: 'Podania', effect: 'Kontrola gry (posiadanie), budowanie akcji, asysty.' },
  crossing: { label: 'Dośrodkowania', effect: 'Jakość akcji skrzydłami i rzutów rożnych; asysty przy główkach.' },
  dribbling: { label: 'Drybling', effect: 'Kreowanie sytuacji indywidualnie, akcje solowe.' },
  firstTouch: { label: 'Przyjęcie', effect: 'Kontrola gry pod pressingiem; jakość wykończenia sytuacji.' },
  technique: { label: 'Technika', effect: 'Kontrola gry i kreowanie; mniej traci na złej murawie i w deszczu.' },
  heading: { label: 'Gra głową', effect: 'Gole i obrona przy dośrodkowaniach i stałych fragmentach.' },
  tackling: { label: 'Odbiór', effect: 'Siła obrony; mniej fauli przy dobrym odbiorze.' },
  marking: { label: 'Krycie', effect: 'Siła obrony, zwłaszcza przy dośrodkowaniach.' },
  freeKicks: { label: 'Rzuty wolne', effect: 'Jakość bezpośrednich rzutów wolnych.' },
  penalties: { label: 'Rzuty karne', effect: 'Skuteczność karnych w meczu i w serii.' },
  vision: { label: 'Wizja gry', effect: 'Kreowanie sytuacji, kluczowe podania, asysty.' },
  decisions: { label: 'Decyzje', effect: 'Kontrola gry i obrona; mniej straconych piłek.' },
  composure: { label: 'Opanowanie', effect: 'Wykończenie dużych szans i karnych; kontrola pod presją.' },
  positioning: { label: 'Ustawianie się', effect: 'Siła obrony; u bramkarza – obrona strzałów.' },
  offTheBall: { label: 'Gra bez piłki', effect: 'Wchodzenie w sytuacje strzeleckie (waga strzelca), kreowanie.' },
  anticipation: { label: 'Przewidywanie', effect: 'Obrona i przechwyty; wejścia na dobitki.' },
  concentration: { label: 'Koncentracja', effect: 'Spadek jakości obrony w końcówce meczu.' },
  workRate: { label: 'Pracowitość', effect: 'Skuteczność pressingu; szybsze zmęczenie.' },
  teamwork: { label: 'Gra zespołowa', effect: 'Kontrola gry, skuteczność pressingu.' },
  aggression: { label: 'Agresja', effect: 'Więcej fauli i kartek, ale twardsza obrona.' },
  bravery: { label: 'Odwaga', effect: 'Obrona i gra głową w polu karnym.' },
  leadership: { label: 'Przywództwo', effect: 'Kapitan: stabilizuje drużynę w końcówce i po straconym golu.' },
  flair: { label: 'Polot', effect: 'Kreowanie nieprzewidywalnych sytuacji, akcje solowe.' },
  pace: { label: 'Szybkość', effect: 'Kontry i gra za linię obrony; obrona przy wysokiej linii.' },
  acceleration: { label: 'Przyspieszenie', effect: 'Kontry, wygrywanie pojedynków na pierwszych metrach.' },
  stamina: { label: 'Wytrzymałość', effect: 'Tempo spadku kondycji w meczu.' },
  strength: { label: 'Siła', effect: 'Pojedynki, gra głową, obrona.' },
  agility: { label: 'Zwinność', effect: 'Drybling i kreowanie; u bramkarza – refleks.' },
  jumping: { label: 'Skoczność', effect: 'Gra głową w obu polach karnych.' },
  naturalFitness: { label: 'Naturalna kondycja', effect: 'Wolniejsze zmęczenie, mniejsze ryzyko kontuzji.' },
  reflexes: { label: 'Refleks', effect: 'Bramkarz: obrona strzałów.' },
  handling: { label: 'Chwytanie', effect: 'Bramkarz: obrona strzałów i dośrodkowań bez dobitek.' },
  oneOnOnes: { label: 'Sam na sam', effect: 'Bramkarz: obrona dużych szans i karnych.' },
  aerialReach: { label: 'Gra w powietrzu', effect: 'Bramkarz: obrona dośrodkowań i rożnych.' },
  commandOfArea: { label: 'Panowanie w polu karnym', effect: 'Bramkarz: zmniejsza zagrożenie po dośrodkowaniach.' },
  kicking: { label: 'Wybicie', effect: 'Bramkarz: udział w budowaniu gry.' },
  professionalism: { label: 'Profesjonalizm', effect: 'Rozwój i forma (poza meczem, kolejne etapy).' },
  ambition: { label: 'Ambicja', effect: 'Rozwój, transfery (kolejne etapy).' },
  loyalty: { label: 'Lojalność', effect: 'Transfery, gotowość gry w kadrze (kolejne etapy).' },
  temperament: { label: 'Temperament', effect: 'Wyżej = spokojniejszy: mniej kartek i głupich fauli.' },
  pressure: { label: 'Odporność na presję', effect: 'Karne i seria karnych; ważne mecze.' },
  injuryProneness: { label: 'Podatność na kontuzje', effect: 'Wyżej = częstsze kontuzje.' },
  bigMatch: { label: 'Gracz na wielkie mecze', effect: 'Premia lub kara w meczach o dużą stawkę.' },
  consistency: { label: 'Regularność', effect: 'Wyżej = mniejsze wahania formy z meczu na mecz.' },
};

export const POSITIONS = [
  'GK', 'DL', 'DC', 'DR', 'WBL', 'WBR', 'DM', 'ML', 'MC', 'MR', 'AML', 'AMC', 'AMR', 'ST',
] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<Position, string> = {
  GK: 'BR', DL: 'LO', DC: 'ŚO', DR: 'PO', WBL: 'LWO', WBR: 'PWO', DM: 'DP',
  ML: 'LP', MC: 'ŚP', MR: 'PP', AML: 'LS', AMC: 'OP', AMR: 'PS', ST: 'N',
};

type Weights = Partial<Record<Attr, number>>;

const FULLBACK: Weights = {
  tackling: 4, marking: 3, positioning: 3, pace: 4, acceleration: 2, stamina: 3, crossing: 3,
  workRate: 2, anticipation: 2, concentration: 2, dribbling: 1, passing: 2, teamwork: 1,
};
const WINGBACK: Weights = {
  crossing: 4, pace: 4, stamina: 4, workRate: 3, dribbling: 3, tackling: 2, marking: 2,
  positioning: 2, acceleration: 2, passing: 2, offTheBall: 2, teamwork: 1,
};
const WIDE_MID: Weights = {
  crossing: 4, pace: 3, dribbling: 3, stamina: 3, workRate: 2, passing: 2, acceleration: 2,
  technique: 2, offTheBall: 2, teamwork: 1, firstTouch: 1,
};
const WINGER: Weights = {
  dribbling: 5, pace: 4, acceleration: 3, technique: 3, flair: 2, crossing: 2, finishing: 2,
  offTheBall: 2, agility: 2, firstTouch: 2, passing: 1, vision: 1,
};

/** Wagi atrybutów do oceny ogólnej na danej pozycji. */
export const POSITION_WEIGHTS: Record<Position, Weights> = {
  GK: {
    reflexes: 5, handling: 4, oneOnOnes: 3, aerialReach: 3, commandOfArea: 3, kicking: 1,
    positioning: 2, concentration: 2, decisions: 1, composure: 1, agility: 2,
  },
  DC: {
    tackling: 5, marking: 5, heading: 4, positioning: 5, strength: 3, jumping: 3, anticipation: 3,
    concentration: 3, decisions: 2, bravery: 2, pace: 2, composure: 1, passing: 1,
  },
  DL: FULLBACK,
  DR: FULLBACK,
  WBL: WINGBACK,
  WBR: WINGBACK,
  DM: {
    tackling: 4, positioning: 4, anticipation: 3, marking: 2, passing: 3, decisions: 3,
    concentration: 2, teamwork: 2, workRate: 2, strength: 2, stamina: 2, composure: 2,
  },
  MC: {
    passing: 5, vision: 3, decisions: 3, firstTouch: 3, technique: 2, teamwork: 2, workRate: 2,
    stamina: 2, composure: 2, tackling: 1, anticipation: 1, offTheBall: 1, longShots: 1,
  },
  ML: WIDE_MID,
  MR: WIDE_MID,
  AML: WINGER,
  AMR: WINGER,
  AMC: {
    passing: 4, vision: 5, technique: 3, firstTouch: 3, dribbling: 3, decisions: 3, flair: 2,
    offTheBall: 2, longShots: 2, finishing: 2, composure: 1,
  },
  ST: {
    finishing: 6, offTheBall: 4, composure: 3, firstTouch: 3, heading: 2, pace: 2, acceleration: 2,
    dribbling: 2, strength: 2, technique: 1, anticipation: 2, jumping: 1,
  },
};

export function weightedAverage(attrs: Attributes, weights: Weights): number {
  let sum = 0;
  let total = 0;
  for (const [key, w] of Object.entries(weights) as [Attr, number][]) {
    sum += attrs[key] * w;
    total += w;
  }
  return total > 0 ? sum / total : 0;
}

/**
 * Mnożnik skuteczności za znajomość pozycji (0–100).
 * 90+ = pozycja naturalna, 0 = zupełnie obca (75% skuteczności).
 */
export function familiarityFactor(familiarity: number): number {
  if (familiarity >= 90) return 1;
  return 0.75 + 0.25 * (Math.max(0, familiarity) / 90);
}

/** Ocena ogólna zawodnika na pozycji, z uwzględnieniem znajomości pozycji. */
export function positionRating(
  attrs: Attributes,
  position: Position,
  familiarity: number,
): number {
  return Math.round(weightedAverage(attrs, POSITION_WEIGHTS[position]) * familiarityFactor(familiarity));
}
