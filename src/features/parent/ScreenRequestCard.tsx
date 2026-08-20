import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Text } from '@/components/ui';
import { formatDuration } from '@/domain/ledger';
import { targetFor } from '@/domain/screens';
import { Child, ScreenTimeSession } from '@/domain/types';
import { colors, spacing } from '@/theme';

interface Props {
  session: ScreenTimeSession;
  child: Child;
  onApprove?: () => void;
  onRefuse?: () => void;
  onStop?: () => void;
}

function secondsLeft(endsAt: string): number {
  return Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
}

/**
 * A console, a television, the family computer: screens Mino cannot drive.
 *
 * The child asks, the parent starts the clock, and both sides see the same
 * countdown — which is the whole point. Without it, "you had twenty minutes"
 * becomes an argument about who remembers what, every single evening.
 */
export function ScreenRequestCard({ session, child, onApprove, onRefuse, onStop }: Props) {
  const target = targetFor(session.target);
  const running = session.status === 'running';

  const [remaining, setRemaining] = useState(() => (running ? secondsLeft(session.endsAt) : 0));

  useEffect(() => {
    if (!running) return;
    setRemaining(secondsLeft(session.endsAt));
    const timer = setInterval(() => setRemaining(secondsLeft(session.endsAt)), 1000);
    return () => clearInterval(timer);
  }, [running, session.endsAt]);

  return (
    <Card style={styles.card} background={running ? colors.blueSoft : colors.surface} elevation={running ? 'none' : 'soft'}>
      <View style={styles.row}>
        <Avatar avatarKey={child.avatarKey} size={40} />
        <View style={styles.texts}>
          <Text variant="bodyStrong">{child.firstName}</Text>
          <Text variant="caption" color={colors.textMuted}>
            {`${target.icon}  ${target.label} · ${session.requestedMinutes} min`}
          </Text>
        </View>
        {running ? (
          <Text variant="section" color={colors.blueDark}>
            {formatDuration(remaining)}
          </Text>
        ) : null}
      </View>

      {running ? (
        <Button
          label={remaining > 0 ? 'ARRÊTER MAINTENANT' : 'TEMPS ÉCOULÉ · CLÔTURER'}
          variant={remaining > 0 ? 'secondary' : 'primary'}
          onPress={() => onStop?.()}
        />
      ) : (
        <View style={styles.actions}>
          <Button label="REFUSER" variant="ghost" onPress={() => onRefuse?.()} />
          <Button
            label={`LANCER ${session.requestedMinutes} MIN`}
            onPress={() => onApprove?.()}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texts: { flex: 1, gap: 2 },
  actions: { gap: spacing.sm },
});

export default ScreenRequestCard;
