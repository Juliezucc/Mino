import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MascotClip } from '@/components/mascot';
import { Button, Confetti, Screen, Text, TimeRing } from '@/components/ui';
import { registerOf } from '@/domain/ageBand';
import { bonusHeadline } from '@/domain/bonus';
import { unitLabel } from '@/domain/minos';
import { ScreenTimeTransaction } from '@/domain/types';
import { rememberBonus } from '@/data/seenBonus';
import { useActiveChild, useBalance, useFamily } from '@/store/selectors';
import { colors, spacing } from '@/theme';

/** Le temps de lire le cadeau avant que le compteur ne se mette à grimper. */
const RING_DELAY = 900;

/**
 * « Tu as reçu un bonus ! »
 *
 * Le pendant, côté enfant, du geste que le parent fait déjà : offrir des
 * minutes sans mission. Jusqu'ici elles apparaissaient sur le compteur sans que
 * rien ne dise d'où elles venaient — un cadeau qu'on ne voit pas arriver n'est
 * pas un cadeau.
 *
 * Ce que cet écran met en avant n'est pas le nombre, c'est **la raison écrite
 * par le parent**. « Pour ton exposé » vaut mieux que n'importe quelle formule
 * que nous pourrions inventer, et c'est elle qui fait la différence entre un
 * cadeau et un virement.
 */
export default function BonusReceived() {
  const router = useRouter();
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const child = useActiveChild();
  const data = useFamily();
  const balance = useBalance(child?.id);

  // Figé au montage : mémoriser le bonus ne doit pas vider l'écran en cours de
  // route, comme la célébration de mission le fait déjà pour la même raison.
  const bonusRef = useRef<ScreenTimeTransaction | null>(null);
  if (!bonusRef.current && data) {
    bonusRef.current = data.transactions.find((t) => t.id === transactionId) ?? null;
  }
  const bonus = bonusRef.current;
  const minutes = bonus?.delta ?? 0;

  const [ringValue, setRingValue] = useState(Math.max(0, balance - minutes));

  useEffect(() => {
    if (!bonus || !child) return;
    // Retenu tout de suite : un enfant qui revient en arrière ne doit pas
    // retomber sur la même fête.
    rememberBonus(child.id, bonus.id).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const timer = setTimeout(() => setRingValue(balance), RING_DELAY);
    return () => clearTimeout(timer);
    // Une seule fois pour ce bonus : le solde est lu au montage, exprès.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonus?.id]);

  if (!child || !bonus) return null;

  const { unit, celebrate } = registerOf(child);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/child');
  };

  return (
    <Screen background={colors.surface} contentStyle={styles.content} scroll={false}>
      <View style={styles.top}>
        <Text variant="title" color={colors.pink} center>
          {celebrate ? '🎁 Bonus reçu !' : '🎁 Bonus reçu'}
        </Text>
        {/* La raison d'abord, en grand : c'est le cadeau, le reste est le
            paquet. */}
        <Text variant="section" center>
          {bonusHeadline(bonus.reason)}
        </Text>
      </View>

      <MascotClip
        name="celebrate"
        size={celebrate ? 230 : 150}
        restExpression="delighted"
        loop={false}
      />

      <Text variant="display" color={colors.pink} center style={styles.reward}>
        {`+${minutes}`}
      </Text>
      <Text variant="title" color={colors.pink} center>
        {unitLabel(minutes, unit).toUpperCase()}
      </Text>

      <Text variant="body" color={colors.textMuted} center>
        {celebrate
          ? `Offert par tes parents, ${child.firstName} — sans mission, juste pour toi.`
          : 'Offert par tes parents, sans mission.'}
      </Text>

      <TimeRing minutes={ringValue} size={190} unit={unit} />

      <Button
        label={celebrate ? 'MERCI !' : 'OK'}
        icon={celebrate ? '💛' : undefined}
        size={celebrate ? 'kid' : 'default'}
        onPress={close}
      />

      {/* En dernier, pour que les confettis passent devant le clip : un clip
          rendu est aplati sur la couleur de l'écran et le masquerait sinon. */}
      {celebrate ? <Confetti /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  top: { alignItems: 'center', gap: spacing.xs },
  reward: { marginBottom: -spacing.sm },
});
