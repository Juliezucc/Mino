import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, MinutesBadge, Screen, ScreenHeader, Text } from '@/components/ui';
import { unitOf } from '@/domain/ageBand';
import { MissionCard } from '@/features/child/MissionCard';
import { useActiveChild, useBalance, useChildMissions } from '@/store/selectors';
import { colors, spacing } from '@/theme';

/**
 * "Mes missions" — what is left to do, and nothing else.
 *
 * Validated missions are deliberately NOT listed. A child scanning this screen
 * is answering one question — what do I do now? — and a column of grey ticks
 * buries the answer under things that no longer need them. The day's work still
 * shows, but as a reward rather than a checklist: the minos earned today, on
 * the home screen and in "Mon temps".
 *
 * Missions waiting on a parent DO stay, because that is a live state the child
 * has to be able to make sense of ("I did it, so where are my minos?").
 */
export default function ChildMissions() {
  const router = useRouter();
  const child = useActiveChild();
  const missions = useChildMissions(child?.id);
  const balance = useBalance(child?.id);

  if (!child) return null;

  const unit = unitOf(child);

  const todo = missions.filter((m) => m.state === 'todo');
  const open = missions.filter((m) => m.state !== 'done');
  const allDone = missions.length > 0 && open.length === 0;

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader
        onBack={() => router.back()}
        right={<MinutesBadge minutes={balance} tone="blue" signed={false} unit={unit} />}
      />

      <View style={styles.head}>
        <Text variant="hero">Mes missions</Text>
        <Text variant="body" color={colors.textMuted}>
          {todo.length > 0
            ? `${todo.length} mission${todo.length > 1 ? 's' : ''} à faire${unit === 'minos' ? ' · touche une carte pour commencer' : ''}`
            : open.length > 0
              ? unit === 'minos'
                ? 'Ton parent doit valider · tes minos arrivent après'
                : 'En attente de validation'
              : 'Tout est fait pour aujourd’hui !'}
        </Text>
      </View>

      {missions.length === 0 ? (
        <EmptyState
          title="Pas encore de mission"
          message="Ton parent va bientôt t’en proposer une."
          expression="motivated"
        />
      ) : allDone ? (
        <EmptyState
          title="Tout est fait ! 🎉"
          message={
            unit === 'minos'
              ? 'Plus rien à faire aujourd’hui. Va profiter de tes minos !'
              : 'Plus rien à faire aujourd’hui. Le temps gagné est à toi.'
          }
          expression="proud"
          action={{ label: 'MON TEMPS', icon: '⏱️', onPress: () => router.push('/child/temps') }}
        />
      ) : (
        <View style={styles.list}>
          {open.map((item) => (
            <MissionCard
              key={item.mission.id}
              item={item}
              unit={unit}
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
