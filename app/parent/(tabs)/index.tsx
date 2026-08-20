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
import { ScreenRequestCard } from '@/features/parent/ScreenRequestCard';
import { HistoryList } from '@/features/history/HistoryList';
import {
  useChildren,
  useFamily,
  useParent,
  usePendingRequests,
  useRunningSessions,
  useScreenRequests,
} from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing, tabBarSpace } from '@/theme';

/** Parent dashboard: my children, and above all the requests waiting for me. */
export default function ParentHome() {
  const router = useRouter();
  const parent = useParent();
  const children = useChildren();
  const data = useFamily();
  const requests = usePendingRequests();
  const screenRequests = useScreenRequests();
  const runningSessions = useRunningSessions();
  const approveSession = useMinoStore((s) => s.approveSession);
  const refuseSession = useMinoStore((s) => s.refuseSession);
  const endSession = useMinoStore((s) => s.endSession);

  if (!data) return null;

  // A console request and a mission waiting for approval are both "something
  // needs me", and a parent should not have to look in two places for them.
  const waiting = requests.length + screenRequests.length;

  const recent = [...data.transactions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text variant="hero">{`Bonjour ${parent?.displayName ?? ''} 👋`}</Text>
          <Text variant="body" color={colors.textMuted}>
            {waiting > 0
              ? `${waiting} demande${waiting > 1 ? 's' : ''} vous attend${waiting > 1 ? 'ent' : ''}`
              : 'Tout est à jour.'}
          </Text>
        </View>
        <Mascot expression={waiting > 0 ? 'motivated' : 'happy'} size={72} />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Vue d’ensemble"
          action={
            children.length > 0
              ? { label: '🎁 Bonus', onPress: () => router.push('/parent/bonus') }
              : undefined
          }
        />
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

      {runningSessions.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Écrans en cours"
            subtitle="Le compte à rebours tourne aussi chez votre enfant"
          />
          {runningSessions.map((session) => {
            const child = children.find((c) => c.id === session.childId);
            if (!child) return null;
            return (
              <ScreenRequestCard
                key={session.id}
                session={session}
                child={child}
                devices={data.devices}
                onStop={() => endSession(session.id, 'stopped').catch(() => undefined)}
                onBonus={() =>
                  router.push({ pathname: '/parent/bonus', params: { childId: session.childId } })
                }
              />
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          // « à valider » jugeait la mission — ranger sa chambre n'est pas une
          // demande qu'on approuve. Ce qui attend ici, c'est un enfant.
          title="En attente de vous"
          subtitle={waiting > 0 ? 'Les minutes sont ajoutées immédiatement' : undefined}
        />
        {waiting === 0 ? (
          <Card elevation="none" background={colors.surfaceMuted}>
            <Text variant="body" color={colors.textMuted} center>
              Aucune demande en attente.
            </Text>
          </Card>
        ) : (
          <>
            {screenRequests.map((session) => {
              const child = children.find((c) => c.id === session.childId);
              if (!child) return null;
              return (
                <ScreenRequestCard
                  key={session.id}
                  session={session}
                  child={child}
                  devices={data.devices}
                  onApprove={() => approveSession(session.id).catch(() => undefined)}
                  onRefuse={() => refuseSession(session.id).catch(() => undefined)}
                />
              );
            })}
            {requests.map((completion) => (
              <RequestCard key={completion.id} completion={completion} />
            ))}
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Historique"
          action={{ label: 'Voir tout', onPress: () => router.push('/parent/enfants') }}
        />
        <HistoryList transactions={recent} attributeTo={children} />
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
