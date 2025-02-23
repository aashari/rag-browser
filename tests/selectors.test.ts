import { test, expect } from 'bun:test';
import { getMeaningfulClasses } from '../src/utils/selectors';
import { UTILITY_CLASS_PATTERNS, MAX_CLASS_LENGTH } from '../src/config/constants';

// Helper function to create a minimal mock of what we need from DOMTokenList
function createMockClassList(classes: string[]): DOMTokenList {
  const tokens = [...classes];
  const mock = {
    [Symbol.iterator]: () => tokens[Symbol.iterator](),
    length: tokens.length,
    item: (index: number) => tokens[index] || null,
    contains: (token: string) => tokens.includes(token),
    toString: () => tokens.join(' '),
    entries: () => tokens.entries(),
    forEach: (callback: (value: string, key: number, parent: DOMTokenList) => void) => {
      tokens.forEach((value, key) => callback(value, key, mock));
    },
    keys: () => tokens.keys(),
    values: () => tokens.values(),
    add: (...tokensToAdd: string[]) => {
      tokensToAdd.forEach(token => {
        if (!tokens.includes(token)) {
          tokens.push(token);
        }
      });
    },
    remove: (...tokensToRemove: string[]) => {
      tokensToRemove.forEach(token => {
        const index = tokens.indexOf(token);
        if (index !== -1) {
          tokens.splice(index, 1);
        }
      });
    },
    toggle: (token: string, force?: boolean) => {
      const hasToken = tokens.includes(token);
      if (force === true || (force === undefined && !hasToken)) {
        if (!hasToken) tokens.push(token);
        return true;
      }
      if (hasToken) {
        tokens.splice(tokens.indexOf(token), 1);
      }
      return false;
    },
    replace: (oldToken: string, newToken: string) => {
      const index = tokens.indexOf(oldToken);
      if (index !== -1) {
        tokens[index] = newToken;
        return true;
      }
      return false;
    },
    supports: () => true,
    value: tokens.join(' ')
  } as unknown as DOMTokenList;
  return mock;
}

test('getMeaningfulClasses filters utility classes', () => {
  const classList = createMockClassList([
    'flex-row',
    'text-lg',
    'custom-class',
    'very-very-very-long-class-name',
    'hover:bg-blue',
    'p-4',
    'm-2',
    'meaningful-class'
  ]);

  const result = getMeaningfulClasses(classList);
  expect(result.sort()).toEqual(['custom-class', 'meaningful-class'].sort());
});

test('getMeaningfulClasses handles empty list', () => {
  const classList = createMockClassList([]);
  const result = getMeaningfulClasses(classList);
  expect(result).toEqual([]);
});

test('getMeaningfulClasses filters by length', () => {
  const classList = createMockClassList([
    'short',
    'a'.repeat(MAX_CLASS_LENGTH + 1),
    'medium-length'
  ]);
  const result = getMeaningfulClasses(classList);
  expect(result.sort()).toEqual(['short', 'medium-length'].sort());
});

test('getMeaningfulClasses filters special characters', () => {
  const classList = createMockClassList([
    'normal',
    'with:colon',
    'with/slash',
    'with[bracket]',
    'with@at',
    'valid-class'
  ]);
  const result = getMeaningfulClasses(classList);
  expect(result.sort()).toEqual(['normal', 'valid-class'].sort());
}); 