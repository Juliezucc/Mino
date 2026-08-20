import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import {
  CHILD_HELPLINE,
  CompanionContext,
  buildContext,
  greeting,
} from '@/domain/companion';
import { CompanionTurn, getCompanionService } from '@/services/companion';
import { useActiveChild, useBalance, useChildMissions } from '@/store/selectors';
import { colors, radii, spacing } from '@/theme';

/**
 * Mino qui reste.
 *
 * L'écran où l'on arrive quand il n'y a plus de temps d'écran. Tout ici est
 * dessiné pour une conversation **courte** : pas d'historique d'hier, pas de
 * fil infini, pas de notification qui rappelle Mino. On vient, on parle, on
 * repart — et Mino pousse dehors bien avant la fin du budget.
 *
 * Ce qui n'y est délibérément pas :
 *
 * — **aucun autre humain.** C'est un personnage, jamais un salon. Rien ici ne
 *   permet à quiconque d'écrire à un enfant ; la règle « pas de chat » du
 *   cahier des charges portait sur cela, et elle tient toujours.
 * — **aucun historique conservé sur l'appareil.** La conversation vit le temps
 *   de l'écran. Ce qui n'est pas gardé ne peut pas être lu par le suivant.
 */
export default function CompanionScreen() {
  const router = useRouter();
  const child = useActiveChild();
  const balance = useBalance(child?.id);
  const missions = useChildMissions(child?.id);

  const [turns, setTurns] = useState<CompanionTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const companion = getCompanionService();

  // Le jour de l'année : fait tourner les défis sans hasard, pour que deux
  // enfants du même âge n'aient pas le même le même jour.
  const day = useMemo(() => Math.floor(Date.now() / 86_400_000), []);

  const context: CompanionContext | null = useMemo(() => {
    if (!child) return null;
    return buildContext({
      child,
      balance,
      missions,
      used: left === null ? 0 : Math.max(0, 20 - left),
      day,
    });
  }, [child, balance, missions, left, day]);

  // La première phrase vient de nous, pas du modèle : elle doit être exacte,
  // et elle ne coûte rien.
  useEffect(() => {
    if (!context || turns.length > 0) return;
    setTurns([{ role: 'mino', text: greeting(context) }]);
  }, [context, turns.length]);

  useEffect(() => {
    if (!child) return;
    companion.remaining(child.id).then(setLeft).catch(() => setLeft(null));
  }, [child, companion]);

  if (!child || !context) return null;

  // Le parent a éteint le compagnon. Cacher le bouton ne suffit pas : une
  // route se rejoint aussi par un lien, et un réglage qui ne tient que par
  // l'interface n'est pas un réglage.
  if (child.companionEnabled === false) {
    return (
      <Screen contentStyle={styles.screen}>
        <ScreenHeader onBack={() => router.back()} title="Mino" />
        <EmptyState
          title="Mino ne discute pas"
          message="Tes parents ont choisi que Mino ne parle pas ici. Tu peux quand même voir tes missions !"
          action={{ label: 'VOIR MES MISSIONS', onPress: () => router.push('/child/missions') }}
        />
      </Screen>
    );
  }

  const closed = left !== null && left <= 0;

  const send = async () => {
    const message = draft.trim();
    if (!message || thinking || closed) return;

    setDraft('');
    setTurns((t) => [...t, { role: 'child', text: message }]);
    setThinking(true);

    try {
      const reply = await companion.say({
        childId: child.id,
        message,
        context,
        history: turns,
      });
      setTurns((t) => [...t, { role: 'mino', text: reply.text }]);
      setLeft(reply.left);
      if (reply.safety === 'alert') setAlerted(true);
    } finally {
      setThinking(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return (
    <Screen contentStyle={styles.screen} scroll={false}>
      <ScreenHeader onBack={() => router.back()} title="Mino" />

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        >
          {turns.map((turn, index) => (
            <View
              key={index}
              style={[styles.row, turn.role === 'child' ? styles.rowChild : styles.rowMino]}
            >
              {turn.role === 'mino' ? <Mascot expression="happy" size={44} /> : null}
              <View style={[styles.bubble, turn.role === 'child' ? styles.fromChild : styles.fromMino]}>
                <Text variant="body" color={turn.role === 'child' ? colors.onBrand : colors.text}>
                  {turn.text}
                </Text>
              </View>
            </View>
          ))}

          {thinking ? (
            <View style={[styles.row, styles.rowMino]}>
              <Mascot expression="motivated" size={44} />
              <View style={[styles.bubble, styles.fromMino]}>
                <Text variant="body" color={colors.textMuted}>
                  …
                </Text>
              </View>
            </View>
          ) : null}

          {/* Une confidence grave : Mino s'est arrêté, et le seul bouton qui
              reste mène à quelqu'un dont c'est le métier. */}
          {alerted ? (
            <Card background={colors.yellowSoft} elevation="none" style={styles.helpline}>
              <Text variant="cardTitle" center>
                {CHILD_HELPLINE.label}
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                Gratuit, confidentiel, ouvert jour et nuit.
              </Text>
              <Button
                label="APPELER LE 119"
                size="kid"
                onPress={() => Linking.openURL(`tel:${CHILD_HELPLINE.number}`).catch(() => undefined)}
              />
            </Card>
          ) : null}
        </ScrollView>

        {closed ? (
          <Card background={colors.mintSoft} elevation="none" style={styles.closed}>
            <Text variant="body" center>
              À demain ! Va vivre une aventure 🌍
            </Text>
            <Button label="VOIR MES MISSIONS" size="kid" onPress={() => router.push('/child/missions')} />
          </Card>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Écris à Mino…"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              multiline
              maxLength={300}
              onSubmitEditing={send}
              accessibilityLabel="Écrire un message à Mino"
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || thinking}
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
              style={[styles.send, (!draft.trim() || thinking) && styles.sendOff]}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </Pressable>
          </View>
        )}

        {/* Dit franchement, parce qu'un enfant a le droit de le savoir — et
            parce que le règlement européen sur l'IA le demande. */}
        <Text variant="caption" color={colors.textSubtle} center style={styles.footer}>
          {companion.capability === 'model'
            ? 'Mino est un personnage, pas une vraie personne. Tes parents peuvent lire vos conversations.'
            : 'Mino répond ici sans connexion : ses réponses sont écrites à l’avance.'}
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: spacing.md },
  fill: { flex: 1 },
  thread: { gap: spacing.md, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  rowMino: { justifyContent: 'flex-start' },
  rowChild: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', padding: spacing.md, borderRadius: radii.lg },
  fromMino: { backgroundColor: colors.surfaceSunken, borderBottomLeftRadius: radii.sm },
  fromChild: { backgroundColor: colors.blue, borderBottomRightRadius: radii.sm },
  helpline: { gap: spacing.sm, marginTop: spacing.md },
  closed: { gap: spacing.md, alignItems: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSunken,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 17,
    color: colors.text,
  },
  send: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { backgroundColor: colors.border },
  sendIcon: { fontSize: 20, color: '#FFFFFF' },
  footer: { paddingTop: spacing.sm },
});
