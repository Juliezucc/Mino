import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { bornesPour, formatTime } from '@/domain/minos';
import { activeDevices, deviceIcon, describeDevice } from '@/domain/devices';
import { getScreenTimeService } from '@/services/screenTime';
import {
  useActiveChild,
  useBalanceDetail,
  useFamily,
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
  const requested = useRequestedSession(child?.id);
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
            Une session est en cours
          </Text>
          <Button
            label="REPRENDRE"
            size={taille}
            onPress={() =>
              router.push({ pathname: '/child/session', params: { sessionId: running.id } })
            }
          />
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
            size={child.companionEnabled === false ? 'kid' : undefined}
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
