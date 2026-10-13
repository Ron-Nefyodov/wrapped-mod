import { test, expect, mock, describe } from 'claude-code/testing';
import { STATS_KEY } from './stats.js';

const NOW = new Date(2026, 9, 11, 23, 15).getTime();
const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/work' };
const PANE = { title: 'Wrapped', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 30 }, view: {} };

function world(on: any, stored: Record<string, unknown> = {}, toolResult: any = { result: 'ok' }) {
  const opened: any[] = [];
  const written: any[] = [];
  const registered: any[] = [];
  const clock = mock.clock(on, { now: NOW });
  const store: Record<string, unknown> = { ...stored };
  on('store.get', ($: any, e: any) => ({ value: store[e.key] === undefined ? undefined : JSON.parse(JSON.stringify(store[e.key])) }));
  on('store.set', ($: any, e: any) => { store[e.key] = JSON.parse(JSON.stringify(e.value)); return { value: undefined }; });
  on('store.delete', ($: any, e: any) => { delete store[e.key]; return { value: undefined }; });
  on('store.keys', () => ({ value: Object.keys(store) }));
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }));
  on('session.end', ($: any, e: any) => ({ sessionId: e.sessionId }));
  on('session.cwd', () => ({ value: '/work' }));
  on('command.register', ($: any, e: any) => { registered.push(e); return { value: { command: e.name } }; });
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }));
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }));
  on('tool.call', () => toolResult);
  on('ui.open', ($: any, e: any) => { opened.push(e); return { value: { isPlaced: true } }; });
  on('ui.invalidate', () => ({ value: undefined }));
  on('ui.toast', () => ({ value: undefined }));
  on('fs.write', ($: any, e: any) => { written.push(e); return { value: undefined }; });
  return { opened, written, registered, clock, store };
}


const today = '2026-10-11';

