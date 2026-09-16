import { describe, expect, it } from '@jest/globals';

import { labelStep, niceMax, roundedTopBar, ticks } from '../scale';

describe('niceMax', () => {
  it.each([
    [0, 1],
    [-10, 1],
    [7, 10],
    [120, 200],
    [2400, 2500],
    [97_500_00, 1_000_000_0],
  ])('rounds %p up to %p', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe('ticks', () => {
  it('splits the axis evenly', () => {
    expect(ticks(100)).toEqual([0, 25, 50, 75, 100]);
  });
});

describe('labelStep', () => {
  it('limits the number of visible labels', () => {
    expect(labelStep(5, 8)).toBe(1);
    expect(labelStep(31, 8)).toBe(4);
  });
});

describe('roundedTopBar', () => {
  it('returns an empty path for zero-height bars', () => {
    expect(roundedTopBar(0, 0, 10, 0, 4)).toBe('');
  });

  it('clamps the corner radius to the bar size', () => {
    expect(roundedTopBar(0, 0, 4, 10, 8)).toContain('Q0,0 2,0');
  });
});
