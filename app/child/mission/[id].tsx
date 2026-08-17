import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedMascot } from '@/components/mascot';
import { Button, Card, Screen, ScreenHeader, StatusPill, Text } from '@/components/ui';
import { accentFor, colors, radii, spacing } from '@/theme';
import { useActiveChild, useChildMissions } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';

/**
 * One mission, one reward, one button. The whole screen exists to make
 * "J'AI TERMINÉ" impossible to miss.
 */
export default function MissionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const child = useActiveChild();
  const missions = useChildMissions(child?.id);
  const completeMission = useMinoStore((s) => s.completeMission);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = missions.find((m) => m.mission.id === id);
  if (!child || !item) return null;

  const accent = accentFor(item.mission.id);
  const waiting = item.state === 'pending';
  const done = item.state === 'done';

  const onFinish = async () => {
    setLoading(true);
    try {
      await completeMission(child.id, item.mission.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’envoyer la demande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        waiting || done ? (
          <Button
            label="RETOUR À MES MISSIONS"
            variant="secondary"
            size="kid"
            onPress={() => router.back()}
          />
        ) : (
          <Button
            label="J’AI TERMINÉ ✓"
            size="kid"
            variant="success"
            onPress={onFinish}
            loading={loading}
          />
        )
      }
    >
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.hero}>
        <View style={[styles.iconTile, { backgroundColor: accent.tint }]}>
          <Text style={styles.icon}>{item.mission.icon}</Text>
        </View>
        <Text variant="hero" center>
          {item.mission.title}
        </Text>
        <StatusPill state={item.state} />
      </View>

      {waiting ? (
        <Card style={styles.card} background={colors.yellowSoft} elevation="none">
          <AnimatedMascot expression="motivated" size={150} animation="celebrate" />
          <Text variant="title" center>
            Bien joué !
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Demande envoyée à ton parent. Tes minutes arrivent dès qu’il valide.
          </Text>
        </Card>
      ) : done ? (
        <Card style={styles.card} background={colors.mintSoft} elevation="none">
          <AnimatedMascot expression="proud" size={150} />
          <Text variant="title" center>
            Mission validée !
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            {`Tu as gagné ${item.completion?.minutesAwarded ?? item.mission.minutes} minutes.`}
          </Text>
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text variant="label" color={colors.textMuted}>
            TU GAGNES
          </Text>
          <Text variant="display" color={colors.blue} center>
            {`+${item.mission.minutes}`}
          </Text>
          <Text variant="section" color={colors.blue}>
            MINUTES
          </Text>
          <AnimatedMascot expression="happy" size={140} />
          <Text variant="body" color={colors.textMuted} center>
            Quand c’est fait, appuie sur le bouton vert. Ton parent recevra la demande.
          </Text>
        </Card>
      )}

      {error ? (
        <Text variant="label" color={colors.danger} center>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 88,
    height: 88,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 44 },
  card: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
});
