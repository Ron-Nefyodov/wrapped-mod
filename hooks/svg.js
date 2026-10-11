import { compact, duration, hourLabel, plural } from './format.js';

export const WIDTH = 1200;
export const HEIGHT = 630;

const COLORS = {
  bgTop: '#21170f',
  bgBottom: '#0f0b08',
  accent: '#D97757',
  accentSoft: '#F0C9A8',
  text: '#F5EFE8',
  muted: '#A89A8E',
  panel: '#ffffff',
};
const SANS = "font-family=\"-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif\"";
const MONO = "font-family=\"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace\"";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clip(text, max) {
  const value = String(text);
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function text(x, y, content, attrs = '') {
  return `<text x="${x}" y="${y}" ${SANS} ${attrs}>${escapeXml(content)}</text>`;
}

function statTiles(summary) {
  const tiles = [
    [compact(summary.prompts), 'prompts'],
    [compact(summary.turns), 'turns'],
    [compact(summary.tokens), 'tokens'],
    [compact(summary.toolCalls), 'tool calls'],
    [compact(summary.activeDays), 'active days'],
    [`${compact(summary.longestStreak)}d`, 'longest streak'],
  ];
  return tiles.map(([value, label], i) => {
    const x = 64 + (i % 3) * 190;
    const y = 345 + Math.floor(i / 3) * 125;
    return [
      text(x, y, value, `font-size="54" font-weight="800" fill="${COLORS.text}"`),
      text(x, y + 30, label.toUpperCase(), `font-size="15" font-weight="600" letter-spacing="2" fill="${COLORS.muted}"`),
    ].join('');
  }).join('\n  ');
}

function toolBars(summary) {
  const top = summary.topTools;
  if (top.length === 0) return text(692, 214, 'No tool calls yet', `font-size="20" fill="${COLORS.muted}"`);
  const max = top[0].count;
  return top.map((tool, i) => {
    const y = 214 + i * 44;
    const width = Math.max(4, Math.round((tool.count / max) * 190));
    return [
      text(692, y, clip(tool.name, 12), `font-size="20" font-weight="600" fill="${COLORS.text}"`),
      `<rect x="830" y="${y - 16}" width="${width}" height="18" rx="9" fill="${COLORS.accent}" fill-opacity="${i === 0 ? 1 : 0.6}"/>`,
      text(1104, y, compact(tool.count), `font-size="20" font-weight="700" fill="${COLORS.accentSoft}" text-anchor="end"`),
    ].join('');
  }).join('\n  ');
}

function hourBars(summary) {
  const max = Math.max(1, ...summary.hours);
  const base = 470;
  const bars = summary.hours.map((count, hour) => {
    const height = count > 0 ? Math.max(4, Math.round((count / max) * 76)) : 2;
    const isPeak = hour === summary.peakHour;
    return `<rect class="hour" x="${692 + hour * 17.5}" y="${base - height}" width="12" height="${height}" rx="3" fill="${COLORS.accent}" fill-opacity="${isPeak ? 1 : count > 0 ? 0.5 : 0.15}"/>`;
  });
  const ticks = [0, 6, 12, 18].map((hour) =>
    text(692 + hour * 17.5, base + 22, hourLabel(hour), `font-size="13" fill="${COLORS.muted}"`));
  return [...bars, ...ticks].join('\n  ');
}

function footer(summary, nowMs) {
  const date = new Date(nowMs);
  const left = [plural(summary.sessions, 'session'), summary.minutes > 0 ? `${duration(summary.minutes)} in sessions` : null]
    .filter(Boolean).join('  ·  ');
  return [
    text(64, 590, left, `font-size="16" fill="${COLORS.muted}"`),
    text(1136, 590, `generated ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}  ·  /wrapped`, `font-size="16" fill="${COLORS.muted}" text-anchor="end"`),
  ].join('\n  ');
}

export function buildSvg(summary, nowMs) {
  const subtitle = summary.peakHour === null
    ? summary.persona
    : `${summary.persona}  ·  peak hour ${hourLabel(summary.peakHour)}`;
  const file = summary.topFile
    ? `<text x="692" y="550" ${MONO} font-size="20" fill="${COLORS.text}">${escapeXml(clip(summary.topFile.name, 30))}</text>`
      + text(1104, 550, plural(summary.topFile.count, 'edit'), `font-size="16" fill="${COLORS.muted}" text-anchor="end"`)
    : text(692, 550, 'No edits yet', `font-size="20" fill="${COLORS.muted}"`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.bgTop}"/>
      <stop offset="1" stop-color="${COLORS.bgBottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${COLORS.accent}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${COLORS.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="1080" cy="40" r="320" fill="url(#glow)"/>
  <rect x="64" y="56" width="40" height="4" rx="2" fill="${COLORS.accent}"/>
  ${text(64, 92, 'CLAUDE CODE WRAPPED', `font-size="18" font-weight="700" letter-spacing="5" fill="${COLORS.accent}"`)}
  ${text(1136, 92, summary.label, `font-size="18" font-weight="700" letter-spacing="2" fill="${COLORS.muted}" text-anchor="end"`)}
  ${text(64, 186, summary.title, `font-size="68" font-weight="800" fill="${COLORS.text}"`)}
  ${text(64, 232, subtitle, `font-size="26" font-weight="500" fill="${COLORS.accentSoft}"`)}
  ${statTiles(summary)}
  <rect x="660" y="132" width="476" height="440" rx="20" fill="${COLORS.panel}" fill-opacity="0.045" stroke="${COLORS.panel}" stroke-opacity="0.08"/>
  ${text(692, 172, 'TOP TOOLS', `font-size="14" font-weight="700" letter-spacing="3" fill="${COLORS.muted}"`)}
  ${toolBars(summary)}
  ${text(692, 372, 'WHEN YOU CODE', `font-size="14" font-weight="700" letter-spacing="3" fill="${COLORS.muted}"`)}
  ${hourBars(summary)}
  ${text(692, 522, 'MOST EDITED', `font-size="14" font-weight="700" letter-spacing="3" fill="${COLORS.muted}"`)}
  ${file}
  ${footer(summary, nowMs)}
</svg>
`;
}
