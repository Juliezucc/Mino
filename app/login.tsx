import { useRouter } from 'expo-router';
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError('Adresse e-mail invalide.');
    setLoading(true);
    setError(null);
    const result = await signIn({ email: email.trim(), password });
    setLoading(false);

    if (!result.ok) return setError(result.reason ?? 'Connexion impossible.');
    router.replace('/who');
  };

  const reset = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError('Indiquez d’abord votre adresse e-mail.');
    setError(null);
    await getAuthService().requestPasswordReset(email.trim());
    setNotice('Si un compte existe pour cette adresse, un lien vient d’être envoyé.');
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
          />
          <Field
            label="Mon mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            error={error ?? undefined}
          />
        </View>

        <Button label="SE CONNECTER" onPress={submit} loading={loading} />

        <Button
          label="Mot de passe oublié"
          variant="ghost"
          haptic={false}
          onPress={reset}
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
