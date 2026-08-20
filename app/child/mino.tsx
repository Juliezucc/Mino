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

import { AnimatedMascot } from '@/components/mascot';
import { Button, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import {
  CHILD_HELPLINE,
  CompanionContext,
  SafetyLevel,
  buildContext,
  expressionFor,
  greeting,
  phaseOf,
} from '@/domain/companion';
import { CompanionTurn, getCompanionService } from '@/services/companion';
import { SpeechStatus, getSpeechService, initSpeechService } from '@/services/speech';
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
  const [listening, setListening] = useState(false);
  /** Ce que l'enfant vient de dire et ce que Mino vient de répondre : de quoi
      choisir son visage sans rien demander au modèle. */
  const [lastSafety, setLastSafety] = useState<SafetyLevel>('none');
  const [typing, setTyping] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [speech, setSpeech] = useState(getSpeechService());
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

  // Savoir si l'appareil sait transcrire hors ligne demande de l'interroger :
  // le bouton n'apparaît donc qu'une fois la réponse connue, jamais avant.
  useEffect(() => {
    initSpeechService().then(setSpeech).catch(() => undefined);
    return () => {
      // Quitter l'écran coupe le micro. Un micro qui reste ouvert parce qu'on
      // a changé d'écran est exactement ce qu'on ne veut pas dans une
      // application pour enfants.
      getSpeechService().stop().catch(() => undefined);
    };
  }, []);

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
  const used = left === null ? 0 : Math.max(0, 20 - left);

  const expression = expressionFor({
    phase: phaseOf(used),
    safety: lastSafety,
    childMessage: [...turns].reverse().find((t) => t.role === 'child')?.text,
    minoReply: turns[turns.length - 1]?.role === 'mino' ? turns[turns.length - 1].text : undefined,
    challenges: context.challenges,
    thinking,
  });

  /**
   * Parler plutôt qu'écrire.
   *
   * Le texte arrive dans le champ à mesure, et n'est pas envoyé tout seul :
   * l'enfant relit et appuie. Une dictée qui s'envoie seule transforme le
   * moindre bruit de la pièce en message à Mino.
   */
  const dictate = async () => {
    setMicError(null);

    if (listening) {
      await speech.stop();
      setListening(false);
      return;
    }

    const permission = await speech.requestPermission();

    // Deux refus, deux phrases. « Impossible ici » ne se règle nulle part —
    // c'est le cas dans cet aperçu, où le cadre interdit le micro — et envoyer
    // un enfant chercher un parent pour quelque chose qu'aucun parent ne peut
    // changer est la plus agaçante des deux erreurs.
    if (permission === 'blocked') {
      setMicError('La dictée ne marche pas dans cet aperçu. Sur un vrai téléphone, elle marchera !');
      return;
    }
    if (permission === 'denied') {
      setMicError('Mino n’a pas le droit d’écouter. Un parent peut l’autoriser dans les réglages du téléphone.');
      return;
    }

    const onStatus = (status: SpeechStatus) => {
      setListening(status === 'listening');
      if (status === 'denied') {
        setMicError('Mino n’a pas le droit d’écouter. Un parent peut l’autoriser dans les réglages du téléphone.');
      }
      if (status === 'error') setMicError('Je n’ai pas bien entendu. Tu peux réessayer, ou écrire !');
    };

    await speech
      .start({ onText: (text) => setDraft(text), onStatus })
      .catch(() => onStatus('error'));
  };

  const send = async () => {
    const message = draft.trim();
    if (!message || thinking || closed) return;

    // Envoyer coupe le micro : sans cela, la dictée continue de remplir un
    // champ que l'on vient de vider.
    if (listening) {
      await speech.stop().catch(() => undefined);
      setListening(false);
    }

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
      setLastSafety(reply.safety);
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
        {/* Mino en grand, au-dessus de la conversation.
            Son visage suit ce qui se dit — l'expression est déduite du dernier
            échange, sans rien coûter de plus. Il rétrécit dès que l'enfant
            écrit : sur un petit téléphone, clavier ouvert, une mascotte de
            140 px mangerait tout le fil. */}
        <View style={styles.stage}>
          <AnimatedMascot
            key={expression}
            expression={expression}
            size={typing ? 76 : 132}
            animation="enter"
          />
        </View>

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
              <View style={[styles.bubble, turn.role === 'child' ? styles.fromChild : styles.fromMino]}>
                <Text variant="body" color={turn.role === 'child' ? colors.onBrand : colors.text}>
                  {turn.text}
                </Text>
              </View>
            </View>
          ))}

          {thinking ? (
            <View style={[styles.row, styles.rowMino]}>
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
            {/* Le micro d'abord, à gauche et gros : c'est la voie principale
                pour un enfant qui écrit encore lentement. Il n'apparaît que si
                l'appareil sait transcrire tout seul — voir services/speech. */}
            {speech.available ? (
              <Pressable
                onPress={dictate}
                accessibilityRole="button"
                accessibilityLabel={listening ? 'Arrêter de parler' : 'Parler à Mino'}
                accessibilityState={{ selected: listening }}
                style={[styles.mic, listening && styles.micOn]}
              >
                <Text style={styles.micIcon}>{listening ? '⏹' : '🎤'}</Text>
              </Pressable>
            ) : null}

            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={speech.available ? 'Parle ou écris à Mino…' : 'Écris à Mino…'}
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              multiline
              maxLength={300}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
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

        {micError ? (
          <Text
            variant="caption"
            color={micError.startsWith('La dictée') ? colors.textMuted : colors.danger}
            center
            style={styles.footer}
          >
            {micError}
          </Text>
        ) : null}

        {/* Dit franchement, parce qu'un enfant a le droit de le savoir — et
            parce que le règlement européen sur l'IA le demande. Quand la
            dictée ne se fait pas sur l'appareil, on le dit aussi : c'est le
            cas dans un navigateur, jamais sur le téléphone d'un enfant. */}
        <Text variant="caption" color={colors.textSubtle} center style={styles.footer}>
          {companion.capability === 'model'
            ? 'Mino est un personnage, pas une vraie personne. Tes parents peuvent lire vos conversations.'
            : 'Mino répond ici sans connexion : ses réponses sont écrites à l’avance.'}
          {speech.available && !speech.onDevice
            ? ' Dans ce navigateur, la dictée passe par le service de reconnaissance vocale du navigateur.'
            : ''}
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: spacing.md },
  fill: { flex: 1 },
  stage: { alignItems: 'center', paddingTop: spacing.xs, paddingBottom: spacing.sm },
  thread: { gap: spacing.md, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  rowMino: { justifyContent: 'flex-start' },
  rowChild: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', padding: spacing.md, borderRadius: radii.lg },
  fromMino: { backgroundColor: colors.surfaceSunken, borderBottomLeftRadius: radii.sm },
  fromChild: { backgroundColor: colors.blue, borderBottomRightRadius: radii.sm },
  helpline: { gap: spacing.sm, marginTop: spacing.md },
  closed: { gap: spacing.md, alignItems: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  mic: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Rouge et net pendant l'écoute : un micro ouvert doit se voir de loin.
  micOn: { backgroundColor: colors.danger },
  micIcon: { fontSize: 22 },
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
