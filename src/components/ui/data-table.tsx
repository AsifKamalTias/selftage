import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type DimensionValue } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, withAlpha } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

export interface Column<T> {
  key: string;
  title: string;
  /** Relative width; ignored when `width` is set. */
  flex?: number;
  width?: DimensionValue;
  align?: 'left' | 'right' | 'center';
  render: (row: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: readonly T[];
  keyExtractor: (row: T) => string;
  /** Rendered after the rows, e.g. totals. Receives the same column layout. */
  footer?: Partial<Record<string, ReactNode>>;
  onRowPress?: (row: T) => void;
  emptyText?: string;
  /** Scroll horizontally when narrower than this. */
  minWidth?: number;
}

function Cell({ column, children }: { column: Column<unknown>; children: ReactNode }) {
  return (
    <View
      style={[
        styles.cell,
        column.width != null ? { width: column.width } : { flex: column.flex ?? 1 },
        {
          alignItems:
            column.align === 'right'
              ? 'flex-end'
              : column.align === 'center'
                ? 'center'
                : 'flex-start',
        },
      ]}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text variant="caption" numberOfLines={2} tabular align={column.align}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  footer,
  onRowPress,
  emptyText = 'No data',
  minWidth = 0,
}: DataTableProps<T>) {
  const { colors } = useTheme();
  const cols = columns as Column<unknown>[];

  const table = (
    <View style={[styles.table, { minWidth, borderColor: colors.border }]}>
      <View style={[styles.row, styles.headerRow, { backgroundColor: colors.surfaceMuted }]}>
        {cols.map((column) => (
          <Cell key={column.key} column={column}>
            <Text
              variant="micro"
              color="textSecondary"
              uppercase
              align={column.align}
              numberOfLines={1}>
              {column.title}
            </Text>
          </Cell>
        ))}
      </View>
      {rows.length === 0 ? (
        <Text variant="caption" color="textMuted" align="center" style={styles.empty}>
          {emptyText}
        </Text>
      ) : (
        rows.map((row, index) => {
          const cells = cols.map((column) => (
            <Cell key={column.key} column={column}>
              {column.render(row, index)}
            </Cell>
          ));
          const rowStyle = [
            styles.row,
            { borderTopColor: colors.border },
            index % 2 === 1 && { backgroundColor: withAlpha(colors.surfaceMuted, 0.45) },
          ];
          return onRowPress ? (
            <PressableScale
              key={keyExtractor(row)}
              scaleTo={0.99}
              onPress={() => onRowPress(row)}
              style={rowStyle}>
              {cells}
            </PressableScale>
          ) : (
            <View key={keyExtractor(row)} style={rowStyle}>
              {cells}
            </View>
          );
        })
      )}
      {footer ? (
        <View style={[styles.row, styles.footerRow, { borderTopColor: colors.borderStrong }]}>
          {cols.map((column) => (
            <Cell key={column.key} column={column}>
              {typeof footer[column.key] === 'string' ? (
                <Text variant="caption" weight="bold" tabular align={column.align}>
                  {footer[column.key]}
                </Text>
              ) : (
                (footer[column.key] ?? null)
              )}
            </Cell>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (!minWidth) return table;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}>
      {table}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  table: {
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  headerRow: {
    borderTopWidth: 0,
    minHeight: 36,
  },
  footerRow: {
    borderTopWidth: 1,
  },
  cell: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: spacing.xl,
  },
});
