/**
 * Kraj i poziom ligi klubu na podstawie danych z Wikidata (kraj klubu, liga).
 * Zwraca kod używany w LEAGUE_STRENGTH (np. ENG, ENG2, SCO).
 */

const COUNTRY_CODE: Record<string, string> = {
  Germany: 'GER', Spain: 'ESP', Italy: 'ITA', France: 'FRA', Portugal: 'POR', Russia: 'RUS', Ukraine: 'UKR',
  Netherlands: 'NED', 'Kingdom of the Netherlands': 'NED', Belgium: 'BEL', Turkey: 'TUR', Türkiye: 'TUR',
  Switzerland: 'SUI', Greece: 'GRE', Austria: 'AUT', 'Czech Republic': 'CZE', Czechia: 'CZE', Denmark: 'DEN',
  Romania: 'ROU', Croatia: 'CRO', Sweden: 'SWE', Poland: 'POL', Israel: 'ISR', Cyprus: 'CYP', Belarus: 'BLR',
  Norway: 'NOR', Hungary: 'HUN', Slovakia: 'SVK', 'Republic of Ireland': 'IRL', Ireland: 'IRL', Iceland: 'ISL',
  Albania: 'ALB', 'United States': 'USA', 'United States of America': 'USA', "People's Republic of China": 'CHN',
  China: 'CHN', Qatar: 'QAT', 'Saudi Arabia': 'KSA', 'United Arab Emirates': 'UAE', Japan: 'JPN', Brazil: 'BRA',
  Argentina: 'ARG', Serbia: 'SRB', Bulgaria: 'BUL', Slovenia: 'SVN', 'Bosnia and Herzegovina': 'BIH',
  Kazakhstan: 'KAZ', Azerbaijan: 'AZE', Finland: 'FIN', Georgia: 'GEO', Scotland: 'SCO', England: 'ENG',
  Wales: 'WAL_L', 'Northern Ireland': 'NIR', Moldova: 'MDA', Armenia: 'ARM', Lithuania: 'LTU', Latvia: 'LVA',
  Estonia: 'EST', Malta: 'MLT', Luxembourg: 'LUX', Liechtenstein: 'LIE', Andorra: 'AND', 'San Marino': 'SMR',
  Gibraltar: 'GIB', 'Faroe Islands': 'FRO', 'North Macedonia': 'MKD', Montenegro: 'MNE', Australia: 'AUS',
  'South Korea': 'KOR', Iran: 'IRN', Mexico: 'MEX', India: 'IND', Thailand: 'THA',
};

/**
 * Ligi, które wskazują kraj lepiej niż kraj klubu (Vaduz gra w lidze szwajcarskiej, kluby walijskie
 * w angielskiej, kluby brytyjskie mają kraj „United Kingdom”).
 * Uwaga: liga w Wikidata to liga OBECNA, więc nie rozróżniamy poziomów (spadki i awanse od 2015).
 */
const LEAGUE_CODE: [RegExp, string][] = [
  [/^Gibraltar/, 'GIB'],
  [/^Scottish/, 'SCO'],
  [/NIFL|Northern Ireland Football League|IFA Premiership/, 'NIR'],
  [/Cymru|Welsh Premier/, 'WAL_L'],
  [/^Swiss/, 'SUI'],
  [/^(Premier League|EFL |English Football League|Football League )/, 'ENG'],
];

export function leagueCode(country: string, league: string | null): string | null {
  if (league) {
    for (const [re, code] of LEAGUE_CODE) if (re.test(league)) return code;
  }
  if (country === 'United Kingdom') return 'ENG';
  return COUNTRY_CODE[country] ?? null;
}
