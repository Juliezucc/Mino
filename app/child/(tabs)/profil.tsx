import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { AVATARS, Avatar, Button, Card, MinutesBadge, Screen, SectionHeader, Text } from '@/components/ui';
import { unitOf } from '@/domain/ageBand';
import { HistoryList } from '@/features/history/HistoryList';
import { useActiveChild, useBalanceDetail, useFamily, useHistory } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
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
  const editChild = useMinoStore((s) => s.editChild);

  if (!child || !balance || !data) return null;

  const unit = unitOf(child);

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
          <MinutesBadge minutes={balance.minutes} tone="blue" signed={false} unit={unit} />
          <MinutesBadge minutes={balance.earnedToday} tone="mint" unit={unit} />
        </View>
        <Text variant="caption" color={colors.textSubtle} center>
          {`${approved} mission${approved > 1 ? 's' : ''} accomplie${approved > 1 ? 's' : ''} au total`}
        </Text>
      </Card>

      {/* Mino est là même quand il reste des minos.
          Le bouton visible sur l'écran « plus de temps » reste le moment fort —
          c'est là que Mino prend tout son sens. Mais le réserver à ce seul
          instant le rendait introuvable : un enfant qui a envie de parler à son
          personnage ne devrait pas avoir à dépenser son temps d'écran d'abord.
          Le budget quotidien ne change pas, donc le coût non plus. */}
      {child.companionEnabled === false ? null : (
        <Card style={styles.talk} background={colors.blueSoft} elevation="none">
          <Mascot expression="happy" size={56} />
          <View style={styles.talkText}>
            <Text variant="cardTitle">Parler à Mino</Text>
            <Text variant="caption" color={colors.textMuted}>
              Il est là même quand tu n’as plus de temps d’écran.
            </Text>
          </View>
          <Button
            label="DISCUTER"
            size="kid"
            full={false}
            onPress={() => router.push('/child/mino')}
          />
        </Card>
      )}

      <View style={styles.section}>
        <SectionHeader title="Mon personnage" subtitle="Touche pour en changer" />
        <View style={styles.avatars}>
          {AVATARS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => editChild(child.id, { avatarKey: item.key }).catch(() => undefined)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: child.avatarKey === item.key }}
            >
              <Avatar avatarKey={item.key} size={64} selected={child.avatarKey === item.key} />
            </Pressable>
          ))}
        </View>
      </View>

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
        <SectionHeader title="Mon historique" subtitle={unit === 'minos' ? 'Chaque mino gagné ou utilisé' : 'Chaque minute gagnée ou utilisée'} />
        <HistoryList transactions={history} limit={12} unit={unit} />
      </View>

      {/**
       * Deux sorties, et surtout pas une seule.
       *
       * Il n'y en avait qu'une, « Changer de profil », qui menait au sélecteur
       * — et sur un appareil réservé à un enfant, elle passait d'abord par le
       * code parent. D'où la scène absurde qu'on a vue à l'usage : le parent
       * tape son code pour arriver au sélecteur, puis touche « Espace parent »,
       * et on lui redemande le même code aussitôt. Le sélecteur reverrouille
       * l'espace parent en s'ouvrant — à juste titre — donc le premier code
       * n'ouvrait rien du tout. Il ne servait qu'à passer une porte.
       *
       * Alors on nomme les deux destinations pour ce qu'elles sont :
       *
       *   • **d'un enfant à l'autre** : jamais de code. C'est un changement de
       *     profil, pas un accès aux réglages.
       *   • **vers l'espace parent** : le code, une fois, et on y arrive.
       */}
      {/* Sur l'appareil réservé à un enfant, le sélecteur demandera le code
          pour ouvrir un AUTRE profil — c'est lui qui pose la question, pas ce
          bouton : on ne ferme pas la porte à celui qui revient chez lui. */}
      <Button
        label="Changer de profil"
        icon="👥"
        size="kid"
        variant="secondary"
        onPress={() => router.replace('/who')}
      />

      <Button
        label="Espace parent"
        icon="🔒"
        variant="ghost"
        onPress={() => router.push('/parent-pin')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.xl },
  talk: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  talkText: { flex: 1, gap: 2 },
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  identityStats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  section: { gap: spacing.md },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
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
