# Kalibracja silnika meczu

Pełny wynik ostatniego przebiegu: [kalibracja-wynik.txt](kalibracja-wynik.txt). Uruchomienie: `npm run kalibracja`.

## Metoda

1. **„Liga”**: 20 wygenerowanych drużyn o sile ~N(70, 4) gra 20 000 meczów u siebie i na wyjeździe.
   Średnie porównujemy z orientacyjnymi wartościami z czołowych lig europejskich (ok. 2014–2019).
2. **Krzywa siły**: faworyt kontra słabsza drużyna na neutralnym terenie, przy różnicy oceny 0–30 punktów.
   Z „wyniku oczekiwanego” (wygrana + pół remisu) liczymy, ilu punktom Elo odpowiada jeden punkt OVR.

## Wynik (v2, 18.11.2026)

**18 z 19 wskaźników w docelowym przedziale**: gole 2,71 na mecz, rozkład 45,8% / 23,9% / 30,4%,
12,6 strzału na drużynę, celność 36%, gole/xG 0,99, 4,9 rożnego, 3,9 żółtej kartki, 0,30 karnego,
2,85 zmiany, 20% goli głową, 23% ze stałych fragmentów. Remisy (23,9%) są o włos poniżej
przedziału 24–28%.

Krzywa siły: **1 punkt OVR ≈ 18–38 punktów Elo** (stromsza niż w v1). Przy różnicy 10 punktów
faworyt wygrywa ~79%, przy 30 punktach ~99,7% i strzela średnio ok. 7 goli.

(v1 z 17.11.2026: 19 z 19, gole 2,64, przy 10 punktach różnicy faworyt wygrywał ~72%.)

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

Wynik: [kalibracja-euro-kadry.txt](kalibracja-euro-kadry.txt). Uruchomienie:
`npm run kalibracja:euro -- --kadry --sym 300` (próby parametrów: `--param klucz=wartość`).

Kadry wszystkich 54 drużyn z wyliczonymi atrybutami (dokładne pozycje, kluby, występy), siła kadry
z Elo. Elo liczone tylko z meczów członków FIFA; reprezentacje debiutujące po 1950 r. startują z 1200,
po 2000 r. z 1000.

Każdy mecz symulowany 300 razy. Przy 40–80 symulacjach różnice log-loss między wariantami
(±0,01) były szumem, więc porównania robimy na 300. Częstości z symulacji wygładzamy (+0,5 do
każdego wyniku), żeby wynik, który akurat nie padł, nie dostawał zerowego prawdopodobieństwa.

| Model | Log-loss ↓ | Gole/mecz | Remisy | Różnica ≥3 |
|---|---|---|---|---|
| Rzeczywistość | – | 2,61 | 18,7% | 20,6% |
| Samo Elo + prosty model remisów | 0,861 | – | – | – |
| Silnik v1 (45 Elo/pkt) | 0,836 | 2,99 | 20,7% | 25,6% |
| Silnik v2, 40 Elo/pkt | 0,827 | 2,93 | 19,1% | 30,7% |
| **Silnik v2, 45 Elo/pkt (wybrany)** | **0,825** | 2,79 | 20,2% | 27,5% |
| Silnik v2, 50 Elo/pkt | 0,837 | 2,70 | 21,1% | 25,2% |

**Według różnicy siły** (Elo z atutem gospodarza; gole faworyta : słabszego):

| Różnica Elo | Meczów | Rzeczywistość | Silnik v1 | Silnik v2 |
|---|---|---|---|---|
| 0–100 | 45 | 1,22 : 1,00 | 1,38 : 1,22 | 1,25 : 1,04 |
| 100–200 | 54 | 1,17 : 0,94 | 1,62 : 1,07 | 1,52 : 0,89 |
| 200–350 | 62 | 1,58 : 0,74 | 1,89 : 0,86 | 1,81 : 0,70 |
| 350–500 | 52 | 2,08 : 0,54 | 2,35 : 0,70 | 2,37 : 0,52 |
| 500+ | 54 | 3,43 : 0,33 | 3,30 : 0,51 | 3,48 : 0,35 |

