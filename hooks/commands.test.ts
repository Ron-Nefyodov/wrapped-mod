import { test, expect, describe } from 'claude-code/testing';
import { parseArgs, exportFileName, RESET_WINDOW_MS, isResetArmed } from './commands.js';

describe('commands', () => {
  test('parse ranges and actions', async () => {
    expect(parseArgs('')).toEqual({ action: 'open', range: 'year' });
    expect(parseArgs('  month ')).toEqual({ action: 'open', range: 'month' });
    expect(parseArgs('all')).toEqual({ action: 'open', range: 'all' });
    expect(parseArgs('export')).toEqual({ action: 'export', range: 'year' });
    expect(parseArgs('export month')).toEqual({ action: 'export', range: 'month' });
    expect(parseArgs('reset')).toEqual({ action: 'reset', range: 'year' });
    expect(parseArgs('reset confirm')).toEqual({ action: 'reset-confirm', range: 'year' });
    expect(parseArgs('RESET YES')).toEqual({ action: 'reset-confirm', range: 'year' });
    expect(parseArgs('banana')).toEqual({ action: 'help', range: 'year' });
  });

  test('export file names', async () => {
    const now = new Date(2026, 9, 11).getTime();
    expect(exportFileName('year', now)).toBe('claude-wrapped-2026.svg');
    expect(exportFileName('month', now)).toBe('claude-wrapped-2026-10.svg');
    expect(exportFileName('all', now)).toBe('claude-wrapped-all.svg');
  });

  test('reset is armed only inside the window', async () => {
    expect(isResetArmed(undefined, 1000)).toBe(false);
    expect(isResetArmed(1000, 1000 + RESET_WINDOW_MS - 1)).toBe(true);
    expect(isResetArmed(1000, 1000 + RESET_WINDOW_MS + 1)).toBe(false);
  });
});
