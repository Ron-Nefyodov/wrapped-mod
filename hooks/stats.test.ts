import { test, expect, describe } from 'claude-code/testing';
import {
  emptyStats, normalizeStats, dayKeyOf, recordSessionStart, recordSessionMinutes,
  recordPrompt, recordTurn, recordTool, summarize, MAX_FILES_PER_MONTH, MAX_DAYS,
} from './stats.js';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('stats recording', () => {
  test('day key is the local date', async () => {
    expect(dayKeyOf(at(2026, 3, 7, 23, 59))).toBe('2026-03-07');
  });

  test('normalize turns junk into empty stats', async () => {
    expect(normalizeStats(undefined)).toEqual(emptyStats());
    expect(normalizeStats({ nope: 1 })).toEqual(emptyStats());
  });

  test('prompts count per day and per hour', async () => {
    const stats = emptyStats();
    recordPrompt(stats, at(2026, 10, 1, 23));
    recordPrompt(stats, at(2026, 10, 1, 23, 30));
    recordPrompt(stats, at(2026, 10, 2, 9));
    expect(stats.days['2026-10-01'].prompts).toBe(2);
    expect(stats.days['2026-10-01'].hours['23']).toBe(2);
    expect(stats.days['2026-10-02'].hours['9']).toBe(1);
  });

  test('turns count only on the main loop, tokens from every loop', async () => {
    const stats = emptyStats();
    const usage = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 10, model: 'm' };
    recordTurn(stats, at(2026, 10, 1), usage, true);
    recordTurn(stats, at(2026, 10, 1), usage, false);
    recordTurn(stats, at(2026, 10, 1), undefined, true);
    const day = stats.days['2026-10-01'];
    expect(day.turns).toBe(2);
    expect(day.inputTokens).toBe(220);
    expect(day.outputTokens).toBe(100);
  });

  test('tools count by name; edits record file paths per month', async () => {
    const stats = emptyStats();
    recordTool(stats, at(2026, 10, 1), 'Edit', '/repo/src/app.ts');
    recordTool(stats, at(2026, 10, 1), 'Edit', '/repo/src/app.ts');
    recordTool(stats, at(2026, 10, 1), 'Bash');
    expect(stats.days['2026-10-01'].tools).toEqual({ Edit: 2, Bash: 1 });
    expect(stats.files['2026-10']).toEqual({ '/repo/src/app.ts': 2 });
  });

  test('distinct file paths are capped per month, keeping the most edited', async () => {
    const stats = emptyStats();
    for (let i = 0; i < 3; i++) recordTool(stats, at(2026, 10, 1), 'Edit', '/hot.ts');
    for (let i = 0; i < MAX_FILES_PER_MONTH + 20; i++) recordTool(stats, at(2026, 10, 1), 'Write', `/f${i}.ts`);
    const files = stats.files['2026-10'];
    expect(Object.keys(files).length).toBeLessThanOrEqual(MAX_FILES_PER_MONTH);
    expect(files['/hot.ts']).toBe(3);
  });

  test('sessions and minutes land on the start day, capped at 12 hours', async () => {
    const stats = emptyStats();
    recordSessionStart(stats, at(2026, 10, 1, 10));
    recordSessionMinutes(stats, at(2026, 10, 1, 10), at(2026, 10, 1, 11, 30));
    recordSessionMinutes(stats, at(2026, 10, 1, 10), at(2026, 10, 3, 10));
    expect(stats.days['2026-10-01'].sessions).toBe(1);
    expect(stats.days['2026-10-01'].minutes).toBe(90 + 720);
  });

  test('old days fold into the archive past the cap', async () => {
    const stats = emptyStats();
    const start = at(2020, 1, 1);
    for (let i = 0; i < MAX_DAYS + 5; i++) recordPrompt(stats, start + i * 86400000);
    expect(Object.keys(stats.days).length).toBe(MAX_DAYS);
    expect(stats.archive.prompts).toBe(5);
    expect(summarize(stats, 'all', start).prompts).toBe(MAX_DAYS + 5);
  });
});

describe('summarize', () => {
  function sample() {
    const stats = emptyStats();
    for (const d of [1, 2, 3, 5, 6]) {
      recordSessionStart(stats, at(2026, 10, d, 22));
      recordPrompt(stats, at(2026, 10, d, 23));
      recordTurn(stats, at(2026, 10, d, 23), { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm' }, true);
    }
    recordTool(stats, at(2026, 10, 1), 'Edit', '/repo/a/register.js');
    recordTool(stats, at(2026, 10, 1), 'Edit', '/repo/a/register.js');
    recordTool(stats, at(2026, 10, 1), 'Edit', '/repo/b/other.js');
    recordTool(stats, at(2026, 10, 2), 'Read');
    recordTool(stats, at(2026, 10, 2), 'Bash');
    recordPrompt(stats, at(2026, 3, 1, 8));
    recordPrompt(stats, at(2025, 12, 31, 8));
    return stats;
  }

  test('year range sums this calendar year', async () => {
    const s = summarize(sample(), 'year', at(2026, 10, 11));
    expect(s.label).toBe('2026');
    expect(s.prompts).toBe(6);
    expect(s.turns).toBe(5);
    expect(s.tokens).toBe(7500);
    expect(s.toolCalls).toBe(5);
    expect(s.sessions).toBe(5);
    expect(s.activeDays).toBe(6);
    expect(s.longestStreak).toBe(3);
  });

  test('month and all ranges', async () => {
    const stats = sample();
    expect(summarize(stats, 'month', at(2026, 10, 11)).prompts).toBe(5);
    expect(summarize(stats, 'month', at(2026, 10, 11)).label).toBe('October 2026');
    const all = summarize(stats, 'all', at(2026, 10, 11));
    expect(all.prompts).toBe(7);
    expect(all.label).toBe('All time');
  });

  test('top tools, peak hour, persona, title and most edited file', async () => {
    const s = summarize(sample(), 'year', at(2026, 10, 11));
    expect(s.topTools).toEqual([{ name: 'Edit', count: 3 }, { name: 'Bash', count: 1 }, { name: 'Read', count: 1 }]);
    expect(s.peakHour).toBe(23);
    expect(s.hours.length).toBe(24);
    expect(s.persona).toBe('Night owl');
    expect(s.title).toBe('The Refactorer');
    expect(s.topFile).toEqual({ name: 'register.js', count: 2 });
  });

  test('empty stats summarize to zeros', async () => {
    const s = summarize(emptyStats(), 'year', at(2026, 10, 11));
    expect(s.prompts).toBe(0);
    expect(s.isEmpty).toBe(true);
    expect(s.peakHour).toBe(null);
    expect(s.topFile).toBe(null);
    expect(s.title).toBe('The Generalist');
  });
});
