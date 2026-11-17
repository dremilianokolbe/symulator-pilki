# Symulator piłki nożnej

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

Następny etap: dane Euro 2016 (53 kadry, wyniki eliminacji) i kalibracja na prawdziwych meczach.

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
