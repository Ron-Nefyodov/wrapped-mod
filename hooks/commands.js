export const RANGES = ['year', 'month', 'all'];
export const RESET_WINDOW_MS = 60000;
export const RANGE_KEY = 'wrapped-range';
export const RESET_KEY = 'wrapped-reset-armed';

export const HELP_TEXT = [
  'Usage:',
  '  /wrapped              this year',
  '  /wrapped month        this month',
  '  /wrapped all          all time',
  '  /wrapped export [range]  save an SVG card in this folder',
  '  /wrapped reset        clear all stats (asks first)',
].join('\n');

export function parseArgs(args) {
  const words = String(args ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const [first, second] = words;
  if (!first) return { action: 'open', range: 'year' };
  if (RANGES.includes(first)) return { action: 'open', range: first };
  if (first === 'export') return { action: 'export', range: RANGES.includes(second) ? second : 'year' };
  if (first === 'reset') {
    const confirmed = second === 'confirm' || second === 'yes';
    return { action: confirmed ? 'reset-confirm' : 'reset', range: 'year' };
  }
  return { action: 'help', range: 'year' };
}

export function normalizeRange(value) {
  return RANGES.includes(value) ? value : 'year';
}

export function exportFileName(range, nowMs) {
  const date = new Date(nowMs);
  if (range === 'all') return 'claude-wrapped-all.svg';
  if (range === 'month') return `claude-wrapped-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}.svg`;
  return `claude-wrapped-${date.getFullYear()}.svg`;
}

export function joinPath(dir, name) {
  return dir.endsWith('/') || dir.endsWith('\\') ? `${dir}${name}` : `${dir}/${name}`;
}

export function isResetArmed(armedAt, nowMs) {
  return typeof armedAt === 'number' && nowMs - armedAt >= 0 && nowMs - armedAt < RESET_WINDOW_MS;
}
