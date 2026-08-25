import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

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
  const [consent, setConsent] = useState(false);
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
    // Le seul consentement qui ne se rattrape jamais. Mino encadre le temps
    // d'écran d'un enfant : c'est le titulaire de l'autorité parentale qui
    // l'autorise, et le dossier déposé chez Apple l'affirme. Ne pas le
    // demander ici, c'est affirmer chez Apple quelque chose que le binaire ne
    // fait pas — et ne pas pouvoir le prouver le jour où on le demande.
    if (!consent) next.consent = 'Cochez cette case pour continuer.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const result = await createAccount({
      parentName: name.trim(),
      email: email.trim(),
      password,
      pin,
      // L'instant du consentement, pas seulement le fait qu'il ait eu lieu :
      // c'est la date qui vaut preuve.
      consentAt: new Date().toISOString(),
    });
    setLoading(false);

    if (!result.ok) {
      // `field` dit quel champ est en cause quand ce n'est pas l'adresse — un
      // mot de passe refusé, par exemple. Sans lui, l'erreur s'affichait sous
      // l'e-mail et le parent corrigeait indéfiniment un champ intact.
      setErrors({ [result.field ?? 'email']: result.reason ?? 'Impossible de créer le compte.' });
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
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            error={errors.email}
          />
          <Field
            label="Mon mot de passe"
            placeholder="8 caractères minimum"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            // Dire au système qu'il s'agit d'un mot de passe NEUF, et le voilà
            // qui en propose un fort, l'enregistre et le remplira tout seul à
            // la prochaine connexion. Sans ces deux lignes, on demande à un
            // parent pressé d'en inventer un — et il ressort celui qu'il
            // utilise partout, c'est-à-dire souvent celui que la protection
            // contre les fuites va refuser. La friction ne venait pas de la
            // protection : elle venait de l'invention.
            autoComplete="new-password"
            textContentType="newPassword"
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
            // Surtout PAS un mot de passe : sans ce démenti, le trousseau
            // propose d'enregistrer le code parent à la place de celui du
            // compte — deux champs masqués sur le même écran, il choisit le
            // dernier. Le parent se retrouve alors avec quatre chiffres
            // remplis automatiquement dans le champ mot de passe.
            autoComplete="off"
            textContentType="none"
            hint="Il protège l’espace parent : les enfants ne doivent pas le connaître."
            error={errors.pin}
          />
        </View>

        <Pressable
          onPress={() => setConsent((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Je suis titulaire de l’autorité parentale et j’accepte les conditions générales et la politique de confidentialité."
          style={styles.consent}
          hitSlop={8}
        >
          <View style={[styles.box, consent && styles.boxOn]}>
            {consent ? (
              <Text variant="bodyStrong" color={colors.onBrand}>
                ✓
              </Text>
            ) : null}
          </View>
          <Text variant="caption" color={colors.textMuted} style={styles.consentText}>
            Je suis titulaire de l’autorité parentale sur les enfants que j’ajouterai, et
            j’accepte les{' '}
            <Text
              variant="caption"
              color={colors.blueInk}
              onPress={() => router.push('/legal/cgv')}
            >
              conditions générales
            </Text>{' '}
            et la{' '}
            <Text
              variant="caption"
              color={colors.blueInk}
              onPress={() => router.push('/legal/confidentialite')}
            >
              politique de confidentialité
            </Text>
            .
          </Text>
        </Pressable>
        {errors.consent ? (
          <Text variant="caption" color={colors.dangerInk}>
            {errors.consent}
          </Text>
        ) : null}

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
  consent: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  // 28 points, et non 20 : la case se coche avec un pouce, sur un écran tenu
  // d'une main, par quelqu'un qui a un enfant dans les bras.
  box: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  consentText: { flex: 1 },
});
