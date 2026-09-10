import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, Chip, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { FAQ_CATEGORIES, FaqCategory, FaqEntry } from '@/content/faq';
import { GUIDE } from '@/content/guide';
import { answerFor, faqByCategory, searchFaq } from '@/domain/support';
import { colors, radii, spacing } from '@/theme';

/**
 * L'aide, dans l'ordre où elle sert.
 *
 * La recherche est en haut, avant le guide, parce qu'un parent qui ouvre cet
 * écran a déjà un problème précis en tête. Le guide s'adresse à celui qui
 * installe ; la recherche à celui qui est bloqué, et c'est lui qui écrit.
 *
 * Le bouton « Signaler un problème » n'apparaît qu'après une recherche.
 * Ce n'est pas une ruse pour décourager les messages : c'est que la réponse
 * arrive en une seconde au lieu d'un jour, et qu'un parent bloqué à 21 h veut
 * une réponse, pas un accusé de réception.
 */
export default function Aide() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FaqCategory | null>(null);

  const trimmed = query.trim();
  const results = useMemo(() => searchFaq(trimmed), [trimmed]);
  const auto = useMemo(() => (trimmed ? answerFor(trimmed) : null), [trimmed]);
  const searching = trimmed.length >= 2;

  const browsed = useMemo(() => (category ? faqByCategory(category) : []), [category]);

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.head}>
        <Mascot expression="motivated" size={96} />
        <Text variant="hero" center>
          Aide
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Décrivez votre problème avec vos mots. La réponse est souvent déjà là.
        </Text>
      </View>

      <Field
        placeholder="Ex. : les applis ne se bloquent pas"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Rechercher dans l’aide"
      />

      {searching ? (
        <SearchResults
          results={results}
          highlighted={auto?.confidence === 'sure' ? auto.entry.id : null}
          onReport={() => router.push('/probleme')}
          onOpenGuide={(id) => router.push({ pathname: '/guide/[id]', params: { id } })}
          onOpenRoute={(route) => router.push(route as never)}
        />
      ) : (
        <>
          <View style={styles.block}>
            <Text variant="section">Guide de démarrage</Text>
            <Text variant="caption" color={colors.textMuted}>
              Dans l’ordre. La première étape suffit pour que votre enfant puisse commencer.
            </Text>
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

          <View style={styles.block}>
            <Text variant="section">Toutes les questions</Text>
            <View style={styles.chips}>
              {FAQ_CATEGORIES.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  selected={category === item.id}
                  onPress={() => setCategory(category === item.id ? null : item.id)}
                />
              ))}
            </View>
            {browsed.map((entry) => (
              <Answer key={entry.id} entry={entry} />
            ))}
          </View>

          <Card background={colors.blueSoft} elevation="none" style={styles.contact}>
            <Text variant="bodyStrong" color={colors.blueInk}>
              Toujours bloqué ?
            </Text>
            <Text variant="body" color={colors.textMuted}>
              Envoyez-nous un signalement. Il part avec ce qu’il faut pour comprendre, et sans
              aucune donnée d’enfant.
            </Text>
            <Button label="Signaler un problème" variant="secondary" onPress={() => router.push('/probleme')} />
          </Card>
        </>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ résultats */

function SearchResults({
  results,
  highlighted,
  onReport,
  onOpenGuide,
  onOpenRoute,
}: {
  results: { entry: FaqEntry }[];
  highlighted: string | null;
  onReport: () => void;
  onOpenGuide: (id: string) => void;
  onOpenRoute: (route: string) => void;
}) {
  if (results.length === 0) {
    return (
      <Card background={colors.surfaceMuted} elevation="none" style={styles.contact}>
        <Text variant="bodyStrong">Rien ne correspond</Text>
        <Text variant="body" color={colors.textMuted}>
          Essayez d’autres mots, ou décrivez-nous le problème : nous répondons à chaque message.
        </Text>
        <Button label="Signaler un problème" variant="secondary" onPress={onReport} />
      </Card>
    );
  }

  return (
    <View style={styles.block}>
      {results.map(({ entry }) => (
        <Answer
          key={entry.id}
          entry={entry}
          // Quand une réponse devance nettement les autres, elle est présentée
          // comme LA réponse : une liste de six liens dont un est bon est une
          // liste que personne ne lit.
          featured={entry.id === highlighted}
          onOpenGuide={onOpenGuide}
          onOpenRoute={onOpenRoute}
        />
      ))}
      <Button label="Ce n’est pas ma réponse" variant="ghost" onPress={onReport} />
    </View>
  );
}

function Answer({
  entry,
  featured,
  onOpenGuide,
  onOpenRoute,
}: {
  entry: FaqEntry;
  featured?: boolean;
  onOpenGuide?: (id: string) => void;
  onOpenRoute?: (route: string) => void;
}) {
  return (
    <Card
      style={styles.answer}
      elevation={featured ? 'soft' : 'none'}
      background={featured ? colors.surface : colors.surfaceMuted}
    >
      <Text variant="bodyStrong">{entry.question}</Text>
      <Text variant="body" color={colors.textMuted}>
        {entry.answer}
      </Text>
      <View style={styles.answerActions}>
        {entry.guide && onOpenGuide ? (
          <Button
            label="Voir les étapes"
            variant="ghost"
            size="small"
            full={false}
            haptic={false}
            onPress={() => onOpenGuide(entry.guide!)}
          />
        ) : null}
        {entry.route && onOpenRoute ? (
          <Button
            label="M’y emmener"
            variant="ghost"
            size="small"
            full={false}
            haptic={false}
            onPress={() => onOpenRoute(entry.route!)}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.sm },
  block: { gap: spacing.sm },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.sm },
  answer: { gap: 4 },
  answerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  contact: { gap: spacing.sm },
});
