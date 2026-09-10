import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Text } from '@/components/ui';
import { Child } from '@/domain/types';
import { colors, spacing } from '@/theme';

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
}

export function FirstStepCard({ enfants, familyCode, appareilDeLEnfant = false }: Props) {
  const router = useRouter();

  const premier = enfants[0];
  if (!premier) return null;
  const plusieurs = enfants.length > 1;

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

      {/* Sur un appareil partagé — le cas le plus courant — l'enfant joue sur
          celui-ci, et il faut pouvoir lui passer tout de suite. Sur le sien,
          l'application rouvre déjà sur son profil : le bouton reste, en
          retrait, parce qu'il sert encore à sortir de l'espace parent. */}
      <Button
        label={plusieurs ? 'Passer à un profil enfant' : `Passer à ${premier.firstName}`}
        icon="👋"
        variant={appareilDeLEnfant ? 'secondary' : 'primary'}
        onPress={() => router.replace('/who')}
      />

      {appareilDeLEnfant ? null : (
        <View style={styles.code}>
          <Text variant="caption" color={colors.textMuted} center>
            {plusieurs
              ? 'Sur chaque appareil confié à un enfant : installez Mino, puis « J’ai un code famille »'
              : `Sur l’appareil de ${premier.firstName} : installez Mino, puis « J’ai un code famille »`}
          </Text>
          <Text variant="title" color={colors.blueInk} center>
            {familyCode}
          </Text>
        </View>
      )}
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
});
