// Uruchamia skrypt TypeScript w wątku roboczym (worker_threads nie dziedziczą loadera tsx).
import { workerData } from 'node:worker_threads';
import { tsImport } from 'tsx/esm/api';

await tsImport(workerData.__file, import.meta.url);
