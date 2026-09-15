import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Text } from '@/components/ui';
import { Child } from '@/domain/types';
import { LIEN_TELECHARGEMENT } from '@/features/onboarding/InstallerSurLAppareil';
import { colors, radii, spacing } from '@/theme';

/**
 * Ce qui reste à faire, quand rien ne s'est encore passé.
 *
 * Affichée tant que `isFirstRun` est vrai — voir `domain/firstRun`, qui porte
 * la règle et la raison. La suite tenait en une phrase : c'est à l'enfant de
 * jouer. Et la sortie existait déjà, mais au fond des réglages, sous une
 * étiquette qui parle de verrouiller.
 *
 * **Trois défauts relevés sur un vrai téléphone, et ils tenaient dans quatre
 * lignes de texte.**
 *
 * *Le genre.* « Dès qu'**il** en aura terminé une » s'affichait sous le prénom
 * de Manon. Mino ne connaît pas le genre des enfants — un prénom et un âge,
 * rien de plus — et ne doit jamais le demander. Toute tournure qui suppose
 * l'un ou l'autre est donc fausse une fois sur deux, et il n'existe aucun
 * réglage pour la corriger. On réécrit la phrase plutôt que d'inventer un
 * « il ou elle » : « dès qu'une mission sera terminée ».
 *
 * *Le nombre.* « Sur **son** appareil à lui » ne désigne plus personne dès la
 * deuxième fiche, et la carte ne nommait de toute façon que `children[0]` —
 * une famille de trois enfants en voyait un seul.
 *
 * *L'endroit.* Ce même bloc explique comment installer Mino sur l'appareil de
 * l'enfant… y compris quand on est déjà dessus. Le parent qui a déclaré « cet
 * appareil est à Manon » lisait donc, sur l'appareil de Manon, qu'il fallait y
 * installer Mino.
 */
interface Props {
  /** Toute la fratrie : la carte parle d'elle, pas du premier profil créé. */
  enfants: Child[];
  familyCode: string;
  /**
   * Cet appareil est celui d'un enfant, le parent l'a déclaré.
   *
   * Change deux choses : on ne propose plus d'installer Mino ici — c'est déjà
   * fait, on est dessus — et le passage au profil de l'enfant cesse d'être
   * l'action principale, puisque l'application y rouvre d'elle-même.
   */
  appareilDeLEnfant?: boolean;
  /**
   * Cet appareil est le téléphone d'un parent, il l'a déclaré à l'inscription
   * ou dans « À moi » — `choixEnregistre(device).kind === 'parent'`.
   *
   * Aucun enfant ne joue ici : c'est le code famille qui devient le geste
   * principal, et « Passer à… » disparaît.
   */
  telephoneDuParent?: boolean;
}

