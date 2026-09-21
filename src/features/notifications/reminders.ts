import type { SQLiteDatabase } from 'expo-sqlite';

import { parseISODate, todayISO } from '@/lib/date';

/** How far ahead reminders are scheduled; anything later is picked up on a later run. */
export const REMINDER_HORIZON_DAYS = 60;

export type ReminderKind = 'recurring' | 'receivable' | 'payable';

export interface ReminderEvent {
  /** Stable per event, so the same thing is never scheduled twice. */
  key: string;
  kind: ReminderKind;
  date: string;
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped. */
  route: string;
}

export interface PlannedReminder extends ReminderEvent {
  /** Absolute moment the notification fires. */
  at: Date;
}

/** "9:05 am" → the minutes past midnight a reminder fires at. */
export function parseReminderTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  const hour = match ? Number(match[1]) : 9;
  const minute = match ? Number(match[2]) : 0;
  return {
    hour: Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 9,
    minute: Number.isFinite(minute) && minute >= 0 && minute <= 59 ? minute : 0,
  };
}

export function formatReminderTime(time: string): string {
  const { hour, minute } = parseReminderTime(time);
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/**
 * Turns due dates into the notifications to schedule: each event fires at the chosen
 * time on its own day, and anything already past fires later today instead, so an
 * overdue bill is still surfaced once.
 */
export function planReminders(
  events: ReminderEvent[],
  { time, now = new Date() }: { time: string; now?: Date }
): PlannedReminder[] {
  const { hour, minute } = parseReminderTime(time);
  const today = todayISO();
  const overdueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  // Today's slot has passed: nudge overdue items a minute out instead of never.
  if (overdueAt <= now) overdueAt.setTime(now.getTime() + 60_000);

  const seen = new Set<string>();
  const planned: PlannedReminder[] = [];

  for (const event of events) {
    if (seen.has(event.key)) continue;
    seen.add(event.key);

    const day = parseISODate(event.date);
    const at =
      event.date <= today
        ? overdueAt
        : new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
    if (at <= now) continue;
    planned.push({ ...event, at });
  }

  return planned.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export interface ReminderPreferences {
  recurring: boolean;
  outstanding: boolean;
}

/** Everything worth a reminder in the horizon, newest due date first. */
export async function collectReminders(
  db: SQLiteDatabase,
  prefs: ReminderPreferences,
  {
    today = todayISO(),
    horizonDays = REMINDER_HORIZON_DAYS,
  }: { today?: string; horizonDays?: number } = {}
): Promise<ReminderEvent[]> {
  const horizonDate = parseISODate(today);
  horizonDate.setDate(horizonDate.getDate() + horizonDays);
  const until = `${horizonDate.getFullYear()}-${String(horizonDate.getMonth() + 1).padStart(2, '0')}-${String(
    horizonDate.getDate()
  ).padStart(2, '0')}`;

  const events: ReminderEvent[] = [];

  if (prefs.recurring) {
    // Manual rules need a nudge; automatic ones post themselves.
    const pending = await db.getAllAsync<{
      id: string;
      dueDate: string;
      name: string;
      kind: string;
    }>(
      `SELECT o.id, o.due_date AS dueDate, r.name, r.kind
       FROM recurring_occurrences o
       JOIN recurring_rules r ON r.id = o.rule_id
       WHERE o.status = 'pending' AND o.due_date <= ?
       ORDER BY o.due_date`,
      [until]
    );
    for (const row of pending) {
      events.push({
        key: `recurring-occurrence-${row.id}`,
        kind: 'recurring',
        date: row.dueDate,
        title: row.kind === 'income' ? 'Money to collect' : 'Payment to make',
        body: `${row.name} is waiting to be marked ${row.kind === 'income' ? 'received' : 'paid'}.`,
        route: '/recurring',
      });
    }

    const upcoming = await db.getAllAsync<{
      id: string;
      nextDate: string;
      name: string;
      mode: string;
    }>(
      `SELECT id, next_date AS nextDate, name, mode FROM recurring_rules
       WHERE is_active = 1 AND mode = 'manual' AND next_date > ? AND next_date <= ?
       ORDER BY next_date`,
      [today, until]
    );
    for (const row of upcoming) {
      events.push({
        key: `recurring-rule-${row.id}-${row.nextDate}`,
        kind: 'recurring',
        date: row.nextDate,
        title: 'Recurring due',
        body: `${row.name} falls due today.`,
        route: '/recurring',
      });
    }
  }

  if (prefs.outstanding) {
    const installments = await db.getAllAsync<{
      id: string;
      dueDate: string;
      title: string;
      direction: string;
      contactName: string;
      sequence: number;
    }>(
      `SELECT i.id, i.due_date AS dueDate, i.sequence, b.title, b.direction, c.name AS contactName
       FROM obligation_installments i
       JOIN obligations b ON b.id = i.obligation_id
       JOIN contacts c ON c.id = b.contact_id
       LEFT JOIN transactions t ON t.installment_id = i.id
       WHERE t.id IS NULL AND i.due_date <= ?
       ORDER BY i.due_date`,
      [until]
    );
    for (const row of installments) {
      const receivable = row.direction === 'receivable';
      events.push({
        key: `installment-${row.id}`,
        kind: receivable ? 'receivable' : 'payable',
        date: row.dueDate,
        title: receivable ? 'Installment to collect' : 'Installment to pay',
        body: `${row.title} · installment ${row.sequence} with ${row.contactName}.`,
        route: '/outstanding',
      });
    }

    const obligations = await db.getAllAsync<{
      id: string;
      dueDate: string;
      title: string;
      direction: string;
      contactName: string;
    }>(
      `SELECT b.id, b.due_date AS dueDate, b.title, b.direction, c.name AS contactName
       FROM obligations b
       JOIN contacts c ON c.id = b.contact_id
       WHERE b.due_date IS NOT NULL AND b.due_date <= ?
         AND COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.obligation_id = b.id), 0)
             < b.amount
         AND NOT EXISTS (SELECT 1 FROM obligation_installments i WHERE i.obligation_id = b.id)
       ORDER BY b.due_date`,
      [until]
    );
    for (const row of obligations) {
      const receivable = row.direction === 'receivable';
      events.push({
        key: `obligation-${row.id}`,
        kind: receivable ? 'receivable' : 'payable',
        date: row.dueDate,
        title: receivable ? 'Money to collect' : 'Payment due',
        body: receivable
          ? `${row.contactName} owes you for ${row.title}.`
          : `${row.title} is due to ${row.contactName}.`,
        route: '/outstanding',
      });
    }
  }

  return events;
}
