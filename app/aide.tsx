import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { GUIDE } from '@/content/guide';
import { colors, radii, spacing } from '@/theme';

/** The handful of things that actually go wrong, answered where people look. */
const FAQ = [
  {
    question: 'Mon enfant ne voit pas sa mission',
    answer:
      'Vérifiez sa récurrence : une mission « certains jours » n’apparaît que les jours choisis. Vérifiez aussi qu’elle lui est bien attribuée, et pas seulement à son frère ou à sa sœur.',
  },
  {
    question: 'Le compteur ne bouge pas',
    answer:
      'Les minutes n’arrivent qu’après votre validation. Regardez les demandes en attente sur l’accueil de l’espace parent.',
  },
  {
    question: 'L’appareil de l’enfant ne trouve pas la famille',
    answer:
      'Le code famille se trouve dans Réglages, sur votre téléphone. Attention à ne pas le confondre avec le code de parrainage, qui a six caractères et pas de tiret.',
  },
  {
    question: 'J’ai oublié mon code parent',
    answer:
      'Reconnectez-vous à votre compte depuis votre propre appareil : le code se redéfinit dans les réglages.',
  },
  {
    question: 'J’ai validé par erreur',
    answer:
      'Ajustez le compteur depuis la fiche de l’enfant. L’opération apparaît dans son historique : rien n’est effacé.',
  },
];

/**
 * The guide's table of contents.
 *
 * Ordered as a parent lives it, not as the app is built: setting up the child's
 * device comes first, because that is the wall everyone hits and the one that
 * makes people give up before they ever see the product work.
 */
export default function GuideIndex() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.head}>
        <Mascot expression="motivated" size={110} />
        <Text variant="hero" center>
          Guide de démarrage
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Suivez-les dans l’ordre. La première suffit pour que votre enfant puisse démarrer.
        </Text>
      </View>

      <View style={styles.list}>
        {GUIDE.map((chapter, index) => (
          <Card
            key={chapter.id}
            onPress={() => router.push({ pathname: '/guide/[id]', params: { id: chapter.id } })}
            accessibilityLabel={`${chapter.title}. ${chapter.summary}`}
            style={styles.card}
          >
            <View style={styles.row}>
              <View style={styles.badge}>
                <Text style={styles.icon}>{chapter.icon}</Text>
              </View>
              <View style={styles.texts}>
                <Text variant="overline" color={colors.textSubtle}>
                  {`ÉTAPE ${index + 1}`}
                </Text>
                <Text variant="cardTitle">{chapter.title}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {chapter.summary}
                </Text>
                <Text variant="caption" color={colors.textSubtle}>
                  {`${chapter.steps.length} étapes · ${chapter.duration}`}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.faqBlock}>
        <Text variant="section">Ça ne marche pas comme prévu</Text>
        {FAQ.map((item) => (
          <Card key={item.question} style={styles.faq} elevation="none" background={colors.surfaceMuted}>
            <Text variant="bodyStrong">{item.question}</Text>
            <Text variant="body" color={colors.textMuted}>
              {item.answer}
            </Text>
          </Card>
        ))}
      </View>

      <Card background={colors.blueSoft} elevation="none" style={styles.contact}>
        <Text variant="bodyStrong" color={colors.blueDark}>
          Bloqué quelque part ?
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Écrivez-nous, nous répondons à chaque message.
        </Text>
        <Button
          label="Conditions générales"
          variant="ghost"
          size="small"
          full={false}
          haptic={false}
          onPress={() => router.push('/legal/cgv')}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.sm },
  list: { gap: spacing.md },
  card: { paddingVertical: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  badge: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  texts: { flex: 1, gap: 2 },
  faqBlock: { gap: spacing.sm, paddingTop: spacing.md },
  faq: { gap: 2 },
  contact: { gap: spacing.sm },
});