export function FirstStepCard({
  enfants,
  familyCode,
  appareilDeLEnfant = false,
  telephoneDuParent = false,
}: Props) {
  const router = useRouter();

  const premier = enfants[0];
  if (!premier) return null;
  const plusieurs = enfants.length > 1;

  /**
   * ------------------------------------------- « installez Mino » ne suffit pas
   *
   * **Le défaut, et il coûte des familles entières.** Cette carte disait « Sur
   * l'appareil de Manon : installez Mino » — et laissait le parent se
   * débrouiller pour trouver Mino dans une boutique où plusieurs applications
   * portent ce nom, sans rapport avec celle-ci. Un parent qui vient de payer,
   * qui a créé sa famille et sa première mission, se retrouvait à chercher.
   * Beaucoup s'arrêtent là, et rien dans nos chiffres ne le dit.
   *
   * **Le code mène à `minoapp.fr/telecharger`, pas à une boutique.** La page
   * aiguille selon l'appareil qui l'ouvre : celui qu'on scanne est presque
   * toujours celui de l'enfant, et il peut être Android. Un code figé sur
   * l'App Store enverrait ce parent-là dans le mur — et un code QR imprimé dans
   * un binaire est exactement ce qu'on ne peut pas rattraper. C'est la même
   * adresse que l'écran d'installation et que celui du blocage : une seule à
   * tenir à jour, et elle vit sur le site.
   *
   * **Et jamais le code seul.** Une caméra qui ne scanne pas, un écran mal
   * éclairé, quelqu'un qui voit mal : l'adresse est écrite en toutes lettres
   * dessous. Un chemin unique n'est pas un chemin.
   */
  const code = (
    <View style={styles.code}>
      <Text variant="caption" color={colors.textMuted} center>
        {plusieurs
          ? 'Sur chaque appareil confié à un enfant : scannez ce code pour installer Mino, puis « J’ai un code famille »'
          : `Sur l’appareil de ${premier.firstName} : scannez ce code pour installer Mino, puis « J’ai un code famille »`}
      </Text>

      <View style={styles.qr}>
        <QRCode
          value={LIEN_TELECHARGEMENT}
          size={132}
          color={colors.navy}
          backgroundColor="#FFFFFF"
          quietZone={10}
        />
      </View>

      <Text variant="caption" color={colors.textSubtle} center>
        ou minoapp.fr/telecharger
      </Text>

      <Text variant="caption" color={colors.textMuted} center>
        Puis ce code famille :
      </Text>
      <Text variant="title" color={colors.blueInk} center>
        {familyCode}
      </Text>
    </View>
  );

  return (
    <Card style={styles.card} background={colors.surfaceMuted} elevation="none">
      {/* Pas de mascotte ici : l'en-tête de l'écran en porte déjà une, à cent
          pixels au-dessus, et deux Minos si proches se lisent comme un bug.
          C'est l'avatar de l'enfant qui a sa place — c'est de lui qu'on parle. */}
      <View style={styles.head}>
        <Avatar avatarKey={premier.avatarKey} size={48} />
        <View style={styles.headTexts}>
          <Text variant="cardTitle">
            {plusieurs ? 'À vos enfants de jouer' : `À ${premier.firstName} de jouer`}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {plusieurs
              ? 'Leurs missions les attendent. Dès qu’une mission sera terminée, elle arrivera ici.'
              : 'Ses missions l’attendent. Dès qu’une mission sera terminée, elle arrivera ici.'}
          </Text>
        </View>
      </View>

      {/*
        À qui s'adresse le geste principal — et ça dépend de l'appareil.

        **Le défaut, relevé par Julie sur son propre téléphone.** « Passer à
        Raphaël » s'affichait en bouton bleu pleine largeur, et le code
        famille — la seule chose à faire depuis ce téléphone-là — était relégué
        en petit texte gris dessous. Le commentaire d'origine l'assumait :
        « sur un appareil partagé, le cas le plus courant, l'enfant joue sur
        celui-ci ». C'était vrai avant que l'appareil ne sache dire qu'il est
        celui d'un parent.

        Il le sait depuis. Sur le téléphone d'un parent, aucun enfant ne joue :
        lui proposer de basculer sur le profil de son fils l'envoie exactement
        là où il n'y a rien à régler — l'écran à bloquer est ailleurs, sur
        l'appareil de l'enfant, et on y arrive avec le code. Le code passe donc
        devant, et le bouton disparaît.
      */}
      {telephoneDuParent ? (
        code
      ) : (
        <Button
          label={plusieurs ? 'Passer à un profil enfant' : `Passer à ${premier.firstName}`}
          icon="👋"
          variant={appareilDeLEnfant ? 'secondary' : 'primary'}
          onPress={() => router.replace('/who')}
        />
      )}

      {/* Sur l'appareil de l'enfant, Mino est déjà installé : on est dessus. */}
      {appareilDeLEnfant || telephoneDuParent ? null : code}

    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headTexts: { flex: 1, gap: spacing.xs },
  code: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Fond blanc et non la teinte de la carte : un code QR se lit par contraste,
  // et une caméra de téléphone d'enfant n'est pas celle d'un appareil photo.
  qr: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    borderRadius: radii.md,
    marginVertical: spacing.xs,
  },
});
