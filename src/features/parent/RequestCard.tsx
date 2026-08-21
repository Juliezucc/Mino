import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, Text } from '@/components/ui';
import { MissionCompletion } from '@/domain/types';
import { useChild, useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { accentFor, colors, radii, spacing } from '@/theme';

interface Props {
  completion: MissionCompletion;
}

function elapsedLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `il y a ${hours} h`;
}

/**
 * Une demande à trancher. Deux réponses, rien d'autre — cette carte est la
 * moitié parent du parcours principal et doit rester une interaction de deux
 * secondes.
 *
 * **Ce qui se décide ici, et comment le dire.** « VALIDER » et « REFUSER »
 * semblaient porter sur la mission elle-même, comme si l'on approuvait qu'on
 * range une chambre. Ce que le parent tranche, c'est **si son enfant l'a
 * réellement faite**. Le complément manquait, et il manquait au bouton : il est
 * rendu à l'en-tête, qui reprend mot pour mot ce que l'enfant a déclaré en
 * appuyant sur « J'AI TERMINÉ ». Les deux actions ne sont plus que des
 * réponses à cette phrase.
 *
 * **Pourquoi « C'est fait » et non « Mission accomplie ».** Dans ce produit, un
 * participe passé désigne un état atteint : la pastille « VALIDÉE », la
 * célébration « Mission accomplie ». Un participe sur un bouton se lirait donc
 * comme une étiquette de statut, pas comme une décision. « C'est fait » est une
 * proposition complète — sujet, verbe — donc une réponse. Et ce n'est pas un mot
 * de plus à apprendre : l'écran de l'enfant dit déjà « Quand c'est fait, appuie
 * sur le bouton vert ».
 *
 * **Pourquoi « À refaire » et non « Refuser ».** Un bouton rouge nommé
 * « refuser » porte sur l'enfant, et un parent qui hésite à l'appuyer finit par
 * valider une mission bâclée pour éviter la dispute — ce qui vide le système de
 * son sens. « À refaire » décrit ce qui se passe vraiment, sans reproche, et
 * ce sont exactement les mots de la notification que l'enfant reçoit depuis le
 * premier jour : « Mission à refaire ». C'est le bouton qui était en retard.
 *
 * Icône et mot, jamais l'un sans l'autre : la règle d'accessibilité du produit,
 * qui permet ici des libellés courts sans les rendre obscurs — et le lecteur
 * d'écran, lui, entend la phrase entière.
 */
export function RequestCard({ completion }: Props) {
  const data = useFamily();
  const child = useChild(completion.childId);
  const approve = useMinoStore((s) => s.approveCompletion);
  const reject = useMinoStore((s) => s.rejectCompletion);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const mission = data?.missions.find((m) => m.id === completion.missionId);
  if (!child || !mission) return null;

  const accent = accentFor(mission.id);
  const minutes = completion.minutesRequested;

  const run = async (action: 'approve' | 'reject') => {
    setBusy(action);
    try {
      if (action === 'approve') await approve(completion.id);
      else await reject(completion.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Avatar avatarKey={child.avatarKey} size={40} />
        <View style={styles.headerTexts}>
          {/* La déclaration de l'enfant, pas seulement son prénom : c'est elle
              que le parent confirme ou renvoie. */}
          <Text variant="bodyStrong">{`${child.firstName} a terminé sa mission`}</Text>
          <Text variant="caption" color={colors.textSubtle}>
            {elapsedLabel(completion.completedAt)}
          </Text>
        </View>
      </View>

      <View style={styles.missionRow}>
        <View style={[styles.iconTile, { backgroundColor: accent.tint }]}>
          <Text style={styles.icon}>{mission.icon}</Text>
        </View>
        <View style={styles.missionTexts}>
          <Text variant="cardTitle" numberOfLines={2}>
            {mission.title}
          </Text>
          {/* Le gain reste ici, en évidence : c'est ce que le parent accorde, et
              il doit le lire avant de décider, pas après. */}
          <Text variant="label" color={colors.blue}>
            {`+${minutes} min`}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => run('reject')}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel={`${child.firstName} : « ${mission.title} » n’est pas faite, la mission repart dans sa liste et aucune minute n’est ajoutée.`}
          style={({ pressed }) => [
            styles.action,
            styles.again,
            busy === 'reject' && styles.busy,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.glyph} color={colors.textMuted}>
            ↩
          </Text>
          <Text variant="label" color={colors.textMuted} center>
            À refaire
          </Text>
        </Pressable>

        {/* Plus large et coloré : confirmer est la réponse attendue neuf fois
            sur dix, et deux boutons de poids égal feraient hésiter à chaque
            carte — hésitation qui se paie en missions validées sans regarder. */}
        <Pressable
          onPress={() => run('approve')}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel={`Oui, ${child.firstName} a fait « ${mission.title} » : lui ajouter ${minutes} minutes.`}
          style={({ pressed }) => [
            styles.action,
            styles.done,
            busy === 'approve' && styles.busy,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.glyph} color={colors.onBrand}>
            ✓
          </Text>
          <Text variant="label" color={colors.onBrand} center>
            {`C’est fait · +${minutes} min`}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTexts: { gap: 1 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  missionTexts: { flex: 1, gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    // 72 points de haut : la cible reste confortable pour un pouce, même
    // pressé, ce qui est l'état normal d'un parent à 20 h.
    minHeight: 72,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  again: { flex: 1, backgroundColor: colors.surfaceSunken },
  done: { flex: 1.9, backgroundColor: colors.mint },
  busy: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  glyph: { fontSize: 24, lineHeight: 28 },
});

export default RequestCard;
