/**
 * Parametry modelu meczu. Wszystkie wartości kalibrowane skryptem `npm run kalibracja`
 * (patrz docs/KALIBRACJA.md). W przyszłości edytowalne w grze („Parametry modelu”).
 */
export interface EngineParams {
  /** Bazowa szansa groźnej akcji drużyny na minutę przy równych siłach. */
  attackRate: number;
  /** Jak mocno przewaga w kreowaniu nad obroną rywala zmienia liczbę akcji (wykładnik). */
  strengthExponent: number;
  /** Jak mocno przewaga w kontroli gry przekłada się na posiadanie (wykładnik). */
  possessionExponent: number;
  /** Jak mocno jakość akcji wpływa na xG pojedynczej sytuacji (wykładnik). */
  chanceQualityExponent: number;
  /** Wpływ umiejętności strzelca na zamianę xG w gola (na punkt atrybutu powyżej 65). */
  finishingSkill: number;
  /** Wpływ bramkarza na obronę strzałów (na punkt powyżej 65). */
  keeperSkill: number;
  /** Atut własnego boiska: mnożnik akcji gospodarza. */
  homeAttack: number;
  /** Atut własnego boiska: mnożnik akcji gościa. */
  awayAttack: number;
  /** Bazowa szansa faulu drużyny broniącej na minutę. */
  foulRate: number;
  /** Szansa żółtej kartki za faul. */
  yellowPerFoul: number;
  /** Szansa bezpośredniej czerwonej kartki za faul. */
  redPerFoul: number;
  /** Szansa, że faul to rzut karny. */
  penaltyPerFoul: number;
  /** Szansa, że faul daje groźny rzut wolny ze strzałem. */
  directFreeKickPerFoul: number;
  /** Bazowa szansa kontuzji zawodnika na minutę. */
  injuryRate: number;
  /** Bazowy spadek kondycji na minutę. */
  fatigueRate: number;
  /** Bazowa szansa spalonego na minutę. */
  offsideRate: number;
  /** Wpływ wyniku na grę: drużyna przegrywająca naciska mocniej. */
  gameStateEffect: number;
}

export const DEFAULT_PARAMS: EngineParams = {
  attackRate: 0.177,
  strengthExponent: 1.9,
  possessionExponent: 1.6,
  chanceQualityExponent: 0.5,
  finishingSkill: 0.014,
  keeperSkill: 0.012,
  homeAttack: 1.18,
  awayAttack: 0.85,
  foulRate: 0.13,
  yellowPerFoul: 0.15,
  redPerFoul: 0.0021,
  penaltyPerFoul: 0.012,
  directFreeKickPerFoul: 0.09,
  injuryRate: 0.00009,
  fatigueRate: 0.33,
  offsideRate: 0.022,
  gameStateEffect: 0.12,
};
