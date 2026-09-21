import type { SQLiteDatabase } from 'expo-sqlite';

import type { EntryKind, RecurringRule } from '@/db/types';
import {
  budgetAlertsSince,
  budgetHealthSnapshot,
  type BudgetAlert,
} from '@/features/budgets/alerts';
import { insertTransaction } from '@/features/transactions/repository';
import { todayISO } from '@/lib/date';
import { newId } from '@/lib/id';

import { queueOccurrence } from './occurrences';
import { listDueRules, markRecurringRun, setRecurringActive } from './repository';
import { nextOccurrenceAfter, occurrencesThrough } from './schedule';

/** Ceiling per rule per run, so a long-dormant daily rule cannot flood the ledger. */
export const MAX_CATCHUP_PER_RULE = 60;

export interface RecurringPosting {
  ruleId: string;
  name: string;
  kind: EntryKind;
  amount: number;
  date: string;
}

export interface RecurringRunResult {
  created: RecurringPosting[];
  /** Manual occurrences queued for the user to mark paid. */
  queued: RecurringPosting[];
  /** Rules paused because they could no longer post (e.g. the account was archived). */
  paused: { id: string; name: string; reason: string }[];
  budgetAlerts: BudgetAlert[];
}

const EMPTY: RecurringRunResult = { created: [], queued: [], paused: [], budgetAlerts: [] };

async function postOccurrences(
  db: SQLiteDatabase,
  rule: RecurringRule,
  dates: string[]
): Promise<RecurringPosting[]> {
  const posted: RecurringPosting[] = [];
  for (const date of dates) {
    await insertTransaction(
      db,
      newId(),
      {
        kind: rule.kind,
        amount: rule.amount,
        categoryId: rule.categoryId,
        sourceId: rule.sourceId,
        accountId: rule.accountId,
        title: rule.name,
        note: rule.note,
        date,
        groupId: rule.groupId,
      },
      [],
      { recurringId: rule.id }
    );
    posted.push({
      ruleId: rule.id,
      name: rule.name,
      kind: rule.kind,
      amount: rule.amount,
      date,
    });
  }
  return posted;
}

/** Manual rules do not touch any account: each due date waits in the pending list. */
async function queueOccurrences(
  db: SQLiteDatabase,
  rule: RecurringRule,
  dates: string[]
): Promise<RecurringPosting[]> {
  const queued: RecurringPosting[] = [];
  for (const date of dates) {
    await queueOccurrence(db, rule.id, date);
    queued.push({ ruleId: rule.id, name: rule.name, kind: rule.kind, amount: rule.amount, date });
  }
  return queued;
}

/**
 * Handles every occurrence due on or before `today`, including ones missed while the app
 * was closed: automatic rules post them, manual rules queue them for confirmation. Safe to
 * call repeatedly — a rule only advances past dates it has actually handled.
 */
export async function runDueRecurring(
  db: SQLiteDatabase,
  {
    today = todayISO(),
    maxPerRule = MAX_CATCHUP_PER_RULE,
  }: { today?: string; maxPerRule?: number } = {}
): Promise<RecurringRunResult> {
  const due = await listDueRules(db, today);
  if (due.length === 0) return EMPTY;

  const budgetsBefore = await budgetHealthSnapshot(db);
  const created: RecurringPosting[] = [];
  const queued: RecurringPosting[] = [];
  const paused: RecurringRunResult['paused'] = [];

  for (const rule of due) {
    const dates = occurrencesThrough(rule, rule.nextDate, today, maxPerRule);
    if (dates.length === 0) continue;
    try {
      if (rule.mode === 'manual') {
        queued.push(...(await queueOccurrences(db, rule, dates)));
      } else {
        created.push(...(await postOccurrences(db, rule, dates)));
      }
      const lastDate = dates[dates.length - 1];
      await markRecurringRun(db, rule.id, lastDate, nextOccurrenceAfter(rule, lastDate));
    } catch (error) {
      // Pause rather than retry on every launch; the reason is shown on the recurring screen.
      await setRecurringActive(db, rule.id, false, today).catch(() => {});
      paused.push({
        id: rule.id,
        name: rule.name,
        reason: error instanceof Error ? error.message : 'Could not post this entry',
      });
    }
  }

  return {
    created,
    queued,
    paused,
    budgetAlerts: created.length > 0 ? await budgetAlertsSince(db, budgetsBefore) : [],
  };
}
