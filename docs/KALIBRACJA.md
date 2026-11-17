# Kalibracja silnika meczu

Pełny wynik ostatniego przebiegu: [kalibracja-wynik.txt](kalibracja-wynik.txt). Uruchomienie: `npm run kalibracja`.

## Metoda

1. **„Liga”**: 20 wygenerowanych drużyn o sile ~N(70, 4) gra 20 000 meczów u siebie i na wyjeździe.
   Średnie porównujemy z orientacyjnymi wartościami z czołowych lig europejskich (ok. 2014–2019).
2. **Krzywa siły**: faworyt kontra słabsza drużyna na neutralnym terenie, przy różnicy oceny 0–30 punktów.
   Z „wyniku oczekiwanego” (wygrana + pół remisu) liczymy, ilu punktom Elo odpowiada jeden punkt OVR.

## Wynik (v1, 17.11.2026)

**19 z 19 wskaźników w docelowym przedziale**: gole 2,64 na mecz, rozkład 45,8% / 25,5% / 28,6%,
12,3 strzału na drużynę, celność 36%, gole/xG 0,97, 4,8 rożnego, 3,9 żółtej kartki, 0,31 karnego,
2,85 zmiany, 19,5% goli głową, 23,5% ze stałych fragmentów.

Krzywa siły: **1 punkt OVR ≈ 20–28 punktów Elo**. Przy różnicy 10 punktów faworyt wygrywa ~72%,
przy 30 punktach (np. Niemcy vs Gibraltar) ~99% i strzela średnio ok. 5,3 gola. W eliminacjach
Euro 2016 Gibraltar tracił średnio 5,6 gola na mecz.

## Ograniczenia (uczciwie)

- **Cele to orientacyjne średnie ligowe, nie dane z Euro 2016.** Prawdziwa kalibracja przyjdzie
  z danymi: ok. 270 meczów eliminacji Euro 2016 z prawdziwymi kadrami. Mecze reprezentacji mają
  zwykle trochę inne proporcje (mniej goli między równymi, więcej pogromów słabeuszy).
- **Wynik zależy od próbki wygenerowanych drużyn.** Inna losowa liga przesuwa średnią goli o ok. ±0,1.
  Dlatego parametry są ustawione na środek przedziałów, a nie na ich krawędź.
- **Przy małych różnicach (0–3 OVR) krzywa jest zaszumiona** przez losowy skład drużyn
  (ta sama średnia ocena, ale różne mocne i słabe strony).
- **Taktyka nie jest jeszcze kalibrowana osobno.** Suwaki działają w modelu (np. pressing męczy
  i zwiększa liczbę fauli), ale nie sprawdziliśmy, czy ich efekty mają realistyczną skalę.
- **Kontuzje** (~0,19 na mecz) to wartość szacunkowa, bez porównania z danymi.

## Parametry

Wszystkie w [src/engine/params.ts](../src/engine/params.ts), z opisem każdego. W grze trafią do edytora
„Parametry modelu”.
