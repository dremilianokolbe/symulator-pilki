# Symulator piłki nożnej: wizja gry

_Wersja robocza, 17.11.2026. Dokument żywy: każda runda pytań go uzupełnia._

## O co chodzi

Osobisty symulator piłkarski w duchu Football Managera, ale:
- **bez meczu 2D**: sucha, realistyczna symulacja (wynik, strzelcy, statystyki, relacja tekstowa),
- **świat, który reaguje**: pieniądze, rankingi i formaty zmieniają się w zależności od tego, co się dzieje,
- **historia jako punkt startu**: dowolny historyczny scenariusz, z którego można zagrać alternatywną historię,
- **dużo rozgrywek**: ligi, puchary i reprezentacje definiowane jako dane, a nie kod,
- **czas płynie od wydarzenia do wydarzenia**, a nie dzień po dniu.

Kod pisze Claude. Emil projektuje, gra i testuje.

## Podjęte decyzje

| Obszar | Decyzja |
|---|---|
| Tryby gry | Kariera trenera + sandbox (symulacje, „co by było gdyby”) + **kariera piłkarza**, po której można zostać trenerem w tym samym świecie |
| Zawodnicy | **Pełne atrybuty w stylu FM** |
| Dane | **Prawdziwe** kluby, reprezentacje, nazwiska, składy |
| Atrybuty historyczne | **Automatycznie wyliczane** z dostępnych danych + **edytor w grze** |
| MVP | **Euro 2016 razem z eliminacjami** (53 reprezentacje, wrzesień 2014 – lipiec 2016) |
| Kogo prowadzisz | **Dowolną z 53** reprezentacji |
| Piłka klubowa w tle | **Historia jako tło**: forma i minuty według prawdziwych sezonów 14/15 i 15/16 + losowość; kontuzje losowe |
| Wierność historii | **Czysty model**: liczy się siła i los; historia służy do kalibracji |
| Tempo | **Od wydarzenia do wydarzenia**, gra zatrzymuje się na ważnych momentach |
| Zdarzenia | **Losowe zdarzenia z wyborami** (ktoś coś zrobił, możesz zareagować) |
| Taktyka | **Formacja + styl**: 5–8 suwaków, rola każdego zawodnika |
| Raport meczu | **Wydarzenia + statystyki** (posiadanie, strzały, xG, oceny) + **mecz na żywo** ze zmianami w trakcie |
| Selekcjoner w MVP | Obserwacja i powołania, mecze towarzyskie, media i konferencje, szatnia i relacje |
| Kariera | **Pełna**: oczekiwania federacji, zwolnienia, oferty, reputacja |
| Statystyki | Szanse na żywo (Monte Carlo), statystyki zawodników, rankingi FIFA/Elo na żywo |
| Regulaminy | **Wierne epoce**: formuła rankingu FIFA 2014–16, koszyki, tie-breaki UEFA, losowanie z ograniczeniami |
| Po Euro 2016 | **Gra trwa dalej** (el. MŚ 2018…), w kolejnych etapach dochodzą kluby i ligi |
| Ekonomia lig (później) | **Pełny model**: cykle praw TV, klucz nagród UEFA, frekwencja, sponsorzy, zmiany formatów |
| Wygląd | **Nowoczesny, czysty**, w stylu Sofascore/FotMob, przyjazny telefonowi |
| Urządzenia | **Komputer i telefon równorzędnie + synchronizacja zapisów w chmurze** |
| Język | **Polski** |

## Kariera piłkarza

| Obszar | Decyzja |
|---|---|
| Kim grasz | **Własny zawodnik**: tworzysz 16–17-latka (pozycja, kraj, klub startowy) |
| Wpływ | Kariera i transfery (agent, kontrakty, wypożyczenia, wybór reprezentacji), trening i rozwój, **kluczowe momenty w meczu** (tekstowy wybór: strzał / podanie / drybling), życie poza boiskiem (media, relacje, zdarzenia) |
| Przejście na trenera | **Realistyczne**: koniec kariery, kursy licencji UEFA (C → Pro, lata), start od asystenta albo młodzieżówki; sława z boiska otwiera drzwi |
| Kiedy | **Po MVP selekcjonera**: Euro 2016 → ligi klubowe → kariera piłkarza jako pierwszy tryb klubowy |

## Silnik meczu

| Obszar | Decyzja |
|---|---|
| Czynniki poza siłą i taktyką | Gospodarz i kibice, zmęczenie i rotacja, pogoda i murawa, **sędzia z własnym stylem** |
| Losowość | **Jak w rzeczywistości**, kalibrowana do prawdziwych danych |
| Kontuzje | **Realistyczne**: prawdziwe typy i czasy przerwy, nawroty, podatność zawodnika, spadek formy po powrocie |
| Mecz na żywo | **Regulowane tempo**: domyślnie 2–3 min, przyspieszenie, skok do ważnej akcji, pauza na zmiany |

## Zawodnicy i świat

