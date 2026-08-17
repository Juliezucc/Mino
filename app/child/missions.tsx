import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, MinutesBadge, Screen, ScreenHeader, Text } from '@/components/ui';
import { MissionCard } from '@/features/child/MissionCard';
import { useActiveChild, useBalance, useChildMissions } from '@/store/selectors';
import { colors, spacing } from '@/theme';

/** "Mes missions" — the list of today's missions, still-to-do ones first. */
export default function ChildMissions() {
  const router = useRouter();
  const child = useActiveChild();
  const missions = useChildMissions(child?.id);
  const balance = useBalance(child?.id);

  if (!child) return null;

  const todo = missions.filter((m) => m.state === 'todo');

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader
        onBack={() => router.back()}
        right={<MinutesBadge minutes={balance} tone="blue" signed={false} />}
      />

      <View style={styles.head}>
        <Text variant="hero">Mes missions</Text>
        <Text variant="body" color={colors.textMuted}>
          {todo.length > 0
            ? `${todo.length} mission${todo.length > 1 ? 's' : ''} à faire · touche une carte pour commencer`
            : 'Tout est fait pour aujourd’hui !'}
        </Text>
      </View>

      {missions.length === 0 ? (
        <EmptyState
          title="Pas encore de mission"
          message="Ton parent va bientôt t’en proposer une."
          expression="motivated"
        />
      ) : (
        <View style={styles.list}>
          {missions.map((item) => (
            <MissionCard
              key={item.mission.id}
              item={item}
              onPress={() =>
                router.push({ pathname: '/child/mission/[id]', params: { id: item.mission.id } })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.lg },
  head: { gap: spacing.xs },
  list: { gap: spacing.md },
});
