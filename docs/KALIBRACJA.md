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

## Kalibracja na prawdziwych meczach: eliminacje Euro 2016

Pełny wynik: [kalibracja-euro-wynik.txt](kalibracja-euro-wynik.txt). Uruchomienie: `npm run kalibracja:euro`.

**Metoda:** 267 meczów eliminacji (wrzesień 2014 – październik 2015). Przed każdym meczem silnik
zna tylko ranking Elo obu drużyn sprzed meczu (liczony z wszystkich meczów reprezentacji od 1872,
`src/data/elo.ts`), zamieniony na OVR: `OVR = 70 + (Elo − 1700) / przelicznik`. Każdy mecz
symulowany 80–100 razy. Porównanie z rzeczywistymi wynikami i z modelami odniesienia.

| Model | Log-loss ↓ | Gole/mecz | Remisy | Różnica ≥3 |
|---|---|---|---|---|
| Rzeczywistość | – | 2,61 | 18,7% | 20,6% |
| Częstości (bez wiedzy o sile) | 1,043 | – | – | – |
| Samo Elo + prosty model remisów | 0,872 | – | – | – |
| Silnik, 25 Elo/pkt | 0,917 | 3,51 | 16,5% | 37,5% |
| Silnik, 35 Elo/pkt | 0,893 | 3,02 | 20,2% | 27,6% |
| Silnik, 40 Elo/pkt | 0,880 | 2,91 | 21,5% | 24,1% |
| **Silnik, 45 Elo/pkt (wybrany)** | **0,874** | 2,83 | 22,5% | 22,0% |
| Silnik, 50 Elo/pkt | 0,890 | 2,78 | 23,5% | 19,9% |

**Wniosek (kadry wygenerowane):** przy 45 Elo na punkt OVR silnik przewiduje wyniki praktycznie
tak dobrze jak samo Elo (0,874 vs 0,872), a przy tym daje pełny mecz: strzelców, kartki, statystyki.

### Z prawdziwymi kadrami (wersja aktualna)

Wynik: [kalibracja-euro-kadry.txt](kalibracja-euro-kadry.txt). Uruchomienie: `npm run kalibracja:euro -- --kadry`.

Kadry wszystkich 54 drużyn z wyliczonymi atrybutami (dokładne pozycje, kluby, występy), siła kadry
z Elo. Dodatkowo poprawione Elo: reprezentacje debiutujące po 1950 r. startują z 1200, po 2000 r.
z 1000 (wcześniej Gibraltar zaczynał eliminacje jak przeciętna drużyna).

| Model | Log-loss ↓ | Gole/mecz | Remisy | Różnica ≥3 |
|---|---|---|---|---|
| Rzeczywistość | – | 2,61 | 18,7% | 20,6% |
| Samo Elo + prosty model remisów | 0,866 | – | – | – |
| Silnik, 40 Elo/pkt | 0,851 | 3,00 | 19,8% | 26,5% |
| **Silnik, 45 Elo/pkt (wybrany)** | **0,847** | 2,91 | 20,9% | 23,9% |
| Silnik, 50 Elo/pkt | 0,862 | 2,82 | 22,1% | 21,4% |

**Silnik z prawdziwymi kadrami przewiduje wyniki lepiej niż samo Elo** (0,847 vs 0,866).
Przedziały pewności są bardzo dobre: przewidziane 10,6% → było 9,6%, 48% → 46%, 89% → 87%.

**Uczciwe zastrzeżenie:** kadry 24 finalistów to składy z czerwca 2016, czyli wiedza sprzed
turnieju, ale po eliminacjach (część powołań wynika z formy w eliminacjach). Dla pozostałych
30 drużyn kadry są wybrane z zawodników grających w latach 2014–16. Wynik może być więc
odrobinę zbyt optymistyczny.

Przedziały pewności (przy 40 Elo/pkt) są dobrze skalibrowane: gdy silnik daje gospodarzom 50%,
wygrywali w 50%; przy 88% w 83%. Lekka nadmierna pewność zostaje tylko u wyraźnych faworytów.

**Co jeszcze odstaje:** silnik daje ok. 8% za dużo goli (2,83 vs 2,61) i za dużo remisów (22,5%
vs 18,7%). Kandydaci do poprawy: słabsze drużyny broniące się głęboko (taktyka AI) oraz mniejsza
liczba goli w meczach reprezentacji niż w ligach.

**Uwaga:** przelicznik dotyczy reprezentacji. Dla lig klubowych trzeba go wyznaczyć osobno
(z ClubElo), bo różnice siły w lidze są mniejsze.

## Ograniczenia (uczciwie)

- **Kalibracja ligowa opiera się na orientacyjnych średnich**, a nie na konkretnych meczach.
  Kalibracja na prawdziwych meczach (wyżej) dotyczy na razie tylko reprezentacji i używa
  wygenerowanych kadr o sile z Elo, a nie prawdziwych zawodników.
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
