import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Screen, Text } from '@/components/ui';
import { getAuthService } from '@/services/auth';
import { dernierLien, oublierLien } from '@/services/auth/lienEntrant';
import { colors, spacing } from '@/theme';

/**
 * Le bout du lien de confirmation.
 *
 * Sans cet écran, le lien reçu par e-mail retombait sur l'« URL du site » du
 * projet Supabase, c'est-à-dire sur l'accueil de Mino — et le parent y
 * trouvait quatre boutons : découvrir la démo, créer un compte parent (qu'il
 * venait de créer), j'ai déjà un compte, j'ai un code famille. Aucun ne
 * correspondait à ce qu'il venait de faire, et le seul juste — se connecter —
 * lui demandait de retaper ce qu'il venait de taper.
 *
 * Le lien de Supabase porte pourtant une session complète dans son fragment
 * (`#access_token=…`). Le client est créé avec `detectSessionInUrl: false` :
 * en React Native il n'y a pas de barre d'adresse, donc rien ne se consomme
 * tout seul, et c'est cet écran qui l'ouvre. Le parent arrive donc connecté,
 * et va droit à la seule chose qui lui reste à faire : sa famille.
 *
 * Quand le lien a expiré, ou quand il a déjà été utilisé, on ne s'acharne
 * pas : la connexion ordinaire marche, et c'est ce qu'on propose.
 */
export default function Confirme() {
  const router = useRouter();
  // `useURL()` seul ne suffit pas : quand Mino est déjà ouvert, l'adresse
  // arrive AVANT que cet écran ne soit monté, et le crochet la manque. Voir
  // `lienEntrant`, qui écoute dès le chargement du paquet.
  const vu = Linking.useURL();
  const url = vu ?? dernierLien();
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;

    // Aucun lien, nulle part : il n'y a rien à consommer, et attendre
    // indéfiniment sous « un instant… » est la pire des réponses.
    if (!url) {
      setErreur('Ce lien est incomplet. Demandez-en un nouveau depuis la connexion.');
      return;
    }

    getAuthService()
      .resumeFromLink(url)
      .then((r) => {
        if (!vivant) return;
        oublierLien();
        // `replace` et non `push` : revenir en arrière sur un lien déjà
        // consommé ne mène nulle part.
        if (r.ok) router.replace('/onboarding/account');
        else setErreur(r.reason ?? 'Ce lien n’est plus valable.');
      })
      .catch(() => vivant && setErreur('Ce lien n’est plus valable.'));
    return () => {
      vivant = false;
    };
  }, [url, router]);

  return (
    <Screen contentStyle={styles.centre}>
      <Mascot expression={erreur ? 'worried' : 'happy'} size={140} />
      <Text variant="hero" center>
        {erreur ? 'Ce lien a expiré' : 'Adresse confirmée'}
      </Text>
      <Text variant="body" color={colors.textMuted} center>
        {erreur ?? 'Un instant, nous ouvrons votre espace parent…'}
      </Text>
      {erreur ? <Button label="Se connecter" onPress={() => router.replace('/login')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
});
