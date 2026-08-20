import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface Props {
  children: React.ReactNode;
  /** Scrollable by default; pass false for screens that must stay pinned. */
  scroll?: boolean;
  background?: string;
  edges?: readonly Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
}

/**
 * Largeur maximale du contenu.
 *
 * Mino tourne aussi sur iPad, sur tablette Android et dans un navigateur, et
 * sans cette borne le contenu s'y étire sur toute la largeur : une carte de
 * mission de mille pixels de large, un anneau de temps perdu au milieu du vide,
 * et une interface qui a manifestement été pensée pour autre chose. C'est
 * exactement ce que Google pénalise depuis ses règles grand écran, et c'était
 * visible du premier coup d'œil sur les captures de la fiche iPad.
 *
 * 620 points : la même colonne de lecture confortable que sur un grand
 * téléphone, centrée. Rien à réapprendre d'un appareil à l'autre.
 */
const MAX_CONTENT_WIDTH = 620;

/**
 * Screen frame: safe areas on iPhone and Android, generous bottom padding so a
 * sticky footer never covers the last card.
 */
export function Screen({
  children,
  scroll = true,
  background = colors.background,
  edges = ['top'],
  contentStyle,
  style,
  footer,
}: Props) {
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      // La colonne se centre par la zone de défilement plutôt que par une vue
      // intercalaire : ajouter un conteneur casserait la hauteur des écrans qui
      // s'étirent, à commencer par la conversation avec Mino.
      contentContainerStyle={[styles.content, styles.column, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, styles.column, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background }, style]} edges={edges}>
      {body}
      {footer ? <View style={[styles.footer, styles.column]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
  },
});

export default Screen;
