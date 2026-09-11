import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Avatar, Card, Screen, Text } from '@/components/ui';
import {
  InstallerSurLAppareil,
  SANS_BOUCLIER,
} from '@/features/onboarding/InstallerSurLAppareil';
import { ChoixDAppareil } from '@/data/deviceProfile';
import { getAuthService } from '@/services/auth';
import { useChildren, useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';
import { useRetourBloque } from '@/hooks/useRetourBloque';

/**
 * À qui est cet appareil — la question qu'on ne posait jamais.
 *
 * L'inscription se terminait sur le tableau de bord parent, et le parent devait
 * trouver seul le chemin vers Réglages → Blocage des applications. Personne ne
 * le fait. On installe un contrôle parental et on repart avec une application
 * qui compte des minutes sans rien bloquer — c'est-à-dire sans le produit.
 *
 * **Pourquoi cette question-ci, et à ce moment-là.** Parce que la réponse
 * change tout ce qui suit, et qu'elle ne se devine pas :
 *
 * — sur le téléphone d'un enfant, il faut poser le bouclier ICI, tout de
 *   suite, et l'appareil doit se rouvrir sur lui sans jamais rien demander ;
 * — sur celui du parent, il n'y a rien à bloquer : le bouclier ira sur
 *   l'appareil de l'enfant, avec le code famille, et c'est ce qu'il faut dire ;
 * — sur une tablette partagée, on bloque aussi, mais l'appareil doit rouvrir
 *   sur le dernier profil utilisé plutôt que d'appartenir à quelqu'un.
 *
 * Poser la question plus tard reviendrait à la poser à quelqu'un qui a déjà
 * rangé son téléphone.
 */
export default function OnboardingAppareil() {
  // Le bouton retour d'Android sortait de l'inscription et rendait l'accueil :
  // vu du parent, une déconnexion au milieu de la création de sa famille.
  useRetourBloque();
  const router = useRouter();
  const enfants = useChildren();
  const famille = useFamily();
  const declarerUsage = useMinoStore((s) => s.declarerUsage);
  const autoriserLaPoseDuCode = useMinoStore((s) => s.autoriserLaPoseDuCode);
  const [busy, setBusy] = useState(false);

  /**
   * Dans un navigateur, la question n'a pas de réponse.
   *
   * « À qui est cet appareil ? » suppose qu'on tient l'appareil en question. Un
   * parent qui vient de s'abonner depuis son ordinateur n'a rien à régler ici :
   * il lui manque l'application sur le téléphone de son enfant, et c'est tout
   * ce qui compte. Lui poser la question revenait à lui faire choisir entre
   * trois réponses fausses, puis à le déposer sur un tableau de bord — abonné,
   * et sans le produit.
   */
  if (SANS_BOUCLIER && famille) {
    return (
      <InstallerSurLAppareil
        code={famille.family.code}
        onTermine={() => router.replace('/parent')}
      />
    );
  }

  const choisir = async (choix: ChoixDAppareil) => {
    const versLeBlocage = choix.kind !== 'parent';
    setBusy(true);
    // Les trois conséquences de la réponse s'écrivent ensemble : séparément,
    // elles se contredisaient et la réponse ne se corrigeait plus. Voir
    // `etatsPourChoix`.
    await declarerUsage(choix).catch(() => undefined);

    /**
     * Le code parent se pose ICI, et nulle part ailleurs.
     *
     * **Le défaut, trouvé sur un vrai iPhone.** L'inscription ne demandait
     * jamais de code à quatre chiffres : la condition qui le réclame ne vaut
     * que pour un parent DÉJÀ connecté rejoignant une famille existante, pas
     * pour celui qui vient de la fonder. Une famille neuve n'avait donc aucun
     * code, et l'espace parent restait ouvert jusqu'au redémarrage de
     * l'application — sur la tablette qu'on venait de déclarer partagée.
     *
     * **Pourquoi à cet instant précis.** C'est le seul moment où l'on sait
     * deux choses à la fois : que l'appareil sera entre les mains d'un enfant,
     * et que le parent est là, en train de répondre. Une seconde plus tard,
     * l'un des deux manque — et un code qu'on demande à quelqu'un d'absent est
     * un code que l'enfant choisit.
     *
     * Sur le téléphone du parent (`versLeBlocage` faux), on ne demande rien :
     * il n'y a personne d'autre pour ouvrir cet espace, et une question de plus
     * à la fin d'une inscription est une inscription de moins.
     */
    const codePose = await getAuthService()
      .hasParentPin()
      // Dans le doute, on suppose qu'il existe : se tromper dans ce sens fait
      // taper un code au parent, se tromper dans l'autre en fait poser un par
      // l'enfant.
      .catch(() => true);

    setBusy(false);

    if (versLeBlocage && !codePose) {
      // Le parent vient de répondre à la carte juste au-dessus : c'est lui qui
      // tient l'appareil. Or `declarerUsage` a écrit `declareALEnfant` vingt
      // lignes plus haut, et l'écran du code relit ce drapeau tout neuf — sans
      // ce signal, il répond « Réservé aux parents » au parent lui-même, en
      // pleine inscription, et il ne peut plus poser de code du tout.
      autoriserLaPoseDuCode();
      router.replace({
        pathname: '/parent-pin',
        params: { ensuite: '/parent/blocage?inscription=1' },
      });
      return;
    }

    // Le blocage enchaîne directement : c'est la seule étape qui fait de Mino
    // un contrôle parental, et la seule qu'on ne peut pas faire à la place du
    // parent. Sur son propre téléphone, il n'y a rien à bloquer — on l'envoie
    // là où l'installation continue vraiment.
    /**
     * `inscription=1` : ce n'est pas une visite, c'est la fin de l'inscription.
     *
     * L'écran du blocage sert à deux moments très différents. Ici, le parent
     * vient de déclarer l'appareil et va le tendre à son enfant : on doit le
     * refermer derrière lui. Depuis les réglages ou le bandeau du tableau de
     * bord, c'est le même écran mais le parent est chez lui, et lui redemander
     * son code à chaque aller-retour serait le meilleur moyen qu'il en choisisse
     * un trivial. Le marqueur distingue les deux — `canGoBack()` ne le pouvait
     * pas, l'accueil traînant au fond de la pile.
     */
    router.replace(versLeBlocage ? '/parent/blocage?inscription=1' : '/parent');
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Mascot expression="motivated" size={110} />
        <Text variant="hero" center>
          À qui est cet appareil ?
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Mino ne se règle pas pareil selon la réponse. Vous pourrez en changer à tout moment.
        </Text>
      </View>

      {enfants.map((enfant) => (
        <Card
          key={enfant.id}
          onPress={busy ? undefined : () => choisir({ kind: 'enfant', childId: enfant.id })}
        >
          <View style={styles.ligne}>
            <Avatar avatarKey={enfant.avatarKey} size={54} />
            <View style={styles.textes}>
              <Text variant="cardTitle">{`Il est à ${enfant.firstName}`}</Text>
              <Text variant="caption" color={colors.textMuted}>
                Mino s’ouvrira toujours sur son profil, et nous allons régler le blocage
                maintenant.
              </Text>
            </View>
          </View>
        </Card>
      ))}

      <Card onPress={busy ? undefined : () => choisir({ kind: 'partage' })}>
        <View style={styles.ligne}>
          <Text variant="hero">🏠</Text>
          <View style={styles.textes}>
            <Text variant="cardTitle">Il est partagé entre les enfants</Text>
            <Text variant="caption" color={colors.textMuted}>
              La tablette du salon, par exemple. Elle rouvre sur le dernier profil utilisé, et nous
              réglons le blocage maintenant.
            </Text>
          </View>
        </View>
      </Card>

      <Card onPress={busy ? undefined : () => choisir({ kind: 'parent' })}>
        <View style={styles.ligne}>
          <Text variant="hero">📱</Text>
          <View style={styles.textes}>
            <Text variant="cardTitle">Il est à moi, le parent</Text>
            <Text variant="caption" color={colors.textMuted}>
              Rien à bloquer ici. Le blocage se règle sur l’appareil de votre enfant, avec le code
              famille — nous vous y conduirons.
            </Text>
          </View>
        </View>
      </Card>

      {/**
        * Pas de « Plus tard » ici, et c'était une erreur d'en avoir mis un.
        *
        * Le raisonnement d'origine — un parent pressé qui ne trouve pas d'issue
        * referme l'application — vaut pour l'écran du blocage, qui demande de
        * traverser les réglages du système et peut légitimement attendre. Il ne
        * vaut pas pour celui-ci.
        *
        * Cette question-ci ne coûte rien : trois cartes, une touche. Et la
        * sauter emporte deux choses qu'aucun écran ne redemandera. Mino ne
        * saura pas s'il est sur la tablette d'un enfant — donc s'il doit
        * rouvrir sur son profil, et à qui adresser les notifications. Surtout,
        * le code parent se pose juste après cette réponse : personne ne l'aura
        * demandé, et l'espace parent restera sans serrure sur un appareil dont
        * on ignore qui s'en sert.
        *
        * L'issue existe toujours, elle est simplement une réponse : « c'est mon
        * téléphone à moi » n'engage à rien et n'ouvre aucun réglage.
        */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  ligne: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  textes: { flex: 1, gap: spacing.xs },
});
