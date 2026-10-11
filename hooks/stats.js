import { basename } from './format.js';
import { personaOf, titleOf } from './persona.js';

export const STATS_KEY = 'wrapped-stats';
export const SESSION_KEY = 'wrapped-session-start';
export const MAX_FILES_PER_MONTH = 50;
export const MAX_TOOLS_PER_DAY = 40;
export const MAX_DAYS = 1100;
export const MAX_SESSION_MINUTES = 12 * 60;
export const EDIT_TOOLS = { Edit: 'file_path', MultiEdit: 'file_path', Write: 'file_path', NotebookEdit: 'notebook_path' };

const DAY_MS = 86400000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function emptyDay() {
  return { sessions: 0, prompts: 0, turns: 0, inputTokens: 0, outputTokens: 0, minutes: 0, tools: {}, hours: {} };
}

export function emptyStats() {
  return { v: 1, days: {}, files: {}, archive: emptyDay() };
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function normalizeStats(raw) {
  if (!isObject(raw) || raw.v !== 1 || !isObject(raw.days)) return emptyStats();
  return {
    v: 1,
    days: raw.days,
    files: isObject(raw.files) ? raw.files : {},
    archive: isObject(raw.archive) ? { ...emptyDay(), ...raw.archive } : emptyDay(),
  };
}

const two = (n) => String(n).padStart(2, '0');

export function dayKeyOf(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

export function monthKeyOf(ms) {
  return dayKeyOf(ms).slice(0, 7);
}

function addInto(target, source) {
  for (const field of ['sessions', 'prompts', 'turns', 'inputTokens', 'outputTokens', 'minutes']) {
    target[field] += source[field] ?? 0;
  }
  for (const [name, count] of Object.entries(source.tools ?? {})) target.tools[name] = (target.tools[name] ?? 0) + count;
  for (const [hour, count] of Object.entries(source.hours ?? {})) target.hours[hour] = (target.hours[hour] ?? 0) + count;
}

function prune(stats) {
  const keys = Object.keys(stats.days).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) {
    addInto(stats.archive, stats.days[key]);
    delete stats.days[key];
  }
}

function dayOf(stats, ms) {
  const key = dayKeyOf(ms);
  if (!stats.days[key]) {
    stats.days[key] = emptyDay();
    prune(stats);
  }
  return stats.days[key];
}

export function recordSessionStart(stats, ms) {
  dayOf(stats, ms).sessions += 1;
  return stats;
}

export function recordSessionMinutes(stats, startMs, endMs) {
  const minutes = Math.min(MAX_SESSION_MINUTES, Math.max(0, Math.round((endMs - startMs) / 60000)));
  if (minutes > 0) dayOf(stats, startMs).minutes += minutes;
  return stats;
}

export function recordPrompt(stats, ms) {
  const day = dayOf(stats, ms);
  const hour = String(new Date(ms).getHours());
  day.prompts += 1;
  day.hours[hour] = (day.hours[hour] ?? 0) + 1;
  return stats;
}

export function recordTurn(stats, ms, usage, isMainLoop) {
  const day = dayOf(stats, ms);
  if (isMainLoop) day.turns += 1;
  if (usage) {
    day.inputTokens += (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    day.outputTokens += usage.output_tokens ?? 0;
  }
  return stats;
}

function capFiles(files) {
  const entries = Object.entries(files);
  if (entries.length <= MAX_FILES_PER_MONTH) return files;
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, MAX_FILES_PER_MONTH));
}

export function recordTool(stats, ms, name, filePath) {
  const day = dayOf(stats, ms);
  const known = name in day.tools || Object.keys(day.tools).length < MAX_TOOLS_PER_DAY;
  const toolName = known ? name : 'Other';
  day.tools[toolName] = (day.tools[toolName] ?? 0) + 1;
  if (typeof filePath === 'string' && filePath) {
    const month = monthKeyOf(ms);
    const files = stats.files[month] ?? {};
    if (filePath in files || Object.keys(files).length < MAX_FILES_PER_MONTH) {
      files[filePath] = (files[filePath] ?? 0) + 1;
    } else {
      // Space-saving: the new path takes the least edited slot, so a hot new file can still climb.
      const [minPath, minCount] = Object.entries(files).sort((a, b) => a[1] - b[1])[0];
      delete files[minPath];
      files[filePath] = minCount + 1;
    }
    stats.files[month] = capFiles(files);
  }
  return stats;
}

export function editedPathOf(e) {
  const field = EDIT_TOOLS[e.tool];
  const value = field ? e[field] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function prefixOf(range, nowMs) {
  if (range === 'all') return '';
  return range === 'month' ? monthKeyOf(nowMs) : dayKeyOf(nowMs).slice(0, 4);
}

function labelOf(range, nowMs) {
  const date = new Date(nowMs);
  if (range === 'all') return 'All time';
  if (range === 'month') return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return String(date.getFullYear());
}

const isActive = (day) => day.sessions + day.prompts + day.turns + Object.keys(day.tools).length > 0;

const dayNumberOf = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

function streaksOf(activeKeys, nowMs) {
  const numbers = activeKeys.map(dayNumberOf).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < numbers.length; i++) {
    run = i > 0 && numbers[i] === numbers[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const today = dayNumberOf(dayKeyOf(nowMs));
  const last = numbers[numbers.length - 1];
  const current = last === today || last === today - 1 ? run : 0;
  return { longest, current };
}

export function summarize(stats, range, nowMs) {
  const prefix = prefixOf(range, nowMs);
  const total = emptyDay();
  const activeKeys = [];
  for (const [key, day] of Object.entries(stats.days)) {
    if (!key.startsWith(prefix)) continue;
    addInto(total, day);
    if (isActive(day)) activeKeys.push(key);
  }
  if (range === 'all') addInto(total, stats.archive);

  const fileCounts = {};
  for (const [month, files] of Object.entries(stats.files)) {
    if (!month.startsWith(prefix.slice(0, 7))) continue;
    for (const [path, count] of Object.entries(files)) fileCounts[path] = (fileCounts[path] ?? 0) + count;
  }
  const [topPath] = Object.entries(fileCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const tools = Object.entries(total.tools)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const hours = Array.from({ length: 24 }, (_, hour) => total.hours[String(hour)] ?? 0);
  const peak = Math.max(...hours);
  const peakHour = peak > 0 ? hours.indexOf(peak) : null;
  const streaks = streaksOf(activeKeys, nowMs);
  const toolCalls = tools.reduce((sum, tool) => sum + tool.count, 0);

  return {
    range,
    label: labelOf(range, nowMs),
    sessions: total.sessions,
    prompts: total.prompts,
    turns: total.turns,
    inputTokens: total.inputTokens,
    outputTokens: total.outputTokens,
    tokens: total.inputTokens + total.outputTokens,
    minutes: total.minutes,
    toolCalls,
    tools,
    topTools: tools.slice(0, 3),
    hours,
    peakHour,
    activeDays: activeKeys.length,
    longestStreak: streaks.longest,
    currentStreak: streaks.current,
    topFile: topPath ? { name: basename(topPath[0]), count: topPath[1] } : null,
    persona: personaOf(peakHour),
    title: titleOf(total.tools),
    isEmpty: total.sessions + total.prompts + total.turns + toolCalls === 0,
  };
}
