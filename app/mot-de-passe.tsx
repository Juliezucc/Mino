import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { getAuthService } from '@/services/auth';
import { colors, spacing } from '@/theme';

/**
 * Choisir un nouveau mot de passe, au bout du lien reçu par e-mail.
 *
 * Cet écran n'existait pas, et c'est ce qui rendait la réinitialisation
 * complètement inutile : `resetPasswordForEmail` partait sans `redirectTo`, le
 * lien menait à l'« URL du site » du projet Supabase — `http://localhost:3000`
 * par défaut — et le parent n'avait aucun moyen de reprendre la main sur son
 * compte. Il recevait un e-mail, cliquait, et tombait dans le vide.
 *
 * Comment on arrive ici : le lien ouvre `mino://mot-de-passe#access_token=…`,
 * expo-router route sur ce fichier, et c'est CET ÉCRAN qui ouvre la session à
 * partir du fragment. Le client Supabase est créé avec
 * `detectSessionInUrl: false` — en React Native il n'y a pas de barre
 * d'adresse, donc rien ne se consomme tout seul. Sans le `resumeFromLink`
 * ci-dessous, on demanderait un nouveau mot de passe sans avoir le droit de le
 * poser sur personne.
 *
 * Deux précautions, et elles se ressemblent : on ne dit jamais si l'adresse
 * existe, et on ne dit jamais pourquoi un lien a échoué au-delà de « il a
 * expiré ». Un lien de récupération est une clé ; ce qu'on en dit doit être
 * aussi avare que ce qu'on dit d'une clé.
 */
export default function NouveauMotDePasse() {
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [pret, setPret] = useState(false);
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;
    let vivant = true;
    getAuthService()
      .resumeFromLink(url)
      .then((r) => {
        if (!vivant) return;
        if (r.ok) setPret(true);
        else setErreur(r.reason ?? 'Ce lien n’est plus valable.');
      })
      .catch(() => vivant && setErreur('Ce lien n’est plus valable.'));
    return () => {
      vivant = false;
    };
  }, [url]);

  const valider = async () => {
    if (motDePasse.length < 8) return setErreur('Au moins 8 caractères.');
    setErreur(null);
    setEnvoi(true);
    const resultat = await getAuthService().setPassword(motDePasse);
    setEnvoi(false);

    if (!resultat.ok) {
      // Le cas courant n'est pas une faute de frappe : c'est un lien ouvert
      // trop tard. On le dit, et on renvoie vers la seule action utile.
      return setErreur(
        resultat.reason ?? 'Ce lien n’est plus valable. Demandez-en un nouveau depuis la connexion.',
      );
    }
    setFait(true);
  };

  if (fait) {
    return (
      <Screen contentStyle={styles.centre}>
        <Mascot expression="proud" size={140} />
        <Text variant="hero" center>
          C’est reparti
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Votre nouveau mot de passe est enregistré.
        </Text>
        <Button label="Continuer" onPress={() => router.replace('/who')} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={styles.content}>
        <ScreenHeader onBack={() => router.replace('/login')} />

        <View style={styles.head}>
          <Text variant="hero" center>
            Nouveau mot de passe
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Choisissez-en un que vous retiendrez. Il ne protège pas seulement
            votre compte : il protège les profils de vos enfants.
          </Text>
        </View>

        <Field
          label="Nouveau mot de passe"
          value={motDePasse}
          onChangeText={setMotDePasse}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={erreur ?? undefined}
        />

        {/* Tant que la session du lien n'est pas ouverte, enregistrer ne
            servirait à rien : le bouton attend, plutôt que d'échouer. */}
        <Button label="Enregistrer" onPress={valider} loading={envoi || !pret} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  head: { gap: spacing.sm, alignItems: 'center' },
  centre: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
