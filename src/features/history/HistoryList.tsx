import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { isSameDay } from '@/domain/ledger';
import { ScreenTimeTransaction } from '@/domain/types';
import { colors, radii, spacing } from '@/theme';

interface Props {
  transactions: ScreenTimeTransaction[];
  limit?: number;
}

const KIND_ICON: Record<ScreenTimeTransaction['kind'], string> = {
  mission_reward: '⭐',
  screen_time_used: '🎮',
  parent_adjustment: '✏️',
  initial_balance: '🎁',
};

function dayLabel(date: Date, now: Date): string {
  if (isSameDay(date, now)) return 'Aujourd’hui';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * The ledger, read by a human. Every line is one transaction — the balance is
 * literally the sum of what is displayed here.
 */
export function HistoryList({ transactions, limit }: Props) {
  const now = new Date();
  const shown = limit ? transactions.slice(0, limit) : transactions;

  if (shown.length === 0) {
    return (
      <Card elevation="none" background={colors.surfaceMuted}>
        <Text variant="body" color={colors.textMuted} center>
          Rien pour l’instant.
        </Text>
      </Card>
    );
  }

  const groups: { label: string; items: ScreenTimeTransaction[] }[] = [];
  for (const tx of shown) {
    const label = dayLabel(new Date(tx.createdAt), now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(tx);
    else groups.push({ label, items: [tx] });
  }

  return (
    <View style={styles.wrap}>
      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text variant="overline" color={colors.textSubtle}>
            {group.label.toUpperCase()}
          </Text>
          <Card padded={false}>
            {group.items.map((tx, index) => {
              const date = new Date(tx.createdAt);
              const positive = tx.delta > 0;
              return (
                <View
                  key={tx.id}
                  style={[styles.row, index > 0 && styles.rowBorderTop]}
                >
                  <View style={styles.icon}>
                    <Text style={styles.iconGlyph}>{KIND_ICON[tx.kind]}</Text>
                  </View>
                  <View style={styles.texts}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {tx.reason}
                    </Text>
                    <Text variant="caption" color={colors.textSubtle}>
                      {timeLabel(date)}
                    </Text>
                  </View>
                  <Text variant="bodyStrong" color={positive ? colors.mint : colors.textMuted}>
                    {`${positive ? '+' : ''}${tx.delta} min`}
                  </Text>
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  group: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 18 },
  texts: { flex: 1, gap: 2 },
});

export default HistoryList;
