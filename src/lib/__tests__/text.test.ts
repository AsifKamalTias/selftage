import { describe, expect, it } from '@jest/globals';

import { countOf, pluralOf, verbFor } from '../text';

describe('pluralOf', () => {
  it('keeps the singular for one', () => {
    expect(pluralOf('entry', 1)).toBe('entry');
    expect(pluralOf('goal', 1)).toBe('goal');
  });

  it('turns a consonant + y into -ies', () => {
    expect(pluralOf('entry', 2)).toBe('entries');
    expect(pluralOf('category', 0)).toBe('categories');
  });

  it('keeps a vowel + y as -ys', () => {
    expect(pluralOf('day', 3)).toBe('days');
  });

  it('adds -es after a sibilant', () => {
    expect(pluralOf('expense', 2)).toBe('expenses');
    expect(pluralOf('box', 2)).toBe('boxes');
    expect(pluralOf('match', 2)).toBe('matches');
  });

  it('uses an explicit plural when given', () => {
    expect(pluralOf('person', 2, 'people')).toBe('people');
    expect(pluralOf('person', 1, 'people')).toBe('person');
  });
});

describe('countOf', () => {
  it('reads naturally either way', () => {
    expect(countOf(1, 'entry')).toBe('1 entry');
    expect(countOf(4, 'entry')).toBe('4 entries');
    expect(countOf(0, 'budget')).toBe('0 budgets');
  });
});

describe('verbFor', () => {
  it('agrees with the count', () => {
    expect(verbFor(1, 'needs', 'need')).toBe('needs');
    expect(verbFor(3, 'needs', 'need')).toBe('need');
  });
});
