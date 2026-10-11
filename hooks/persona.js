const TITLE_GROUPS = [
  ['The Refactorer', ['Edit', 'MultiEdit']],
  ['The Explorer', ['Read', 'Grep', 'Glob']],
  ['The Operator', ['Bash']],
  ['The Author', ['Write']],
  ['The Delegator', ['Agent', 'Task']],
];

export const FALLBACK_TITLE = 'The Generalist';

export function personaOf(peakHour) {
  if (peakHour === null || peakHour === undefined) return 'Fresh start';
  if (peakHour >= 5 && peakHour < 11) return 'Early bird';
  if (peakHour >= 11 && peakHour < 17) return 'Day shift';
  if (peakHour >= 17 && peakHour < 23) return 'Evening coder';
  return 'Night owl';
}

export function titleOf(tools) {
  const groupOf = (name) => TITLE_GROUPS.find(([, names]) => names.includes(name))?.[0] ?? null;
  const totals = new Map();
  for (const [name, count] of Object.entries(tools)) {
    const key = groupOf(name) ?? `other:${name}`;
    totals.set(key, (totals.get(key) ?? 0) + count);
  }
  let best = null;
  let bestCount = 0;
  for (const [key, count] of totals) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best && !best.startsWith('other:') ? best : FALLBACK_TITLE;
}
