import QRCode from 'react-native-qrcode-svg';
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

/**
 * L'adresse que porte le code, et pourquoi ce n'est pas celle de l'App Store.
 *
 * L'appareil qu'on scanne est le plus souvent celui de l'enfant, et il peut
 * être Android. Un code figé sur l'App Store enverrait ce parent-là dans le
 * mur. Une page de redirection règle le cas d'aujourd'hui **et** celui du jour
 * où le Play Store ouvre, sans qu'il faille republier l'application — or un
 * code QR imprimé dans un binaire est exactement ce qu'on ne peut pas
 * rattraper.
 */
export const LIEN_TELECHARGEMENT = 'https://minoapp.fr/telecharger';

/**
 * Ce qu'il reste à faire quand l'inscription s'est terminée dans un navigateur.
 *
 * **Le problème que cet écran résout.** Un parent qui vient de s'abonner depuis
 * son ordinateur a une famille, une première mission et un abonnement — et rien
 * du tout sur le téléphone de son enfant. Autrement dit, il n'a pas le produit :
 * Mino ne referme aucune application depuis un navigateur, et ne le fera jamais.
 * L'écran qui suivait lui demandait « à qui est cet appareil ? », question qui a
 * du sens sur un téléphone et aucun ici.
 *
 * **Pourquoi un code à scanner.** Parce que le geste à faire se passe sur un
 * AUTRE appareil que celui qu'on a sous les yeux, et que recopier une adresse
 * d'un écran à l'autre est le moment précis où l'on renonce.
 *
 * **Et pourquoi il n'est jamais seul.** Une caméra qui ne scanne pas, un écran
 * mal éclairé, quelqu'un qui voit mal : l'adresse est écrite en toutes lettres
 * dessous, et se copie d'une touche. Un chemin unique n'est pas un chemin.
 */
export function InstallerSurLAppareil({
  code,
  onTermine,
}: {
  code: string;
  onTermine: () => void;
}) {
  const [copie, setCopie] = useState<'lien' | 'code' | null>(null);

  const copier = (quoi: 'lien' | 'code', valeur: string) => {
    // `navigator.clipboard` n'existe pas partout — un contexte non sécurisé
    // suffit à le faire disparaître. L'échec est silencieux et sans gravité :
    // le texte reste affiché, et se sélectionne à la main.
    const presse = (globalThis as { navigator?: { clipboard?: { writeText?: (v: string) => Promise<void> } } })
      .navigator?.clipboard;
    presse?.writeText?.(valeur).then(
      () => setCopie(quoi),
      () => undefined,
    );
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text variant="hero" center>
          Il reste à l’installer
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Mino referme les applications depuis le téléphone ou la tablette de votre enfant. C’est là
          qu’il faut l’installer — ce navigateur ne peut pas le faire.
        </Text>
      </View>

      <Card style={styles.bloc}>
        <Text variant="cardTitle" center>
          Scannez ce code avec l’appareil de votre enfant
        </Text>
        <View style={styles.qr}>
          {/* 200 points : en dessous, un code se scanne mal sur un écran vu de
              biais, et le parent croit que c'est son téléphone qui ne marche
              pas. La marge blanche fait partie du code, elle n'est pas
              décorative. */}
          <QRCode
            value={LIEN_TELECHARGEMENT}
            size={200}
            color={colors.navy}
            backgroundColor="#FFFFFF"
            quietZone={12}
          />
        </View>
        <Text variant="caption" color={colors.textMuted} center>
          ou rendez-vous sur
        </Text>
        <Text variant="bodyStrong" color={colors.blueInk} center>
          minoapp.fr/telecharger
        </Text>
        <Button
          label={copie === 'lien' ? 'Lien copié' : 'Copier le lien'}
          icon={copie === 'lien' ? '✓' : '🔗'}
          variant="secondary"
          onPress={() => copier('lien', LIEN_TELECHARGEMENT)}
        />
      </Card>

      <Card style={styles.bloc} background={colors.blueSoft} elevation="none">
        <Text variant="cardTitle" center>
          Puis, dans l’application : « J’ai un code famille »
        </Text>
        {/* `hero` et non `display` : un code famille fait onze caractères, et
            la taille au-dessus le coupait en deux lignes sur une fenêtre
            étroite — un code coupé se recopie de travers. */}
        <Text variant="hero" color={colors.blueInk} center style={styles.code}>
          {code}
        </Text>
        <Text variant="caption" color={colors.textMuted} center>
          Ce code relie l’appareil à votre famille. Votre enfant y verra ses missions et son
          compteur, rien d’autre.
        </Text>
        <Button
          label={copie === 'code' ? 'Code copié' : 'Copier le code'}
          icon={copie === 'code' ? '✓' : '📋'}
          variant="secondary"
          onPress={() => copier('code', code)}
        />
      </Card>

      <Text variant="caption" color={colors.textSubtle} center>
        Installez aussi Mino sur votre propre téléphone et connectez-vous avec votre compte : vous
        confirmerez les missions d’une touche, où que vous soyez.
      </Text>

      {/* Le code famille vit aussi dans les réglages : le dire ici évite qu'un
          parent pressé garde cet onglet ouvert « pour ne pas le perdre ». */}
      <Button
        label="Plus tard — le code est dans mes réglages"
        variant="ghost"
        haptic={false}
        onPress={onTermine}
      />
    </Screen>
  );
}

/** Vrai là où Mino ne peut rien bloquer, c'est-à-dire dans un navigateur. */
export const SANS_BOUCLIER = Platform.OS === 'web';

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  bloc: { gap: spacing.md },
  qr: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  code: { letterSpacing: 2 },
});

export default InstallerSurLAppareil;
