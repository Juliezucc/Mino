import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedMascot } from '@/components/mascot';
import { MascotExpression } from '@/components/mascot/types';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { formatDuration } from '@/domain/ledger';
import { unitOf, tailleBouton } from '@/domain/ageBand';
import { ID } from '@/domain/types';
import { formatTime } from '@/domain/minos';
import { getScreenTimeService } from '@/services/screenTime';
import { useActiveChild, useRunningSession } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

function secondsLeft(endsAt: string): number {
  return Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
}

/**
 * The screen-time session.
 *
 * In this MVP the countdown is honest about what it does: it measures the time
 * used, it does not lock any app. Real blocking arrives through ScreenTimeService.
 */
export default function SessionScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const child = useActiveChild();
  // Les boutons géants sont pour les petits : voir `tailleBouton`. Douze écrans
  // écrivaient « kid » en dur, et un adolescent de quatorze ans les recevait
  // tous.
  const taille = tailleBouton(child);
  const running = useRunningSession(child?.id);
  const endSession = useMinoStore((s) => s.endSession);

  const session = running && (!sessionId || running.id === sessionId) ? running : null;
  // Seeded from the session itself: starting at 0 would read as "time is up"
  // and close the session on the very first render.
  const [remaining, setRemaining] = useState(() => (session ? secondsLeft(session.endsAt) : -1));
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const left = secondsLeft(session.endsAt);
      setRemaining(left);
      return left;
    };
    tick();
    const interval = setInterval(() => {
      if (tick() <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const finish = async (status: 'finished' | 'stopped') => {
    if (!session || closing) return;
    setClosing(true);
    await getScreenTimeService().revoke(session.id);
    await endSession(session.id, status);
    setClosing(false);
    if (router.canGoBack()) router.back();
    else router.replace('/child/temps');
  };

  useEffect(() => {
    // `remaining < 0` means "not measured yet" — only a real zero ends the session.
    if (session && remaining === 0 && !closing) finish('finished');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session]);

  // The session can also end from the parent's phone. The store tells this
  // screen, but the shield lives on THIS device: without this, a parent
  // stopping a session remotely would leave the apps unlocked here.
  const wasRunning = useRef<ID | null>(null);
  useEffect(() => {
    if (session) {
      wasRunning.current = session.id;
      return;
    }
    const ended = wasRunning.current;
    if (!ended) return;
    wasRunning.current = null;
    getScreenTimeService()
      .revoke(ended)
      .catch(() => undefined);
  }, [session]);

  if (!child || !session) {
    return (
      <Screen contentStyle={styles.content}>
        <ScreenHeader onBack={() => router.replace('/child/temps')} />
        <Card style={styles.card}>
          <AnimatedMascot expression="happy" size={140} />
          <Text variant="title" center>
            Session terminée
          </Text>
          <Button label="RETOUR" size={taille} variant="secondary" onPress={() => router.replace('/child/temps')} />
        </Card>
      </Screen>
    );
  }

  const unit = unitOf(child);
  const total = session.requestedMinutes * 60;
  const progress = total > 0 ? remaining / total : 0;
  const expression: MascotExpression =
    progress > 0.5 ? 'delighted' : progress > 0.15 ? 'happy' : progress > 0 ? 'worried' : 'sad';

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <Button
          label="J’ARRÊTE MAINTENANT"
          size={taille}
          variant="secondary"
          onPress={() => finish('stopped')}
          loading={closing}
        />
      }
    >
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.head}>
        <Text variant="hero" center>
          Bon écran !
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {progress <= 0.15
            ? 'Presque plus de temps !'
            : unit === 'minos'
              ? 'Profite bien de tes minos.'
              : 'Bon écran.'}
        </Text>
      </View>

      <AnimatedMascot expression={expression} size={170} style={styles.mascot} />

      <Card style={styles.card}>
        <Text variant="label" color={colors.textMuted}>
          TEMPS RESTANT
        </Text>
        <Text variant="display" color={colors.blueInk}>
          {formatDuration(remaining)}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
        </View>
        <Text variant="caption" color={colors.textSubtle} center>
          {`Sur ${formatTime(session.requestedMinutes, unit)} · ce que tu utilises est retiré de ton compteur`}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg, alignItems: 'stretch' },
  head: { gap: spacing.xs },
  mascot: { alignSelf: 'center' },
  card: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceSunken,
    width: '100%',
    overflow: 'hidden',
  },
  fill: { height: 12, borderRadius: 6, backgroundColor: colors.blue },
});
