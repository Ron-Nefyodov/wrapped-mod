import { drawWrappedPane } from './card.js';
import { exportFileName, HELP_TEXT, isResetArmed, joinPath, normalizeRange, parseArgs, RANGE_KEY, RESET_KEY } from './commands.js';
import {
  editedPathOf, normalizeStats, recordPrompt, recordSessionMinutes, recordSessionStart, recordTool, recordTurn,
  SESSION_KEY, STATS_KEY, summarize,
} from './stats.js';
import { enqueue, updateStats } from './stats-store.js';
import { buildSvg } from './svg.js';

const WRAPPED_PANE_ID = 'wrapped';
const WRAPPED_COMMAND = {
  name: 'wrapped',
  description: 'Your Claude Code year in one card',
  argumentHint: '[month|all|export|reset]',
};

export function register(on) {
  on('session.start', async ($, e, next) => {
    const result = await next(e);
    try {
      await $.command.register(WRAPPED_COMMAND);
      const now = await $.clock.now();
      await $.store.set(SESSION_KEY, now);
      await updateStats({ get: (k) => $.store.get(k), set: (k, v) => $.store.set(k, v) }, (s) => recordSessionStart(s, now));
    } catch {
      // Stats are best effort; never block a session.
    }
    return result;
  }).catch(($, e, next) => next(e));

  on('session.end', async ($, e, next) => {
    const result = await next(e);
    try {
      const startedAt = await $.store.get(SESSION_KEY);
      if (typeof startedAt === 'number') {
        const now = await $.clock.now();
        await updateStats({ get: (k) => $.store.get(k), set: (k, v) => $.store.set(k, v) }, (s) => recordSessionMinutes(s, startedAt, now));
        await $.store.delete(SESSION_KEY);
      }
    } catch {
      // best effort
    }
    return result;
  }).catch(($, e, next) => next(e));

  on('prompt.submit', async ($, e, next) => {
    const result = await next(e);
    if (e.origin.kind === 'composer') {
      try {
        if (!result?.drop) {
          const now = await $.clock.now();
          await updateStats({ get: (k) => $.store.get(k), set: (k, v) => $.store.set(k, v) }, (s) => recordPrompt(s, now));
        }
      } catch {
        // best effort
      }    }
    return result;
  }).catch(($, e, next) => next(e));

  on('turn.complete', async ($, e, next) => {
    const result = await next(e);
    try {
      const now = await $.clock.now();
      await updateStats({ get: (k) => $.store.get(k), set: (k, v) => $.store.set(k, v) }, (s) => recordTurn(s, now, e.usage, e.agentId === undefined));
    } catch {
      // best effort
    }    return result;
  }).catch(($, e, next) => next(e));

  on('tool.call', async ($, e, next) => {
    const result = await next(e);
    try {
      if (!result?.deny) {
        const now = await $.clock.now();
        const path = result?.isError ? undefined : editedPathOf(e);
        await updateStats({ get: (k) => $.store.get(k), set: (k, v) => $.store.set(k, v) }, (s) => recordTool(s, now, e.tool, path));
      }
    } catch {
      // best effort
    }
    return result;
  }).catch(($, e, next) => next(e));

  on('command.run', { command: 'wrapped' }, async ($, e, next) => {
    const { action, range } = parseArgs(e.args);
    const now = await $.clock.now();

    if (action === 'help') return { text: HELP_TEXT };

    if (action === 'reset') {
      await $.store.set(RESET_KEY, now);
      return { text: 'This deletes all Wrapped stats. To confirm, run /wrapped reset confirm within 60 seconds.' };
    }

    if (action === 'reset-confirm') {
      if (!isResetArmed(await $.store.get(RESET_KEY), now)) {
        return { text: 'Nothing to confirm. Run /wrapped reset first.' };
      }
      await enqueue(() => $.store.delete(STATS_KEY));
      await $.store.delete(RESET_KEY);
      return { text: 'Wrapped stats cleared.' };
    }

    const summary = summarize(normalizeStats(await $.store.get(STATS_KEY)), range, now);

    if (action === 'export') {
      const path = joinPath(await $.session.cwd(), exportFileName(range, now));
      try {
        await $.fs.write(path, buildSvg(summary, now));
      } catch (error) {
        return { text: `Could not save the Wrapped card to ${path}: ${error?.message ?? error}`, exitCode: 1 };
      }
      return { text: `Wrapped card saved: ${path}` };
    }

    await $.store.set(RANGE_KEY, range);
    const opened = await $.ui.open({ id: WRAPPED_PANE_ID, title: `Wrapped · ${summary.label}`, focus: true, closeOnEscape: true, rows: 28 });
    $.ui.invalidate('ui.render');
    if (opened && opened.isPlaced === false) return { text: 'Wrapped needs more room. Make the terminal bigger and run /wrapped again.' };
    return {};
  }).catch(() => ({ text: 'Wrapped hit an error. Try again.', exitCode: 1 }));

  on('ui.render', { component: 'Pane', requestId: 'wrapped' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e);
    try {
      const range = normalizeRange(await $.store.get(RANGE_KEY));
      const stats = normalizeStats(await $.store.get(STATS_KEY));
      const summary = summarize(stats, range, await $.clock.now());
      return drawWrappedPane(await $.ui.resolve(e), summary, e.props.bodyColumns);
    } catch {
      return next(e);
    }
  });
}
