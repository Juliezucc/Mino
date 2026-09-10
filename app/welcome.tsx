import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AnimatedMascot } from '@/components/mascot';
import { Button, Logo, Screen, Text } from '@/components/ui';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/** Le drapeau que pose `scripts/capture-store.mjs`, et personne d'autre. */
const DEMO_FLAG = 'mino.captures.demo';

const STEPS = [
  { icon: '📋', title: 'Je fais', text: 'mes missions' },
  { icon: '⏱️', title: 'Je gagne', text: 'du temps' },
  { icon: '🎮', title: 'Je profite', text: 'de mes écrans' },
];

export default function Welcome() {
  const router = useRouter();
  const startDemo = useMinoStore((s) => s.startDemo);
  const repositoryName = useMinoStore((s) => s.repository.name);

  /**
   * La porte d'entrée de la famille de démonstration, et elle n'est pas pour
   * les visiteurs.
   *
   * **Pourquoi elle existe.** Les captures des boutiques sont photographiées
   * en conduisant la vraie application (`scripts/capture-store.mjs`), et les
   * huit écrans qu'elles montrent supposent une famille déjà vivante : Noah
   * avec ses trente-cinq minos, une mission qui attend d'être confirmée, une
   * sœur, un historique. Un bouton « Découvrir avec la démo » le faisait, et
   * il a été retiré de l'accueil — à raison, il embrouillait des parents qui
   * venaient créer leur famille. Sans remplaçant, les captures ne se refont
   * plus, et une boutique finit par montrer une version de l'application qui
   * n'existe plus.
   *
   * **Pourquoi elle est sans danger.** Elle ne s'ouvre que là où le dépôt est
   * `local` — c'est-à-dire sans clés Supabase, donc jamais sur
   * `app.minoapp.fr` ni dans les applications publiées, où le dépôt est
   * `supabase`. Elle ne crée rien côté serveur, ne franchit aucun paiement,
   * et n'écrit que dans le navigateur qui la demande.
   *
   * **Pourquoi un drapeau de stockage et non un paramètre d'adresse.** C'était
   * `?demo=1` dans un premier temps, et expo-router réécrit l'adresse en
   * `/welcome` avant que cet écran ne soit monté : la question avait disparu
   * quand on la posait. Le stockage local, lui, survit à la redirection.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || repositoryName !== 'local') return;
    let demande = false;
    try {
      demande = globalThis.localStorage?.getItem(DEMO_FLAG) === '1';
    } catch {
      // Navigation privée, stockage refusé : il n'y a alors pas de captures à
      // prendre, et l'accueil ordinaire est la bonne réponse.
    }
    if (!demande) return;
    startDemo()
      .then(() => router.replace('/who'))
      .catch(() => undefined);
  }, [repositoryName, router, startDemo]);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Logo size={44} />
        <Text variant="hero" style={styles.claim}>
          Grandir,{'\n'}une mission à la fois.
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Mino accompagne les enfants au quotidien pour transformer leurs efforts en temps d’écran,
          simplement et positivement.
        </Text>
      </View>

      <AnimatedMascot expression="happy" size={190} style={styles.mascot} />

      <View style={styles.steps}>
        {STEPS.map((step) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.stepIcon}>
              <Text style={styles.emoji}>{step.icon}</Text>
            </View>
            <View>
              <Text variant="bodyStrong">{step.title}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {step.text}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {/**
          * `replace` et non `push`, et c'est le correctif d'un défaut qui
          * coûtait la famille entière.
          *
          * L'inscription enchaîne ensuite tous ses écrans en `replace` — voulu :
          * on ne revient pas en arrière dans une inscription. Mais cette
          * première marche-ci était un `push`, si bien que l'accueil restait au
          * fond de la pile pendant toute l'inscription et jusque dans l'espace
          * parent. La flèche « retour » du dernier écran trouvait donc quelque
          * chose à dépiler, et ce quelque chose était « Créer ma famille » :
          * un parent qui venait de créer la sienne, de payer, et de réserver la
          * tablette à son enfant se retrouvait devant l'écran qui lui annonce
          * qu'il n'a pas de compte. Vu de sa place, Mino l'avait déconnecté.
          */}
        <Button
          label="Créer ma famille"
          variant="secondary"
          onPress={() => router.replace('/onboarding/child')}
        />
        <Button label="J’ai déjà un compte" variant="ghost" onPress={() => router.push('/login')} />
        {/* The child's own device starts here, and nowhere else: joining is
            what an eight-year-old does on the phone they were just handed. */}
        <Button
          label="J’ai un code famille"
          icon="🔑"
          variant="ghost"
          onPress={() => router.push('/join')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl, gap: spacing.xl },
  header: { gap: spacing.md },
  claim: { marginTop: spacing.sm },
  mascot: { alignSelf: 'center' },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  actions: { gap: spacing.md },
});
