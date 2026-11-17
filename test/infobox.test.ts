import { describe, expect, it } from 'vitest';
import { clubInYear, estimatedCapsAt, parseInfobox, parsePositions } from '../src/data/infobox';
import { leagueCode } from '../src/data/leagues';

const BOX = `{{Infobox football biography
| name = Testowy Zawodnik
| birth_date = {{birth date and age|1988|8|21|df=y}}
| position = {{hlist|[[Right-back]]|[[centre-back]]}}
| years1 = 2006–2010 | clubs1 = [[Lech Poznań]]
| years2 = 2010–2014 | clubs2 = [[Borussia Dortmund]]
| years3 = 2014–2017 | clubs3 = [[Bayern Munich]]
| years4 = 2015 | clubs4 = → [[Juventus FC|Juventus]] (loan)
| national_years1 = 2007
| national_team1 = [[Poland national under-19 football team|Poland U19]]
| national_caps1 = 5
| national_years2 = 2008–2019
| national_team2 = [[Poland national football team|Poland]]
| national_caps2 = 72
| national_goals2 = [[List of goals|6]]
}}`;

describe('infoboks Wikipedii', () => {
  const d = parseInfobox(BOX);

  it('czyta pozycje z listy, pierwsza jest główna', () => {
    expect(d.primary).toBe('DR');
    expect(d.positions.DR).toBe(100);
    expect(d.positions.DC).toBe(85);
  });

  it('czyta datę urodzenia', () => {
    expect(d.birthDate).toBe('1988-08-21');
  });

  it('pomija kadry młodzieżowe', () => {
    expect(d.national).toMatchObject({ from: 2008, to: 2019, caps: 72, goals: 6 });
  });

  it('wypożyczenie ma pierwszeństwo w danym roku', () => {
    expect(clubInYear(d, 2015)).toBe('Juventus');
    expect(clubInYear(d, 2016)).toBe('Bayern Munich');
    expect(clubInYear(d, 2012)).toBe('Borussia Dortmund');
  });

  it('szacuje występy w kadrze proporcjonalnie do lat gry', () => {
    // 2008–2019 = 12 lat, 72 mecze; połowa 2015 roku ≈ 7,5/12 kariery.
    expect(estimatedCapsAt(d, 2015)).toBe(45);
    expect(estimatedCapsAt(d, 2005)).toBe(0);
  });
});

describe('pozycje', () => {
  it.each([
    ['[[Goalkeeper (association football)|Goalkeeper]]', 'GK'],
    ['[[Defensive midfielder]]', 'DM'],
    ['[[Winger (association football)|Winger]]', 'AMR'],
    ['Left–back', 'DL'],
    ['[[Striker (association football)|Striker]]', 'ST'],
    ['{{flatlist|\n*[[Centre back]]\n*[[Left back]]}}', 'DC'],
  ])('%s → %s', (text, expected) => {
    expect(parsePositions(text).primary).toBe(expected);
  });
});

describe('ligi', () => {
  it('rozpoznaje ligę ponad krajem klubu', () => {
    expect(leagueCode('Liechtenstein', 'Swiss Super League')).toBe('SUI');
    expect(leagueCode('United Kingdom', 'Scottish Premiership')).toBe('SCO');
    expect(leagueCode('United Kingdom', 'Premier League')).toBe('ENG');
    expect(leagueCode('Gibraltar', 'Gibraltar National League')).toBe('GIB');
    expect(leagueCode('Poland', 'Ekstraklasa')).toBe('POL');
  });
});
