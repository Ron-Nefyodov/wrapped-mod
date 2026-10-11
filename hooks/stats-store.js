import { normalizeStats, STATS_KEY } from './stats.js';

// One write at a time, so parallel tool calls never lose an increment.
let writes = Promise.resolve();

export function enqueue(task) {
  const run = writes.then(task);
  writes = run.catch(() => undefined);
  return run;
}

export function updateStats({ get, set }, change) {
  return enqueue(async () => {
    const stats = normalizeStats(await get(STATS_KEY));
    change(stats);
    await set(STATS_KEY, stats);
  });
}
