import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { ScreenTimeAuthorization, getScreenTimeService } from '@/services/screenTime';
import { colors, radii, spacing } from '@/theme';

/**
 * Where a parent hands Mino the right to lock and unlock the apps.
 *
 * The screen exists in both worlds on purpose. With the native module, it asks
 * for the system authorisation and opens the app picker. Without it, it says so
 * plainly and explains the manual setup instead — never a button that pretends
 * to grant something it cannot.
 */
export default function ShieldSetup() {
  const service = getScreenTimeService();
  const router = useRouter();

  const [status, setStatus] = useState<ScreenTimeAuthorization>('not-determined');
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(await service.authorization());
    setCount((await service.selection()).count);
  }, [service]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const ask = async () => {
    setBusy(true);
    try {
      const next = await service.requestAuthorization();
      setStatus(next);
      if (next === 'approved') setCount((await service.chooseApps()).count);
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    setBusy(true);
    try {
      setCount((await service.chooseApps()).count);
    } finally {
      setBusy(false);
    }
  };

  const manual =
    Platform.OS === 'android'
      ? 'Application Family Link → votre enfant → Contrôles → Limites de temps par application.'
      : 'Réglages → Temps d’écran → Limites d’app, avec un code que votre enfant ne connaît pas.';

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} title="Blocage des applications" />

      <View style={styles.hero}>
        <Mascot expression={status === 'approved' ? 'proud' : 'motivated'} size={110} />
        <Text variant="hero" center>
          {status === 'approved'
            ? 'Le blocage est actif'
            : status === 'unsupported'
              ? 'Ce vers quoi nous allons'
              : 'Laisser Mino verrouiller les écrans'}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {status === 'unsupported'
            ? 'Le but de Mino : que les applications choisies restent verrouillées, et que le verrou se lève exactement le temps que votre enfant a gagné.'
            : 'Les applications choisies restent verrouillées, et Mino lève le verrou exactement le temps que votre enfant a gagné.'}
        </Text>
      </View>

      {status === 'unsupported' ? (
        <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
          <Text variant="cardTitle">Pas encore disponible sur cette version</Text>
          <Text variant="body" color={colors.textMuted}>
            Cette version de Mino compte le temps et le décompte, mais ne verrouille pas encore les
            applications elle-même. C’est ce que nous construisons, et cela demande une autorisation
            spécifique d’Apple et de Google.
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {`En attendant, réglez la limite dans le contrôle parental de l’appareil : ${manual}`}
          </Text>
          <Button
            label="Voir le guide"
            variant="secondary"
            onPress={() => router.push({ pathname: '/guide/[id]', params: { id: 'blocage' } })}
          />
        </Card>
      ) : status === 'approved' ? (
        <>
          <Card background={colors.mintSoft} elevation="none" style={styles.block}>
            <Text variant="cardTitle">
              {count > 0
                ? `${count} application${count > 1 ? 's' : ''} sous contrôle`
                : 'Aucune application sélectionnée'}
            </Text>
            <Text variant="body" color={colors.textMuted}>
              {count > 0
                ? 'Elles s’ouvrent uniquement pendant une session, et se reverrouillent toutes seules à la fin — même si Mino est fermé.'
                : 'Choisissez les applications que Mino doit verrouiller entre deux sessions.'}
            </Text>
            <Button label="Choisir les applications" variant="secondary" onPress={pick} loading={busy} />
          </Card>

          <Card elevation="none" background={colors.surfaceMuted} style={styles.block}>
            <Text variant="caption" color={colors.textMuted}>
              Mino ne sait pas lesquelles vous avez choisies : le système ne nous transmet qu’un
              nombre. Nous ne pouvons donc pas savoir ce que votre enfant utilise, et c’est très
              bien ainsi.
            </Text>
          </Card>
        </>
      ) : status === 'denied' ? (
        <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
          <Text variant="cardTitle">Autorisation refusée</Text>
          <Text variant="body" color={colors.textMuted}>
            Mino continue de fonctionner : les missions, le compteur et les demandes restent
            identiques. Seul le verrouillage automatique est désactivé.
          </Text>
          <Button
            label="Ouvrir les réglages du téléphone"
            variant="secondary"
            onPress={() => Linking.openSettings().catch(() => undefined)}
          />
        </Card>
      ) : (
        <>
          <View style={styles.steps}>
            {[
              'Vous autorisez Mino à gérer le temps d’écran de cet appareil.',
              'Vous choisissez les applications à encadrer, dans le sélecteur du système.',
              'Elles restent verrouillées, et s’ouvrent le temps que votre enfant a gagné.',
            ].map((step, index) => (
              <View key={step} style={styles.step}>
                <View style={styles.number}>
                  <Text variant="caption" color={colors.onBrand}>
                    {index + 1}
                  </Text>
                </View>
                <Text variant="body" color={colors.textMuted} style={styles.stepText}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
          <Button label="AUTORISER MINO" icon="🔒" onPress={ask} loading={busy} />
          <Text variant="caption" color={colors.textSubtle} center>
            À faire sur l’appareil de votre enfant, une seule fois.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  block: { gap: spacing.md },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  number: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepText: { flex: 1 },
});
