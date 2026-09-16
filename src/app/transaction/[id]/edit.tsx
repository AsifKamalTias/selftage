import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { ScreenLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { TransactionForm } from '@/features/transactions/components/transaction-form';
import { useTransaction, useUpdateTransaction } from '@/features/transactions/hooks';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isPending } = useTransaction(id);
  const update = useUpdateTransaction();
  const toast = useToast();

  if (isPending) return <ScreenLoader />;
  if (!data) {
    return (
      <EmptyState
        icon="search-outline"
        title="Transaction not found"
        message="It may have been deleted."
      />
    );
  }

  return (
    <TransactionForm
      key={data.id}
      initial={data}
      submitLabel="Save changes"
      onSubmit={async ({ input, added, removedIds }) => {
        await update.mutateAsync({ id: data.id, input, added, removedIds });
        toast.success('Transaction updated');
      }}
    />
  );
}
