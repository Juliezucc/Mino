import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { GUIDE, chapterById } from '@/content/guide';
import { SCREENS } from '@/content/guideScreens';
import { colors, radii, spacing } from '@/theme';

/** Phone screenshots are 390×844; keep the ratio whatever width we give them. */
const SCREEN_RATIO = 844 / 390;

/**
 * One chapter of the guide: numbered steps, each with the screen the parent is
 * meant to be looking at. Steps that happen outside Mino — in iOS settings, in
 * a store — are marked, so nobody hunts for a button that is not ours.
 */
export default function GuideChapterScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();

  const chapter = chapterById(id ?? '');
  if (!chapter) return null;

  const index = GUIDE.findIndex((c) => c.id === chapter.id);
  const next = GUIDE[index + 1];
  const shotWidth = Math.min(280, width - spacing.lg * 2 - spacing.lg * 2);

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.head}>
        <Text style={styles.icon}>{chapter.icon}</Text>
        <Text variant="overline" color={colors.textSubtle}>
          {`ÉTAPE ${index + 1} SUR ${GUIDE.length}`}
        </Text>
        <Text variant="hero" center>
          {chapter.title}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {chapter.summary}
        </Text>
      </View>

      <View style={styles.steps}>
        {chapter.steps.map((step, i) => (
          <Card key={step.title} style={styles.step}>
            <View style={styles.stepHead}>
              <View style={[styles.number, step.outside && styles.numberOutside]}>
                <Text variant="label" color={colors.onBrand}>
                  {i + 1}
                </Text>
              </View>
              <Text variant="cardTitle" style={styles.stepTitle}>
                {step.title}
              </Text>
            </View>

            {step.where ? (
              <View style={styles.where}>
                <Text variant="caption" color={colors.blueDark}>
                  {step.where}
                </Text>
              </View>
            ) : null}

            {step.outside ? (
              <View style={[styles.where, styles.outside]}>
                <Text variant="caption" color={colors.textMuted}>
                  Hors de Mino, dans les réglages de l’appareil
                </Text>
              </View>
            ) : null}

            {step.body.map((paragraph) => (
              <Text key={paragraph} variant="body" color={colors.textMuted}>
                {paragraph}
              </Text>
            ))}

            {step.screen ? (
              <View style={styles.shotWrap}>
                <Image
                  source={SCREENS[step.screen]}
                  style={{
                    width: shotWidth,
                    height: shotWidth * SCREEN_RATIO,
                    borderRadius: radii.lg,
                  }}
                  contentFit="cover"
                  contentPosition="top"
                  transition={0}
                  accessibilityLabel={`Capture d’écran : ${step.title}`}
                />
              </View>
            ) : null}

            {step.tip ? (
              <Card background={colors.yellowSoft} elevation="none">
                <Text variant="caption" color={colors.textMuted}>
                  {`💡  ${step.tip}`}
                </Text>
              </Card>
            ) : null}
          </Card>
        ))}
      </View>

      {next ? (
        <Button
          label={`ÉTAPE SUIVANTE · ${next.title}`}
          onPress={() => router.replace({ pathname: '/guide/[id]', params: { id: next.id } })}
        />
      ) : (
        <Button label="RETOUR AU GUIDE" variant="secondary" onPress={() => router.back()} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.xs },
  // Explicit line height: an emoji at this size overflows its box and would
  // otherwise collide with the label under it.
  icon: { fontSize: 44, lineHeight: 54 },
  steps: { gap: spacing.md },
  step: { gap: spacing.md, paddingVertical: spacing.lg },
  stepHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  number: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberOutside: { backgroundColor: colors.purple },
  stepTitle: { flex: 1 },
  where: {
    alignSelf: 'flex-start',
    backgroundColor: colors.blueSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  outside: { backgroundColor: colors.surfaceSunken },
  shotWrap: { alignItems: 'center', paddingTop: spacing.xs },
});
