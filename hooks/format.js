const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
const LEVELS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const UNITS = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

function withCommas(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function compact(n) {
  const value = Number(n) || 0;
  if (value < 10000) return withCommas(value);
  for (const [size, unit] of UNITS) {
    if (value >= size) return `${(value / size).toFixed(1).replace(/\.0$/, '')}${unit}`;
  }
  return withCommas(value);
}

export function bar(value, max, width) {
  if (max <= 0 || value <= 0 || width <= 0) return '';
  const eighths = Math.max(1, Math.round((Math.min(value, max) / max) * width * 8));
  return '█'.repeat(Math.floor(eighths / 8)) + EIGHTHS[eighths % 8];
}

export function sparkline(values) {
  const max = Math.max(0, ...values);
  return values
    .map((v) => (v > 0 && max > 0 ? LEVELS[Math.max(0, Math.ceil((v / max) * LEVELS.length) - 1)] : ' '))
    .join('');
}

export function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function basename(path) {
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || String(path);
}

export function duration(minutes) {
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours >= 100 || rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function pad(text, width) {
  const value = String(text);
  return value.length >= width ? value.slice(0, width) : value + ' '.repeat(width - value.length);
}

export function padStart(text, width) {
  const value = String(text);
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

export function plural(count, word) {
  return `${compact(count)} ${count === 1 ? word : `${word}s`}`;
}
