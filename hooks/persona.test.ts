import { test, expect, describe } from 'claude-code/testing';
import { personaOf, titleOf } from './persona.js';

describe('persona', () => {
  test('peak hour picks the persona at each boundary', async () => {
    expect(personaOf(5)).toBe('Early bird');
    expect(personaOf(10)).toBe('Early bird');
    expect(personaOf(11)).toBe('Day shift');
    expect(personaOf(16)).toBe('Day shift');
    expect(personaOf(17)).toBe('Evening coder');
    expect(personaOf(22)).toBe('Evening coder');
    expect(personaOf(23)).toBe('Night owl');
    expect(personaOf(0)).toBe('Night owl');
    expect(personaOf(4)).toBe('Night owl');
    expect(personaOf(null)).toBe('Fresh start');
  });

  test('dominant tool group picks the title', async () => {
    expect(titleOf({ Edit: 5, Bash: 4 })).toBe('The Refactorer');
    expect(titleOf({ Read: 2, Grep: 2, Glob: 2, Bash: 5 })).toBe('The Explorer');
    expect(titleOf({ Bash: 9 })).toBe('The Operator');
    expect(titleOf({ Write: 3 })).toBe('The Author');
    expect(titleOf({ Agent: 3 })).toBe('The Delegator');
    expect(titleOf({ mcp__x__y: 30, Edit: 2 })).toBe('The Generalist');
    expect(titleOf({})).toBe('The Generalist');
  });
});
