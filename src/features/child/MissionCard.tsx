import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons/Icon';
import { Card, MinutesBadge, StatusPill, Text } from '@/components/ui';
import { formatMinos } from '@/domain/minos';
import { ChildMission } from '@/domain/missions';
import { accentFor, colors, radii, spacing } from '@/theme';

interface Props {
  item: ChildMission;
  onPress?: () => void;
}

/** Big, tappable mission card: emoji, name, reward. Readable at a glance. */
export function MissionCard({ item, onPress }: Props) {
  const accent = accentFor(item.mission.id);
  const done = item.state === 'done';

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${item.mission.title}, ${formatMinos(item.mission.minutes)}`}
      style={[styles.card, done && styles.done]}
    >
      <View style={styles.row}>
        <View style={[styles.iconTile, { backgroundColor: accent.tint }]}>
          <Text style={styles.icon}>{item.mission.icon}</Text>
        </View>

        <View style={styles.texts}>
          <Text variant="cardTitle" numberOfLines={2}>
            {item.mission.title}
          </Text>
          <View style={styles.metaRow}>
            <MinutesBadge
              minutes={item.mission.minutes}
              tone={done ? 'muted' : 'blue'}
              size="sm"
              unit="minos"
            />
            <StatusPill state={item.state} />
          </View>
        </View>

        {onPress ? <Icon name="chevron-right" color={colors.textSubtle} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: spacing.lg },
  done: { opacity: 0.62 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 62,
    height: 62,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 30 },
  texts: { flex: 1, gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});

export default MissionCard;
