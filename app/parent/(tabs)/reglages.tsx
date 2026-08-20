import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, Logo, Screen, SectionHeader, Text } from '@/components/ui';
import { accessOf } from '@/domain/billing';
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
        <Text variant="section" color={colors.blue}>
          {data?.family.code}
        </Text>
        <Text variant="caption" color={colors.textSubtle}>
          Ce code servira à connecter l’appareil d’un enfant à la famille.
        </Text>
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
          TEMPS D’ÉCRAN
        </Text>
        <Text variant="body">
          {capability === 'timer-only'
            ? 'Cette version mesure le temps avec un minuteur dans l’application. Le blocage réel des applications arrivera via les APIs de contrôle parental iOS et Android.'
            : 'Le blocage des applications est géré par le système.'}
        </Text>
      </Card>

      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          CONFIDENTIALITÉ
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Pas de géolocalisation, pas de publicité, pas de tracking marketing côté enfant, pas de
          chat, pas de profil public. Les enfants d’une famille ne sont jamais visibles par une
          autre famille.
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    borderRadius: radii.pill,
  },
  actions: { gap: spacing.md },
  links: { gap: spacing.sm },
  footer: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },
});
