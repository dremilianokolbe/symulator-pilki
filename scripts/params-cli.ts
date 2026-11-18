import { DEFAULT_PARAMS, type EngineParams } from '../src/engine/params';

/** Parametry modelu z wiersza poleceń: `--param klucz=wartość` (można powtarzać). */
export function paramsFromArgs(argv: string[] = process.argv): EngineParams {
  const params: EngineParams = { ...DEFAULT_PARAMS };
  argv.forEach((arg, i) => {
    if (arg !== '--param') return;
    const [key, value] = argv[i + 1]!.split('=');
    if (!(key! in params)) throw new Error(`Nieznany parametr: ${key}`);
    (params as unknown as Record<string, number>)[key!] = Number(value);
  });
  return params;
}
