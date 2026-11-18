# Symulator piłki nożnej

**Zagraj: https://dremilianokolbe.github.io/symulator-pilki/** (na telefonie: „Dodaj do ekranu początkowego”, działa też offline).

Osobisty symulator piłkarski w duchu Football Managera: bez meczu 2D, za to z realistycznym
silnikiem statystycznym, historycznymi scenariuszami i światem, który reaguje na wyniki.
Wizja i wszystkie decyzje projektowe: [WIZJA_GRY.md](WIZJA_GRY.md).

## Stan projektu

**Etap 1: silnik meczu v1 (gotowy).**

- symulacja minuta po minucie z API do meczu na żywo (zmiany i taktyka w trakcie),
- 38 atrybutów (1–100) + 8 cech osobowości + nawyki, ocena ogólna per pozycja,
- formacja + 6 suwaków stylu, przewaga gospodarza, pogoda, murawa, wysokość, sędzia,
- zmęczenie, kontuzje (realistyczne typy i przerwy), kartki, karne, rzuty rożne i wolne,
- dogrywka i seria rzutów karnych,
- statystyki (posiadanie, strzały, xG, …) i oceny zawodników,
- polska relacja tekstowa,
- skalibrowany na realnych średnich (patrz [docs/KALIBRACJA.md](docs/KALIBRACJA.md)).

**Etap 2: dane Euro 2016 (w toku).**

- wyniki wszystkich meczów reprezentacji od 1872 i ranking Elo liczony z nich,
- 267 meczów eliminacji i 51 meczów turnieju z Elo obu drużyn sprzed meczu,
- kadry wszystkich 54 drużyn (1242 zawodników): 24 finalistów ze składów Euro 2016,
  30 pozostałych wybranych z zawodników grających w kadrze w latach 2014–16,
- dokładne pozycje (np. prawy obrońca, skrzydłowy) z infoboksów Wikipedii, kluby z sezonu 2014/15,
- kalibracja na prawdziwych meczach eliminacji: silnik z prawdziwymi kadrami przewiduje wyniki
  lepiej niż samo Elo (szczegóły w [docs/KALIBRACJA.md](docs/KALIBRACJA.md)).

Brakuje: siły poszczególnych klubów z ClubElo (API niedostępne; na razie siła ligi + lista czołowych
klubów), formy klubowej z sezonów 14/15 i 15/16.

**Etap 3: rozgrywki Euro 2016 (tryb sandbox).**

- eliminacje (9 grup, prawdziwy terminarz), tabele wg regulaminu UEFA, ranking 3. miejsc,
- baraże (dwumecze, bramki na wyjeździe), losowanie turnieju z koszykami,
- turniej na 24 drużyny: grupy, 4 najlepsze trzecie miejsca, drabinka 1/8 → finał,
- pojedynczy przebieg z tabelami i strzelcami albo Monte Carlo z szansami każdej drużyny.

Szczegóły i uproszczenia: [docs/ROZGRYWKI.md](docs/ROZGRYWKI.md).

```bash
npm run euro -- --raz
```

```bash
npm run euro -- --symulacje 10000
```

Pełne Monte Carlo trwa długo (ok. 330 meczów na przebieg); najlepiej uruchamiać, gdy komputer nie jest zajęty.

**Etap 4: kariera selekcjonera (terminal).**

Dowolna z 54 reprezentacji, od września 2014 do końca Euro 2016: sztab, okna reprezentacyjne,
powołania z szerokiej kadry, sparingi, konferencje, zdarzenia losowe, mecz na żywo z decyzjami,
kartki, kontuzje, forma, morale, prawdziwe tytuły prasowe, zaufanie federacji i zwolnienie.
Szczegóły: [docs/KARIERA.md](docs/KARIERA.md).

```bash
npm run kariera
```

**Etap 5: aplikacja (PWA).**

Kariera selekcjonera i symulacje Euro 2016 w przeglądarce, mobile-first, tryb jasny i ciemny.
Cała logika gry działa w Web Workerze (ten sam kod co w terminalu), Monte Carlo na kilku workerach
naraz, zapis kariery w przeglądarce (seed + decyzje), tryb offline po zainstalowaniu.

```bash
npm run app
```

Serwer pokazuje adres w sieci lokalnej (np. `http://192.168.x.x:5173`) – telefon w tej samej sieci
Wi-Fi może z niego grać. Instalacja na ekranie głównym i tryb offline wymagają HTTPS, czyli hostingu.

```bash
npm run app:build
```

Wersja produkcyjna trafia do `dist/` (pliki statyczne, do wrzucenia na dowolny hosting).

## Dane i źródła

- Wyniki i strzelcy: [martj42/international_results](https://github.com/martj42/international_results) (CC0).
- Składy Euro 2016: Wikipedia, [UEFA Euro 2016 squads](https://en.wikipedia.org/wiki/UEFA_Euro_2016_squads) (CC BY-SA 4.0).
- Zawodnicy reprezentacji 2014–16 i ich kluby: [Wikidata](https://www.wikidata.org) (CC0).
- Pozycje, daty urodzenia, kariera: infoboksy artykułów o zawodnikach z angielskiej Wikipedii (CC BY-SA 4.0).
- Siła klubów (planowane): [ClubElo](http://clubelo.com).

```bash
npm run dane:pobierz
```

```bash
npm run dane:przetworz
```

Mecz z prawdziwymi kadrami (nazwy drużyn po angielsku, jak w danych):

```bash
npm run mecz -- --dom Poland --gosc Germany --neutralny
```

## Uruchamianie

```bash
npm install
```

Jeden mecz z relacją (drużyny demonstracyjne z fikcyjnymi zawodnikami):

```bash
npm run mecz
```

Opcje: `-- --seed 123` (powtórka tego samego meczu), `--puchar` (dogrywka i karne), `--pogoda heat|rain|snow|cold`.

Kalibracja (20 000 meczów vs realne średnie):

```bash
npm run kalibracja
```

Testy:

```bash
npm test
```

## Struktura

| Ścieżka | Co tam jest |
|---|---|
| `src/engine/match.ts` | Silnik meczu |
| `src/engine/attributes.ts` | Atrybuty, pozycje, ocena per pozycja |
| `src/engine/params.ts` | Parametry modelu (kalibrowane) |
| `src/engine/types.ts` | Typy: zawodnik, taktyka, kontekst i wynik meczu |
| `src/engine/injuries.ts` | Typy kontuzji |
| `src/engine/rng.ts` | Losowość z ziarnem (powtarzalne mecze) |
| `src/generator/players.ts` | Generator zawodników i kadr |
| `src/commentary/pl.ts` | Relacja po polsku |
| `scripts/` | Podgląd meczu, kalibracja, generowanie dokumentacji |
| `docs/` | Atrybuty, kalibracja |
