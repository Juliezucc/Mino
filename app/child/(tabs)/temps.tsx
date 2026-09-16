import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedMascot } from '@/components/mascot';
import {
  Button,
  Card,
  MinutesBadge,
  Screen,
  Text,
  TimeCapsules,
  TimeRing,
  TimeSlider,
} from '@/components/ui';
import { unitOf, tailleBouton } from '@/domain/ageBand';
import { formatDuration } from '@/domain/ledger';
import { bornesPour, formatTime } from '@/domain/minos';
import { activeDevices, deviceIcon, describeDevice } from '@/domain/devices';
import { getScreenTimeService } from '@/services/screenTime';
import { heure, openWindowAt } from '@/domain/freeWindows';
import {
  useActiveChild,
  useBalanceDetail,
  useFamily,
  useMinuteCourante,
  useRequestedSession,
  useRunningSession,
} from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing, tabBarSpace } from '@/theme';

/** "Mon temps": how much I own, on which screen I want it, and how to start. */
export default function ChildTime() {
  const router = useRouter();
  const child = useActiveChild();
  // Les boutons géants sont pour les petits : voir `tailleBouton`. Douze écrans
  // écrivaient « kid » en dur, et un adolescent de quatorze ans les recevait
  // tous.
  const taille = tailleBouton(child);
  const family = useFamily();
  const balance = useBalanceDetail(child?.id);
  const running = useRunningSession(child?.id);

  /**
   * ------------------------------------------- l'onglet Temps ne disait RIEN
   *
   * **Le défaut, et c'est l'écran où l'enfant vient justement.** « Mon temps »
   * ne mentionnait les plages libres nulle part : zéro occurrence dans tout le
   * fichier. Un enfant qui arrive ici un mercredi à 14 h voit son solde, choisit
   * une durée, appuie sur COMMENCER — et reçoit le refus du domaine EN ROUGE,
   * sous le curseur, en petits caractères : « C'est ouvert jusqu'à 16:00, tu
   * n'as rien à dépenser. »
   *
   * Une bonne nouvelle annoncée comme une erreur. C'est probablement ce que les
   * enfants de Julie ont vécu sans savoir le nommer : la plage marchait, mais
   * l'écran où ils vont pour s'en servir la traitait comme un problème.
   *
   * On la dit donc à la place du lanceur, pas après lui.
   */
  const minute = useMinuteCourante();
  const plageOuverte = openWindowAt(
    family?.freeWindows ?? [],
    child?.id ?? null,
    new Date(minute * 60_000),
  );
  const requested = useRequestedSession(child?.id);

  /**
   * Le temps qui défile, ici aussi.
   *
   * **Le défaut, vu par Julie sur le téléphone de son fils.** Pendant une
   * séance, cet onglet n'affichait qu'un bouton « REPRENDRE ». Or le temps
   * court : les minutes se consomment pendant que l'enfant est ailleurs, et
   * c'est précisément ce qu'il doit voir. Un bouton qui invite à « reprendre »
   * laisse croire que quelque chose est en pause — alors que rien ne l'est.
   *
   * Le décompte vivait dans `session.tsx`, l'écran qu'on atteint en touchant ce
   * bouton. Il est donc à un geste de distance de l'endroit où il compte.
   *
   * `-1` et non `0` à l'amorce : zéro se lirait « temps écoulé » au tout
   * premier rendu, avant que le premier battement n'ait eu lieu. C'est la même
   * précaution que dans `session.tsx`, et pour la même raison.
   */
  const [restant, setRestant] = useState(() =>
    running ? Math.max(0, Math.round((new Date(running.endsAt).getTime() - Date.now()) / 1000)) : -1,
  );

  useEffect(() => {
    if (!running) {
      setRestant(-1);
      return;
    }
    const battre = () => {
      const reste = Math.max(0, Math.round((new Date(running.endsAt).getTime() - Date.now()) / 1000));
      setRestant(reste);
      return reste;
    };
    battre();
    const minuteur = setInterval(() => {
      if (battre() <= 0) clearInterval(minuteur);
    }, 1000);
    return () => clearInterval(minuteur);
  }, [running]);
  const startSession = useMinoStore((s) => s.startSession);
  const endSession = useMinoStore((s) => s.endSession);

  // `null` means this very device, the only screen Mino drives by itself.
  const [deviceId, setDeviceId] = useState<string | null>(null);
  /**
   * Le solde entier par défaut, et non « rien de choisi ».
   *
   * Le bouton était désactivé tant qu'aucune puce n'avait été touchée : un
   * enfant voyait « COMMENCER » éteint sans comprendre ce qu'on attendait de
   * lui. Le curseur, lui, montre toujours une valeur — celle-là est donc déjà
   * choisie, et le geste le plus courant, tout prendre, ne demande plus rien.
   */
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!child || !balance) return null;

  const unit = unitOf(child);
  const bornes = bornesPour(balance.minutes);
  const devices = activeDevices(family?.devices);
  // Every declared device is a screen a parent has to start, and so is any
  // session at all when the family asked for approval.
  const supervised = deviceId !== null || child.requireApproval === true;

  const begin = async () => {
    const minutes = selected ?? bornes?.max ?? 0;
    if (!minutes) return;
    setLoading(true);
    try {
      const sessionId = await startSession(child.id, minutes, deviceId ?? undefined);
      setError(null);
      if (supervised) return; // The screen switches to "waiting" on its own.

      // The service seam: today an in-app timer, tomorrow real app unblocking.
      try {
        await getScreenTimeService().grant({ sessionId, childId: child.id, minutes });
      } catch (e) {
        /**
         * Le blocage n'a pas été levé, donc la séance n'a jamais commencé.
         *
         * La refermer tout de suite est ce qui empêche le pire enchaînement :
         * une séance ouverte dans le grand livre, des minutes qui s'écoulent, et
         * des applications restées fermées. Fermée à la seconde, elle ne débite
         * rien — `endSession` ne facture que le temps écoulé, et il est nul.
         */
        await endSession(sessionId, 'stopped').catch(() => undefined);
        throw e;
      }
      router.push({ pathname: '/child/session', params: { sessionId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de démarrer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <Text variant="hero">Mon temps</Text>

      <Card style={styles.ringCard}>
        <TimeRing minutes={balance.minutes} unit={unit} />
        {unit === 'minos' ? <TimeCapsules minutes={balance.minutes} /> : null}
      </Card>

      <Card style={styles.statsCard} elevation="none" background={colors.mintSoft}>
        <View style={styles.statRow}>
          <Text variant="bodyStrong">{unit === 'minos' ? 'Minos gagnés aujourd’hui' : 'Gagné aujourd’hui'}</Text>
          <MinutesBadge minutes={balance.earnedToday} tone="mint" unit={unit} />
        </View>
        {balance.usedToday > 0 ? (
          <View style={styles.statRow}>
            <Text variant="body" color={colors.textMuted}>
              {unit === 'minos' ? 'Minos utilisés aujourd’hui' : 'Utilisé aujourd’hui'}
            </Text>
            <MinutesBadge minutes={-balance.usedToday} tone="muted" unit={unit} />
          </View>
        ) : null}
      </Card>

      {requested ? (
        // A supervised screen: the child asked, and nothing is billed until a
        // parent actually starts the clock.
        <Card style={styles.useCard} background={colors.yellowSoft} elevation="none">
          <AnimatedMascot expression="motivated" size={110} />
          <Text variant="cardTitle" center>
            Demande envoyée
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            {`${formatTime(requested.requestedMinutes, unit)} sur ${describeDevice(family?.devices, requested.deviceId)}. Un parent lance le minuteur quand c’est bon.`}
          </Text>
        </Card>
      ) : running ? (
        <Card style={styles.useCard} background={colors.blueSoft} elevation="none">
          <AnimatedMascot expression="delighted" size={110} />
          <Text variant="cardTitle" center>
            Ton temps tourne
          </Text>
          {/* Le décompte en grand, et le bouton en retrait : ce que l'enfant
              veut savoir, c'est combien il lui reste — pas où appuyer. */}
          <Text variant="hero" color={colors.blueInk} center>
            {restant < 0 ? '—' : formatDuration(restant)}
          </Text>
          <Button
            label="VOIR MON TEMPS"
            variant="secondary"
            size={taille}
            onPress={() =>
              router.push({ pathname: '/child/session', params: { sessionId: running.id } })
            }
          />
        </Card>
      ) : plageOuverte ? (
        /* Ni demande en attente, ni séance en cours, et l'écran est ouvert : le
           lanceur ne mènerait qu'à un refus. On met la nouvelle à sa place.

           **Cette branche passe AVANT celle du solde vide, et l'ordre est le
           défaut lui-même.** Elle était en dessous : un enfant à zéro mino
           pendant une plage ouverte lisait « Plus de minos pour aujourd'hui »
           sur l'écran où il venait justement profiter d'un moment où rien
           n'est décompté. C'est le cas le plus fréquent — un mercredi
           après-midi arrive rarement avec un solde intact — et c'est celui
           que les enfants de Julie ont signalé.

           Pendant une plage, le solde n'a aucune conséquence : il ne bouge
           pas. Il n'a donc rien à dire ici. */
        <Card style={styles.useCard} background={colors.mintSoft} elevation="soft">
          <AnimatedMascot expression="delighted" size={110} />
          <Text variant="hero" color={colors.mintInk} center>
            🎉 C’est ouvert !
          </Text>
          <Text variant="section" color={colors.mintInk} center>
            {`${plageOuverte.label} — jusqu’à ${heure(plageOuverte.endMinute)}`}
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            {unit === 'minos'
              ? 'Tu n’as rien à lancer et rien à dépenser : tes minos t’attendent pour plus tard.'
              : 'Rien à lancer : tes minutes ne sont pas décomptées pendant ce moment.'}
          </Text>
        </Card>
      ) : balance.minutes <= 0 ? (
        <Card style={styles.useCard}>
          {/* Plus de temps d'écran, mais Mino reste. C'est le seul endroit de
              l'application où l'on n'est pas renvoyé à ce qu'il faut faire
              pour mériter quelque chose. */}
          <AnimatedMascot expression="happy" size={120} />
          <Text variant="cardTitle" center>
            {unit === 'minos' ? 'Plus de minos pour aujourd’hui 🥲' : 'Plus de temps pour aujourd’hui 🥲'}
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            {child.companionEnabled === false
              ? 'Fais une mission pour en regagner !'
              : 'Mais moi je reste ! Tu veux me raconter ta journée ?'}
          </Text>
          {child.companionEnabled === false ? null : (
            <Button label="PARLER À MINO" icon="💬" size={taille} onPress={() => router.push('/child/mino')} />
          )}
          <Button
            label="VOIR MES MISSIONS"
            icon="📋"
            variant={child.companionEnabled === false ? 'primary' : 'secondary'}
            // `taille`, et non `'kid'` en dur : la ligne servait un bouton de
            // 64 px avec un libellé de 20 px à une adolescente de quatorze ans,
            // quand les trois autres boutons du même écran sont à 52 px. C'est
            // `tailleBouton` qui connaît le seuil des treize ans — s'en écarter
            // ici rouvrait exactement ce que ce fichier ferme deux lignes plus
            // haut.
            size={child.companionEnabled === false ? taille : undefined}
            onPress={() => router.push('/child/missions')}
          />
        </Card>
      ) : (
        <Card style={styles.useCard}>
          <Text variant="section" center>
            Utiliser mon temps
          </Text>

          {devices.length > 0 ? (
            <>
              <Text variant="label" color={colors.textMuted}>
                SUR QUEL ÉCRAN ?
              </Text>
              <View style={styles.targets}>
                <Pressable
                  onPress={() => setDeviceId(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cet appareil"
                  accessibilityState={{ selected: deviceId === null }}
                  style={[styles.target, deviceId === null && styles.targetOn]}
                >
                  <Text style={styles.targetIcon}>📱</Text>
                  <Text
                    variant="label"
                    color={deviceId === null ? colors.blueDark : colors.textMuted}
                    center
                  >
                    Cet appareil
                  </Text>
                </Pressable>

                {devices.map((device) => {
                  const on = deviceId === device.id;
                  return (
                    <Pressable
                      key={device.id}
                      onPress={() => setDeviceId(device.id)}
                      accessibilityRole="button"
                      accessibilityLabel={device.label}
                      accessibilityState={{ selected: on }}
                      style={[styles.target, on && styles.targetOn]}
                    >
                      <Text style={styles.targetIcon}>{deviceIcon(device.kind)}</Text>
                      <Text
                        variant="label"
                        color={on ? colors.blueDark : colors.textMuted}
                        center
                        numberOfLines={2}
                      >
                        {device.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="caption" color={colors.textSubtle} center>
                {supervised
                  ? 'Un parent doit lancer le minuteur.'
                  : 'Le minuteur démarre tout de suite.'}
              </Text>
            </>
          ) : null}

          <Text variant="label" color={colors.textMuted}>
            COMBIEN ?
          </Text>
          {bornes ? (
            <TimeSlider
              value={selected ?? bornes.max}
              min={bornes.min}
              max={bornes.max}
              label={formatTime(selected ?? bornes.max, unit)}
              onChange={setSelected}
            />
          ) : null}

          {error ? (
            <Text variant="caption" color={colors.dangerInk} center>
              {error}
            </Text>
          ) : null}
          <Button
            label={supervised ? 'DEMANDER À MON PARENT' : 'COMMENCER'}
            icon={supervised ? '🙋' : '▶️'}
            size={taille}
            variant="primary"
            disabled={!bornes}
            loading={loading}
            onPress={begin}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.lg },
  ringCard: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  statsCard: { gap: spacing.md },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  useCard: { alignItems: 'center', gap: spacing.md },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  target: {
    width: 86,
    gap: spacing.xs,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  targetOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  targetIcon: { fontSize: 26 },
  durations: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
});
