import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Text } from '@/components/ui';
import { MissionCompletion } from '@/domain/types';
import { useChild, useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { accentFor, colors, radii, spacing } from '@/theme';

interface Props {
  completion: MissionCompletion;
}

function elapsedLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `il y a ${hours} h`;
}

/**
 * A validation request. Two decisions, nothing else — this card is the parent's
 * half of the core journey and must stay a two-second interaction.
 */
export function RequestCard({ completion }: Props) {
  const data = useFamily();
  const child = useChild(completion.childId);
  const approve = useMinoStore((s) => s.approveCompletion);
  const reject = useMinoStore((s) => s.rejectCompletion);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const mission = data?.missions.find((m) => m.id === completion.missionId);
  if (!child || !mission) return null;

  const accent = accentFor(mission.id);

  const run = async (action: 'approve' | 'reject') => {
    setBusy(action);
    try {
      if (action === 'approve') await approve(completion.id);
      else await reject(completion.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Avatar avatarKey={child.avatarKey} size={40} />
        <View style={styles.headerTexts}>
          <Text variant="bodyStrong">{child.firstName}</Text>
          <Text variant="caption" color={colors.textSubtle}>
            {elapsedLabel(completion.completedAt)}
          </Text>
        </View>
      </View>

      <View style={styles.missionRow}>
        <View style={[styles.iconTile, { backgroundColor: accent.tint }]}>
          <Text style={styles.icon}>{mission.icon}</Text>
        </View>
        <View style={styles.missionTexts}>
          <Text variant="cardTitle" numberOfLines={2}>
            {mission.title}
          </Text>
          <Text variant="label" color={colors.blue}>
            {`+${completion.minutesRequested} min`}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="REFUSER"
          variant="danger"
          onPress={() => run('reject')}
          loading={busy === 'reject'}
          style={styles.action}
          full={false}
        />
        <Button
          label={`VALIDER +${completion.minutesRequested} MIN`}
          variant="success"
          onPress={() => run('approve')}
          loading={busy === 'approve'}
          style={styles.actionWide}
          full={false}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTexts: { gap: 1 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  missionTexts: { flex: 1, gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
  actionWide: { flex: 1.6 },
});

export default RequestCard;
