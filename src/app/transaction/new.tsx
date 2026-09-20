import { useLocalSearchParams } from 'expo-router';

import { ScreenLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import type { EntryKind } from '@/db/types';
import { useBudgetAlertPresenter } from '@/features/budgets/use-budget-alerts';
import { TransactionForm } from '@/features/transactions/components/transaction-form';
import { useCreateTransaction, useTransaction } from '@/features/transactions/hooks';

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ kind?: string; duplicateOf?: string }>();
  const kind: EntryKind = params.kind === 'income' ? 'income' : 'expense';
  const template = useTransaction(params.duplicateOf);
  const create = useCreateTransaction();
  const toast = useToast();
  const presentBudgetAlerts = useBudgetAlertPresenter();

  if (params.duplicateOf && template.isPending) return <ScreenLoader />;

  return (
    <TransactionForm
      defaultKind={kind}
      template={template.data ?? undefined}
      allowSaveAndNew
      onSubmit={async ({ input, added }) => {
        const { budgetAlerts } = await create.mutateAsync({ input, files: added });
        toast.success(input.kind === 'income' ? 'Income saved' : 'Expense saved');
        presentBudgetAlerts(budgetAlerts);
      }}
    />
  );
}
