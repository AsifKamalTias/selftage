import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/loader';
import { Screen } from '@/components/ui/screen';
import { SelectField } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import type { LedgerEntry } from '@/db/types';
import { useAccounts } from '@/features/accounts/hooks';
import { PeriodSelector } from '@/features/dashboard/components/period-selector';
import { ledgerCsv, ledgerHtml } from '@/features/export/reports';
import { sharePdf, shareTextFile } from '@/features/export/share';
import { LedgerSummaryCard } from '@/features/ledger/components/ledger-summary-card';
import { useLedgerStatements } from '@/features/ledger/hooks';
import type { LedgerStatement } from '@/features/ledger/repository';
import { useSettings } from '@/features/settings/settings-provider';
import { useTheme } from '@/theme/theme-provider';
import {
  formatRange,
  PERIOD_PRESETS,
  rangeForPreset,
  todayISO,
  type PeriodPreset,
} from '@/lib/date';
import { spacing } from '@/theme/tokens';

const COMBINED = '__combined__';
const EACH = '__each__';

function isPreset(value: string | undefined): value is PeriodPreset {
  return PERIOD_PRESETS.some((p) => p.value === value);
}

function StatementCard({
  statement,
  hasStart,
  wide,
}: {
  statement: LedgerStatement;
  hasStart: boolean;
  /** Only a wide screen can show the five-column table. */
  wide: boolean;
}) {
  const { formatDate, formatAmount } = useSettings();
  const openingRow: LedgerEntry[] = hasStart
    ? [
        {
          id: `bf-${statement.accountId ?? 'all'}`,
          accountId: statement.accountId ?? '',
          accountName: statement.accountName,
          transactionId: null,
          entryType: 'opening',
          date: '',
          description: 'Balance brought forward',
          categoryName: null,
          sourceName: null,
          debit: 0,
          credit: 0,
          balance: statement.summary.openingBalance,
          createdAt: '',
        },
      ]
    : [];

  const entries = [...openingRow, ...statement.entries];

  return (
    <View style={styles.statement}>
      <Text variant="subheading">{statement.accountName}</Text>
      <LedgerSummaryCard summary={statement.summary} showOpening={hasStart} />
      {wide ? (
        <DataTable
          rows={entries}
          keyExtractor={(e) => e.id}
          emptyText="No entries in this period"
          columns={[
            {
              key: 'date',
              title: 'Date',
              width: 104,
              render: (e) => (e.date && e.entryType !== 'opening' ? formatDate(e.date) : '—'),
            },
            {
              key: 'description',
              title: 'Description',
              flex: 2,
              render: (e) => (
                <View>
                  <Text variant="caption" weight="medium" numberOfLines={1}>
                    {e.description}
                  </Text>
                  {e.transactionId && (e.categoryName || e.sourceName || !statement.accountId) ? (
                    <Text variant="micro" color="textMuted" numberOfLines={1}>
                      {[e.categoryName, e.sourceName, statement.accountId ? null : e.accountName]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
              ),
            },
            {
              key: 'debit',
              flex: 1.3,
              title: 'Debit',
              align: 'right',
              render: (e) =>
                e.debit ? <Amount value={e.debit} variant="caption" color="income" /> : '',
            },
            {
              key: 'credit',
              flex: 1.3,
              title: 'Credit',
              align: 'right',
              render: (e) =>
                e.credit ? <Amount value={e.credit} variant="caption" color="expense" /> : '',
            },
            {
              key: 'balance',
              flex: 1.3,
              title: 'Balance',
              align: 'right',
              render: (e) => <Amount value={e.balance} variant="caption" weight="bold" />,
            },
          ]}
          footer={{
            description: 'Totals · closing',
            debit: formatAmount(statement.summary.totalDebit),
            credit: formatAmount(statement.summary.totalCredit),
            balance: formatAmount(statement.summary.closingBalance),
          }}
        />
      ) : (
        <LedgerEntryList entries={entries} statement={statement} />
      )}
    </View>
  );
}

/**
 * The phone layout for a statement: five columns never fit side by side, so each entry
 * becomes a row with its money stacked on the right, under a matching header.
 */
function LedgerEntryList({
  entries,
  statement,
}: {
  entries: LedgerEntry[];
  statement: LedgerStatement;
}) {
  const { colors } = useTheme();
  const { formatDate, formatAmount } = useSettings();

  return (
    <Card padded={false} style={styles.entryCard}>
      <View style={[styles.entryHeader, { backgroundColor: colors.surfaceMuted }]}>
        <Text variant="micro" color="textSecondary" uppercase style={styles.flex}>
          Entry
        </Text>
        <Text variant="micro" color="textSecondary" uppercase>
          In / out · balance
        </Text>
      </View>

      {entries.length === 0 ? (
        <Text variant="caption" color="textMuted" align="center" style={styles.entryEmpty}>
          No entries in this period
        </Text>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={[styles.entryRow, { borderTopColor: colors.border }]}>
            <View style={styles.entryText}>
              <Text variant="caption" weight="medium" numberOfLines={1}>
                {e.description}
              </Text>
              <Text variant="micro" color="textMuted" numberOfLines={1}>
                {[
                  e.entryType === 'opening' || !e.date ? null : formatDate(e.date),
                  e.categoryName,
                  e.sourceName,
                  statement.accountId ? null : e.accountName,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Brought forward'}
              </Text>
            </View>
            <View style={styles.entryAmounts}>
              {e.debit ? (
                <Amount value={e.debit} variant="caption" weight="semibold" color="income" />
              ) : e.credit ? (
                <Amount value={e.credit} variant="caption" weight="semibold" color="expense" />
              ) : (
                <Text variant="caption" color="textMuted">
                  —
                </Text>
              )}
              <Text variant="micro" color="textMuted" tabular>
                {formatAmount(e.balance)}
              </Text>
            </View>
          </View>
        ))
      )}

      <View style={[styles.entryFooter, { borderTopColor: colors.borderStrong }]}>
        <Text variant="caption" weight="bold" style={styles.flex}>
          Totals · closing
        </Text>
        <View style={styles.entryAmounts}>
          <Text variant="micro" color="textMuted" tabular>
            <Text variant="micro" color="income">
              {formatAmount(statement.summary.totalDebit)}
            </Text>
            {' / '}
            <Text variant="micro" color="expense">
              {formatAmount(statement.summary.totalCredit)}
            </Text>
          </Text>
          <Text variant="caption" weight="bold" tabular>
            {formatAmount(statement.summary.closingBalance)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default function LedgerReportScreen() {
  const params = useLocalSearchParams<{ accountId?: string; preset?: string }>();
  const { settings, currency } = useSettings();
  const toast = useToast();
  const [preset, setPreset] = useState<PeriodPreset>(
    isPreset(params.preset) && params.preset !== 'all' ? params.preset : 'this-month'
  );
  const [scope, setScope] = useState<string>(params.accountId || COMBINED);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  // Five columns only read well on a tablet or a wide window.
  const { width } = useWindowDimensions();
  const wide = width >= 700;

  const accounts = useAccounts();
  const range = rangeForPreset(preset, { weekStartsOn: settings.weekStartsOn });
  const accountIds =
    scope === COMBINED ? null : scope === EACH ? (accounts.data ?? []).map((a) => a.id) : [scope];
  const statements = useLedgerStatements({ from: range.from, to: range.to, accountIds });
  const rangeText = formatRange(range, settings.dateFormat);
  const hasStart = !!range.from;

  const exportAs = async (format: 'pdf' | 'csv') => {
    if (!statements.data) return;
    setExporting(format);
    const ctx = { currency, dateFormat: settings.dateFormat, rangeText, hasStart };
    const baseName = `ledger-report-${todayISO()}`;
    try {
      if (format === 'pdf') {
        await sharePdf(`${baseName}.pdf`, ledgerHtml(statements.data, ctx));
      } else {
        await shareTextFile(`${baseName}.csv`, ledgerCsv(statements.data, ctx), 'text/csv');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <Screen safeBottom>
      <View style={styles.controls}>
        <PeriodSelector value={preset} onChange={setPreset} />
        <SelectField
          label="Accounts"
          value={scope}
          onChange={(value) => setScope(value ?? COMBINED)}
          options={[
            {
              value: COMBINED,
              label: 'All accounts (combined)',
              icon: 'layers',
              color: '#6366F1',
            },
            {
              value: EACH,
              label: 'Each account separately',
              icon: 'albums',
              color: '#8B5CF6',
            },
            ...(accounts.data ?? []).map((a) => ({
              value: a.id,
              label: a.name,
              description: a.accountTypeName,
              icon: a.icon,
              color: a.color,
            })),
          ]}
        />
      </View>

      <Card muted elevated={false} style={styles.meta}>
        <View style={styles.metaText}>
          <Text variant="caption" color="textMuted">
            Statement period
          </Text>
          <Text weight="semibold">{rangeText}</Text>
        </View>
        <View style={styles.exports}>
          <Button
            title="PDF"
            icon="document-outline"
            size="sm"
            loading={exporting === 'pdf'}
            disabled={!statements.data || exporting != null}
            onPress={() => exportAs('pdf')}
          />
          <Button
            title="CSV"
            icon="grid-outline"
            size="sm"
            variant="secondary"
            loading={exporting === 'csv'}
            disabled={!statements.data || exporting != null}
            onPress={() => exportAs('csv')}
          />
        </View>
      </Card>

      {statements.isPending ? (
        <View style={styles.statement}>
          <Skeleton height={118} radius={20} />
          <Skeleton height={240} radius={16} />
        </View>
      ) : statements.error ? (
        <EmptyState
          icon="warning-outline"
          title="Couldn't build the report"
          message={statements.error.message}
        />
      ) : (
        statements.data?.map((statement) => (
          <StatementCard
            key={statement.accountId ?? 'combined'}
            statement={statement}
            hasStart={hasStart}
            wide={wide}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  entryCard: {
    overflow: 'hidden',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  entryText: {
    flex: 1,
    gap: 2,
  },
  entryAmounts: {
    alignItems: 'flex-end',
    gap: 2,
  },
  entryEmpty: {
    paddingVertical: spacing.xl,
  },
  entryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1.5,
  },
  flex: {
    flex: 1,
  },
  controls: {
    gap: spacing.md,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  metaText: {
    flex: 1,
    minWidth: 160,
    gap: 2,
  },
  exports: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statement: {
    gap: spacing.md,
  },
});
