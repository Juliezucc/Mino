import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Avatar, Button, Card, Screen, Text } from '@/components/ui';
import { useChildren } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * À qui est cet appareil — la question qu'on ne posait jamais.
 *
 * L'inscription se terminait sur le tableau de bord parent, et le parent devait
 * trouver seul le chemin vers Réglages → Blocage des applications. Personne ne
 * le fait. On installe un contrôle parental et on repart avec une application
 * qui compte des minutes sans rien bloquer — c'est-à-dire sans le produit.
 *
 * **Pourquoi cette question-ci, et à ce moment-là.** Parce que la réponse
 * change tout ce qui suit, et qu'elle ne se devine pas :
 *
 * — sur le téléphone d'un enfant, il faut poser le bouclier ICI, tout de
 *   suite, et l'appareil doit se rouvrir sur lui sans jamais rien demander ;
 * — sur celui du parent, il n'y a rien à bloquer : le bouclier ira sur
 *   l'appareil de l'enfant, avec le code famille, et c'est ce qu'il faut dire ;
 * — sur une tablette partagée, on bloque aussi, mais l'appareil doit rouvrir
 *   sur le dernier profil utilisé plutôt que d'appartenir à quelqu'un.
 *
 * Poser la question plus tard reviendrait à la poser à quelqu'un qui a déjà
 * rangé son téléphone.
 */
export default function OnboardingAppareil() {
  const router = useRouter();
  const enfants = useChildren();
  const lockDeviceTo = useMinoStore((s) => s.lockDeviceTo);
  const [busy, setBusy] = useState(false);

  const choisir = async (childId: string | null, versLeBlocage: boolean) => {
    setBusy(true);
    await lockDeviceTo(childId).catch(() => undefined);
    setBusy(false);
    // Le blocage enchaîne directement : c'est la seule étape qui fait de Mino
    // un contrôle parental, et la seule qu'on ne peut pas faire à la place du
    // parent. Sur son propre téléphone, il n'y a rien à bloquer — on l'envoie
    // là où l'installation continue vraiment.
    router.replace(versLeBlocage ? '/parent/blocage' : '/parent');
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Mascot expression="motivated" size={110} />
        <Text variant="hero" center>
          À qui est cet appareil ?
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Mino ne se règle pas pareil selon la réponse. Vous pourrez en changer à tout moment.
        </Text>
      </View>

      {enfants.map((enfant) => (
        <Card key={enfant.id} onPress={busy ? undefined : () => choisir(enfant.id, true)}>
          <View style={styles.ligne}>
            <Avatar avatarKey={enfant.avatarKey} size={54} />
            <View style={styles.textes}>
              <Text variant="cardTitle">{`Il est à ${enfant.firstName}`}</Text>
              <Text variant="caption" color={colors.textMuted}>
                Mino s’ouvrira toujours sur son profil, et nous allons régler le blocage
                maintenant.
              </Text>
            </View>
          </View>
        </Card>
      ))}

      <Card onPress={busy ? undefined : () => choisir(null, true)}>
        <View style={styles.ligne}>
          <Text variant="hero">🏠</Text>
          <View style={styles.textes}>
            <Text variant="cardTitle">Il est partagé à la maison</Text>
            <Text variant="caption" color={colors.textMuted}>
              La tablette du salon, par exemple. Elle rouvre sur le dernier profil utilisé, et nous
              réglons le blocage maintenant.
            </Text>
          </View>
        </View>
      </Card>

      <Card onPress={busy ? undefined : () => choisir(null, false)}>
        <View style={styles.ligne}>
          <Text variant="hero">📱</Text>
          <View style={styles.textes}>
            <Text variant="cardTitle">C’est mon téléphone à moi</Text>
            <Text variant="caption" color={colors.textMuted}>
              Rien à bloquer ici. Le blocage se règle sur l’appareil de votre enfant, avec le code
              famille — nous vous y conduirons.
            </Text>
          </View>
        </View>
      </Card>

      {/* Sauter est possible, et le dire l'est aussi : un parent pressé qui ne
          trouve pas d'issue referme l'application, et on a perdu l'installation
          au lieu de la retarder. */}
      <Button
        label="Plus tard"
        variant="ghost"
        haptic={false}
        onPress={() => router.replace('/parent')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  ligne: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  textes: { flex: 1, gap: spacing.xs },
});
