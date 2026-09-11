import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { getSupabaseClient } from '@/data/supabaseRepository';
import { useChild, useSession } from '@/store/selectors';
import { colors, radii, spacing } from '@/theme';

interface Line {
  id: number;
  role: 'child' | 'mino';
  text: string;
  safety: string;
  created_at: string;
}

/**
 * Ce que mon enfant raconte à Mino.
 *
 * Cet écran est la contrepartie d'une promesse faite à l'enfant : on lui dit,
 * en bas de sa conversation, que ses parents peuvent la lire. Il faut donc que
 * ce soit vrai et facile — un espace présenté comme privé et lisible en douce
 * serait bien pire que celui-ci.
 *
 * Rien ne s'y répond : c'est une lecture, pas une messagerie. Un parent qui
 * veut réagir à ce qu'il lit le fait dans la vraie vie, ce qui est précisément
 * ce que le produit cherche à provoquer.
 */
export default function ConversationsScreen() {
  const session = useSession();
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId);

  const [lines, setLines] = useState<Line[] | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !childId) {
      setLines([]);
      return;
    }
    client
      .from('companion_messages')
      .select('id, role, text, safety, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setLines((data as Line[]) ?? []));
  }, [childId]);

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader
        onBack={() => router.back()}
        title={child ? `Mino et ${child.firstName}` : 'Conversations'}
      />

      {lines === null ? (
        <Text variant="body" color={colors.textMuted} center>
          Chargement…
        </Text>
      ) : lines.length === 0 ? (
        /**
         * Zéro ligne n'est pas une absence de conversation.
         *
         * **Le défaut : l'écran prenait un refus de lecture pour un silence.**
         * `companion_messages_read` n'ouvre qu'à un parent — pas à un appareil
         * appairé, et c'est juste : la tablette d'un enfant ne doit pas pouvoir
         * relire ses propres conversations pour savoir ce que ses parents en
         * verront. Mais la requête rend alors zéro ligne, exactement comme une
         * famille où Mino n'a jamais parlé, et l'écran affirmait « Mino n'a pas
         * encore discuté avec cet enfant ». C'est-à-dire qu'il rassurait un
         * parent sur la foi d'une chose qu'il n'avait pas le droit de lire.
         */
        <EmptyState
          title={
            session && session.kind !== 'parent' ? 'Pas lisible depuis cet appareil' : 'Aucune conversation'
          }
          message={
            !getSupabaseClient()
              ? 'Les conversations sont enregistrées sur le compte en ligne. Cette version hors ligne n’en garde aucune.'
              : session && session.kind !== 'parent'
                ? 'Les conversations ne se lisent que depuis le téléphone d’un parent. Cet appareil a rejoint la famille avec le code : il ne peut pas y accéder, même avec le code à quatre chiffres.'
                : 'Mino n’a pas encore discuté avec cet enfant. Cela n’arrive que lorsque son temps d’écran est terminé.'
          }
        />
      ) : (
        <>
          <Card background={colors.blueSoft} elevation="none">
            <Text variant="caption" color={colors.textMuted}>
              Votre enfant sait que vous pouvez lire ces conversations : c’est écrit sous la sienne.
              Elles sont conservées trente jours, puis effacées.
            </Text>
          </Card>

          {lines.map((line, index) => {
            const newDay = index === 0 || day(line.created_at) !== day(lines[index - 1].created_at);
            return (
              <View key={line.id}>
                {newDay ? (
                  <Text variant="label" color={colors.textSubtle} style={styles.day}>
                    {day(line.created_at).toUpperCase()}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    line.role === 'child' ? styles.fromChild : styles.fromMino,
                    // Ce qui a déclenché l'orientation vers le 119 est signalé,
                    // pour qu'un parent qui parcourt ne puisse pas le manquer.
                    line.safety === 'alert' && styles.flagged,
                  ]}
                >
                  <Text variant="caption" color={colors.textSubtle}>
                    {line.role === 'child' ? (child?.firstName ?? 'Votre enfant') : 'Mino'}
                  </Text>
                  <Text variant="body">{line.text}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  day: { paddingTop: spacing.lg, paddingBottom: spacing.xs },
  bubble: { padding: spacing.md, borderRadius: radii.lg, gap: 2 },
  fromChild: { backgroundColor: colors.blueSoft, marginLeft: spacing.xl },
  fromMino: { backgroundColor: colors.surfaceSunken, marginRight: spacing.xl },
  flagged: { borderWidth: 2, borderColor: colors.warning },
});