Przykład: Polska (1536 Elo) – Gibraltar (1021) u siebie: v1 3,16 : 0,51 (strzały 23 : 6),
v2 3,27 : 0,34 (strzały 26 : 4, posiadanie 64%).

**Co zmieniło się w v2 (18.11.2026):**
- **Plan gry komputera** (`aiAdaptation`): przed meczem drużyna prowadzona przez komputer
  dopasowuje nastawienie do różnicy sił. Wyraźnie słabsza cofa się i obniża linię obrony, mocniejsza
  atakuje śmielej. Ustawienia gracza silnik nie zmienia.
- **Forma dnia całej drużyny** (`teamFormSd`): wspólny mnożnik dla wszystkich zawodników. Forma
  pojedynczych zawodników uśredniała się w jedenastce, więc silnik dawał za mało niespodzianek.
- **Ostrzejsza krzywa siły** (`strengthExponent` 1,9 → 2,8) przy mniejszej liczbie akcji.
- **Mecze reprezentacji** (`international`, `internationalAttack` 0,86): przy tej samej różnicy sił
  pada w nich mniej goli niż w lidze (2,1–2,2 przy wyrównanych drużynach w eliminacjach vs ok. 2,7
  w czołowych ligach). Dzięki temu liczba akcji (`attackRate`) zostaje skalibrowana na ligi.
- Nasycenie przewagi osobno dla faworyta i słabszego (`favouriteDamping`, `underdogDamping`).
  Okazało się prawie bez znaczenia, zostaje jako parametr.

Historia poprawek (log-loss przy 80 symulacjach z obcinaniem, więc nie wprost porównywalny z tabelą wyżej):
- 0,847 – pierwsza wersja z prawdziwymi kadrami,
- 0,835 – optymalny wybór składu (wcześniej np. Ronaldo potrafił trafić na prawą obronę) i formacji,
- 0,826 – ranking Elo tylko z meczów członków FIFA, bez turniejów nieoficjalnych (wcześniej Gibraltar
  zbierał punkty na Island Games i startował w eliminacjach z 1335 zamiast ok. 1020).

**Uczciwe zastrzeżenie:** kadry 24 finalistów to składy z czerwca 2016, czyli wiedza sprzed
turnieju, ale po eliminacjach (część powołań wynika z formy w eliminacjach). Dla pozostałych
30 drużyn kadry są wybrane z zawodników grających w latach 2014–16. Wynik może być więc
odrobinę zbyt optymistyczny. Do tego 267 meczów to mała próba: różnica log-loss 0,01 mieści się
w szumie samych danych, a średnie w koszykach mają błąd ok. ±0,2 gola.

**Co jeszcze odstaje:**
- Gole: 2,79 vs 2,61. Nadwyżka pochodzi od faworytów przy średniej różnicy sił (100–500 Elo),
  którzy strzelają o 0,2–0,35 gola za dużo.
- Wyniki różnicą ≥3 goli: 27,5% vs 20,6%, z tego samego powodu.
- Remisy w meczach bardzo nierównych: ok. 8% vs 4% (ale w rzeczywistości to 2 mecze z 54).
- Silnik jest trochę zbyt pewny przy wyraźnych faworytach: przy 89% przewidywanej wygranej
  gospodarze wygrywali w 83%.

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
- **Plan gry komputera jest kalibrowany tylko pośrednio** (przez wyniki), a nie na danych
  o posiadaniu czy strzałach w prawdziwych meczach.
- **Taktyka nie jest jeszcze kalibrowana osobno.** Suwaki działają w modelu (np. pressing męczy
  i zwiększa liczbę fauli), ale nie sprawdziliśmy, czy ich efekty mają realistyczną skalę.
- **Kontuzje** (~0,19 na mecz) to wartość szacunkowa, bez porównania z danymi.

## Parametry

Wszystkie w [src/engine/params.ts](../src/engine/params.ts), z opisem każdego. W grze trafią do edytora
„Parametry modelu”.
