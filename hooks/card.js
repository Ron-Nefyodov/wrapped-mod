import { bar, compact, duration, hourLabel, pad, padStart, plural, sparkline } from './format.js';

export const ACCENT = 'claude';

function tilesPerRow(width) {
  if (width >= 120) return 6;
  if (width >= 60) return 3;
  if (width >= 40) return 2;
  return 1;
}

export function statTilesOf(summary) {
  return [
    { id: 'prompts', value: compact(summary.prompts), label: 'prompts' },
    { id: 'turns', value: compact(summary.turns), label: 'turns' },
    { id: 'tokens', value: compact(summary.tokens), label: 'tokens' },
    { id: 'tools', value: compact(summary.toolCalls), label: 'tool calls' },
    { id: 'days', value: compact(summary.activeDays), label: 'active days' },
    { id: 'streak', value: `${compact(summary.longestStreak)}d`, label: 'longest streak' },
  ];
}

export function toolRowsOf(topTools, width) {
  const nameWidth = Math.min(16, Math.max(4, ...topTools.map((tool) => tool.name.length)));
  const counts = topTools.map((tool) => compact(tool.count));
  const countWidth = Math.max(1, ...counts.map((count) => count.length));
  const barWidth = Math.max(4, Math.min(40, width - nameWidth - countWidth - 6));
  const max = topTools[0]?.count ?? 0;
  return topTools.map((tool, i) => ({
    name: pad(tool.name, nameWidth),
    bar: pad(bar(tool.count, max, barWidth), barWidth),
    count: padStart(counts[i], countWidth),
  }));
}

export function hourAxisOf(cellWidth) {
  const axis = Array.from({ length: 24 * cellWidth }, () => ' ');
  for (const hour of [0, 6, 12, 18]) {
    String(hour).split('').forEach((char, i) => { axis[hour * cellWidth + i] = char; });
  }
  return axis.join('').trimEnd();
}

export function drawWrappedPane({ Box, Text }, summary, columns) {
  const width = Math.max(20, columns - 2);
  const heading = (label) => Text({ bold: true, dimColor: true, children: [label] });
  const header = Box({
    key: 'wrapped-header', flexDirection: 'row', justifyContent: 'space-between',
    children: [
      Text({ bold: true, color: ACCENT, children: ['✦ CLAUDE CODE WRAPPED'] }),
      Text({ bold: true, children: [summary.label] }),
    ],
  });
  const footer = Text({ dimColor: true, children: ['/wrapped [year|month|all] · /wrapped export · Esc closes'] });

  if (summary.isEmpty) {
    return Box({
      key: 'wrapped-card', flexDirection: 'column', paddingX: 1,
      children: [
        header,
        Box({ key: 'wrapped-empty', marginY: 1, children: [Text({ children: [`No activity yet for ${summary.label}. Use Claude Code a bit and check back.`] })] }),
        footer,
      ],
    });
  }

  const subtitle = [summary.persona, summary.peakHour === null ? null : `peak ${hourLabel(summary.peakHour)}`]
    .filter(Boolean).join(' · ');
  const identity = Box({
    key: 'wrapped-identity', flexDirection: 'column', marginTop: 1,
    children: [
      Text({ bold: true, children: [summary.title] }),
      Text({ color: ACCENT, children: [subtitle] }),
    ],
  });

  const perRow = tilesPerRow(width);
  const tileWidth = Math.floor(width / perRow);
  const tiles = statTilesOf(summary).map((tile) => Box({
    key: `wrapped-stat-${tile.id}`, flexDirection: 'column', width: tileWidth,
    children: [
      Text({ bold: true, color: ACCENT, children: [tile.value] }),
      Text({ dimColor: true, children: [tile.label] }),
    ],
  }));
  const rows = [];
  for (let i = 0; i < tiles.length; i += perRow) {
    rows.push(Box({ flexDirection: 'row', children: tiles.slice(i, i + perRow) }));
  }
  const stats = Box({ key: 'wrapped-stats', flexDirection: 'column', marginTop: 1, rowGap: 1, children: rows });

  const toolLines = summary.topTools.length === 0
    ? [Text({ dimColor: true, children: ['No tool calls yet'] })]
    : toolRowsOf(summary.topTools, width).map((row) => Box({
      flexDirection: 'row',
      children: [
        Text({ children: [`${row.name}  `] }),
        Text({ color: ACCENT, children: [row.bar] }),
        Text({ bold: true, children: [`  ${row.count}`] }),
      ],
    }));
  const tools = Box({ key: 'wrapped-tools', flexDirection: 'column', marginTop: 1, children: [heading('TOP TOOLS'), ...toolLines] });

  const cellWidth = width >= 50 ? 2 : 1;
  const spark = sparkline(summary.hours).split('').map((char) => char.repeat(cellWidth)).join('');
  const hours = Box({
    key: 'wrapped-hours', flexDirection: 'column', marginTop: 1,
    children: [
      heading('WHEN YOU CODE'),
      Text({ color: ACCENT, children: [spark] }),
      Text({ dimColor: true, children: [hourAxisOf(cellWidth)] }),
    ],
  });

  const fileText = summary.topFile
    ? [Text({ bold: true, children: [summary.topFile.name] }), Text({ dimColor: true, children: [` · ${plural(summary.topFile.count, 'edit')}`] })]
    : [Text({ dimColor: true, children: ['no edits yet'] })];
  const file = Box({
    key: 'wrapped-file', flexDirection: 'row', marginTop: 1,
    children: [Text({ bold: true, dimColor: true, children: ['MOST EDITED  '] }), ...fileText],
  });

  const extras = [plural(summary.sessions, 'session')];
  if (summary.minutes > 0) extras.push(`${duration(summary.minutes)} in sessions`);
  if (summary.currentStreak > 1) extras.push(`${summary.currentStreak}-day streak going`);
  const meta = Box({ key: 'wrapped-meta', children: [Text({ dimColor: true, children: [extras.join(' · ')] })] });

  return Box({
    key: 'wrapped-card', flexDirection: 'column', paddingX: 1,
    children: [header, identity, stats, tools, hours, file, meta, Box({ marginTop: 1, children: [footer] })],
  });
}
