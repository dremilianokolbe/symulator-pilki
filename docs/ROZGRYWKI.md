# Rozgrywki: Euro 2016

Kod: [src/scenarios/euro2016/](../src/scenarios/euro2016/), tabele: [src/competition/standings.ts](../src/competition/standings.ts).

```bash
npm run euro -- --raz --seed 7
```

```bash
npm run euro -- --symulacje 10000
```

```bash
npm run euro -- --symulacje 10000 --tylko-turniej
```

## Co jest odwzorowane wiernie

- **Eliminacje:** 9 grup z prawdziwym składem i terminarzem (daty, gospodarze, mecze na neutralnym terenie,
  np. Gibraltar grał „u siebie” w Faro). Mecz Czarnogóra–Rosja (przerwany, walkower) jest dopisany ręcznie,
  bo brakuje go w zbiorze wyników.
- **Tabele wg art. 14.01 regulaminu eliminacji:** punkty → mecze bezpośrednie (punkty, bilans, gole,
  gole na wyjeździe, ponownie dla mniejszej grupy) → bilans → gole → gole na wyjeździe → zwycięstwa →
  zwycięstwa na wyjeździe → fair play → współczynnik.
- **Ranking 3. miejsc eliminacji:** bez meczów z 6. drużyną grupy (bo grupa I miała 5 drużyn).
  Najlepsza awansuje bezpośrednio, 8 pozostałych gra baraże.
- **Baraże:** rozstawienie (4 + 4), losowanie par i gospodarza pierwszego meczu, dwumecz z bramkami
  na wyjeździe (liczonymi także w dogrywce, jak w 2016), dogrywka i karne.
- **Losowanie turnieju:** koszyk 1 = Francja (A1), Hiszpania (obrońca tytułu) i 4 najlepsze, koszyki 2–4
  wg współczynnika, Rosja i Ukraina nie mogą trafić do jednej grupy. Gdy awansują te same 24 drużyny co
  naprawdę, używane jest prawdziwe losowanie.
- **Tabele turnieju wg art. 18.01:** punkty → mecze bezpośrednie → bilans → gole → fair play → współczynnik.
- **4 najlepsze z 6 trzecich miejsc** i drabinka 1/8 z numeracją meczów 37–51 jak w 2016.
- **Francja gra u siebie**, pozostałe mecze turnieju na neutralnym terenie.

Wszystko sprawdzone testami na prawdziwych wynikach: z rzeczywistych meczów wychodzą rzeczywiste tabele
(łącznie z karami punktowymi Serbii i Chorwacji), Turcja jako najlepsza trzecia drużyna eliminacji
i pary 1/8 z 2016 ([test/euro2016.test.ts](../test/euro2016.test.ts)).

## Uproszczenia (do poprawy)

- **Współczynnik UEFA zastąpiony rankingiem Elo** liczonym na żywo z wyników w symulowanym świecie
  (rozstawienia w barażach i losowaniu, ostatnie kryterium w tabelach). Prawdziwy współczynnik UEFA
  da się policzyć z wyników (formuła z 2015 r.) – osobne zadanie.
- **Przydział trzecich miejsc w 1/8:** UEFA miała tabelę 15 kombinacji; tu wybierany jest pierwszy
  dozwolony przydział (zgodny z przypadkiem z 2016, pozostałe kombinacje mogą się różnić od tabeli UEFA).
- **Siła kadr stała w każdej fazie:** eliminacje wg Elo z września 2014, turniej wg Elo z czerwca 2016.
  Nie ma jeszcze formy, kontuzji ani zawieszeń za kartki przenoszonych między meczami.
- **Taktyka:** wszyscy grają domyślnym stylem; formacja wybierana automatycznie (czwórka obrońców,
  najwyższa suma ocen jedenastki).
- **Sparingi:** pomijane.
