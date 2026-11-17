/** Generuje docs/ATRYBUTY.md z definicji w kodzie. Uruchom: npx tsx scripts/atrybuty-doc.ts */
import { writeFileSync } from 'node:fs';
import {
  ATTR_INFO, GOALKEEPING, MENTAL, PERSONALITY, PHYSICAL, POSITION_LABEL, POSITION_WEIGHTS, POSITIONS, TECHNICAL,
} from '../src/engine/attributes';
import { TRAIT_LABEL, TRAITS } from '../src/engine/types';

type Key = keyof typeof ATTR_INFO;

const section = (title: string, keys: readonly Key[]) =>
  `## ${title}\n\n| Atrybut | Co napędza w silniku |\n|---|---|\n` +
  keys.map((k) => `| ${ATTR_INFO[k].label} | ${ATTR_INFO[k].effect} |`).join('\n') + '\n';

const positions = POSITIONS.map((p) => {
  const top = Object.entries(POSITION_WEIGHTS[p])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => ATTR_INFO[k as Key].label)
    .join(', ');
  return `| ${POSITION_LABEL[p]} (${p}) | ${top} |`;
}).join('\n');

const md = `# Atrybuty zawodników (v1, do akceptacji)

Skala 1–100. Plik generowany z kodu (\`src/engine/attributes.ts\`), więc zawsze zgadza się z silnikiem.

${section('Techniczne', TECHNICAL)}
${section('Mentalne', MENTAL)}
${section('Fizyczne', PHYSICAL)}
${section('Bramkarskie', GOALKEEPING)}
${section('Osobowość (ukryte)', PERSONALITY)}
## Nawyki

${TRAITS.map((t) => `- ${TRAIT_LABEL[t]}`).join('\n')}

## Ocena ogólna per pozycja: najważniejsze atrybuty

| Pozycja | Najważniejsze atrybuty (malejąco) |
|---|---|
${positions}

Znajomość pozycji: 90+ = naturalna (100% skuteczności), 0 = zupełnie obca (75%).
`;

writeFileSync('docs/ATRYBUTY.md', md);
console.log('Zapisano docs/ATRYBUTY.md');
