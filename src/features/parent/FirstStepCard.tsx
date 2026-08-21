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
 */
interface Props {
  child: Child;
  familyCode: string;
}

export function FirstStepCard({ child, familyCode }: Props) {
  const router = useRouter();

  return (
    <Card style={styles.card} background={colors.surfaceMuted} elevation="none">
      {/* Pas de mascotte ici : l'en-tête de l'écran en porte déjà une, à cent
          pixels au-dessus, et deux Minos si proches se lisent comme un bug.
          C'est l'avatar de l'enfant qui a sa place — c'est de lui qu'on parle. */}
      <View style={styles.head}>
        <Avatar avatarKey={child.avatarKey} size={48} />
        <View style={styles.headTexts}>
          <Text variant="cardTitle">{`À ${child.firstName} de jouer`}</Text>
          <Text variant="caption" color={colors.textMuted}>
            Ses missions l’attendent. Dès qu’il en aura terminé une, elle arrivera ici.
          </Text>
        </View>
      </View>

      {/* Sur un appareil partagé — le cas le plus courant — l'enfant joue sur
          celui-ci, et il faut pouvoir lui passer tout de suite. */}
      <Button
        label={`Passer à ${child.firstName}`}
        icon="👋"
        onPress={() => router.replace('/who')}
      />

      <View style={styles.code}>
        <Text variant="caption" color={colors.textMuted} center>
          Sur sa tablette à lui : installez Mino, puis « J’ai un code famille »
        </Text>
        <Text variant="title" color={colors.blueInk} center>
          {familyCode}
        </Text>
      </View>
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
