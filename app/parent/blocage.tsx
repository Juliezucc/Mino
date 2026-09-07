import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { PairedDevice } from '@/data/repository';
import { aRegler, etatDe, phraseDe } from '@/domain/shieldReport';
import { ScreenTimeAuthorization, getScreenTimeService } from '@/services/screenTime';
import { useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

/**
 * Where a parent hands Mino the right to lock and unlock the apps.
 *
 * The screen exists in both worlds on purpose. With the native module, it asks
 * for the system authorisation and opens the app picker. Without it, it says so
 * plainly and explains the manual setup instead — never a button that pretends
 * to grant something it cannot.
 */
export default function ShieldSetup() {
  const service = getScreenTimeService();
  const router = useRouter();

  const [status, setStatus] = useState<ScreenTimeAuthorization>('not-determined');
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  /** Ce qu'iOS a répondu quand il a refusé. Voir `ask`. */
  const [echec, setEchec] = useState<string | null>(null);

  /**
   * L'état du bouclier sur LES AUTRES appareils — c'est-à-dire, presque
   * toujours, sur celui qui compte.
   *
   * Sans cette liste, le produit avait un mode de panne silencieux et c'était
   * le pire de tous : un adolescent retire à Mino l'accès aux statistiques
   * d'usage, le bouclier cesse d'exister, et cet écran-ci continue d'afficher
   * « Le blocage est actif » — parce qu'il lit l'autorisation du téléphone du
   * PARENT, où tout va bien. Un bouclier mort dont le parent ignore la mort
   * produit la confiance sans la protection.
   *
   * `null` veut dire « on n'a pas pu demander », et se dit ; `[]` veut dire
   * « aucun appareil appairé », et ne se dit pas de la même façon.
   */
  const [appareils, setAppareils] = useState<PairedDevice[] | null>(null);
  const famille = useFamily();
  const depot = useMinoStore((s) => s.repository);
  const reportShield = useMinoStore((s) => s.reportShield);

  const refresh = useCallback(async () => {
    const courant = await service.authorization();
    setStatus(courant);
    setCount((await service.selection()).count);
    // Cet écran est le seul endroit où l'autorisation change : c'est donc ici
    // qu'il faut en rendre compte, sans quoi la famille apprendrait la
    // nouvelle au prochain lancement seulement.
    void reportShield();
    if (depot.pairedDevices) {
      await depot
        .pairedDevices()
        .then(setAppareils)
        .catch(() => setAppareils(null));
    }
  }, [service, depot, reportShield]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  /**
   * Demander l'autorisation, et ne jamais laisser l'écran muet.
   *
   * Le refus d'iOS remontait ici sans un mot : le parent appuyait sur
   * « AUTORISER MINO », rien ne se passait, et il n'avait aucun moyen de savoir
   * si le refus venait d'Apple, de son compte, ou d'un défaut de Mino. Deux
   * causes reviennent, et aucune ne se devine — le Temps d'écran désactivé sur
   * l'appareil, et un compte Apple qui n'est pas un compte enfant.
   */
  const ask = async () => {
    setBusy(true);
    setEchec(null);
    try {
      const next = await service.requestAuthorization();
      setStatus(next);
      if (next === 'approved') setCount((await service.chooseApps()).count);
      // Ni accordée, ni refusée franchement : la fenêtre système ne s'est pas
      // ouverte. Le dire vaut mieux que de réafficher le même écran.
      else if (next === 'not-determined') {
        setEchec(
          'iOS n’a pas ouvert la demande. Vérifiez que le Temps d’écran est activé sur cet appareil : Réglages → Temps d’écran.',
        );
      }
    } catch (e) {
      setEchec(e instanceof Error ? e.message : 'L’autorisation n’a pas pu être demandée.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    setBusy(true);
    try {
      setCount((await service.chooseApps()).count);
    } finally {
      setBusy(false);
    }
  };

  const manual =
    Platform.OS === 'android'
      ? 'Application Family Link → votre enfant → Contrôles → Limites de temps par application.'
      : 'Réglages → Temps d’écran → Limites d’app, avec un code que votre enfant ne connaît pas.';

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} title="Blocage des applications" />

      <View style={styles.hero}>
        <Mascot expression={status === 'approved' ? 'proud' : 'motivated'} size={110} />
        <Text variant="hero" center>
          {status === 'approved'
            ? 'Le blocage est actif'
            : status === 'unsupported'
              ? 'Ce vers quoi nous allons'
              : 'Laisser Mino verrouiller les écrans'}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {status === 'unsupported'
            ? 'Le but de Mino : que les applications choisies restent verrouillées, et que le verrou se lève exactement le temps que votre enfant a gagné.'
            : 'Les applications choisies restent verrouillées, et Mino lève le verrou exactement le temps que votre enfant a gagné.'}
        </Text>
      </View>

      {status === 'unsupported' ? (
        <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
          <Text variant="cardTitle">Pas encore disponible sur cette version</Text>
          <Text variant="body" color={colors.textMuted}>
            Cette version de Mino compte le temps et le décompte, mais ne verrouille pas encore les
            applications elle-même. C’est ce que nous construisons, et cela demande une autorisation
            spécifique d’Apple et de Google.
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {`En attendant, réglez la limite dans le contrôle parental de l’appareil : ${manual}`}
          </Text>
          <Button
            label="Voir le guide"
            variant="secondary"
            onPress={() => router.push({ pathname: '/guide/[id]', params: { id: 'blocage' } })}
          />
        </Card>
      ) : status === 'approved' ? (
        <>
          <Card background={colors.mintSoft} elevation="none" style={styles.block}>
            <Text variant="cardTitle">
              {count > 0
                ? `${count} application${count > 1 ? 's' : ''} sous contrôle`
                : 'Aucune application sélectionnée'}
            </Text>
            <Text variant="body" color={colors.textMuted}>
              {count > 0
                ? 'Elles s’ouvrent uniquement pendant une session, et se reverrouillent toutes seules à la fin — même si Mino est fermé.'
                : 'Choisissez les applications que Mino doit verrouiller entre deux sessions.'}
            </Text>
            <Button label="Choisir les applications" variant="secondary" onPress={pick} loading={busy} />
          </Card>

          <Card elevation="none" background={colors.surfaceMuted} style={styles.block}>
            <Text variant="caption" color={colors.textMuted}>
              Mino ne sait pas lesquelles vous avez choisies : le système ne nous transmet qu’un
              nombre. Nous ne pouvons donc pas savoir ce que votre enfant utilise, et c’est très
              bien ainsi.
            </Text>
          </Card>
        </>
      ) : status === 'denied' ? (
        <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
          <Text variant="cardTitle">Autorisation refusée</Text>
          <Text variant="body" color={colors.textMuted}>
            Mino continue de fonctionner : les missions, le compteur et les demandes restent
            identiques. Seul le verrouillage automatique est désactivé.
          </Text>
          {/* Ici `openSettings()` est le bon geste, et c'est le seul endroit où
              il l'est : une fois l'autorisation refusée, iOS ajoute un
              interrupteur « Temps d'écran » sur la fiche de Mino, et c'est
              exactement là que ce bouton dépose le parent. Le nom du bouton le
              dit, pour qu'il ne promette pas le réglage général du système. */}
          <Button
            label="Ouvrir la fiche de Mino dans les Réglages"
            variant="secondary"
            onPress={() => Linking.openSettings().catch(() => undefined)}
          />
        </Card>
      ) : (
        <>
          <View style={styles.steps}>
            {[
              'Vous autorisez Mino à gérer le temps d’écran de cet appareil.',
              'Vous choisissez les applications à encadrer, dans le sélecteur du système.',
              'Elles restent verrouillées, et s’ouvrent le temps que votre enfant a gagné.',
            ].map((step, index) => (
              <View key={step} style={styles.step}>
                <View style={styles.number}>
                  <Text variant="caption" color={colors.onBrand}>
                    {index + 1}
                  </Text>
                </View>
                <Text variant="body" color={colors.textMuted} style={styles.stepText}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
          <Button label="AUTORISER MINO" icon="🔒" onPress={ask} loading={busy} />
          {/* ------------------------------------ quand le système n'a rien ouvert

              Ce n'est pas un message d'erreur, et ça ne doit pas en devenir un.
              Un parent qui appuie sur « autoriser » et ne voit rien se produire
              n'a pas besoin d'apprendre qu'il y a eu un échec : il l'a vu. Il a
              besoin de savoir quoi faire, dans quel ordre, et de pouvoir y aller
              d'ici.

              La cause est presque toujours la même, et elle est hors de Mino :
              le Temps d'écran n'est pas activé sur l'appareil. iOS ne permet pas
              de le vérifier à l'avance — aucune API ne le dit — donc on ne peut
              pas l'exiger avant. On le rattrape après, et on l'explique.       */}
          {echec ? (
            <Card background={colors.yellowSoft} elevation="none" style={styles.guide}>
              <Text variant="bodyStrong">Une chose à activer d’abord</Text>
              <Text variant="body" color={colors.textMuted}>
                Mino s’appuie sur le Temps d’écran d’Apple. Il doit être activé sur cet
                appareil — c’est lui qui demandera votre code, et qui empêchera votre enfant
                de retirer le blocage.
              </Text>
              {/* La méprise que produit le Partage familial, et qui coûte un
                  quart d'heure : la page « Temps d'écran » d'un iPhone de
                  parent propose aussi les enfants du groupe. On règle alors
                  consciencieusement le mauvais appareil.                     */}
              <Text variant="body" color={colors.textMuted}>
                Si la page vous propose les membres de votre famille, ne choisissez personne :
                restez sur les réglages de cet appareil-ci, celui que votre enfant utilise.
              </Text>

              <View style={styles.steps}>
                {[
                  'Quittez Mino et ouvrez l’app Réglages — l’icône grise en forme de rouage.',
                  'Touchez « Temps d’écran ». S’il vous propose de l’activer, activez-le ; s’il est déjà actif, passez à la suite.',
                  'Faites défiler jusqu’en bas de cette page, jusqu’à « Verrouiller les réglages du temps d’écran ». Choisissez un code à 4 chiffres que votre enfant ne connaît pas.',
                  'Revenez dans Mino et appuyez de nouveau sur « C’est fait, réessayer ».',
                ].map((etape, index) => (
                  <View key={etape} style={styles.step}>
                    <View style={styles.number}>
                      <Text variant="caption" color={colors.onBrand}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text variant="body" color={colors.textMuted} style={styles.stepText}>
                      {etape}
                    </Text>
                  </View>
                ))}
              </View>

              {/* PAS de bouton « ouvrir les Réglages » ici, et c'est délibéré.
                  `Linking.openSettings()` ouvre la fiche de Mino dans les
                  Réglages — jamais le Temps d'écran, qui est ailleurs. iOS
                  n'expose aucun moyen public d'y emmener quelqu'un : les
                  adresses `App-Prefs:` que l'on trouve partout sont privées, et
                  Apple refuse à la revue les applications qui s'en servent.

                  Un bouton qui promet d'ouvrir un réglage et dépose le parent
                  sur une page sans rapport est pire que pas de bouton : il lui
                  fait croire que l'application se trompe, au moment précis où on
                  lui demande de nous faire confiance. Le chemin est donc écrit,
                  en toutes lettres, et il tient en quatre gestes.            */}
              <Button label="C’est fait, réessayer" onPress={ask} loading={busy} />

              {/* Le message d'iOS, en petit et en dernier. Il ne sert pas au
                  parent — il sert au support le jour où la cause est ailleurs. */}
              <Text variant="caption" color={colors.textSubtle}>
                {echec}
              </Text>
            </Card>
          ) : null}
          <Text variant="caption" color={colors.textSubtle} center>
            À faire sur l’appareil de votre enfant, une seule fois.
          </Text>
        </>
      )}

      {/* ----------------------------------- les autres appareils de la famille

          Placé APRÈS le réglage de cet appareil-ci, et jamais avant : le
          parent qui arrive ici vient régler quelque chose, pas faire un
          inventaire. Mais il ne doit pas repartir sans avoir vu qu'un
          appareil est passé au rouge.                                      */}
      {appareils && appareils.length > 0 ? (
        <View style={styles.parc}>
          <Text variant="label" color={colors.textMuted}>
            {aRegler(appareils) > 0
              ? `APPAREILS DE LA FAMILLE — ${aRegler(appareils)} À REGARDER`
              : 'APPAREILS DE LA FAMILLE'}
          </Text>

          {appareils.map((appareil) => {
            const dit = phraseDe(etatDe(appareil));
            const enfant = (famille?.children ?? []).find((c) => c.id === appareil.childId);
            const nom =
              enfant?.firstName ??
              appareil.label ??
              `Appareil arrivé le ${new Date(appareil.joinedAt).toLocaleDateString('fr-FR')}`;

            return (
              <Card
                key={appareil.id}
                elevation="none"
                background={dit.grave ? colors.yellowSoft : colors.mintSoft}
                style={styles.block}
              >
                <Text variant="cardTitle">
                  {dit.grave ? '⚠️ ' : '✅ '}
                  {nom}
                </Text>
                <Text variant="body">{dit.titre}</Text>
                <Text variant="body" color={colors.textMuted}>
                  {dit.detail}
                </Text>
              </Card>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  block: { gap: spacing.md },
  parc: { gap: spacing.md, marginTop: spacing.md },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  number: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepText: { flex: 1 },
  guide: { gap: spacing.md },
});
