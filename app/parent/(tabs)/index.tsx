import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons/Icon';
import { Mascot } from '@/components/mascot';
import {
  Avatar,
  Button,
  Card,
  MinutesBadge,
  Screen,
  SectionHeader,
  Text,
  TimeCapsules,
} from '@/components/ui';
import { balanceDetail } from '@/domain/ledger';
import { RequestCard } from '@/features/parent/RequestCard';
import { HistoryList } from '@/features/history/HistoryList';
import { useChildren, useFamily, useParent, usePendingRequests } from '@/store/selectors';
import { colors, spacing, tabBarSpace } from '@/theme';

/** Parent dashboard: my children, and above all the requests waiting for me. */
export default function ParentHome() {
  const router = useRouter();
  const parent = useParent();
  const children = useChildren();
  const data = useFamily();
  const requests = usePendingRequests();

  if (!data) return null;

  const recent = [...data.transactions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text variant="hero">{`Bonjour ${parent?.displayName ?? ''} 👋`}</Text>
          <Text variant="body" color={colors.textMuted}>
            {requests.length > 0
              ? `${requests.length} demande${requests.length > 1 ? 's' : ''} à valider`
              : 'Tout est à jour, rien à valider.'}
          </Text>
        </View>
        <Mascot expression={requests.length > 0 ? 'motivated' : 'happy'} size={72} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Vue d’ensemble" />
        {children.length === 0 ? (
          <Card style={styles.emptyChildren}>
            <Text variant="body" color={colors.textMuted} center>
              Aucun profil enfant pour l’instant.
            </Text>
            <Button
              label="Créer un profil enfant"
              icon="＋"
              full={false}
              onPress={() => router.push('/parent/child-new')}
            />
          </Card>
        ) : (
          children.map((child) => {
            const balance = balanceDetail(data.transactions, child.id);
            return (
              <Card
                key={child.id}
                onPress={() =>
                  router.push({ pathname: '/parent/child/[id]', params: { id: child.id } })
                }
                accessibilityLabel={`${child.firstName}, ${balance.minutes} minutes disponibles`}
              >
                <View style={styles.childRow}>
                  <Avatar avatarKey={child.avatarKey} size={54} />
                  <View style={styles.childTexts}>
                    <Text variant="cardTitle">{child.firstName}</Text>
                    <Text variant="title" color={colors.blue}>
                      {`${balance.minutes}:00`}
                    </Text>
                    <Text variant="caption" color={colors.textMuted}>
                      min disponibles
                    </Text>
                    <TimeCapsules minutes={balance.minutes} compact maxCapsules={10} />
                  </View>
                  <Icon name="chevron-right" color={colors.textSubtle} />
                </View>
              </Card>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Demandes à valider"
          subtitle={requests.length > 0 ? 'Les minutes sont ajoutées immédiatement' : undefined}
        />
        {requests.length === 0 ? (
          <Card elevation="none" background={colors.surfaceMuted}>
            <Text variant="body" color={colors.textMuted} center>
              Aucune demande en attente.
            </Text>
          </Card>
        ) : (
          requests.map((completion) => (
            <RequestCard key={completion.id} completion={completion} />
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Historique"
          action={{ label: 'Voir tout', onPress: () => router.push('/parent/enfants') }}
        />
        <HistoryList transactions={recent} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTexts: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.md },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childTexts: { flex: 1, gap: 2 },
  emptyChildren: { alignItems: 'center', gap: spacing.md },
});
