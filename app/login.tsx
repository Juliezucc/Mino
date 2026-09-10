import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/ui';
import { Button, Card, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { getAuthService } from '@/services/auth';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The parent signing back in — a new phone, a reinstall, a second parent.
 *
 * Nothing here reveals whether an address has an account. A wrong password and
 * an unknown address answer the same sentence, and a reset request always says
 * it was sent: "no account with that e-mail" is a list of your customers,
 * handed out one guess at a time.
 */
export default function Login() {
  const router = useRouter();
  const signIn = useMinoStore((s) => s.signIn);

  /**
   * L'adresse déjà saisie, quand on arrive de l'inscription.
   *
   * Un parent dont l'inscription a échoué sur son adresse vient de la taper.
   * La lui redemander, c'est lui faire refaire le geste qui n'a pas marché — et
   * c'est le moment exact où l'on referme une application.
   */
  const { email: fourni } = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(typeof fourni === 'string' ? fourni : '');
  const [password, setPassword] = useState('');
  /**
   * Deux messages, et pas un seul — c'est la correction, et elle vaut d'être
   * expliquée.
   *
   * Tout arrivait dans `error`, qui est branché sur le champ du **mot de
   * passe**. « Indiquez d'abord votre adresse e-mail » s'affichait donc sous le
   * mot de passe, à quelqu'un qui venait de toucher « mot de passe oublié » et
   * qui regardait le haut de l'écran. De son point de vue, rien ne se passait.
   */
  const [erreurEmail, setErreurEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [envoiLien, setEnvoiLien] = useState(false);

  const submit = async () => {
    setErreurEmail(null);
    if (!EMAIL_RE.test(email.trim())) return setErreurEmail('Adresse e-mail invalide.');
    setLoading(true);
    setError(null);
    const result = await signIn({ email: email.trim(), password });
    setLoading(false);

    if (result.ok) return router.replace('/who');
    const dit = result.reason ?? 'Connexion impossible.';
    if (result.field === 'email') setErreurEmail(dit);
    else setError(dit);
  };

  const reset = async () => {
    setError(null);
    setNotice(null);
    setErreurEmail(null);
    if (!EMAIL_RE.test(email.trim())) {
      return setErreurEmail('Indiquez d’abord votre adresse e-mail, ci-dessus.');
    }
    // Un envoi de courriel prend une seconde ou deux. Sans témoin, le bouton
    // paraît mort et on le touche trois fois — ce qui déclenche la limite
    // d'envoi de Supabase, et fait échouer les trois.
    setEnvoiLien(true);
    await getAuthService()
      .requestPasswordReset(email.trim())
      .catch(() => undefined);
    setEnvoiLien(false);
    setNotice(
      'Si un compte existe pour cette adresse, un lien vient d’être envoyé. Pensez à regarder dans les indésirables.',
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={styles.content}>
        <ScreenHeader onBack={() => router.back()} />

        <View style={styles.head}>
          <Logo size={40} />
          <Text variant="hero" center>
            Se connecter
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Le compte appartient au parent. Sur l’appareil d’un enfant, utilisez plutôt le code
            famille.
          </Text>
        </View>

        <View style={styles.form}>
          <Field
            label="Mon e-mail"
            placeholder="julie@exemple.fr"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            error={erreurEmail ?? undefined}
          />
          <Field
            label="Mon mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            // « current », et non « new » : c'est ce qui fait remplir le mot de
            // passe déjà enregistré au lieu d'en proposer un autre.
            autoComplete="current-password"
            textContentType="password"
            error={error ?? undefined}
          />
        </View>

        <Button label="SE CONNECTER" onPress={submit} loading={loading} />

        <Button
          label="Mot de passe oublié"
          variant="ghost"
          haptic={false}
          onPress={reset}
          loading={envoiLien}
        />

        {notice ? (
          <Card elevation="none" background={colors.mintSoft}>
            <Text variant="caption" color={colors.textMuted}>
              {notice}
            </Text>
          </Card>
        ) : null}

        <Button
          label="J’ai un code famille"
          icon="🔑"
          variant="secondary"
          onPress={() => router.replace('/join')}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.sm },
  form: { gap: spacing.lg },
});
