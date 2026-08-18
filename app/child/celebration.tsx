import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MascotAnimation } from '@/components/mascot';
import { Button, Confetti, Screen, Text, TimeRing } from '@/components/ui';
import { MissionCompletion } from '@/domain/types';
import { useActiveChild, useBalance, useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/** Delay before the counter starts climbing, so the child reads the reward first. */
const RING_DELAY = 900;

/**
 * The payoff screen: confetti, the mascot, the minutes won, and the counter
 * visibly climbing from the old balance to the new one (35 → 50).
 */
export default function Celebration() {
  const router = useRouter();
  const { completionId } = useLocalSearchParams<{ completionId?: string }>();
  const child = useActiveChild();
  const data = useFamily();
  const balance = useBalance(child?.id);
  const markCelebrated = useMinoStore((s) => s.markCelebrated);

  // Freeze the completion: marking it celebrated must not blank the screen.
  const completionRef = useRef<MissionCompletion | null>(null);
  if (!completionRef.current && data) {
    completionRef.current =
      data.completions.find((c) => c.id === completionId) ??
      data.completions.find(
        (c) => c.childId === child?.id && c.status === 'approved' && !c.celebratedAt,
      ) ??
      null;
  }
  const completion = completionRef.current;
  const minutes = completion?.minutesAwarded ?? 0;

  const [ringValue, setRingValue] = useState(Math.max(0, balance - minutes));

  useEffect(() => {
    if (!completion) return;
    markCelebrated(completion.id).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const timer = setTimeout(() => setRingValue(balance), RING_DELAY);
    return () => clearTimeout(timer);
    // Runs once for this completion: the balance is read at mount on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completion?.id]);

  if (!child || !completion) return null;

  const mission = data?.missions.find((m) => m.id === completion.missionId);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/child');
  };

  return (
    <Screen background={colors.surface} contentStyle={styles.content} scroll={false}>
      <Confetti />

      <View style={styles.top}>
        <Text variant="title" color={colors.mint} center>
          Mission validée !
        </Text>
        {mission ? (
          <Text variant="body" color={colors.textMuted} center>
            {`${mission.icon}  ${mission.title}`}
          </Text>
        ) : null}
      </View>

      <MascotAnimation name="celebrate" size={190} restExpression="delighted" />

      <Text variant="display" color={colors.blue} center style={styles.reward}>
        {`+${minutes}`}
      </Text>
      <Text variant="title" color={colors.blue} center>
        MINUTES
      </Text>

      <Text variant="section" center>
        {`Bravo ${child.firstName} !`}
      </Text>

      <TimeRing minutes={ringValue} size={190} label="min disponibles" />

      <Button label="SUPER !" icon="🎉" size="kid" onPress={close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  top: { gap: spacing.xs, alignItems: 'center' },
  reward: { marginBottom: -spacing.sm },
});
