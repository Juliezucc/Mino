import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
import { choixEnregistre } from '@/data/deviceProfile';
import { balanceDetail } from '@/domain/ledger';
import { isFirstRun } from '@/domain/firstRun';
import { accessOf } from '@/domain/billing';
import { AccessBanner } from '@/features/parent/AccessBanner';
import { BouclierBanner } from '@/features/parent/BouclierBanner';
import { CodeParentBanner } from '@/features/parent/CodeParentBanner';
import { NotificationsBanner } from '@/features/parent/NotificationsBanner';
import { FirstStepCard } from '@/features/parent/FirstStepCard';
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
  const subscription = useMinoStore((s) => s.subscription);
  const device = useMinoStore((s) => s.device);

  if (!data) return null;

  // A console request and a mission waiting for approval are both "something
  // needs me", and a parent should not have to look in two places for them.
  const waiting = requests.length + screenRequests.length;

  const recent = [...data.transactions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const firstStep = isFirstRun(data);
  // « Cet appareil est à Manon », répondu par le parent — voir `ChoixDAppareil`.
  const appareilDeLEnfant = choixEnregistre(device).kind === 'enfant';
  const access = accessOf(subscription);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text variant="hero">{`Bonjour ${parent?.displayName ?? ''} 👋`}</Text>
          <Text variant="body" color={colors.textMuted}>
            {waiting > 0
              ? `${waiting} demande${waiting > 1 ? 's' : ''} vous attend${waiting > 1 ? 'ent' : ''}`
              : // « Tout est à jour » à quelqu'un dont rien n'a encore eu lieu
                // sonne faux : il n'y a rien à jour, il y a tout à commencer.
                firstStep
                ? 'Votre famille est prête.'
                : 'Tout est à jour.'}
          </Text>
        </View>
        {/* ------------------------------------------- revenir chez l'enfant

            La seule sortie de l'espace parent vivait dans Réglages, sous deux
            écrans. Un parent qui vient de valider une mission veut rendre le
            téléphone à son enfant, tout de suite — et ne trouvant rien, il
            ferme l'application. C'est ce qui a été observé.

            La mascotte est le seul élément fixe de cet en-tête : elle devient
            le chemin du retour. Le mot sous elle n'est pas décoratif — sans
            lui, personne ne devine qu'un dessin se touche.                  */}
        <Pressable
          onPress={() => router.replace('/who')}
          accessibilityRole="button"
          accessibilityLabel="Changer de profil, quitter l’espace parent"
          style={({ pressed }) => [styles.sortie, pressed && styles.presse]}
          hitSlop={8}
        >
          <Mascot expression={waiting > 0 ? 'motivated' : 'happy'} size={72} />
          <Text variant="caption" color={colors.textMuted} center>
            Changer de profil
          </Text>
        </Pressable>
      </View>

      {/* Un verrou qu'on découvre en appuyant sur un bouton met en colère :
          celui-là s'annonce ici, avant de gêner. */}
      <AccessBanner access={access} connu={subscription !== null} />

      {/* Avant le bouclier, et volontairement : un espace parent sans serrure
          s'ouvre à l'enfant tout de suite, et se répare en dix secondes. Le
          blocage, lui, demande de traverser les réglages du système. */}
      <CodeParentBanner />

      {/* Le blocage est le produit. Tant qu'il n'est pas actif sur cet
          appareil-ci — et tant que le parent n'a pas dit qu'il n'en voulait
          pas — il faut le dire ici, là où il regarde de toute façon. */}
      <BouclierBanner />

      {/* La boucle ne tient que si les deux bouts l'entendent. Sans permission,
          l'appareil est injoignable pour toujours — et iOS ne pose la question
          que si on la lui demande. */}
      <NotificationsBanner />

      {/* Avant la première minute gagnée, la seule chose utile à dire est ce
          qui vient après. Voir `FirstStepCard`.

          **Mais pas en tête sur l'appareil de l'enfant.** Le parent qui ouvre
          son espace depuis la tablette de Manon n'y vient pas pour qu'on lui
          propose, en pleine largeur, de repasser à Manon : l'application y
          rouvre d'elle-même sur elle. Il vient voir où en est sa famille. La
          carte descend donc sous « Vue d'ensemble », qui prend sa place. */}
      {firstStep && !appareilDeLEnfant ? (
        <FirstStepCard enfants={children} familyCode={data.family.code} />
      ) : null}

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
                    <Text variant="title" color={colors.blueInk}>
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

      {/* La même carte, en second, quand on est sur l'appareil de l'enfant :
          ce qu'il reste à faire garde sa place, mais après ce que le parent
          est venu voir. */}
      {firstStep && appareilDeLEnfant ? (
        <FirstStepCard enfants={children} familyCode={data.family.code} appareilDeLEnfant />
      ) : null}

      {runningSessions.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Écrans en cours"
            subtitle="Le compte à rebours tourne aussi côté enfant"
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

      {/* Le premier jour, ces deux sections ne diraient que « rien », deux fois
          de plus, sous une carte qui vient de le dire mieux. */}
      {firstStep ? null : (
        <View style={styles.section}>
          <SectionHeader
            // « à valider » jugeait la mission — ranger sa chambre n'est pas
            // une demande qu'on approuve. Ce qui attend ici, c'est un enfant.
            title="En attente de vous"
            // La section mélange deux choses : une mission à confirmer, qui
            // AJOUTE des minutes, et une demande d'écran, qui en DÉPENSE.
            // Promettre « les minutes sont ajoutées » au-dessus d'un bouton
            // « LANCER 20 MIN » disait le contraire de ce qui allait se passer.
            subtitle={
              requests.length > 0 && screenRequests.length === 0
                ? 'Les minutes sont ajoutées immédiatement'
                : screenRequests.length > 0 && requests.length === 0
                  ? 'Le minuteur démarre dès que vous lancez'
                  : undefined
            }
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
      )}

      {firstStep ? null : (
        <View style={styles.section}>
          <SectionHeader
            title="Historique"
            action={{ label: 'Voir tout', onPress: () => router.push('/parent/enfants') }}
          />
          <HistoryList transactions={recent} attributeTo={children} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sortie: { alignItems: 'center', gap: spacing.xs, maxWidth: 96 },
  presse: { opacity: 0.7 },
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTexts: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.md },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childTexts: { flex: 1, gap: 2 },
  emptyChildren: { alignItems: 'center', gap: spacing.md },
});
