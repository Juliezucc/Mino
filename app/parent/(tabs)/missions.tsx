import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

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
  const editMission = useMinoStore((s) => s.editMission);

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

                {/* Le réglage se change ici, sur la mission elle-même.
                    Le proposer seulement à la création serait le figer : un
                    parent découvre au bout d'une semaine que confirmer « faire
                    son lit » tous les matins ne lui apprend rien, et c'est
                    exactement à ce moment-là qu'il doit pouvoir le retirer. */}
                <Pressable
                  onPress={() =>
                    editMission(mission.id, { autoApprove: !mission.autoApprove }).catch(
                      () => undefined,
                    )
                  }
                  accessibilityRole="switch"
                  accessibilityState={{ checked: mission.autoApprove === true }}
                  accessibilityLabel={
                    mission.autoApprove
                      ? `« ${mission.title} » se compte toute seule. Toucher pour la faire passer par vous.`
                      : `« ${mission.title} » passe par vous. Toucher pour qu’elle se compte toute seule.`
                  }
                  style={[styles.auto, mission.autoApprove && styles.autoOn]}
                >
                  <Text variant="caption" color={mission.autoApprove ? colors.mintInk : colors.textMuted}>
                    {mission.autoApprove ? '⚡  Se compte toute seule' : '✓  Vous confirmez'}
                  </Text>
                </Pressable>

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
                  {/* Discret, et volontairement : supprimer était jusqu'ici
                      l'élément le plus visible de chaque ligne après le titre.
                      Une action qu'on ne fait presque jamais, et qui efface,
                      n'a rien à faire au premier plan — elle reste à sa place,
                      avec la même surface tactile. */}
                  <Pressable
                    onPress={() => confirmArchive(mission.id, mission.title)}
                    accessibilityRole="button"
                    accessibilityLabel={`Supprimer la mission « ${mission.title} »`}
                    hitSlop={8}
                    style={styles.remove}
                  >
                    <Text variant="caption" color={colors.textSubtle}>
                      🗑  Supprimer
                    </Text>
                  </Pressable>
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
  auto: {
    alignSelf: 'flex-start',
    // 44 px de haut : mesuré à 30, et c'est un bouton qu'un parent touche en
    // tenant son téléphone d'une main.
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
  },
  autoOn: { backgroundColor: colors.mintSoft },
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
  // Discret à l'œil, mais pas petit sous le doigt : mesuré à 26 px de haut.
  remove: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  avatars: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', flex: 1 },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
