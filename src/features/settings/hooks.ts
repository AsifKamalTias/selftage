import { useDbMutation } from '@/db/hooks';
import { deleteAllAttachmentFiles } from '@/features/attachments/storage';
import { transactionsCsv } from '@/features/export/reports';
import { shareTextFile } from '@/features/export/share';
import { listTransactions } from '@/features/transactions/repository';
import { todayISO } from '@/lib/date';

import { resetAllData } from './repository';

export function useResetAllData() {
  return useDbMutation(async (db) => {
    await resetAllData(db);
    deleteAllAttachmentFiles();
  });
}

export function useExportTransactions() {
  return useDbMutation(async (db) => {
    const items = await listTransactions(db, { sort: 'oldest' }, { limit: -1 });
    if (items.length === 0) throw new Error('There are no transactions to export yet.');
    await shareTextFile(`transactions-${todayISO()}.csv`, transactionsCsv(items), 'text/csv');
    return items.length;
  });
}
