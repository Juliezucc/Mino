import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen, ScreenHeader, Text } from '@/components/ui';
import { codeTropFacile, parentGate } from '@/domain/parentGate';
import { getAuthService } from '@/services/auth';
import { useParentDeCetAppareil } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, shadows, spacing } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Keeps the parent area out of reach of a curious child. */
export default function ParentPin() {
  const router = useRouter();
  /**
   * L'espace parent, sauf quand l'inscription attend ailleurs.
   *
   * L'écran acceptait autrefois un paramètre `then` et servait aussi de
   * barrière au changement de profil sur un appareil réservé. C'est ce qui
   * produisait deux codes d'affilée : le premier menait au sélecteur, lequel
   * reverrouille l'espace parent en s'ouvrant, si bien que le second était
   * redemandé aussitôt. Changer de profil ne coûte plus de code.
   *
   * `ensuite` revient pour un seul appelant, et le piège d'alors ne se
   * représente pas : `/onboarding/appareil` envoie ici le parent qui vient de
   * déclarer l'appareil partagé, pour qu'il pose son code pendant qu'il est
   * encore là — puis l'installation reprend au blocage, qui est l'étape
   * suivante.
   *
   * **Le sélecteur de profil est l'exception, et elle a coûté la
   * fonctionnalité.** Le commentaire d'origine affirmait que la destination
   * n'était jamais le sélecteur, « donc rien ne se reverrouille derrière ».
   * C'est devenu faux le jour où `who.tsx` a demandé le code pour ouvrir le
   * profil d'un autre enfant : le sélecteur RE-MONTE et referme l'espace
   * parent en s'ouvrant. D'où `ouvrir`, qui traverse cet écran sans être lu —
   * le sélecteur le lira, lui, et terminera le geste.
   *
   * Seuls des chemins internes sont acceptés : un paramètre d'URL décide ici
   * d'où atterrit quelqu'un qui vient de saisir un secret.
   */
  const { ensuite, ouvrir, retour } = useLocalSearchParams<{
    ensuite?: string;
    ouvrir?: string;
    retour?: string;
  }>();
  const chemin =
    typeof ensuite === 'string' && ensuite.startsWith('/') && !ensuite.startsWith('//')
      ? ensuite
      : '/parent';
  /**
   * Un identifiant d'enfant, et rien d'autre.
   *
   * Il repart dans une URL : le filtrer n'est pas une politesse. Les
   * identifiants du dépôt sont de la forme `enf_<uuid>` — tout ce qui n'y
   * ressemble pas est jeté plutôt que renvoyé tel quel.
   */
  const aOuvrir = typeof ouvrir === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(ouvrir) ? ouvrir : null;
  /**
   * D'où l'on vient, pour savoir où l'on repart.
   *
   * Comme `ouvrir`, il traverse cet écran sans être lu : c'est l'écran
   * d'arrivée qui s'en sert. Même filtre — un chemin interne, jamais une
   * adresse fabriquée ailleurs.
   */
  const aRevenirVers =
    typeof retour === 'string' && retour.startsWith('/') && !retour.startsWith('//')
      ? retour
      : null;

  const suite = {
    ...(aOuvrir ? { ouvrir: aOuvrir } : {}),
    ...(aRevenirVers ? { retour: aRevenirVers } : {}),
  };
  const destination = Object.keys(suite).length
    ? { pathname: chemin, params: suite }
    : chemin;
  const parent = useParentDeCetAppareil();
  const unlockParent = useMinoStore((s) => s.unlockParent);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  /**
   * Null while we are asking. A family with no PIN at all — an account that
   * never set one — must be able to define it here rather than meet "wrong
   * code" forever.
   */
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  /**
   * De quel appareil s'agit-il ?
   *
   * Cette question manquait, et son absence ouvrait la porte en grand. Sur la
   * tablette d'un enfant — celle qui a rejoint la famille avec le code — il
   * n'existe aucun code parent, puisque le code appartient au compte du
   * parent. L'écran en concluait « aucun code n'est défini » et invitait
   * poliment **l'enfant** à en choisir un. Il lui suffisait de taper quatre
   * chiffres pour s'ouvrir l'espace parent sur son propre appareil.
   *
   * Trouvé en conduisant le parcours du deuxième appareil, jusqu'au bout.
   */
  const [deviceSession, setDeviceSession] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = getAuthService();
    auth.hasParentPin().then(setHasPin).catch(() => setHasPin(true));
    auth
      .session()
      .then((s) => setDeviceSession(s.kind === 'device'))
      // Dans le doute, on suppose l'appareil d'un enfant : se tromper dans ce
      // sens fait attendre un parent, se tromper dans l'autre ouvre l'espace
      // parent à un enfant.
      .catch(() => setDeviceSession(true));
  }, []);

  // Tant qu'on interroge, on n'affiche ni l'un ni l'autre : `enter` est le
  // seul état qui ne promette rien de faux.
  /**
   * L'appareil que le parent a déclaré à son enfant, ou partagé.
   *
   * `deviceSession` ne reconnaît qu'une tablette arrivée par le code famille.
   * La tablette du salon, elle, porte très souvent la session du parent
   * lui-même — c'est là qu'il s'est inscrit — et passait donc pour son
   * téléphone personnel : l'enfant qui touchait « Espace parent » se voyait
   * offrir de choisir le code. Ce que le parent a déclaré à l'inscription est
   * la seule chose qui distingue les deux.
   */
  const device = useMinoStore((s) => s.device);
  const declareALEnfant = device.declareALEnfant || device.lockedChildId !== null;

  /**
   * Le parent vient de demander à poser son code — et il le prouve par un
   * geste qu'un enfant ne fait pas. Voir `poseDemandeeParLeParent`.
   *
   * Lu une seule fois, à l'ouverture, et consommé aussitôt : l'état local le
   * garde le temps de cette visite, le signal ne survit pas à l'écran. Le
   * laisser vivre rouvrirait la porte à l'enfant à qui l'on tend la tablette
   * une minute plus tard.
   */
  const consommerLAutorisation = useMinoStore((s) => s.consommerLAutorisationDeCode);
  const [poseDemandeeParLeParent] = useState(() => useMinoStore.getState().poseDuCodeAutorisee);
  useEffect(() => {
    if (poseDemandeeParLeParent) consommerLAutorisation();
  }, [poseDemandeeParLeParent, consommerLAutorisation]);

  const gate =
    hasPin === null || deviceSession === null
      ? 'enter'
      : parentGate({
          hasPin,
          onChildDevice: deviceSession,
          declareALEnfant,
          poseDemandeeParLeParent,
        });
  const canCreatePin = gate === 'create';
  const blocked = gate === 'ask-a-parent';

  const press = (key: string) => {
    if (key === '' || checking || blocked) return;
    setError(null);

    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;

    const next = pin + key;
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  const submit = async (value: string) => {
    setChecking(true);

    if (blocked) {
      setChecking(false);
      setPin('');
      return;
    }

    if (canCreatePin) {
      /**
       * La même règle qu'à l'inscription, et c'est ici qu'elle manquait.
       *
       * Cet écran posait le code sans rien vérifier : `0000` y passait, alors
       * que l'inscription le refuse. Et c'est par ici que passent désormais
       * tous les rattrapages — le bandeau du tableau de bord, la connexion par
       * mot de passe, le changement d'appareil dans les réglages. La porte la
       * plus empruntée était la seule sans serrure.
       */
      if (codeTropFacile(value)) {
        setChecking(false);
        setError('Trop facile à deviner. Choisissez autre chose.');
        setTimeout(() => setPin(''), 220);
        return;
      }
      const created = await getAuthService().setParentPin(value);
      setChecking(false);
      if (!created.ok) {
        setError(created.reason ?? 'Code refusé.');
        setTimeout(() => setPin(''), 220);
        return;
      }
      setHasPin(true);
      await unlockParent(value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace(destination);
      return;
    }

    // Verified by the auth service, which rate-limits it — never compared here.
    const result = await unlockParent(value);
    setChecking(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace(destination);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    setError(result.reason ?? 'Code incorrect.');
    setTimeout(() => setPin(''), 220);
  };

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      {/* Renoncer ramène d'où l'on vient — l'espace enfant ou le sélecteur —
          et jamais ailleurs : une croix qui déplace est une croix qui piège. */}
      <ScreenHeader
        closeIcon
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/who'))}
      />

      <View style={styles.head}>
        <Text variant="title" center>
          {blocked ? 'Réservé aux parents' : canCreatePin ? 'Choisir un code parent' : 'Code parent'}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {blocked
            ? // L'enfant n'a rien à apprendre des protections qui le concernent :
              // l'ancien texte lui disait qu'un code existe, sur quel appareil
              // il se choisit et dans quel menu — et l'invitait à le réclamer.
              'Cette partie de Mino n’est pas pour toi. Reviens en arrière : tes missions t’attendent.'
            : canCreatePin
              ? 'Aucun code n’est encore défini. Choisissez-en un que votre enfant ne devinera pas.'
              : // Sans le `trim`, un parent qui n'a pas fini son inscription se
                // voit saluer « Bonjour null ». Voir `who.tsx`.
                parent?.displayName?.trim()
                ? `Bonjour ${parent.displayName}, entrez votre code à 4 chiffres.`
                : 'Entre ton code à 4 chiffres.'}
        </Text>
      </View>

      {/* Ni pastilles ni pavé quand il n'y a rien à taper : un clavier qui ne
          répond pas se lit comme une panne, et on essaie plus fort. */}
      {blocked ? null : (
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < pin.length && styles.dotFilled,
                error && styles.dotError,
              ]}
            />
          ))}
        </View>
      )}

      {error ? (
        <Text variant="label" color={colors.dangerInk} center>
          {error}
        </Text>
      ) : (
        <View style={styles.errorSpacer} />
      )}

      {blocked ? null : (
      <View style={styles.pad}>
        {KEYS.map((key, index) => (
          <Pressable
            key={`${key}-${index}`}
            onPress={() => press(key)}
            disabled={key === ''}
            accessibilityRole="button"
            accessibilityLabel={key === '⌫' ? 'Effacer' : key}
            style={({ pressed }) => [
              styles.key,
              key === '' && styles.keyHidden,
              pressed && key !== '' && styles.keyPressed,
            ]}
          >
            <Text variant="title" color={key === '⌫' ? colors.textMuted : colors.text}>
              {key}
            </Text>
          </Pressable>
        ))}
      </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.md },
  head: { gap: spacing.sm, marginTop: spacing.lg },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surfaceSunken,
  },
  dotFilled: { backgroundColor: colors.blue },
  dotError: { backgroundColor: colors.dangerSoft },
  errorSpacer: { height: 19 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  key: {
    width: 78,
    height: 68,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  keyHidden: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  keyPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
});
