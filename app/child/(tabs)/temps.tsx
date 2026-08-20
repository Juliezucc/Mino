import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedMascot } from '@/components/mascot';
import { formatMinos } from '@/domain/minos';
import { Button, Card, Chip, MinutesBadge, Screen, Text, TimeCapsules, TimeRing } from '@/components/ui';
import { getScreenTimeService } from '@/services/screenTime';
import { useActiveChild, useBalanceDetail, useRunningSession } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing, tabBarSpace } from '@/theme';

const DURATIONS = [10, 20, 30];

/** "Mon temps": how much I own, how it looks, and how to spend it. */
export default function ChildTime() {
  const router = useRouter();
  const child = useActiveChild();
  const balance = useBalanceDetail(child?.id);
  const running = useRunningSession(child?.id);
  const startSession = useMinoStore((s) => s.startSession);

  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!child || !balance) return null;

  const options = DURATIONS.filter((d) => d <= balance.minutes);

  const begin = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const sessionId = await startSession(child.id, selected);
      // The service seam: today an in-app timer, tomorrow real app unblocking.
      await getScreenTimeService().grant({ sessionId, childId: child.id, minutes: selected });
      setError(null);
      router.push({ pathname: '/child/session', params: { sessionId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de démarrer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <Text variant="hero">Mon temps</Text>

      <Card style={styles.ringCard}>
        <TimeRing minutes={balance.minutes} unit="minos" />
        <TimeCapsules minutes={balance.minutes} />
      </Card>

      <Card style={styles.statsCard} elevation="none" background={colors.mintSoft}>
        <View style={styles.statRow}>
          <Text variant="bodyStrong">Minos gagnés aujourd’hui</Text>
          <MinutesBadge minutes={balance.earnedToday} tone="mint" unit="minos" />
        </View>
        {balance.usedToday > 0 ? (
          <View style={styles.statRow}>
            <Text variant="body" color={colors.textMuted}>
              Minos utilisés aujourd’hui
            </Text>
            <MinutesBadge minutes={-balance.usedToday} tone="muted" unit="minos" />
          </View>
        ) : null}
      </Card>

      {running ? (
        <Card style={styles.useCard} background={colors.blueSoft} elevation="none">
          <AnimatedMascot expression="delighted" size={110} />
          <Text variant="cardTitle" center>
            Une session est en cours
          </Text>
          <Button
            label="REPRENDRE"
            size="kid"
            onPress={() =>
              router.push({ pathname: '/child/session', params: { sessionId: running.id } })
            }
          />
        </Card>
      ) : balance.minutes <= 0 ? (
        <Card style={styles.useCard}>
          <AnimatedMascot expression="sad" size={120} />
          <Text variant="cardTitle" center>
            Plus de minos…
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Fais une mission pour gagner de nouveaux minos !
          </Text>
          <Button label="VOIR MES MISSIONS" icon="📋" size="kid" onPress={() => router.push('/child/missions')} />
        </Card>
      ) : (
        <Card style={styles.useCard}>
          <Text variant="section" center>
            Utiliser mon temps
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Combien de minos veux-tu utiliser maintenant ?
          </Text>
          <View style={styles.durations}>
            {(options.length > 0 ? options : [balance.minutes]).map((value) => (
              <Chip
                key={value}
                label={formatMinos(value)}
                selected={selected === value}
                onPress={() => setSelected(value)}
              />
            ))}
          </View>
          {error ? (
            <Text variant="caption" color={colors.danger} center>
              {error}
            </Text>
          ) : null}
          <Button
            label="COMMENCER"
            icon="▶️"
            size="kid"
            variant="primary"
            disabled={!selected}
            loading={loading}
            onPress={begin}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.lg },
  ringCard: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  statsCard: { gap: spacing.md },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  useCard: { alignItems: 'center', gap: spacing.md },
  durations: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
});
