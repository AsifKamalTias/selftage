import type { SQLiteDatabase } from 'expo-sqlite';

import { DomainError, toFriendlyError } from '@/db/client';
import {
  deleteAttachmentFiles,
  MAX_ATTACHMENT_BYTES,
  persistAttachment,
} from '@/features/attachments/storage';
import { formatFileSize, type PickedFile } from '@/features/attachments/types';
import { newId } from '@/lib/id';

import {
  insertTransaction,
  modifyTransaction,
  removeTransaction,
  transactionInputSchema,
  type NewAttachment,
  type TransactionInput,
} from './repository';

/** Validates input and falls back to the type name when no title was entered. */
async function normalize(db: SQLiteDatabase, input: TransactionInput): Promise<TransactionInput> {
  const result = transactionInputSchema.safeParse(input);
  if (!result.success) throw new DomainError(result.error.issues[0]?.message ?? 'Invalid input');
  const data = result.data;
  if (!data.title) {
    const category = await db.getFirstAsync<{ name: string }>(
      'SELECT name FROM categories WHERE id = ?',
      [data.categoryId]
    );
    data.title = category?.name ?? (data.kind === 'income' ? 'Income' : 'Expense');
  }
  return { ...data, note: data.note || null };
}

async function persistAll(files: PickedFile[], transactionId: string): Promise<NewAttachment[]> {
  for (const file of files) {
    if (file.size != null && file.size > MAX_ATTACHMENT_BYTES) {
      throw new DomainError(
        `"${file.name}" is larger than ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`
      );
    }
  }
  const saved: NewAttachment[] = [];
  try {
    for (const file of files) saved.push(await persistAttachment(file, transactionId));
  } catch (error) {
    deleteAttachmentFiles(saved.map((s) => s.uri));
    throw error;
  }
  return saved;
}

export async function createTransaction(
  db: SQLiteDatabase,
  input: TransactionInput,
  files: PickedFile[]
): Promise<string> {
  const id = newId();
  let saved: NewAttachment[] = [];
  try {
    const data = await normalize(db, input);
    saved = await persistAll(files, id);
    await insertTransaction(db, id, data, saved);
    return id;
  } catch (error) {
    deleteAttachmentFiles(saved.map((s) => s.uri));
    throw toFriendlyError(error);
  }
}

export async function updateTransaction(
  db: SQLiteDatabase,
  id: string,
  input: TransactionInput,
  changes: { added: PickedFile[]; removedIds: string[] }
): Promise<void> {
  let saved: NewAttachment[] = [];
  try {
    const data = await normalize(db, input);
    saved = await persistAll(changes.added, id);
    const removed = await modifyTransaction(db, id, data, {
      added: saved,
      removedIds: changes.removedIds,
    });
    deleteAttachmentFiles(removed.map((a) => a.uri));
  } catch (error) {
    deleteAttachmentFiles(saved.map((s) => s.uri));
    throw toFriendlyError(error);
  }
}

export async function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  try {
    const removed = await removeTransaction(db, id);
    deleteAttachmentFiles(removed.map((a) => a.uri));
  } catch (error) {
    throw toFriendlyError(error);
  }
}
