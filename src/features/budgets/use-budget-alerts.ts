import { notify } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { useSettings } from '@/features/settings/settings-provider';

import type { BudgetAlert } from './alerts';
import { BUDGET_PERIOD_WINDOW } from './period';

/**
 * Announces budgets crossed by the transaction that was just saved: a dialog when a
 * limit is passed, a toast when spending gets close to one.
 */
export function useBudgetAlertPresenter() {
  const { formatAmount } = useSettings();
  const toast = useToast();

  const overLine = (alert: BudgetAlert) =>
    `${alert.label} (${BUDGET_PERIOD_WINDOW[alert.period]}): ${formatAmount(
      alert.spent
    )} of ${formatAmount(alert.amount)} — over by ${formatAmount(Math.abs(alert.remaining))}.`;

  const closeLine = (alert: BudgetAlert) => {
    const days = alert.daysLeft === 1 ? '1 day' : `${alert.daysLeft} days`;
    return `${alert.label}: ${Math.round(alert.progress * 100)}% of your ${
      alert.period
    } budget used — ${formatAmount(alert.remaining)} left for ${days}.`;
  };

  return (alerts: BudgetAlert[]) => {
    if (alerts.length === 0) return;
    const exceeded = alerts.filter((alert) => alert.health === 'exceeded');
    const warnings = alerts.filter((alert) => alert.health === 'warning');

    if (exceeded.length > 0) {
      notify(
        exceeded.length === 1 ? 'Budget limit reached' : `${exceeded.length} budgets over limit`,
        exceeded.map(overLine).join('\n\n')
      );
      return;
    }
    const extra = warnings.length > 1 ? ` (+${warnings.length - 1} more)` : '';
    toast.show(`${closeLine(warnings[0])}${extra}`, 'warning');
  };
}
