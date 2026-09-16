import { describe, expect, it } from '@jest/globals';

import { bucketize, cumulative, pickGranularity } from '../buckets';

describe('pickGranularity', () => {
  it('scales with the range length', () => {
    expect(pickGranularity({ from: '2026-09-14', to: '2026-09-20' })).toBe('day');
    expect(pickGranularity({ from: '2026-09-01', to: '2026-09-30' })).toBe('week');
    expect(pickGranularity({ from: '2026-01-01', to: '2026-12-31' })).toBe('month');
    expect(pickGranularity({ from: '2022-01-01', to: '2026-12-31' })).toBe('year');
  });
});

describe('bucketize', () => {
  const daily = [
    { date: '2026-01-05', income: 1000, expense: 200 },
    { date: '2026-01-20', income: 0, expense: 300 },
    { date: '2026-03-02', income: 500, expense: 0 },
  ];

  it('creates zero-filled monthly buckets and sums days into them', () => {
    const buckets = bucketize(daily, { from: '2026-01-01', to: '2026-04-30' }, 'month');
    expect(buckets.map((b) => b.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr']);
    expect(buckets.map((b) => [b.income, b.expense])).toEqual([
      [1000, 500],
      [0, 0],
      [500, 0],
      [0, 0],
    ]);
    expect(buckets[3].to).toBe('2026-04-30');
  });

  it('aligns weekly buckets to Mondays and clamps to the range', () => {
    const buckets = bucketize(
      [{ date: '2026-09-02', income: 10, expense: 0 }],
      { from: '2026-09-01', to: '2026-09-30' },
      'week'
    );
    expect(buckets[0]).toMatchObject({ from: '2026-09-01', to: '2026-09-06', income: 10 });
    expect(buckets[1]).toMatchObject({ from: '2026-09-07', to: '2026-09-13' });
    expect(buckets[buckets.length - 1].to).toBe('2026-09-30');
  });

  it('uses weekday labels for short daily ranges', () => {
    const buckets = bucketize([], { from: '2026-09-14', to: '2026-09-16' }, 'day');
    expect(buckets.map((b) => b.label)).toEqual(['Mon', 'Tue', 'Wed']);
  });
});

describe('cumulative', () => {
  it('produces running totals', () => {
    const points = cumulative([
      { key: 'a', label: 'A', from: '', to: '', income: 5, expense: 1 },
      { key: 'b', label: 'B', from: '', to: '', income: 0, expense: 2 },
    ]);
    expect(points).toEqual([
      { label: 'A', income: 5, expense: 1 },
      { label: 'B', income: 5, expense: 3 },
    ]);
  });
});
