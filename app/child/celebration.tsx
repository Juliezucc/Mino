import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MascotClip } from '@/components/mascot';
import { Button, Confetti, Screen, Text, TimeRing } from '@/components/ui';
import { registerOf } from '@/domain/ageBand';
import { Celebration, celebrationFor } from '@/domain/ledger';
import { unitLabel } from '@/domain/minos';
import { MissionCompletion } from '@/domain/types';
import { useActiveChild, useBalance, useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

/** Delay before the counter starts climbing, so the child reads the reward first. */
const RING_DELAY = 900;

/**
 * The payoff screen: confetti, the mascot, the minutes won, and the counter
 * visibly climbing from the old balance to the new one (35 → 50).
 *
 * **Il célèbre tout ce qui attend, pas une mission.**
 *
 * Le défaut que cela répare se voit dès qu'on se sert vraiment de
 * l'application : un parent rentre le soir, confirme les huit missions de la
 * journée d'un coup, passe sur le profil de l'enfant — et reçoit huit écrans
 * de confettis à la file, chacun s'ouvrant sur le précédent. Le premier fait
 * plaisir. Le troisième est un obstacle entre l'enfant et son temps d'écran.
 *
 * Une seule célébration, donc, et un récapitulatif quand il y a plusieurs
 * missions : le total en gros, le détail juste en dessous. C'est aussi plus
 * juste que huit fois « +15 » — ce que l'enfant veut savoir, c'est ce qu'il a
 * gagné en tout.
 */
export default function Celebration() {
  const router = useRouter();
  const { completionId } = useLocalSearchParams<{ completionId?: string }>();
  const child = useActiveChild();
  const data = useFamily();
  const balance = useBalance(child?.id);
  const markCelebrated = useMinoStore((s) => s.markCelebrated);

  /**
   * Le lot est figé au montage, et il le faut deux fois plutôt qu'une : les
   * marquer célébrées vide la liste dont l'écran se sert, et l'écran se
   * viderait sous les yeux de l'enfant.
   *
   * `completionId` reste accepté, mais n'est plus qu'un filet : l'écran
   * s'ouvre parfois sur une complétion qui vient d'arriver et que le magasin
   * n'a pas encore reprise.
   */
  const fermeRef = useRef(false);
  const lotRef = useRef<Celebration | null>(null);
  if (!lotRef.current && data && child) {
    lotRef.current = celebrationFor(data, child.id, completionId);
  }
  const lot = lotRef.current?.completions ?? [];
  const minutes = lotRef.current?.minutes ?? 0;

  const [ringValue, setRingValue] = useState(Math.max(0, balance - minutes));

  useEffect(() => {
    if (lot.length === 0) return;
    // Une seule écriture pour tout le lot : huit allers-retours réseau pour un
    // écran que l'enfant referme en deux secondes, c'est huit occasions d'en
    // rater un.
    markCelebrated(lot.map((c) => c.id)).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const timer = setTimeout(() => setRingValue(balance), RING_DELAY);
    return () => clearTimeout(timer);
    // Runs once for this batch: the balance is read at mount on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.length]);

  if (!child || lot.length === 0) return null;

  // A fourteen-year-old showered in confetti closes the app. Same moment,
  // different volume.
  const { unit, celebrate } = registerOf(child);
  const plusieurs = lot.length > 1;

  const titre = plusieurs
    ? `${lot.length} missions accomplies${celebrate ? ' !' : ''}`
    : `Mission accomplie${celebrate ? ' !' : ''}`;

  const missionDe = (completion: MissionCompletion) =>
    data?.missions.find((m) => m.id === completion.missionId);

  // Une seule fermeture, même sur trois appuis : un enfant de cinq ans qui
  // trouve qu'il ne se passe rien tape plusieurs fois, et deux `back()`
  // remonteraient d'un écran de trop — il se retrouverait ailleurs que là d'où
  // il vient.
  const close = () => {
    if (fermeRef.current) return;
    fermeRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/child');
  };

  return (
    // Défilable dès qu'il y a un récapitulatif : une famille de trois enfants
    // avec une routine complète fait dix lignes, et le bouton ne doit jamais
    // sortir de l'écran.
    <Screen background={colors.surface} contentStyle={styles.content} scroll={plusieurs}>
      <View style={styles.top}>
        <Text variant="title" color={colors.mintInk} center>
          {titre}
        </Text>
        {!plusieurs && missionDe(lot[0]) ? (
          <Text variant="body" color={colors.textMuted} center>
            {`${missionDe(lot[0])!.icon}  ${missionDe(lot[0])!.title}`}
          </Text>
        ) : null}
      </View>

      <MascotClip
        name="celebrate"
        size={celebrate ? 230 : 150}
        restExpression={celebrate ? 'delighted' : 'proud'}
        loop={false}
      />

      <Text variant="display" color={colors.blueInk} center style={styles.reward}>
        {`+${minutes}`}
      </Text>
      <Text variant="title" color={colors.blueInk} center>
        {unitLabel(minutes, unit).toUpperCase()}
      </Text>

      <Text variant="section" center>
        {celebrate ? `Bravo ${child.firstName} !` : `Ajouté à ton compteur, ${child.firstName}.`}
      </Text>

      {/* Le détail, seulement quand il y a plusieurs missions. L'icône avant le
          titre : à cinq ans, c'est elle qu'on lit. */}
      {plusieurs ? (
        <View style={styles.recap}>
          {lot.map((completion) => {
            const mission = missionDe(completion);
            return (
              <View key={completion.id} style={styles.ligne}>
                <Text style={styles.ligneIcone}>{mission?.icon ?? '⭐'}</Text>
                <Text variant="body" style={styles.ligneTitre} numberOfLines={1}>
                  {mission?.title ?? 'Mission'}
                </Text>
                <Text variant="label" color={colors.blueInk}>
                  {`+${completion.minutesAwarded ?? 0}`}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <TimeRing minutes={ringValue} size={190} unit={unit} />

      <Button
        label={celebrate ? 'SUPER !' : 'OK'}
        icon={celebrate ? '🎉' : undefined}
        size={celebrate ? 'kid' : 'default'}
        onPress={close}
      />

      {/* Last, so the confetti passes in front of the clip: a rendered clip is
          flattened onto the screen colour and would otherwise mask it. */}
      {celebrate ? <Confetti /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  top: { gap: spacing.xs, alignItems: 'center' },
  reward: { marginBottom: -spacing.sm },
  recap: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ligneIcone: { fontSize: 22 },
  ligneTitre: { flex: 1 },
});
