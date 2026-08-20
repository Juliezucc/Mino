import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, MinutesBadge, Screen, SectionHeader, Text } from '@/components/ui';
import { ROUTINES, suits } from '@/domain/missionLibrary';
import { childrenOfMission, describeRepeat } from '@/domain/missions';
import { useChildren, useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { accentFor, colors, radii, spacing, tabBarSpace } from '@/theme';

/** All the family's missions, with who they are for and how often they repeat. */
export default function ParentMissions() {
  const router = useRouter();
  const data = useFamily();
  const children = useChildren();
  const archiveMission = useMinoStore((s) => s.archiveMission);

  if (!data) return null;

  const missions = data.missions.filter((m) => !m.archived);

  // A routine is only offered if at least one child in the family can actually
  // do something in it — no sibling routine for an only child, no vacuuming for
  // a five-year-old.
  const routines = ROUTINES.filter((routine) =>
    routine.suggestions.some((s) =>
      children.some((child) => suits(s, child, children.filter((c) => c.id !== child.id))),
    ),
  );

  const confirmArchive = (missionId: string, title: string) => {
    Alert.alert('Supprimer la mission ?', `« ${title} » ne sera plus proposée aux enfants.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          archiveMission(missionId).catch(() => undefined);
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader title="Missions" subtitle={`${missions.length} mission(s) active(s)`} />

      <Button
        label="Créer une mission"
        icon="＋"
        onPress={() => router.push('/parent/mission-new')}
      />

      <View style={styles.block}>
        <SectionHeader
          title="Routines prêtes à l’emploi"
          subtitle="Un thème, et Mino propose les missions qui vont avec"
        />
        <View style={styles.routines}>
          {routines.map((routine) => (
            <Card
              key={routine.id}
              onPress={() => router.push({ pathname: '/parent/routine/[id]', params: { id: routine.id } })}
              accessibilityLabel={`${routine.title}. ${routine.tagline}`}
              style={styles.routine}
              elevation="soft"
            >
              <Text style={styles.routineIcon}>{routine.icon}</Text>
              <Text variant="cardTitle" numberOfLines={2}>
                {routine.title}
              </Text>
              <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
                {routine.tagline}
              </Text>
            </Card>
          ))}
        </View>
      </View>

      {missions.length === 0 ? (
        <EmptyState
          title="Aucune mission"
          message="Crée une première petite responsabilité du quotidien."
          expression="motivated"
        />
      ) : (
        <View style={styles.list}>
          {missions.map((mission) => {
            const accent = accentFor(mission.id);
            const assigned = childrenOfMission(data, mission.id);
            return (
              <Card key={mission.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={[styles.iconTile, { backgroundColor: accent.tint }]}>
                    <Text style={styles.icon}>{mission.icon}</Text>
                  </View>
                  <View style={styles.texts}>
                    <Text variant="cardTitle" numberOfLines={2}>
                      {mission.title}
                    </Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {describeRepeat(mission.repeat)}
                    </Text>
                  </View>
                  <MinutesBadge minutes={mission.minutes} />
                </View>

                <View style={styles.footer}>
                  <View style={styles.avatars}>
                    {assigned.map((childId) => {
                      const child = children.find((c) => c.id === childId);
                      if (!child) return null;
                      return (
                        <View key={childId} style={styles.assignee}>
                          <Avatar avatarKey={child.avatarKey} size={26} />
                          <Text variant="caption" color={colors.textMuted}>
                            {child.firstName}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <Button
                    label="Supprimer"
                    variant="ghost"
                    size="small"
                    full={false}
                    haptic={false}
                    onPress={() => confirmArchive(mission.id, mission.title)}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  routines: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  routine: { width: '47%', flexGrow: 1, gap: spacing.xs },
  routineIcon: { fontSize: 32 },
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.lg },
  list: { gap: spacing.md },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  texts: { flex: 1, gap: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  avatars: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', flex: 1 },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
