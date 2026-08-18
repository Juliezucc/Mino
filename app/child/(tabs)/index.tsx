import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedMascot, MascotAnimation } from '@/components/mascot';
import { MascotExpression } from '@/components/mascot/types';
import { Button, Card, MinutesBadge, Screen, Text, TimeRing } from '@/components/ui';
import { useBalanceDetail, useChildMissions, useActiveChild } from '@/store/selectors';
import { colors, spacing, tabBarSpace } from '@/theme';

/** Child home: who I am, how much time I have, and one obvious thing to do. */
export default function ChildHome() {
  const router = useRouter();
  const child = useActiveChild();
  const balance = useBalanceDetail(child?.id);
  const missions = useChildMissions(child?.id);

  if (!child || !balance) return null;

  const todo = missions.filter((m) => m.state === 'todo');
  const waiting = missions.filter((m) => m.state === 'pending');

  const expression: MascotExpression =
    balance.minutes === 0 ? 'sad' : balance.minutes < 10 ? 'worried' : waiting.length > 0 ? 'motivated' : 'happy';

  const message =
    balance.minutes === 0
      ? 'Plus de temps… fais une mission pour en gagner !'
      : balance.minutes < 10
        ? 'Presque plus de temps ! Une mission et hop.'
        : todo.length > 0
          ? `Tu as ${todo.length} mission${todo.length > 1 ? 's' : ''} à faire aujourd’hui.`
          : 'Toutes tes missions sont faites. Bravo !';

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text variant="hero">{`Salut ${child.firstName} ! 👋`}</Text>
          <Text variant="body" color={colors.textMuted}>
            {message}
          </Text>
        </View>
        {expression === 'happy' ? (
          // A single hop on arrival, then the mascot goes still.
          <MascotAnimation name="wave" size={96} restExpression="happy" />
        ) : (
          <AnimatedMascot expression={expression} size={96} />
        )}
      </View>

      <Card style={styles.ringCard} elevation="soft">
        <TimeRing minutes={balance.minutes} />
        {balance.earnedToday > 0 ? (
          <View style={styles.earned}>
            <Text variant="label" color={colors.textMuted}>
              Gagné aujourd’hui
            </Text>
            <MinutesBadge minutes={balance.earnedToday} tone="mint" />
          </View>
        ) : null}
      </Card>

      <Button
        label="VOIR MES MISSIONS"
        icon="📋"
        size="kid"
        onPress={() => router.push('/child/missions')}
      />

      {waiting.length > 0 ? (
        <Card background={colors.yellowSoft} elevation="none">
          <View style={styles.waitingRow}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <View style={styles.waitingTexts}>
              <Text variant="cardTitle">
                {waiting.length > 1
                  ? `${waiting.length} missions en attente`
                  : '1 mission en attente'}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {`Ton parent doit valider pour ajouter tes minutes.`}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTexts: { flex: 1, gap: spacing.xs },
  ringCard: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  earned: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  waitingIcon: { fontSize: 28 },
  waitingTexts: { flex: 1, gap: 2 },
});
