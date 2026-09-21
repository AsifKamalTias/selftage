import { describe, expect, it } from '@jest/globals';

import { planInstallments } from '../repository';

const plan = (amount: number, count: number, frequency: 'weekly' | 'fortnightly' | 'monthly') =>
  planInstallments(amount, { count, frequency, startDate: '2026-01-31' });

describe('planInstallments', () => {
  it('splits evenly when it divides', () => {
    const parts = plan(30000, 3, 'monthly');
    expect(parts.map((p) => p.amount)).toEqual([10000, 10000, 10000]);
  });

  it('gives the remainder to the last installment', () => {
    const parts = plan(10000, 3, 'monthly');
    expect(parts.map((p) => p.amount)).toEqual([3333, 3333, 3334]);
  });

  it('always adds back up to the whole amount', () => {
    for (const amount of [1, 7, 999, 100001]) {
      for (const count of [1, 2, 3, 7, 12]) {
        const total = plan(amount, count, 'monthly').reduce((sum, p) => sum + p.amount, 0);
        expect(total).toBe(amount);
      }
    }
  });

  it('clamps the anchor day on shorter months', () => {
    const parts = plan(30000, 3, 'monthly');
    expect(parts.map((p) => p.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('steps by 7 and 14 days', () => {
    expect(plan(300, 3, 'weekly').map((p) => p.dueDate)).toEqual([
      '2026-01-31',
      '2026-02-07',
      '2026-02-14',
    ]);
    expect(plan(300, 3, 'fortnightly').map((p) => p.dueDate)).toEqual([
      '2026-01-31',
      '2026-02-14',
      '2026-02-28',
    ]);
  });

  it('numbers installments from one', () => {
    expect(plan(500, 5, 'weekly').map((p) => p.sequence)).toEqual([1, 2, 3, 4, 5]);
  });
});
