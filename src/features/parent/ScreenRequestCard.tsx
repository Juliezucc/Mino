import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Text } from '@/components/ui';
import { formatDuration } from '@/domain/ledger';
import { deviceById, deviceIcon, describeDevice } from '@/domain/devices';
import { Child, Device, ScreenTimeSession } from '@/domain/types';
import { colors, spacing } from '@/theme';

interface Props {
  session: ScreenTimeSession;
  child: Child;
  /** The family's declared screens, to name the one this session is for. */
  devices?: Device[];
  onApprove?: () => void;
  onRefuse?: () => void;
  onStop?: () => void;
  onBonus?: () => void;
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
export function ScreenRequestCard({
  session,
  child,
  devices,
  onApprove,
  onRefuse,
  onStop,
  onBonus,
}: Props) {
  const device = deviceById(devices, session.deviceId);
  const icon = device ? deviceIcon(device.kind) : '📱';
  const name = describeDevice(devices, session.deviceId);
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
            {`${icon}  ${name} · ${session.requestedMinutes} min`}
          </Text>
        </View>
        {running ? (
          <Text variant="section" color={colors.blueInk}>
            {formatDuration(remaining)}
          </Text>
        ) : null}
      </View>

      {running ? (
        <View style={styles.actions}>
          <Button
            label={remaining > 0 ? 'ARRÊTER MAINTENANT' : 'TEMPS ÉCOULÉ · CLÔTURER'}
            variant={remaining > 0 ? 'secondary' : 'primary'}
            onPress={() => onStop?.()}
          />
          {onBonus ? (
            <Button label="OFFRIR DU TEMPS" icon="🎁" variant="ghost" onPress={() => onBonus()} />
          ) : null}
        </View>
      ) : (
        <View style={styles.actions}>
          {/* « Pas maintenant » plutôt que « REFUSER » : ce n'est presque
              jamais un non définitif, c'est un non tout de suite. Le mot dit
              au passage à l'enfant que ses minos ne sont pas perdus — et il
              évite de faire d'un « on est à table » un jugement. */}
          <Button label="Pas maintenant" variant="ghost" onPress={() => onRefuse?.()} />
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
