import React from 'react';
import {
  Keyboard,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radii, spacing, type } from '@/theme';

import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Les claviers numériques d'iOS n'ont pas de touche « Valider ».
 *
 * **Le défaut, trouvé par Julie sur son iPhone puis par son mari sur le sien.**
 * Un `number-pad` iOS n'affiche que des chiffres et une flèche d'effacement —
 * laquelle occupe, en bas à droite, la place exacte où la main va chercher
 * « Valider ». Une fois les quatre chiffres du code parent tapés, il n'existe
 * aucun moyen de refermer le clavier depuis le clavier, et le bouton qu'il
 * faut atteindre est dessous, caché par lui. Julie l'a dit deux fois, sur deux
 * écrans différents.
 *
 * **Ce qui NE marche pas, et que j'ai failli livrer.** `returnKeyType` et
 * `returnKeyLabel` ne posent rien : le premier n'a pas de touche à décorer sur
 * un clavier numérique, le second est propre à Android. Une `InputAccessoryView`
 * marcherait, mais c'est un composant iOS à rendre et à câbler dans chaque
 * écran — beaucoup de surface pour une barre grise.
 *
 * On referme donc le clavier nous-mêmes quand le champ est PLEIN : le
 * quatrième chiffre du code, le sixième du code famille. Un champ qui sait
 * qu'il ne peut plus rien recevoir n'a pas besoin qu'on le lui dise, et le
 * bouton apparaît sous le doigt au moment où il devient utile.
 *
 * Seulement sur un clavier numérique, et seulement si l'appelant a dit combien
 * de caractères il attend : ailleurs, refermer couperait la saisie de
 * quelqu'un qui n'a pas fini.
 */
const CLAVIERS_SANS_RETOUR = ['number-pad', 'numeric', 'decimal-pad', 'phone-pad'];

/** Parent-side text input. Calm, rounded, no aggressive borders. */
export function Field({ label, hint, error, containerStyle, style, ...rest }: Props) {
  const { onChangeText, keyboardType, maxLength } = rest;
  const refermeQuandPlein =
    typeof maxLength === 'number' &&
    !!keyboardType &&
    CLAVIERS_SANS_RETOUR.includes(keyboardType);

  const saisir = React.useCallback(
    (valeur: string) => {
      onChangeText?.(valeur);
      // Après l'appelant : c'est lui qui filtre la saisie, et il peut très
      // bien n'en garder que trois chiffres sur quatre frappes.
      if (refermeQuandPlein && valeur.length >= (maxLength ?? 0)) Keyboard.dismiss();
    },
    [onChangeText, refermeQuandPlein, maxLength],
  );

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text variant="label" color={colors.textMuted}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, !!error && styles.inputError, style]}
        {...rest}
        onChangeText={onChangeText ? saisir : undefined}
      />
      {error ? (
        <Text variant="caption" color={colors.dangerInk}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={colors.textSubtle}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
    color: colors.text,
    ...type.body,
  },
  inputError: { borderColor: colors.danger },
});

export default Field;
