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
 * The child is asked for the family code and nothing else. At eight years old
 * every extra field is a wall, and an e-mail typed on a phone is the tallest of
 * them. Proving that an adult is present happens at the third step, where the
 * system's own screen-time authorisation asks for the parent's account — far
 * better than a form could.
 *
 * The code therefore carries the whole weight of the pairing, which is why it
 * is six characters and why the backend rate-limits attempts.
 */
export default function JoinFamily() {
  const router = useRouter();
  const joinFamily = useMinoStore((s) => s.joinFamily);
  const selectChild = useMinoStore((s) => s.selectChild);
  const lockDeviceTo = useMinoStore((s) => s.lockDeviceTo);
  const children = useChildren();
  const service = getScreenTimeService();

  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shield, setShield] = useState<ScreenTimeAuthorization | null>(null);

  const join = async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await joinFamily({ code });
      if (!ok) {
        setError('Ce code ne correspond à aucune famille. Redemande-le à ton parent.');
        return;
      }
      setStep('profile');
    } catch (e) {
      // Le message porté par l'exception, quand il y en a un : il distingue
      // « le serveur ne répond pas » de « ce code est mauvais », et ces deux
      // phrases n'appellent pas du tout la même réaction — l'une envoie
      // chercher un parent, l'autre fait recopier un code déjà juste.
      const dit = e instanceof Error && e.message ? e.message : null;
      setError(dit ?? 'Connexion impossible. Vérifiez le réseau et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * « C'est l'appareil de qui ? » — et la réponse est appliquée.
   *
   * Elle ne l'était pas : choisir un enfant et choisir « Appareil partagé »
   * faisaient exactement la même chose, la question était posée pour rien. Or
   * c'est tout l'intérêt de cet écran — sur la tablette de Noah, Mino doit
   * rouvrir sur Noah, et changer de profil doit passer par le code parent.
   *
   * Le réglage reste modifiable dans Réglages : un enfant qui répondrait «
   * partagé » pour s'ouvrir les minos de son frère n'a rien gagné de
   * définitif, et un parent est de toute façon présent à l'étape suivante.
   */
  const pickChild = async (childId: string) => {
    selectChild(childId);
    await lockDeviceTo(childId).catch(() => undefined);
    setStep('shield');
  };

  const pickShared = async () => {
    await lockDeviceTo(null).catch(() => undefined);
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
                Demande le code à ton parent. Il est dans son application, dans Réglages.
              </Text>
            </View>

            <Field
              label="Code famille"
              placeholder="MINO-7K2QX9"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))}
              error={error ?? undefined}
            />

            <Button
              label="CONTINUER"
              size="kid"
              onPress={join}
              loading={loading}
              disabled={code.replace(/[^A-Z0-9]/g, '').length < 10}
            />

            <Card elevation="none" background={colors.surfaceMuted}>
              <Text variant="caption" color={colors.textMuted}>
                Tu n’as ni compte, ni mot de passe, ni adresse e-mail à donner. Ce code suffit.
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
                Si c’est ton appareil à toi, choisis-toi : Mino s’ouvrira toujours sur ton profil.
                Si vous êtes plusieurs dessus, choisis « Appareil partagé ».
              </Text>
            </View>

            <View style={styles.children}>
              {children.map((child) => (
                <Pressable
                  key={child.id}
                  onPress={() => {
                    pickChild(child.id).catch(() => undefined);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`C’est l’appareil de ${child.firstName}`}
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
              onPress={() => {
                pickShared().catch(() => undefined);
              }}
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
