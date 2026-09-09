import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Screen, ScreenHeader, Text } from '@/components/ui';
import { ChildForm, ChildFormValue } from '@/features/parent/ChildForm';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * Le premier écran de Mino, et le premier depuis peu.
 *
 * **Ce que l'ordre précédent coûtait.** On demandait d'abord un prénom de
 * parent, une adresse, un mot de passe, un code à quatre chiffres et une case
 * à cocher — cinq champs — puis une confirmation par e-mail qui faisait
 * quitter l'application. Le premier enfant n'apparaissait qu'après tout ça.
 * Autrement dit : tout l'effort avant la moindre récompense, à l'endroit du
 * parcours où l'on perd le plus de monde.
 *
 * Ici, le parent tape un prénom et voit sa famille exister. Le reste vient
 * après, quand il a une raison de le donner.
 *
 * **Le consentement est ici, et il n'y a pas d'autre endroit possible.** Mino
 * encadre le temps d'écran d'un enfant : c'est le titulaire de l'autorité
 * parentale qui l'autorise, et le dossier déposé chez Apple l'affirme. Il doit
 * donc précéder la création du profil — pas la suivre. Ce qui se recueille
 * n'est pas la case cochée mais l'instant : c'est la date qui vaut preuve le
 * jour où on la demande.
 */
export default function OnboardingChild() {
  const router = useRouter();
  const fonderFamille = useMinoStore((s) => s.fonderFamille);
  const addChild = useMinoStore((s) => s.addChild);
  const [consent, setConsent] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (value: ChildFormValue) => {
    if (!consent) return setErreur('Cochez la case pour continuer.');
    setErreur(null);
    setLoading(true);
    try {
      /**
       * La famille d'abord, l'enfant ensuite — et dans cet ordre seulement.
       *
       * Un profil d'enfant n'existe que dans une famille : sans elle, il n'y a
       * ni identité pour l'écrire, ni ligne à laquelle le rattacher. C'est
       * `fonderFamille` qui ouvre la session anonyme et crée la famille vide.
       */
      const ouverte = await fonderFamille({ consentAt: new Date().toISOString() });
      if (!ouverte.ok) return setErreur(ouverte.reason ?? 'Impossible de créer votre famille.');

      const childId = await addChild(value);
      router.replace({ pathname: '/onboarding/mission', params: { childId } });
    } catch (e) {
      // Sans ce filet, le bouton tourne sans fin et sans un mot — l'écran le
      // plus difficile à signaler, parce qu'il n'y a rien à raconter.
      const dit = (e as { message?: unknown } | null)?.message;
      setErreur(
        typeof dit === 'string' && dit.trim()
          ? dit
          : 'Impossible de continuer. Vérifiez votre connexion et réessayez.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          title="Votre premier enfant"
          subtitle="Un prénom et un avatar suffisent. Aucun compte, aucune adresse e-mail pour l’enfant."
        />

        <ChildForm submitLabel="Continuer" onSubmit={submit} loading={loading} />

        <Pressable
          onPress={() => setConsent((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Je suis titulaire de l’autorité parentale sur cet enfant et j’accepte les conditions générales et la politique de confidentialité."
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
            Je suis titulaire de l’autorité parentale sur cet enfant, et j’accepte les{' '}
            <Text variant="caption" color={colors.blueInk} onPress={() => router.push('/legal/cgv')}>
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

        {erreur ? (
          <Text variant="caption" color={colors.dangerInk}>
            {erreur}
          </Text>
        ) : null}

        <Text variant="caption" color={colors.textSubtle}>
          Mino ne collecte aucune donnée inutile : pas de géolocalisation, pas de publicité, pas de
          suivi marketing côté enfant.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