| Obszar | Decyzja |
|---|---|
| Rozwój prawdziwych młodych | **Model + historia**: potencjał według tego, kim realnie zostali, ale rozwój zależy od minut, treningu i kontuzji, więc mogą nie wypalić |
| Nowi zawodnicy | **Prawdziwe roczniki wchodzą zgodnie z historią do 2026**, potem generowani |
| Uprawnienia do kadry | **Wierne przepisy FIFA z epoki**: podwójne obywatelstwo, zmiana federacji, naturalizacje; można przekonywać zawodników |
| Widoczność atrybutów | **Pełna**: skauting dotyczy formy, zdrowia i dyspozycji, a nie odkrywania liczb |
| Zdarzenia losowe | Sportowe, medialne, federacja i polityka, kariera prywatna; **częstotliwość na suwaku** |
| Media | **Prawdziwe tytuły** (Przegląd Sportowy, Marca, L'Équipe…) |
| Sztab | **Realny wpływ**: analityk (raport rywala), trener przygotowania (kontuzje), asystent (sugestie składu) |

## Atrybuty zawodników

| Obszar | Decyzja |
|---|---|
| Skala | **1–100**, jak w FIFA |
| Ocena ogólna | **Per pozycja**, wyliczana z atrybutów (np. ST 88, CAM 81) |
| Osobowość | **Pełna**: profesjonalizm, ambicja, lojalność, temperament, odporność na presję, podatność na kontuzje, gracz na wielkie mecze; wpływa na rozwój, szatnię, karne i kartki |
| Pozycje i nawyki | **Jak w FM**: znajomość każdej pozycji, lepsza noga, nawyki (strzały z dystansu, zejście do środka, krótka gra) |

## Kalendarz, edytor, sandbox, ekrany

| Obszar | Decyzja |
|---|---|
| Kalendarz selekcjonera | **Wiernie + obóz**: prawdziwe okna FIFA 2014–16, zgrupowania z treningami, obóz przed Euro, cięcie szerokiej kadry do 23, sparingi |
| Edytor | **Wszystko**: zawodnicy, drużyny i kluby, rozgrywki (formaty, regulaminy, losowania), parametry modelu |
| Sandbox | Zmiany składów, inny format, wymuszenie wyniku i symulacja dalej, **porównanie A/B** (dwie wersje świata po 10 000 przebiegów) |
| Ekran główny kariery | **Najbliższe wydarzenie**: duża karta „co teraz” + „dalej”, pod spodem skrót newsów i tabeli |

## Proponowana architektura

- **Aplikacja:** PWA (React + TypeScript), instalowana na telefonie i komputerze, mobile-first.
- **Silnik:** osobny moduł TypeScript bez UI: deterministyczny, z ziarnem losowości (ten sam seed daje ten sam wynik). Symulacje Monte Carlo liczą się w tle (Web Worker), żeby nie blokować ekranu.
- **Rozgrywki jako konfiguracja:** format (grupy, fazy, rozstawienia, tie-breaki, „najlepsze trzecie miejsca”) opisany w plikach danych. Nowy turniej oznacza nowy plik, nie nowy kod.
- **Czas:** kolejka wydarzeń (mecz, okno powołań, kontuzja, konferencja, oferta). Gra przewija do najbliższego wydarzenia, które wymaga Twojej decyzji.
- **Model meczu:** symulacja po fazach meczu. Atrybuty + taktyka + forma + zmęczenie dają szanse na akcje, z akcji powstają strzały z xG, a strzał kończy się golem albo nie, w zależności od wykończenia i bramkarza. Model kalibrowany na prawdziwych wynikach (średnia goli, przewaga gospodarza, rozkład wyników, częstość niespodzianek).
- **Dane:** osobny proces przygotowania: otwarte źródła → ujednolicone pliki → wyliczenie atrybutów → paczka danych scenariusza. Edytor w grze nadpisuje wartości, a poprawki przeżywają aktualizacje danych.
- **Zapis i synchronizacja:** zapis lokalny + konto i synchronizacja w chmurze (np. Supabase).

## Plan budowy (propozycja)

1. **Fundament:** szkielet PWA, moduł silnika, losowość z ziarnem.
2. **Silnik meczu v1 + kalibracja:** dwie drużyny, raport, statystyki. Weryfikacja na wynikach el. Euro 2016.
3. **Dane scenariusza:** 53 kadry (~1500–2000 zawodników), forma klubowa 14/15–15/16, atrybuty automatyczne, edytor.
4. **Rozgrywki:** eliminacje (9 grup, najlepsza 3. drużyna, baraże), losowanie, turniej na 24 drużyny (z tabelą par dla 3. miejsc), ranking FIFA według formuły z epoki.
5. **Tryb sandbox:** pojedyncza symulacja i 10 000 przebiegów, szanse na żywo.
6. **Kariera selekcjonera:** kalendarz wydarzeń, obserwacja, powołania, sparingi, mecz na żywo.
7. **Świat wokół:** media, szatnia, zdarzenia losowe, oceny i zwolnienia, oferty.
8. **Synchronizacja i konto.**
9. **Dalej:** el. MŚ 2018 w alternatywnej historii → kluby i ligi → ekonomia lig.

## Ryzyka i uwagi

- **Dane to najtrudniejsza część.** Pełne atrybuty dla historycznych zawodników nie istnieją w otwartych źródłach, więc będą wyliczane. Pierwsze wersje mogą dawać dziwne wyniki dla pojedynczych graczy, a edytor jest od tego, żeby je poprawić.
- **Pełne atrybuty a model bez animacji:** każdy atrybut musi mieć realny wpływ w modelu, inaczej jest tylko ozdobą. Do ustalenia, które atrybuty co napędzają.
- **Prawdziwe nazwiska** są w porządku w grze do własnego użytku. Publiczne wydanie wymagałoby innego podejścia do licencji.

## Otwarte pytania (kolejne rundy)

- Pełna lista atrybutów i to, co każdy napędza w modelu (do zaprojektowania przy silniku, do akceptacji Emila).
- Edytor: import/eksport danych do pliku?
- Nazwa gry?
