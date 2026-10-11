import { test, expect, describe } from 'claude-code/testing';
import { buildSvg, escapeXml } from './svg.js';
import { emptyStats, recordPrompt, recordTool, summarize } from './stats.js';

const now = new Date(2026, 9, 11, 12).getTime();

function summary() {
  const stats = emptyStats();
  recordPrompt(stats, new Date(2026, 9, 1, 23).getTime());
  recordTool(stats, now, 'Edit', '/repo/<weird>&.ts');
  recordTool(stats, now, 'Bash');
  return summarize(stats, 'year', now);
}

describe('svg card', () => {
  test('escapes xml', async () => {
    expect(escapeXml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;');
  });

  test('is a 1200x630 svg with the key facts', async () => {
    const svg = buildSvg(summary(), now);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain('The Refactorer');
    expect(svg).toContain('Night owl');
    expect(svg).toContain('2026');
    expect(svg).toContain('&lt;weird&gt;&amp;.ts');
    expect(svg).not.toContain('<weird>');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  test('draws one bar per hour', async () => {
    const svg = buildSvg(summary(), now);
    expect((svg.match(/class="hour"/g) ?? []).length).toBe(24);
  });

  test('empty summary still builds', async () => {
    const svg = buildSvg(summarize(emptyStats(), 'all', now), now);
    expect(svg).toContain('All time');
    expect(svg).toContain('The Generalist');
  });
});
