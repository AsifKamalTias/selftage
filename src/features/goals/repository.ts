import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { assertUniqueName, DomainError, runInTransaction } from '@/db/client';
import type { AccountAvailability, Goal, GoalContribution } from '@/db/types';
import { writeTransaction } from '@/features/transactions/repository';
import { isISODate, nowTimestamp, todayISO } from '@/lib/date';
import { newId } from '@/lib/id';

export const goalInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Keep the name under 60 characters'),
  targetAmount: z.number().int().positive('Enter a target greater than zero'),
  targetDate: z.string().refine(isISODate, 'Choose a valid target date').nullable(),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').nullable(),
  icon: z.string().min(1, 'Choose an icon'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Choose a color'),
});

export type GoalInput = z.infer<typeof goalInputSchema>;

/** Reserved money only counts while a goal is active; completing it spends the reserve. */
const SAVED_SUM = `
  COALESCE((SELECT SUM(c.amount) FROM goal_contributions c WHERE c.goal_id = g.id), 0)`;

const SELECT_COLUMNS = `
  g.id, g.name, g.target_amount AS targetAmount, g.target_date AS targetDate, g.note,
  g.icon, g.color, g.status, g.completed_at AS completedAt,
  g.created_at AS createdAt, g.updated_at AS updatedAt,
  ${SAVED_SUM} AS saved,
  (SELECT COUNT(*) FROM goal_contributions c WHERE c.goal_id = g.id) AS contributionCount`;

export async function listGoals(
  db: SQLiteDatabase,
  { includeCompleted = true }: { includeCompleted?: boolean } = {}
): Promise<Goal[]> {
  return db.getAllAsync<Goal>(
    `SELECT ${SELECT_COLUMNS}
     FROM goals g
     ${includeCompleted ? '' : "WHERE g.status = 'active'"}
     ORDER BY g.status, g.target_date IS NULL, g.target_date, g.created_at`
  );
}

export async function getGoal(db: SQLiteDatabase, id: string): Promise<Goal | null> {
  return db.getFirstAsync<Goal>(`SELECT ${SELECT_COLUMNS} FROM goals g WHERE g.id = ?`, [id]);
}

export async function listGoalContributions(
  db: SQLiteDatabase,
  goalId: string
): Promise<GoalContribution[]> {
  return db.getAllAsync<GoalContribution>(
    `SELECT c.id, c.goal_id AS goalId, c.account_id AS accountId, a.name AS accountName,
       a.icon AS accountIcon, a.color AS accountColor, c.amount, c.date, c.note,
       c.created_at AS createdAt
     FROM goal_contributions c
     JOIN accounts a ON a.id = c.account_id
     WHERE c.goal_id = ?
     ORDER BY c.date DESC, c.created_at DESC`,
    [goalId]
  );
}

/** Balance minus what active goals hold, per account. */
export async function getAccountAvailability(
  db: SQLiteDatabase,
  accountId: string
): Promise<AccountAvailability> {
  const row = await db.getFirstAsync<AccountAvailability>(
    `SELECT a.id AS accountId,
       COALESCE((
         SELECT SUM(c.amount) FROM goal_contributions c
         JOIN goals g ON g.id = c.goal_id
         WHERE c.account_id = a.id AND g.status = 'active'
       ), 0) AS reserved,
       COALESCE((SELECT SUM(l.debit - l.credit) FROM ledger_entries l WHERE l.account_id = a.id), 0)
         - COALESCE((
             SELECT SUM(c.amount) FROM goal_contributions c
             JOIN goals g ON g.id = c.goal_id
             WHERE c.account_id = a.id AND g.status = 'active'
           ), 0) AS available
     FROM accounts a WHERE a.id = ?`,
    [accountId]
  );
  if (!row) throw new DomainError('The selected account no longer exists.');
  return row;
}

export async function createGoal(db: SQLiteDatabase, input: GoalInput): Promise<string> {
  const data = goalInputSchema.parse(input);
  await assertUniqueName(db, 'goals', data.name);
  const id = newId();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO goals (id, name, target_amount, target_date, note, icon, color, status,
       completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`,
    [id, data.name, data.targetAmount, data.targetDate, data.note, data.icon, data.color, now, now]
  );
  return id;
}

export async function updateGoal(db: SQLiteDatabase, id: string, input: GoalInput): Promise<void> {
  const data = goalInputSchema.parse(input);
  const existing = await getGoal(db, id);
  if (!existing) throw new DomainError('This goal no longer exists.');
  if (existing.status === 'completed') {
    throw new DomainError('Completed goals cannot be edited.');
  }
  await assertUniqueName(db, 'goals', data.name, { excludeId: id });
  await db.runAsync(
    `UPDATE goals SET name = ?, target_amount = ?, target_date = ?, note = ?, icon = ?,
       color = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.name,
      data.targetAmount,
      data.targetDate,
      data.note,
      data.icon,
      data.color,
      nowTimestamp(),
      id,
    ]
  );
}

/** Deleting releases whatever is still held; posted spends keep their history. */
export async function deleteGoal(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}

