import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, MinutesBadge, Screen, SectionHeader, Text } from '@/components/ui';
import { HistoryList } from '@/features/history/HistoryList';
import { useActiveChild, useBalanceDetail, useFamily, useHistory } from '@/store/selectors';
import { colors, radii, spacing, tabBarSpace } from '@/theme';

/** Badges are recognition only — no levels, no currency, nothing to manage. */
const BADGES = [
  { key: 'debutant', icon: '⭐', label: 'Débutant', at: 1 },
  { key: 'perseverant', icon: '⚡', label: 'Persévérant', at: 5 },
  { key: 'organise', icon: '🗓️', label: 'Organisé', at: 10 },
  { key: 'top', icon: '🏆', label: 'Top !', at: 20 },
  { key: 'responsable', icon: '🛡️', label: 'Responsable', at: 35 },
  { key: 'champion', icon: '🥇', label: 'Champion', at: 50 },
];

export default function ChildProfile() {
  const router = useRouter();
  const child = useActiveChild();
  const data = useFamily();
  const balance = useBalanceDetail(child?.id);
  const history = useHistory(child?.id);

  if (!child || !balance || !data) return null;

  const approved = data.completions.filter(
    (c) => c.childId === child.id && c.status === 'approved',
  ).length;

  return (
    <Screen contentStyle={styles.content}>
      <Card style={styles.identity}>
        <Avatar avatarKey={child.avatarKey} size={92} />
        <Text variant="title">{child.firstName}</Text>
        <Text variant="body" color={colors.textMuted}>
          {`${child.age} ans`}
        </Text>
        <View style={styles.identityStats}>
          <MinutesBadge minutes={balance.minutes} tone="blue" signed={false} />
          <MinutesBadge minutes={balance.earnedToday} tone="mint" />
        </View>
        <Text variant="caption" color={colors.textSubtle} center>
          {`${approved} mission${approved > 1 ? 's' : ''} validée${approved > 1 ? 's' : ''} au total`}
        </Text>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Mes badges" />
        <View style={styles.badges}>
          {BADGES.map((badge) => {
            const unlocked = approved >= badge.at;
            return (
              <View key={badge.key} style={[styles.badge, !unlocked && styles.badgeLocked]}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                <Text variant="caption" color={unlocked ? colors.text : colors.textSubtle} center>
                  {badge.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Mon historique" subtitle="Chaque minute gagnée ou utilisée" />
        <HistoryList transactions={history} limit={12} />
      </View>

      <Button label="Changer de profil" variant="secondary" onPress={() => router.replace('/who')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.xl },
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  identityStats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  section: { gap: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  badge: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  badgeLocked: { opacity: 0.4 },
  badgeIcon: { fontSize: 28 },
});
