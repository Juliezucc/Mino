import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { choixEnregistre } from '@/data/deviceProfile';
import { PairedDevice } from '@/data/repository';
import { LIEN_TELECHARGEMENT } from '@/features/onboarding/InstallerSurLAppareil';
import { aRegler, etatDe, phraseDe } from '@/domain/shieldReport';
import { ScreenTimeAuthorization, getScreenTimeService } from '@/services/screenTime';
import { useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';
import { useRetourBloque } from '@/hooks/useRetourBloque';

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

  /**
   * Le bouton retour d'Android, ici aussi.
   *
   * Cet écran est le dernier de l'inscription, atteint en `replace` : dépiler
   * ramenait à l'accueil, c'est-à-dire à « Créer ma famille » pour quelqu'un
   * qui vient de la créer. La flèche du bandeau savait déjà l'éviter ; le
   * bouton matériel, lui, ne demandait rien à personne.
   */
  /**
   * Où l'on atterrit en quittant cet écran — et ce n'est pas toujours le même
   * endroit.
   *
   * **Le défaut, trouvé sur un vrai iPhone.** Le parent répond « cet appareil
   * est à Manon », arrive ici, ne veut pas régler le bouclier tout de suite —
   * c'est son droit — et touche la flèche. Il atterrissait dans l'espace
   * parent, DÉVERROUILLÉ, sur la tablette qu'il vient de déclarer à son
   * enfant. Il n'avait plus qu'à la lui tendre. C'est la réouverture du défaut
   * que `a574943` avait fermé, par une autre porte : les trois sorties de cet
   * écran — la flèche, le bouton du bas, et le retour matériel d'Android —
   * menaient toutes à `/parent`.
   *
   * **La condition porte sur l'ENTRÉE, pas sur l'appareil.** Se fonder sur le
   * seul profil verrouillerait aussi le parent qui ouvre Réglages → « Blocage
   * des applications » sur la tablette du salon : il retaperait son code à
   * chaque aller-retour, et finirait par en choisir un trivial. Le marqueur
   * `inscription=1` n'est posé que par `onboarding/appareil.tsx`.
   *
   * `/who` plutôt que `/parent` verrouillé : le sélecteur referme le verrou de
   * lui-même au montage, et c'est l'écran qu'on tend à l'enfant. Renvoyer vers
   * `/parent` ferait rebondir la garde du layout vers l'écran du code, et
   * redemanderait au parent, trois secondes après l'avoir choisi, le code
   * qu'il vient de poser.
   */
  const { inscription } = useLocalSearchParams<{ inscription?: string }>();
  const device = useMinoStore((s) => s.device);
  const lockParent = useMinoStore((s) => s.lockParent);

  const sortirDuBlocage = useCallback(() => {
    if (inscription === '1' && choixEnregistre(device).kind !== 'parent') {
      lockParent();
      router.replace('/who');
      return;
    }
    router.replace('/parent');
  }, [inscription, device, lockParent, router]);

  useRetourBloque(() => {
    sortirDuBlocage();
    return true;
  });

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
        // Le message nommait iOS sur les deux systèmes. Envoyer un parent
        // Android vérifier « Réglages → Temps d'écran » le fait chercher un
        // écran qui n'existe pas chez lui.
        setEchec(
          Platform.OS === 'android'
            ? 'Le réglage s’est ouvert sans être accordé. Revenez-y : il en faut deux, l’accès aux données d’utilisation et la superposition d’écran.'
            : 'iOS n’a pas ouvert la demande. Vérifiez que le Temps d’écran est activé sur cet appareil : Réglages → Temps d’écran.',
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

  /**
   * Dans un navigateur, il n'y a rien à autoriser et rien à attendre : il y a
   * une application à installer ailleurs. C'est la seule distinction qui
   * compte pour cet écran, et elle ne se lit pas dans `status`.
   */
  const dansUnNavigateur = Platform.OS === 'web';

  /**
   * Ce qu'on montre d'une panne système, et ce qu'on garde pour soi.
   *
   * **Le défaut que cela répare.** Le message brut du système s'affichait tel
   * quel, en petit, sous les consignes. Sur une tablette Samsung, ça a donné
   * six lignes de trace Java au milieu de l'écran d'un parent :
   *
   *     Call to function 'MinoScreenTime.requestAuthorization' has been
   *     rejected. → Caused by: java.lang.NoSuchMethodError: No virtual method
   *     unsafeCheckOpNoThrow(…) in class Landroid/app/AppOpsManager…
   *
   * Un message d'erreur qu'on ne comprend pas ne rassure personne : il dit
   * « ce logiciel est cassé », et il le dit au moment où l'on demande la
   * permission de contrôler l'appareil d'un enfant.
   *
   * La trace part donc dans la console — elle y sert à qui sait la lire — et
   * l'écran garde une phrase. Le message est conservé tel quel quand il vient
   * de nous : ceux-là sont écrits pour être lus.
   */
  const lisible = (message: string): string => {
    const technique = /NoSuchMethodError|java\.lang|Landroid\/|has been rejected|Exception|at [\w.$]+\(/i;
    if (!technique.test(message)) return message;
    console.warn('[bouclier]', message);
    return 'Le système n’a pas répondu comme prévu sur cet appareil. Accordez les accès à la main par le chemin ci-dessus, et écrivez-nous si cela recommence.';
  };

  const manual =
    Platform.OS === 'android'
      ? 'Application Family Link → votre enfant → Contrôles → Limites de temps par application.'
      : 'Réglages → Temps d’écran → Limites d’app, avec un code que votre enfant ne connaît pas.';

  return (
    <Screen contentStyle={styles.content}>
      {/**
        * Revenir, sans retomber sur « Créer une famille ».
        *
        * L'inscription enchaîne ses écrans en `replace` — c'est voulu, on ne
        * revient pas en arrière dans une inscription. Mais cet écran en est le
        * bout, et `router.back()` renvoyait alors à la seule entrée qui restait
        * dans l'historique : l'accueil de bienvenue. Un parent qui vient de
        * créer sa famille se retrouvait devant « Créer mon compte parent »,
        * c'est-à-dire devant l'écran qui lui annonce qu'elle n'existe pas.
        *
        * **Le garde-fou `canGoBack()` ne suffisait pas**, et c'est ce qui a été
        * observé sur une vraie tablette : il répondait « oui », puisque
        * l'accueil traînait encore au fond de la pile. Il n'y a donc plus de
        * condition. Cet écran a une seule sortie possible — l'espace parent —
        * qu'on y arrive par la fin de l'inscription ou depuis les réglages.
        */}
      <ScreenHeader onBack={sortirDuBlocage} title="Blocage des applications" />

      <View style={styles.hero}>
        <Mascot expression={status === 'approved' ? 'proud' : 'motivated'} size={110} />
        <Text variant="hero" center>
          {status === 'approved'
            ? 'Le blocage est actif'
            : status === 'unsupported'
              ? dansUnNavigateur
                ? 'À installer sur l’appareil de votre enfant'
                : 'Ce vers quoi nous allons'
              : 'Laisser Mino verrouiller les écrans'}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {status === 'unsupported' && !dansUnNavigateur
            ? 'Le but de Mino : que les applications choisies restent verrouillées, et que le verrou se lève exactement le temps que votre enfant a gagné.'
            : 'Les applications choisies restent verrouillées, et Mino lève le verrou exactement le temps que votre enfant a gagné.'}
        </Text>
      </View>

      {/**
        * `unsupported` recouvrait deux situations très différentes, et n'en
        * décrivait qu'une — la mauvaise.
        *
        * L'écran annonçait « Pas encore disponible sur cette version : Mino ne
        * verrouille pas encore les applications elle-même ». C'était vrai le
        * jour où cette carte a été écrite. Ce ne l'est plus : le bouclier
        * fonctionne sur iPhone comme sur Android, téléphone et tablette. Le
        * parent qui lisait cela dans son navigateur apprenait donc que le
        * produit qu'il vient de payer n'existe pas.
        *
        * Ce qui est vrai dans un navigateur, c'est qu'**une page web ne peut
        * rien verrouiller** — aucun navigateur ne donne ce pouvoir, et aucun ne
        * le donnera. Il n'y a donc rien à réparer ici : il y a une application
        * à installer sur l'appareil de l'enfant. C'est un chemin, pas une
        * excuse, et c'est ce que cette carte offre.
        */}
      {status === 'unsupported' && dansUnNavigateur ? (
        <>
          <Card style={styles.block}>
            <Text variant="cardTitle" center>
              Scannez ce code avec l’appareil de votre enfant
            </Text>
            <Text variant="body" color={colors.textMuted} center>
              Le verrou vit dans l’application, sur le téléphone ou la tablette à encadrer. Cette
              page-ci, dans un navigateur, ne peut rien fermer.
            </Text>
            <View style={styles.qr}>
              <QRCode
                value={LIEN_TELECHARGEMENT}
                size={200}
                color={colors.navy}
                backgroundColor="#FFFFFF"
                quietZone={12}
              />
            </View>
            {/* Un seul code, et volontairement : la page de téléchargement
                envoie vers l'App Store ou vers Google Play selon l'appareil qui
                l'ouvre. Deux codes figés — l'un Apple, l'autre Android —
                obligeraient le parent à deviner lequel scanner, et surtout ils
                seraient gravés dans le binaire : impossible à corriger le jour
                où une des deux adresses change. */}
            <Text variant="caption" color={colors.textMuted} center>
              iPhone, iPad ou Android — la page vous envoie sur la bonne boutique. Ou rendez-vous
              sur minoapp.fr/telecharger
            </Text>
          </Card>

          <Card style={styles.block} background={colors.blueSoft} elevation="none">
            <Text variant="cardTitle" center>
              Puis, dans l’application : « J’ai un code famille »
            </Text>
            <Text variant="hero" color={colors.blueInk} center style={styles.code}>
              {famille?.family.code ?? '—'}
            </Text>
            <Text variant="caption" color={colors.textMuted} center>
              Ce code relie l’appareil à votre famille. C’est là que vous autoriserez le blocage, en
              deux touches.
            </Text>
          </Card>
        </>
      ) : status === 'unsupported' ? (
        <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
          {/* Sur un appareil, `unsupported` ne veut plus dire « pas encore
              écrit » : le module existe. Il veut dire qu'il n'est pas dans CE
              binaire — Expo Go, ou une version antérieure au bouclier. */}
          <Text variant="cardTitle">Le blocage n’est pas dans cette version</Text>
          <Text variant="body" color={colors.textMuted}>
            Cette version de Mino compte le temps et le décompte, mais ne porte pas le verrou.
            Installez Mino depuis l’App Store ou Google Play sur l’appareil de votre enfant : c’est
            cette version-là qui verrouille.
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {`En attendant, réglez la limite dans le contrôle parental de l’appareil : ${manual}`}
          </Text>
          {/* En retrait, et c'est le sujet : la consigne utile tient dans la
              ligne au-dessus. Le guide détaille, il ne remplace pas — et
              l'offrir comme action principale revenait à demander cinq pages
              de lecture à quelqu'un qui installe une application. */}
          <Button
            label="Voir le guide détaillé"
            variant="ghost"
            haptic={false}
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
            {/**
              * La phrase qui fait cocher vite, et elle est vérifiée.
              *
              * **La crainte est juste, la conséquence n'existe pas.** Un
              * parent pressé coche tout — c'est le geste normal, et il hésite
              * en arrivant sur Mino : s'il le ferme, son enfant ne pourra plus
              * ouvrir ses missions. Cette hésitation lui coûte une minute, et
              * parfois le réglage entier.
              *
              * Or iOS ne verrouille jamais l'application qui DÉTIENT
              * l'autorisation de contrôle parental, exactement comme il
              * protège Réglages. Éprouvé sur un vrai iPhone : Mino coché,
              * Mino s'ouvre quand même.
              *
              * On ne peut de toute façon pas s'exclure nous-mêmes — les
              * exceptions se déclarent par jeton d'application, et une
              * application n'obtient jamais le sien : le `bundleIdentifier`
              * est nul par conception, la même garantie qui nous empêche de
              * savoir ce que l'enfant a installé. Il n'y avait donc rien à
              * coder, et tout à dire.
              */}
            <Text variant="caption" color={colors.textMuted}>
              Cochez sans crainte, même tout : Mino reste toujours ouvert pour votre enfant, et les
              Réglages pour vous. iOS ne les ferme jamais.
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
          <Text variant="cardTitle">
            {Platform.OS === 'android' ? 'Il manque une autorisation' : 'Autorisation refusée'}
          </Text>
          <Text variant="body" color={colors.textMuted}>
            Mino continue de fonctionner : les missions, le compteur et les demandes restent
            identiques. Seul le verrouillage automatique est désactivé.
          </Text>
          {/**
           * Deux systèmes, deux gestes — et le second n'existait pas.
           *
           * **Sur iOS**, `openSettings()` est exactement le bon geste : une fois
           * l'autorisation refusée, le système ajoute un interrupteur « Temps
           * d'écran » sur la fiche de Mino, et c'est là que ce bouton dépose le
           * parent.
           *
           * **Sur Android, c'était une impasse**, et elle a été trouvée à la
           * première ouverture sur un vrai appareil. Les deux accès dont le
           * bouclier a besoin ne figurent pas sur la fiche de l'application :
           * ils vivent dans « Accès spécial », trois niveaux plus loin, et la
           * fiche affiche même « Aucune autorisation accordée » — ce qui donne
           * à un parent la certitude d'être au bon endroit et rien à y toucher.
           *
           * On redemande donc l'autorisation, ce qui rouvre le bon écran du
           * système. Et on dit qu'il y en a deux : Android ne les présente
           * jamais ensemble, si bien qu'un parent qui vient d'en accorder une
           * revient ici en pensant avoir terminé.
           */}
          {Platform.OS === 'android' ? (
            <>
              <Text variant="body" color={colors.textMuted}>
                Android demande deux accès distincts, dans deux écrans différents : l’accès aux
                données d’utilisation, pour savoir quelle application est ouverte, et la
                superposition d’écran, pour afficher Mino par-dessus.
              </Text>
              <Button
                label="Ouvrir le réglage manquant"
                variant="secondary"
                loading={busy}
                onPress={ask}
              />
              <Text variant="caption" color={colors.textSubtle}>
                Il faudra sans doute y revenir deux fois — le système ne les propose pas ensemble.
                À la main : Réglages → Applications → Accès spécial → Accès aux données
                d’utilisation, puis Superposition d’écran.
              </Text>
            </>
          ) : (
            <Button
              label="Ouvrir la fiche de Mino dans les Réglages"
              variant="secondary"
              onPress={() => Linking.openSettings().catch(() => undefined)}
            />
          )}
        </Card>
      ) : (
        <>
          <View style={styles.steps}>
            {(Platform.OS === 'android'
              ? [
                  'Vous accordez à Mino deux accès, dans les paramètres d’Android.',
                  'Vous choisissez les applications à encadrer.',
                  'Mino les referme, et les rouvre le temps que votre enfant a gagné.',
                ]
              : [
                  'Vous autorisez Mino à gérer le temps d’écran de cet appareil.',
                  'Vous choisissez les applications à encadrer, dans le sélecteur du système.',
                  'Elles restent verrouillées, et s’ouvrent le temps que votre enfant a gagné.',
                ]
            ).map((step, index) => (
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
              {/**
                * **Deux systèmes, deux marches à suivre — et une seule était
                * écrite.** Cette carte parlait du Temps d'écran d'Apple, de
                * l'app « Réglages » et d'un code à quatre chiffres. Sur une
                * tablette Android, rien de tout cela n'existe : le menu
                * s'appelle « Paramètres », il n'y a pas de Temps d'écran, et
                * les deux accès dont Mino a besoin vivent dans « Accès
                * spécial ». Un parent qui suivait ces consignes cherchait des
                * écrans qui n'étaient pas sur son appareil, puis concluait que
                * l'application se trompait — au moment précis où on lui demande
                * de nous confier le contrôle de celui de son enfant.
                */}
              {Platform.OS === 'android' ? (
                <>
                  <Text variant="bodyStrong">Deux accès à accorder</Text>
                  <Text variant="body" color={colors.textMuted}>
                    Android ne permet pas de les demander par une simple question : il faut les
                    activer dans les paramètres, et il les range dans deux écrans différents qu’il
                    ne propose jamais ensemble.
                  </Text>

                  <View style={styles.steps}>
                    {[
                      'L’accès aux données d’utilisation : il permet à Mino de savoir quelle application est ouverte.',
                      'La superposition d’écran : il permet à Mino de s’afficher par-dessus pour refermer.',
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

                  {/* Un vrai bouton, et non un chemin à recopier : `ask()`
                      rouvre le paramètre qui manque encore — celui des données
                      d'utilisation d'abord, la superposition ensuite. C'est le
                      système qui s'ouvre, on ne fait que l'appeler. */}
                  <Button
                    label="Ouvrir les paramètres"
                    icon="⚙️"
                    onPress={ask}
                    loading={busy}
                  />

                  <Text variant="caption" color={colors.textSubtle}>
                    Il faudra revenir ici entre les deux : Android n’en accorde qu’un à la fois.
                    Si le bouton n’ouvre rien, le chemin à la main est Paramètres → Applications →
                    Accès spécial → Accès aux données d’utilisation, puis Superposition d’écran.
                  </Text>
                </>
              ) : (
                <>
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
                      n'expose aucun moyen public d'y emmener quelqu'un.        */}
                  <Button label="C’est fait, réessayer" onPress={ask} loading={busy} />
                </>
              )}

              {/**
                * Le message du système, en petit et en dernier — mais plus
                * jamais brut.
                *
                * Il servait au support. Il a servi à autre chose : une trace
                * Java de six lignes s'est affichée en plein milieu de l'écran
                * d'un parent, sur une tablette où le module natif appelait une
                * méthode qui n'existe pas avant Android 10. Ce qu'on montre
                * désormais, c'est une phrase ; la trace part dans la console,
                * où elle sert à qui sait la lire.
                */}
              <Text variant="caption" color={colors.textSubtle}>
                {lisible(echec)}
              </Text>
            </Card>
          ) : null}
          <Text variant="caption" color={colors.textSubtle} center>
            À faire une seule fois sur chaque appareil confié à un enfant.
          </Text>
        </>
      )}

      {/**
        * La sortie vers l'avant, qui manquait.
        *
        * Cet écran est le dernier de l'installation, et il ne proposait rien
        * d'autre que le guide ou le retour. Un parent pressé — c'est-à-dire
        * tous — n'avait donc le choix qu'entre lire cinq pages et reculer.
        * Sur le web, où le bouclier n'existe pas, l'écran était une impasse
        * complète : il n'y avait ni verrou à régler, ni chemin pour en poser
        * un ailleurs.
        */}
      <Button
        label={
          inscription === '1' && choixEnregistre(device).kind !== 'parent'
            ? 'Terminer'
            : 'Terminer, aller à mon espace'
        }
        variant={status === 'approved' ? 'secondary' : 'primary'}
        onPress={sortirDuBlocage}
      />

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
  qr: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  code: { letterSpacing: 2 },
});