export interface ContributionInput {
  goalId: string;
  accountId: string;
  /** Always positive; `release` decides the direction. */
  amount: number;
  date: string;
  note: string | null;
}

/** Holds money from an account for the goal. */
export async function reserveForGoal(db: SQLiteDatabase, input: ContributionInput): Promise<void> {
  const goal = await getGoal(db, input.goalId);
  if (!goal) throw new DomainError('This goal no longer exists.');
  if (goal.status === 'completed') throw new DomainError('This goal is already completed.');
  if (input.amount <= 0) throw new DomainError('Enter an amount greater than zero.');

  const { available } = await getAccountAvailability(db, input.accountId);
  if (input.amount > available) {
    throw new DomainError('That is more than the account has available.');
  }
  await insertContribution(db, input, input.amount);
}

/** Breaks part or all of the reserve, returning it to the account. */
export async function releaseFromGoal(db: SQLiteDatabase, input: ContributionInput): Promise<void> {
  const goal = await getGoal(db, input.goalId);
  if (!goal) throw new DomainError('This goal no longer exists.');
  if (goal.status === 'completed') throw new DomainError('This goal is already completed.');
  if (input.amount <= 0) throw new DomainError('Enter an amount greater than zero.');

  const held = await heldByAccount(db, input.goalId);
  const fromAccount = held.get(input.accountId) ?? 0;
  if (input.amount > fromAccount) {
    throw new DomainError('This goal is not holding that much from the account.');
  }
  await insertContribution(db, input, -input.amount);
}

async function insertContribution(
  db: SQLiteDatabase,
  input: ContributionInput,
  signedAmount: number
): Promise<void> {
  if (!isISODate(input.date)) throw new DomainError('Choose a valid date.');
  await db.runAsync(
    `INSERT INTO goal_contributions (id, goal_id, account_id, amount, date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), input.goalId, input.accountId, signedAmount, input.date, input.note, nowTimestamp()]
  );
}

/** Net amount the goal holds from each account. */
export async function heldByAccount(
  db: SQLiteDatabase,
  goalId: string
): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ accountId: string; held: number }>(
    `SELECT account_id AS accountId, SUM(amount) AS held
     FROM goal_contributions WHERE goal_id = ?
     GROUP BY account_id HAVING SUM(amount) != 0`,
    [goalId]
  );
  return new Map(rows.map((row) => [row.accountId, row.held]));
}

export interface CompleteGoalInput {
  goalId: string;
  /** Expense type the spend is recorded under. */
  categoryId: string;
  sourceId: string | null;
  date: string;
}

export interface CompleteGoalResult {
  /** One spend per account that was holding money. */
  spends: { accountId: string; amount: number }[];
  total: number;
}

/**
 * Marks the goal done and spends what it holds: one expense per contributing account, so
 * each ledger stays accurate. Release money first if the real purchase costs less.
 */
export async function completeGoal(
  db: SQLiteDatabase,
  { goalId, categoryId, sourceId, date }: CompleteGoalInput
): Promise<CompleteGoalResult> {
  const goal = await getGoal(db, goalId);
  if (!goal) throw new DomainError('This goal no longer exists.');
  if (goal.status === 'completed') throw new DomainError('This goal is already completed.');
  if (goal.saved <= 0) throw new DomainError('Reserve money for this goal first.');
  if (goal.saved < goal.targetAmount) {
    throw new DomainError('Reserve the full target before completing this goal.');
  }
  if (!isISODate(date)) throw new DomainError('Choose a valid date.');

  const held = await heldByAccount(db, goalId);
  const spends = [...held.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([accountId, amount]) => ({ accountId, amount }));
  if (spends.length === 0) throw new DomainError('Reserve money for this goal first.');

  const now = nowTimestamp();
  await runInTransaction(db, async (tx) => {
    for (const spend of spends) {
      await writeTransaction(
        tx,
        newId(),
        {
          kind: 'expense',
          amount: spend.amount,
          categoryId,
          sourceId,
          accountId: spend.accountId,
          title: goal.name,
          note: `Goal completed: ${goal.name}`,
          date,
          groupId: null,
        },
        [],
        { goalId }
      );
    }
    await tx.runAsync(
      "UPDATE goals SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
      [now, now, goalId]
    );
  });

  return { spends, total: spends.reduce((sum, spend) => sum + spend.amount, 0) };
}

export async function goalsSummary(
  db: SQLiteDatabase,
  today = todayISO()
): Promise<{ active: number; reserved: number; dueSoon: number }> {
  const row = await db.getFirstAsync<{ active: number; reserved: number; dueSoon: number }>(
    `SELECT
       COUNT(*) AS active,
       COALESCE(SUM((SELECT SUM(c.amount) FROM goal_contributions c WHERE c.goal_id = g.id)), 0) AS reserved,
       COALESCE(SUM(CASE WHEN g.target_date IS NOT NULL AND g.target_date <= date(?, '+7 day')
         THEN 1 ELSE 0 END), 0) AS dueSoon
     FROM goals g WHERE g.status = 'active'`,
    [today]
  );
  return row ?? { active: 0, reserved: 0, dueSoon: 0 };
}