describe('wrapped wiring', () => {
  test('session start registers /wrapped and counts a session', async ($: any, on: any) => {
    const w = world(on);
    await $.session.start(SESSION);
    expect(w.registered.map((r) => r.name)).toContain('wrapped');
    expect((w.store[STATS_KEY] as any).days[today].sessions).toBe(1);
  });

  test('session end adds minutes since start', async ($: any, on: any) => {
    const w = world(on);
    await $.session.start(SESSION);
    await w.clock.advance(30 * 60000);
    await $.session.end({ reason: 'other', sessionId: 's1', resume: {} });
    expect((w.store[STATS_KEY] as any).days[today].minutes).toBe(30);
  });

  test('only composer prompts count, by hour', async ($: any, on: any) => {
    const w = world(on);
    await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } });
    await $.prompt.submit({ text: 'bot', wait: false, origin: { kind: 'sdk' } });
    const day = (w.store[STATS_KEY] as any).days[today];
    expect(day.prompts).toBe(1);
    expect(day.hours['23']).toBe(1);
  });

  test('turns record usage', async ($: any, on: any) => {
    const w = world(on);
    await $.turn.complete({
      answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer',
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm' },
    });
    const day = (w.store[STATS_KEY] as any).days[today];
    expect(day.turns).toBe(1);
    expect(day.outputTokens).toBe(5);
  });

  test('tool calls by name and edited paths', async ($: any, on: any) => {
    const w = world(on);
    await $.tool.call({ tool: 'Edit', file_path: '/work/a.ts', old_string: 'a', new_string: 'b' });
    await $.tool.call({ tool: 'NotebookEdit', notebook_path: '/work/n.ipynb', new_source: 'x' });
    await $.tool.call({ tool: 'Bash', command: 'ls' });
    const s = w.store[STATS_KEY] as any;
    expect(s.days[today].tools).toEqual({ Edit: 1, NotebookEdit: 1, Bash: 1 });
    expect(s.files['2026-10']).toEqual({ '/work/a.ts': 1, '/work/n.ipynb': 1 });
  });

  test('/wrapped opens the pane with the chosen range', async ($: any, on: any) => {
    const w = world(on);
    await $.session.start(SESSION);
    await $.command.run({ command: 'wrapped', args: 'month', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } });
    expect(w.opened[0].id).toBe('wrapped');
    expect(w.store['wrapped-range']).toBe('month');
  });

  test('/wrapped export writes the svg to cwd and prints the path', async ($: any, on: any) => {
    const w = world(on);
    await $.session.start(SESSION);
    const out = await $.command.run({ command: 'wrapped', args: 'export', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } });
    expect(w.written[0].path).toBe('/work/claude-wrapped-2026.svg');
    expect(w.written[0].text).toContain('<svg');
    expect(out.text).toContain('/work/claude-wrapped-2026.svg');
  });

  test('/wrapped reset needs confirm', async ($: any, on: any) => {
    const w = world(on);
    await $.session.start(SESSION);
    const cmd = (args: string) => $.command.run({ command: 'wrapped', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } });
    expect((await cmd('reset confirm')).text).toContain('/wrapped reset');
    expect((w.store[STATS_KEY] as any).days[today].sessions).toBe(1);
    expect((await cmd('reset')).text).toContain('/wrapped reset confirm');
    expect((w.store[STATS_KEY] as any).days[today].sessions).toBe(1);
    expect((await cmd('reset confirm')).text).toContain('cleared');
    expect(w.store[STATS_KEY]).toBe(undefined);
  });

  test('pane draws the card for the stored range', async ($: any, on: any) => {
    const w = world(on);
    await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } });
    await $.tool.call({ tool: 'Edit', file_path: '/work/src/register.js', old_string: 'a', new_string: 'b' });
    w.store['wrapped-range'] = 'month';
    const ui = await $.ui.mount({ plugin: 'wrapped', surface: 'terminal', component: 'Pane', requestId: 'wrapped', props: PANE });
    expect((await ui.find({ key: 'wrapped-header' }))?.text).toContain('October 2026');
    expect((await ui.find({ key: 'wrapped-identity' }))?.text).toContain('Night owl');
    expect((await ui.find({ key: 'wrapped-identity' }))?.text).toContain('The Refactorer');
    expect((await ui.find({ key: 'wrapped-stat-prompts' }))?.text).toContain('1');
    expect((await ui.find({ key: 'wrapped-tools' }))?.text).toContain('Edit');
    expect((await ui.find({ key: 'wrapped-tools' }))?.text).toContain('█');
    expect((await ui.find({ key: 'wrapped-file' }))?.text).toContain('register.js');
    expect((await ui.find({ key: 'wrapped-file' }))?.text).not.toContain('/work/src');
  });

  test('empty pane shows the empty state', async ($: any, on: any) => {
    const w = world(on);
    const ui = await $.ui.mount({ plugin: 'wrapped', surface: 'terminal', component: 'Pane', requestId: 'wrapped', props: PANE });
    expect((await ui.find({ key: 'wrapped-empty' }))?.text).toContain('No activity');
  });

  test('parallel tool calls lose no counts', async ($: any, on: any) => {
    const w = world(on);
    await Promise.all(Array.from({ length: 10 }, () => $.tool.call({ tool: 'Read', file_path: '/work/x' })));
    expect((w.store[STATS_KEY] as any).days[today].tools.Read).toBe(10);
  });

  test('denied tool calls do not count', async ($: any, on: any) => {
    const w = world(on, {}, { deny: 'no' });
    await $.tool.call({ tool: 'Bash', command: 'rm -rf /' });
    expect(w.store[STATS_KEY]).toBe(undefined);
  });

  test('narrow pane stacks tiles and still draws', async ($: any, on: any) => {
    const w = world(on);
    await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } });
    const ui = await $.ui.mount({ plugin: 'wrapped', surface: 'terminal', component: 'Pane', requestId: 'wrapped', props: { ...PANE, bodyColumns: 36 } });
    expect((await ui.find({ key: 'wrapped-stat-streak' }))?.text).toContain('longest streak');
  });
});
