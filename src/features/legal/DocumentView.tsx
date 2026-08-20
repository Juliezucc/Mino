import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { Block, LegalDocument } from '@/content/document';
import { colors, radii, spacing } from '@/theme';

/**
 * Renders a `LegalDocument`. One renderer for the privacy policy, the terms and
 * the help section, so they stay typographically identical and a change to how
 * a callout looks happens once.
 */

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'p':
      return (
        <Text variant="body" color={colors.textMuted}>
          {block.text}
        </Text>
      );

    case 'bullets':
      return (
        <View style={styles.bullets}>
          {block.items.map((item) => (
            <View key={item} style={styles.bullet}>
              <View style={styles.dot} />
              <Text variant="body" color={colors.textMuted} style={styles.bulletText}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      );

    case 'note':
      return (
        <Card background={colors.blueSoft} elevation="none">
          <Text variant="bodyStrong" color={colors.blueDark}>
            {block.text}
          </Text>
        </Card>
      );

    case 'rows':
      return (
        <View style={styles.rows}>
          {block.rows.map((row) => (
            <View key={row.label} style={styles.rowItem}>
              <Text variant="bodyStrong">{row.label}</Text>
              <Text variant="body" color={colors.textMuted}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      );
  }
}

export function DocumentView({ document }: { document: LegalDocument }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="hero">{document.title}</Text>
        {document.subtitle ? (
          <Text variant="body" color={colors.textMuted}>
            {document.subtitle}
          </Text>
        ) : null}
        <Text variant="caption" color={colors.textSubtle}>
          {`Dernière mise à jour : ${document.updatedAt}`}
        </Text>
      </View>

      {document.intro?.length ? (
        <View style={styles.blocks}>
          {document.intro.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </View>
      ) : null}

      {document.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text variant="section">{section.title}</Text>
          <View style={styles.blocks}>
            {section.blocks.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  head: { gap: spacing.xs },
  section: { gap: spacing.md },
  blocks: { gap: spacing.md },
  bullets: { gap: spacing.sm },
  bullet: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.blue,
    marginTop: 9,
  },
  bulletText: { flex: 1 },
  rows: { gap: spacing.md },
  rowItem: {
    gap: 2,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
});

export default DocumentView;
