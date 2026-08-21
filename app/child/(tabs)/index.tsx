import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedMascot, MascotAnimation } from '@/components/mascot';
import { MascotExpression } from '@/components/mascot/types';
import { Button, Card, MinutesBadge, Screen, Text, TimeRing } from '@/components/ui';
import { unitOf } from '@/domain/ageBand';
import { pendingBonus } from '@/domain/bonus';
import { lastSeenBonus } from '@/data/seenBonus';
import { useBalanceDetail, useChildMissions, useActiveChild, useFamily } from '@/store/selectors';
import { colors, spacing, tabBarSpace } from '@/theme';

/** Child home: who I am, how much time I have, and one obvious thing to do. */
export default function ChildHome() {
  const router = useRouter();
  const child = useActiveChild();
  const balance = useBalanceDetail(child?.id);
  const missions = useChildMissions(child?.id);
  const data = useFamily();

  /**
   * Un bonus reçu se fête ici.
   *
   * L'accueil est le seul écran où l'enfant passe forcément, et le déclencheur
   * ne peut pas vivre dans les données : le registre ne se modifie jamais, donc
   * ce qui a déjà été fêté est retenu sur l'appareil (voir `domain/bonus`).
   *
   * Le calcul se refait à chaque changement du registre, et pas seulement au
   * montage : le cas le plus fréquent est justement celui où le parent offre
   * les minutes **pendant** que la tablette de l'enfant est ouverte sur cet
   * écran. Un déclencheur qui ne regarde qu'au démarrage raterait précisément
   * le moment qu'on cherche à célébrer.
   */
  // `undefined` tant que l'appareil n'a pas dit ce qu'il avait déjà fêté :
  // sans cette distinction, le premier rendu croirait n'avoir rien vu et
  // ressortirait un cadeau déjà montré.
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!child) return;
    lastSeenBonus(child.id).then(setSeen).catch(() => setSeen(null));
  }, [child?.id]);

  const bonus =
    child && data && seen !== undefined ? pendingBonus(data.transactions, child.id, seen) : null;

  useEffect(() => {
    if (!bonus) return;
    // Retenu ici aussi, tout de suite : l'écran de fête l'écrit sur le disque,
    // mais l'attendre laisserait le temps à un rendu de relancer la navigation.
    setSeen(bonus.id);
    router.push({ pathname: '/child/bonus', params: { transactionId: bonus.id } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonus?.id]);

  if (!child || !balance) return null;

  const unit = unitOf(child);

  const todo = missions.filter((m) => m.state === 'todo');
  const waiting = missions.filter((m) => m.state === 'pending');

  /**
   * Un enfant qui n'a encore rien gagné n'a pas « plus » de minos : il n'en a
   * jamais eu. Le dire autrement, c'est reprocher à quelqu'un d'avoir dépensé
   * ce qu'on ne lui a jamais donné — et accueillir un enfant, le premier jour,
   * avec un Mino triste.
   */
  const debut = data ? data.transactions.every((t) => t.childId !== child.id) : false;

  const expression: MascotExpression = debut
    ? 'motivated'
    : balance.minutes === 0
      ? 'sad'
      : balance.minutes < 10
        ? 'worried'
        : waiting.length > 0
          ? 'motivated'
          : 'happy';

  const message = debut
    ? todo.length > 0
      ? `Bienvenue ! Tu as ${todo.length} mission${todo.length > 1 ? 's' : ''} pour commencer.`
      : 'Bienvenue ! Tes missions arrivent bientôt.'
    : balance.minutes === 0
      ? unit === 'minos'
        ? 'Plus de minos… fais une mission pour en gagner !'
        : 'Plus de temps. Une mission et tu en regagnes.'
      : balance.minutes < 10
        ? unit === 'minos'
          ? 'Presque plus de minos ! Une mission et hop.'
          : 'Presque plus de temps.'
        : todo.length > 0
          ? `Tu as ${todo.length} mission${todo.length > 1 ? 's' : ''} à faire aujourd’hui.`
          : 'Toutes tes missions sont faites. Bravo !';

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text variant="hero">
            {unit === 'minos' ? `Salut ${child.firstName} ! 👋` : `Bonjour ${child.firstName}`}
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {message}
          </Text>
        </View>
        {expression === 'happy' ? (
          // A single hop on arrival, then the mascot goes still.
          <MascotAnimation name="wave" size={96} restExpression="happy" />
        ) : (
          <AnimatedMascot expression={expression} size={96} />
        )}
      </View>

      <Card style={styles.ringCard} elevation="soft">
        <TimeRing minutes={balance.minutes} unit={unit} />
        {balance.earnedToday > 0 ? (
          <View style={styles.earned}>
            <Text variant="label" color={colors.textMuted}>
              Gagné aujourd’hui
            </Text>
            <MinutesBadge minutes={balance.earnedToday} tone="mint" unit={unit} />
          </View>
        ) : null}
      </Card>

      <Button
        label="VOIR MES MISSIONS"
        icon="📋"
        size="kid"
        onPress={() => router.push('/child/missions')}
      />

      {waiting.length > 0 ? (
        <Card background={colors.yellowSoft} elevation="none">
          <View style={styles.waitingRow}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <View style={styles.waitingTexts}>
              <Text variant="cardTitle">
                {waiting.length > 1
                  ? `${waiting.length} missions en attente`
                  : '1 mission en attente'}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {unit === 'minos'
                  ? 'Ton parent confirme, et tes minos arrivent.'
                  : 'En attente de confirmation par ton parent.'}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTexts: { flex: 1, gap: spacing.xs },
  ringCard: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  earned: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  waitingIcon: { fontSize: 28 },
  waitingTexts: { flex: 1, gap: 2 },
});
