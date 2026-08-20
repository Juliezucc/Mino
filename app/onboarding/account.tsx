import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 1 of onboarding: the parent account. Children never create an account. */
export default function CreateAccount() {
  const router = useRouter();
  const createAccount = useMinoStore((s) => s.createAccount);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Indique ton prénom.';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Adresse e-mail invalide.';
    if (password.length < 8) next.password = 'Au moins 8 caractères.';
    if (!/^\d{4}$/.test(pin)) next.pin = 'Le code parent doit contenir 4 chiffres.';
    // A PIN identical to the last digits of the password helps nobody.
    if (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '0000') {
      next.pin = 'Trop facile à deviner. Choisissez autre chose.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const result = await createAccount({
      parentName: name.trim(),
      email: email.trim(),
      password,
      pin,
    });
    setLoading(false);

    if (!result.ok) {
      setErrors({ email: result.reason ?? 'Impossible de créer le compte.' });
      return;
    }
    router.replace('/onboarding/child');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          title="Créer mon compte"
          subtitle="Le compte appartient au parent. Aucun e-mail n’est demandé aux enfants."
        />

        <View style={styles.form}>
          <Field
            label="Mon prénom"
            placeholder="Julie"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            error={errors.name}
          />
          <Field
            label="Mon e-mail"
            placeholder="julie@exemple.fr"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
          />
          <Field
            label="Mon mot de passe"
            placeholder="8 caractères minimum"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            hint="Il protège votre compte. Le code à 4 chiffres, lui, protège l’espace parent sur les appareils de la famille."
            error={errors.password}
          />
          <Field
            label="Code parent (4 chiffres)"
            placeholder="••••"
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            hint="Il protège l’espace parent : les enfants ne doivent pas le connaître."
            error={errors.pin}
          />
        </View>

        <Text variant="caption" color={colors.textSubtle}>
          Mino ne collecte aucune donnée inutile : pas de géolocalisation, pas de publicité, pas de
          suivi marketing côté enfant.
        </Text>

        <Button label="Continuer" onPress={submit} loading={loading} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: spacing.lg },
});
