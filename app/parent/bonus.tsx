import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Avatar, Button, Card, Chip, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { ID } from '@/domain/types';
import { useChildren } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

const AMOUNTS = [5, 10, 15, 30];

/** Ready-made reasons, because a bonus with no reason teaches nothing. */
const REASONS = [
  'Coup de main spontané',
  'Belle journée',
  'Gentil avec son frère ou sa sœur',
  'Bon bulletin',
  'Juste parce que',
];

/**
 * A gift, outside of any mission.
 *
 * Always positive: a "bonus" that could also take time away would be a
 * punishment wearing a nicer name, and Mino never takes back what was earned.
 * Corrections live on the child's own page, named for what they are.
 */
export default function BonusScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const children = useChildren();
  const grantBonus = useMinoStore((s) => s.grantBonus);

  const [selected, setSelected] = useState<ID[]>(childId ? [childId] : []);
  const [minutes, setMinutes] = useState(10);
  const [reason, setReason] = useState(REASONS[0]);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = (id: ID) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const send = async () => {
    setLoading(true);
    try {
      for (const id of selected) await grantBonus(id, minutes, reason);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    const names = children
      .filter((c) => selected.includes(c.id))
      .map((c) => c.firstName)
      .join(' et ');

    return (
      <Screen contentStyle={styles.done}>
        <Mascot expression="delighted" size={150} />
        <Text variant="title" center>
          {`+${minutes} min pour ${names}`}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {`Le compteur est déjà à jour. Dites-le-lui de vive voix : « ${reason} », c’est ce qui donne au bonus sa valeur.`}
        </Text>
        <Button label="TERMINÉ" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <Button
          label={`OFFRIR ${minutes} MIN`}
          icon="🎁"
          onPress={send}
          disabled={selected.length === 0}
          loading={loading}
        />
      }
    >
      <ScreenHeader onBack={() => router.back()} title="Envoyer un bonus" />

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          À qui ?
        </Text>
        <View style={styles.row}>
          {children.map((child) => {
            const on = selected.includes(child.id);
            return (
              <Pressable
                key={child.id}
                onPress={() => toggle(child.id)}
                accessibilityRole="button"
                accessibilityLabel={child.firstName}
                accessibilityState={{ selected: on }}
                style={[styles.childTile, on && styles.childTileOn]}
              >
                <Avatar avatarKey={child.avatarKey} size={36} />
                <Text variant="label" color={on ? colors.blueDark : colors.textMuted}>
                  {child.firstName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Combien ?
        </Text>
        <View style={styles.row}>
          {AMOUNTS.map((value) => (
            <Chip
              key={value}
              label={`+${value} min`}
              selected={minutes === value}
              onPress={() => setMinutes(value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Pourquoi ?
        </Text>
        <View style={styles.row}>
          {REASONS.map((value) => (
            <Chip
              key={value}
              label={value}
              selected={reason === value}
              onPress={() => setReason(value)}
            />
          ))}
        </View>
        <Field
          placeholder="Ou écrivez la vôtre"
          value={REASONS.includes(reason) ? '' : reason}
          onChangeText={(v) => setReason(v || REASONS[0])}
        />
      </View>

      <Card elevation="none" background={colors.surfaceMuted}>
        <Text variant="caption" color={colors.textMuted}>
          Un bonus n’enlève jamais de temps. Pour corriger une erreur, passez par la fiche de
          l’enfant : l’opération y est nommée pour ce qu’elle est, et tracée dans l’historique.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.xl },
  done: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, flexGrow: 1 },
  block: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  childTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  childTileOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
});
