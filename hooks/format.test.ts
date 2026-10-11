import { test, expect, describe } from 'claude-code/testing';
import { compact, bar, sparkline, hourLabel, basename, duration, plural } from './format.js';

describe('format', () => {
  test('compact numbers', async () => {
    expect(compact(0)).toBe('0');
    expect(compact(999)).toBe('999');
    expect(compact(1234)).toBe('1,234');
    expect(compact(12345)).toBe('12.3K');
    expect(compact(2_345_678)).toBe('2.3M');
    expect(compact(4_100_000_000)).toBe('4.1B');
    expect(compact(10_000)).toBe('10K');
  });

  test('bars use eighth blocks and fill exactly at max', async () => {
    expect(bar(10, 10, 5)).toBe('█████');
    expect(bar(0, 10, 5)).toBe('');
    expect(bar(5, 10, 5)).toBe('██▌');
    expect(bar(1, 1000, 5)).toBe('▏');
    expect(bar(3, 0, 5)).toBe('');
  });

  test('sparkline scales to the max', async () => {
    expect(sparkline([0, 1, 2, 4, 8])).toBe(' ▁▂▄█');
    expect(sparkline([0, 0])).toBe('  ');
  });

  test('hour label, basename, duration', async () => {
    expect(hourLabel(0)).toBe('00:00');
    expect(hourLabel(23)).toBe('23:00');
    expect(basename('/a/b/c.ts')).toBe('c.ts');
    expect(basename('C:\\x\\y.js')).toBe('y.js');
    expect(duration(45)).toBe('45m');
    expect(duration(150)).toBe('2h 30m');
    expect(duration(6000)).toBe('100h');
  });

  test('plural counts', async () => {
    expect(plural(1, 'edit')).toBe('1 edit');
    expect(plural(2345, 'edit')).toBe('2,345 edits');
    expect(plural(0, 'session')).toBe('0 sessions');
  });
});
