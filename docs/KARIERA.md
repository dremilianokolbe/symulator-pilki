# Kariera selekcjonera (v1, terminal)

```bash
npm run kariera
```

```bash
npm run kariera -- --druzyna Poland
```

```bash
npm run kariera -- --wczytaj data/saves/Poland-123456.json
```

## Jak to działa

Prowadzisz dowolną z 54 reprezentacji od września 2014 do końca Euro 2016. Cały świat (wszystkie
mecze eliminacji, baraże, losowanie, turniej) toczy się wg prawdziwego terminarza; gra zatrzymuje się
tylko wtedy, gdy coś zależy od Ciebie.

**Start:** oczekiwania federacji (z rankingu Elo w grupie), wybór sztabu: asystent (sugestie powołań,
składu i zmian), analityk (raport o rywalu), trener przygotowania (kontuzje, regeneracja). Każdy
kandydat ma plus i minus (droższy fachowiec kosztuje zaufanie federacji, były kadrowicz podnosi morale).

**Każde okno reprezentacyjne:**
1. Upływ czasu: forma w klubach (wahania zależne od regularności zawodnika), kontuzje w klubach
   (moment urazu losowy w trakcie przerwy), leczenie urazów.
2. Zdarzenie losowe z wyborem (ok. 70% okien): zawodnik prosi o rozmowę, gwiazda krytykuje w wywiadzie,
   młody talent, prezes federacji, telewizja, konflikt w szatni.
3. Raport z obserwacji: kontuzje, kto w formie, kto bez formy.
4. Powołania: 23 z szerokiej kadry (skład + do 17 rezerwowych z prawdziwej kadry 2014–16).
5. Sparing w wolnym terminie (listopad 2014, marzec i czerwiec 2015, przed Euro): rywal mocniejszy,
   równy albo słabszy, albo bez sparingu (trening: +forma).
6. Konferencja prasowa: pytanie i 2–3 odpowiedzi z konsekwencjami (media, zaufanie, morale).

**Mecz:** skład zaproponowany przez asystenta (optymalny przydział do pozycji), raport analityka,
zmiany formacji, stylu (6 gotowych: zrównoważony, ofensywny, defensywny, pressing, kontratak,
posiadanie) i zawodników. Mecz na żywo z relacją; przerwy na decyzje: gol, czerwona kartka, uraz
Twojego zawodnika, przerwa, 60., 70. i 80. minuta, dogrywka. Możesz zmieniać zawodników i styl
albo przewinąć do końca.

**Po meczu:** statystyki, oceny, kartki i zawieszenia (eliminacje: pauza po 3., 5.… żółtej;
turniej: po 2., 4.…, kasowanie po ćwierćfinale; czerwona: 1 mecz), kontuzje z czasem przerwy,
forma z oceny, morale, nagłówek z prawdziwego tytułu prasowego kraju (Przegląd Sportowy, Kicker,
Marca…), zmiana zaufania federacji wg wyniku względem oczekiwań (Elo).

**Koniec:** po eliminacjach ocena celu; zaufanie poniżej 12 w trakcie eliminacji = zwolnienie.
Na koniec kadencji podsumowanie i werdykt federacji (cel + zaufanie), mistrz Europy w tym świecie
i porównanie z prawdziwą historią.

## Zapis gry

Zapis = drużyna + seed + lista odpowiedzi (`data/saves/`), zapisywany po każdej decyzji. Wczytanie
odtwarza decyzje i gra toczy się dalej dokładnie tak samo. **Zapis działa tylko w tej samej wersji
gry:** po zmianach w kodzie odpowiedzi mogą trafić w inne pytania.

## Czego jeszcze nie ma (kolejne kroki)

- interfejsu graficznego (aplikacja na telefon) – logika kariery jest już niezależna od terminala,
- ofert pracy od innych reprezentacji i klubów, kontynuacji po Euro 2016 (eliminacje MŚ 2018),
- prawdziwej formy klubowej z sezonów 14/15 i 15/16 (na razie model),
- kursów licencji, życia prywatnego, rozbudowanych mediów (dziennikarze z charakterem),
- suwaków taktyki (na razie 6 gotowych stylów), stałych fragmentów i indywidualnych instrukcji,
- zawieszeń i kontuzji u rywali sterowanych przez komputer.
