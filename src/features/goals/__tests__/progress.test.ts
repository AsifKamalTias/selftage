import { describe, expect, it } from '@jest/globals';

import { describeDeadline, goalProgress, type GoalProgressInput } from '../progress';

const TODAY = '2026-09-21';

const goal = (overrides: Partial<GoalProgressInput> = {}): GoalProgressInput => ({
  targetAmount: 100_000,
  targetDate: '2026-12-20',
  saved: 0,
  status: 'active',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...overrides,
});

describe('goalProgress', () => {
  it('reports share, percentage and what is left', () => {
    const p = goalProgress(goal({ saved: 25_000 }), TODAY);
    expect(p.ratio).toBeCloseTo(0.25);
    expect(p.percent).toBe(25);
    expect(p.remaining).toBe(75_000);
    expect(p.reached).toBe(false);
  });

  it('counts the deadline inclusively', () => {
    expect(goalProgress(goal(), TODAY).daysLeft).toBe(91);
    expect(goalProgress(goal({ targetDate: TODAY }), TODAY).daysLeft).toBe(1);
    expect(goalProgress(goal({ targetDate: '2026-09-18' }), TODAY).daysLeft).toBe(-2);
  });

  it('spreads what is left over the days that remain', () => {
    const p = goalProgress(goal({ saved: 28_000, targetDate: '2026-09-30' }), TODAY);
    // 72,000 left over 10 days.
    expect(p.perDay).toBe(7_200);
    expect(p.perWeek).toBe(50_400);
    expect(p.perMonth).toBe(72_000);
  });

  it('asks for nothing once the target is reached', () => {
    const p = goalProgress(goal({ saved: 120_000 }), TODAY);
    expect(p.reached).toBe(true);
    expect(p.percent).toBe(120);
    expect(p.remaining).toBe(0);
    expect(p.perDay).toBe(0);
    expect(p.pace).toBe('reached');
  });

  it('classifies the pace against an even schedule', () => {
    // 20 of 110 days elapsed ≈ 18% expected.
    expect(goalProgress(goal({ saved: 30_000 }), TODAY).pace).toBe('on-track');
    expect(goalProgress(goal({ saved: 1_000 }), TODAY).pace).toBe('behind');
    expect(goalProgress(goal({ targetDate: TODAY, saved: 10 }), TODAY).pace).toBe('due-today');
    expect(goalProgress(goal({ targetDate: '2026-09-01', saved: 10 }), TODAY).pace).toBe('overdue');
    expect(goalProgress(goal({ targetDate: null, saved: 10 }), TODAY).pace).toBe('no-deadline');
  });

  it('has no expected pace without a deadline', () => {
    const p = goalProgress(goal({ targetDate: null, saved: 10_000 }), TODAY);
    expect(p.expectedRatio).toBeNull();
    expect(p.daysLeft).toBeNull();
    expect(p.perDay).toBe(0);
  });

  it('treats a deadline on the creation day as fully elapsed', () => {
    const p = goalProgress(
      goal({ createdAt: '2026-09-21T08:00:00.000Z', targetDate: '2026-09-21', saved: 10 }),
      TODAY
    );
    expect(p.expectedRatio).toBe(1);
  });
});

describe('describeDeadline', () => {
  it('phrases the time left', () => {
    expect(describeDeadline(goalProgress(goal({ targetDate: '2026-09-22' }), TODAY))).toBe(
      '2 days left'
    );
    expect(describeDeadline(goalProgress(goal({ targetDate: TODAY }), TODAY))).toBe('Due today');
    expect(describeDeadline(goalProgress(goal({ targetDate: '2026-09-20' }), TODAY))).toBe(
      '1 day past due'
    );
    expect(describeDeadline(goalProgress(goal({ targetDate: null }), TODAY))).toBe('No deadline');
  });
});
