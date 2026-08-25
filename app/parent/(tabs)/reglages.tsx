import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Logo, Screen, SectionHeader, Text } from '@/components/ui';
import { accessOf } from '@/domain/billing';
import { QUIET_FROM_HOUR, QUIET_UNTIL_HOUR } from '@/domain/notifications';
import { getNotificationService } from '@/services/notifications';
import { getScreenTimeService } from '@/services/screenTime';
import { useFamily, useParent } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing, tabBarSpace } from '@/theme';

export default function ParentSettings() {
  const router = useRouter();
  const parent = useParent();
  const data = useFamily();
  const repositoryName = useMinoStore((s) => s.repository.name);
  const lockParent = useMinoStore((s) => s.lockParent);
  const resetAll = useMinoStore((s) => s.resetAll);
  const startDemo = useMinoStore((s) => s.startDemo);
  const subscription = useMinoStore((s) => s.subscription);
  const notifications = useMinoStore((s) => s.notifications);
  const device = useMinoStore((s) => s.device);
  const lockDeviceTo = useMinoStore((s) => s.lockDeviceTo);
  const setNotifications = useMinoStore((s) => s.setNotificationPreferences);
  const notifier = getNotificationService();

  const capability = getScreenTimeService().capability;
  const access = accessOf(subscription);
  const accessLabel =
    access.kind === 'trial'
      ? `Essai gratuit · ${access.daysLeft} jour${access.daysLeft > 1 ? 's' : ''} restant${access.daysLeft > 1 ? 's' : ''}`
      : access.kind === 'active'
        ? access.cancelAtPeriodEnd
          ? 'Résilié · actif jusqu’à la fin de la période'
          : `Actif · formule ${subscription?.plan === 'yearly' ? 'annuelle' : 'mensuelle'}`
        : access.kind === 'grace'
          ? 'Paiement en attente'
          : 'Aucun abonnement actif';

  const confirmReset = () => {
    Alert.alert(
      'Réinitialiser Mino ?',
      'Toutes les données de la famille seront effacées de cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            await resetAll();
            router.replace('/welcome');
          },
        },
      ],
    );
  };

  const reloadDemo = () => {
    Alert.alert('Recharger la démo ?', 'Les données actuelles seront remplacées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Recharger',
        onPress: async () => {
          await startDemo();
          router.replace('/who');
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader title="Réglages" />

      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          COMPTE PARENT
        </Text>
        <Text variant="cardTitle">{parent?.displayName}</Text>
        <Text variant="body" color={colors.textMuted}>
          {parent?.email}
        </Text>
        <View style={styles.divider} />
        <Text variant="label" color={colors.textMuted}>
          CODE FAMILLE
        </Text>
        <Text variant="section" color={colors.blueInk}>
          {data?.family.code}
        </Text>
        <Text variant="caption" color={colors.textSubtle}>
          Ce code servira à connecter l’appareil d’un enfant à la famille.
        </Text>
        {/* La FAQ renvoie ici depuis deux réponses — « changer d'adresse » et
            « supprimer mon compte » — et l'a fait longtemps sans que l'écran
            existe. */}
        <Button
          label="Gérer mon compte"
          icon="👤"
          variant="secondary"
          onPress={() => router.push('/parent/compte')}
        />
      </Card>

      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          ABONNEMENT
        </Text>
        <Text variant="cardTitle">{accessLabel}</Text>
        <View style={styles.links}>
          <Button
            label="Gérer mon abonnement"
            variant="secondary"
            onPress={() => router.push('/parent/abonnement')}
          />
          <Button
            label="Parrainer une famille"
            icon="🎁"
            variant="secondary"
            onPress={() => router.push('/parent/parrainage')}
          />
        </View>
      </Card>

      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          NOTIFICATIONS
        </Text>
        {notifier.available ? (
          <>
            <View style={styles.row}>
              <Chip
                label="Mes alertes"
                icon={notifications.parents ? '🔔' : '🔕'}
                selected={notifications.parents}
                onPress={() => setNotifications({ parents: !notifications.parents })}
              />
              <Chip
                label="Alertes enfant"
                icon={notifications.child ? '🔔' : '🔕'}
                selected={notifications.child}
                onPress={() => setNotifications({ child: !notifications.child })}
              />
              <Chip
                label="Heures calmes"
                icon="🌙"
                selected={notifications.quietHours}
                onPress={() => setNotifications({ quietHours: !notifications.quietHours })}
              />
            </View>
            <Text variant="caption" color={colors.textSubtle}>
              {notifications.quietHours
                ? `Rien n’est envoyé entre ${QUIET_FROM_HOUR}h et ${QUIET_UNTIL_HOUR}h — sauf l’alerte « plus que 5 minutes », qui évite qu’un écran s’arrête sans prévenir.`
                : 'Les notifications peuvent arriver à toute heure, y compris le soir sur l’appareil de votre enfant.'}
            </Text>
            <Button
              label="Autoriser les notifications"
              variant="secondary"
              onPress={() => notifier.requestPermission().catch(() => undefined)}
            />
          </>
        ) : (
          <Text variant="body" color={colors.textMuted}>
            Les notifications ne fonctionnent pas dans cet aperçu. Elles arriveront sur l’application
            installée depuis l’App Store ou le Play Store.
          </Text>
        )}
      </Card>

      {/* Cet appareil-ci, pas les écrans de la maison.
          Le réglage vit sur le téléphone et non dans le compte : la tablette du
          salon et le téléphone de Noah appartiennent à la même famille et ne
          doivent pas se comporter pareil. */}
      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          CET APPAREIL
        </Text>
        <Text variant="body" color={colors.textMuted}>
          {device.lockedChildId
            ? `Réservé à ${(data?.children ?? []).find((c) => c.id === device.lockedChildId)?.firstName ?? 'un enfant'} : Mino s’ouvre directement sur son profil, et il faut votre code pour en changer.`
            : 'Partagé : Mino rouvre sur le dernier profil utilisé, et vos enfants peuvent en changer librement.'}
        </Text>
        <View style={styles.chips}>
          <Chip
            label="Partagé"
            icon="👨‍👩‍👧"
            selected={!device.lockedChildId}
            onPress={() => lockDeviceTo(null).catch(() => undefined)}
          />
          {(data?.children ?? []).map((child) => (
            <Chip
              key={child.id}
              label={`À ${child.firstName}`}
              icon="🔒"
              selected={device.lockedChildId === child.id}
              onPress={() => lockDeviceTo(child.id).catch(() => undefined)}
            />
          ))}
        </View>
        <Text variant="caption" color={colors.textSubtle}>
          Sur un appareil partagé, chacun voit les profils des autres et peut lancer leur temps
          d’écran. Réservez-le à un enfant si c’est son téléphone à lui.
        </Text>
      </Card>

      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          APPAREILS DE LA MAISON
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Console, télévision, ordinateur : déclarez-les pour que vos enfants puissent y échanger
          leur temps. Le fonctionnement automatique n’existe que sur un iPhone, un iPad ou un
          appareil Android où Mino est installé.
        </Text>
        <Button
          label="Gérer les appareils"
          icon="🎮"
          variant="secondary"
          onPress={() => router.push('/parent/appareils')}
        />
      </Card>

      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          TEMPS D’ÉCRAN
        </Text>
        <Text variant="body">
          {capability === 'timer-only'
            ? 'Mino compte les minos gagnés et les décompte pendant chaque session. Le blocage des autres applications est assuré par le contrôle parental de l’appareil — le guide explique comment le régler en cinq minutes.'
            : 'Mino verrouille lui-même les applications et lève le verrou le temps gagné.'}
        </Text>
        <Button
          label="Blocage des applications"
          icon="🔒"
          variant="secondary"
          onPress={() => router.push('/parent/blocage')}
        />
        {/* Le pendant du blocage : les moments où l'on ouvre sans faire gagner.
            Rangé ici plutôt qu'ailleurs parce qu'un parent qui vient régler le
            blocage est précisément celui qui pense « oui, mais le mercredi ». */}
        <Button
          label="Plages libres"
          icon="🗓️"
          variant="secondary"
          onPress={() => router.push('/parent/plages')}
        />
        <Text variant="caption" color={colors.textSubtle}>
        </Text>
      </Card>

      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          CONFIDENTIALITÉ
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Pas de géolocalisation, pas de publicité, pas de tracking marketing côté enfant, pas
          de messagerie entre personnes, pas de profil public. Les enfants d’une famille ne sont
          jamais visibles par une autre famille.
        </Text>
        <Text variant="caption" color={colors.textSubtle}>
          {`Stockage des données : ${repositoryName === 'local' ? 'appareil uniquement' : 'Supabase (RLS activée)'}`}
        </Text>
      </Card>

      <View style={styles.links}>
        <Button label="Guide de démarrage" icon="💡" variant="secondary" onPress={() => router.push('/aide')} />
        <Button
          label="Politique de confidentialité"
          variant="ghost"
          haptic={false}
          onPress={() => router.push('/legal/confidentialite')}
        />
        <Button
          label="Conditions générales"
          variant="ghost"
          haptic={false}
          onPress={() => router.push('/legal/cgv')}
        />
      </View>

      <View style={styles.actions}>
        <Button label="Verrouiller l’espace parent" variant="secondary" onPress={() => {
          lockParent();
          router.replace('/who');
        }} />
        <Button label="Recharger les données de démo" variant="secondary" onPress={reloadDemo} />
        <Button label="Réinitialiser l’application" variant="danger" onPress={confirmReset} />
      </View>

      <View style={styles.footer}>
        <Logo size={26} baseline />
        <Text variant="caption" color={colors.textSubtle}>
          Version 0.1.0 — MVP
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.lg },
  block: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    borderRadius: radii.pill,
  },
  actions: { gap: spacing.md },
  links: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },
});
