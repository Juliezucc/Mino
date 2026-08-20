import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Avatar, Button, Card, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { ScreenTimeAuthorization, getScreenTimeService } from '@/services/screenTime';
import { useChildren } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

type Step = 'code' | 'profile' | 'shield';

/**
 * Setting up Mino on the child's device.
 *
 * Three steps, in the order they can actually be done: attach the device to the
 * family, say whose device it is, then hand the phone to a parent for the one
 * thing only a parent may authorise.
 *
 * The code alone is not enough to join. Four characters get read aloud across a
 * kitchen and written on a fridge; guessing one would put a stranger inside a
 * family with children in it. The parent's e-mail is asked for as a second
 * secret, and a mismatch never says which half was wrong.
 */
export default function JoinFamily() {
  const router = useRouter();
  const joinFamily = useMinoStore((s) => s.joinFamily);
  const selectChild = useMinoStore((s) => s.selectChild);
  const children = useChildren();
  const service = getScreenTimeService();

  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shield, setShield] = useState<ScreenTimeAuthorization | null>(null);

  const join = async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await joinFamily({ code, parentEmail: email });
      if (!ok) {
        // Deliberately vague: naming which half is wrong turns the pair into
        // two separate things to guess.
        setError('Le code et l’e-mail ne correspondent à aucune famille.');
        return;
      }
      setStep('profile');
    } catch {
      setError('Connexion impossible. Vérifiez le réseau et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const pickChild = (childId: string) => {
    selectChild(childId);
    setStep('shield');
  };

  const authorize = async () => {
    setLoading(true);
    try {
      const next = await service.requestAuthorization();
      setShield(next);
      if (next === 'approved') await service.chooseApps();
    } finally {
      setLoading(false);
    }
  };

  const finish = () => router.replace('/child');

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={styles.content}>
        <ScreenHeader onBack={step === 'code' ? () => router.back() : undefined} />

        <View style={styles.progress}>
          {(['code', 'profile', 'shield'] as Step[]).map((s) => (
            <View key={s} style={[styles.dot, step === s && styles.dotOn]} />
          ))}
        </View>

        {step === 'code' ? (
          <>
            <View style={styles.hero}>
              <Mascot expression="happy" size={120} />
              <Text variant="hero" center>
                Rejoindre ma famille
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                Demande les deux informations à ton parent. Elles sont dans son application, dans
                Réglages.
              </Text>
            </View>

            <Field
              label="Code famille"
              placeholder="MINO-7K2Q"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))}
            />
            <Field
              label="E-mail du parent"
              placeholder="parent@exemple.fr"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              error={error ?? undefined}
            />

            <Button
              label="CONTINUER"
              size="kid"
              onPress={join}
              loading={loading}
              disabled={code.length < 5 || !email.includes('@')}
            />

            <Card elevation="none" background={colors.surfaceMuted}>
              <Text variant="caption" color={colors.textMuted}>
                L’e-mail sert uniquement à vérifier que cet appareil rejoint la bonne famille. Ton
                parent reste le seul à avoir un compte.
              </Text>
            </Card>
          </>
        ) : step === 'profile' ? (
          <>
            <View style={styles.hero}>
              <Mascot expression="motivated" size={120} />
              <Text variant="hero" center>
                C’est l’appareil de qui ?
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                Choisis ton profil. Si vous partagez l’appareil, tu pourras en changer à chaque
                fois.
              </Text>
            </View>

            <View style={styles.children}>
              {children.map((child) => (
                <Pressable
                  key={child.id}
                  onPress={() => pickChild(child.id)}
                  accessibilityRole="button"
                  accessibilityLabel={child.firstName}
                  style={styles.childTile}
                >
                  <Avatar avatarKey={child.avatarKey} size={72} />
                  <Text variant="cardTitle">{child.firstName}</Text>
                </Pressable>
              ))}
            </View>

            <Button
              label="Appareil partagé"
              variant="secondary"
              onPress={() => setStep('shield')}
            />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Mascot expression={shield === 'approved' ? 'proud' : 'surprised'} size={120} />
              <Text variant="hero" center>
                {shield === 'approved'
                  ? 'Tout est prêt !'
                  : shield === null
                    ? 'Passe le téléphone à un parent'
                    : 'C’est noté'}
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                {shield === 'approved'
                  ? 'Les applications choisies s’ouvriront le temps que tu auras gagné.'
                  : shield === null
                    ? 'Dernière étape : un adulte autorise Mino à verrouiller les applications de cet appareil. C’est à faire une seule fois.'
                    : 'Tu peux commencer : tes missions et ton compteur fonctionnent déjà.'}
              </Text>
            </View>

            {shield === 'unsupported' ? (
              <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
                <Text variant="cardTitle">À régler dans le téléphone</Text>
                <Text variant="body" color={colors.textMuted}>
                  Cette version ne verrouille pas encore les applications elle-même. Un parent doit
                  poser la limite dans le contrôle parental de l’appareil — le guide, côté parent,
                  explique comment.
                </Text>
              </Card>
            ) : shield === 'denied' ? (
              <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
                <Text variant="cardTitle">Autorisation refusée</Text>
                <Text variant="body" color={colors.textMuted}>
                  Ce n’est pas grave : les missions et le compteur fonctionnent quand même. Un
                  parent pourra l’activer plus tard dans ses réglages.
                </Text>
              </Card>
            ) : shield === null ? (
              <Button label="AUTORISER MINO" icon="🔒" onPress={authorize} loading={loading} />
            ) : null}

            <Button
              label={shield === null ? 'Plus tard' : 'COMMENCER'}
              variant={shield === null ? 'secondary' : 'primary'}
              size={shield === null ? 'default' : 'kid'}
              onPress={finish}
            />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  progress: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  dot: { width: 28, height: 5, borderRadius: 3, backgroundColor: colors.surfaceSunken },
  dotOn: { backgroundColor: colors.blue },
  hero: { alignItems: 'center', gap: spacing.sm },
  block: { gap: spacing.sm },
  children: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  childTile: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
});
