import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Avatar, Button, Card, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { ScreenTimeAuthorization, getScreenTimeService } from '@/services/screenTime';
import { useChildren, useParents } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

/**
 * `parent` est une sous-étape de `profile`, pas une quatrième marche : les
 * points d'avancement en comptent trois, et en afficher un de plus à qui
 * répond « c'est mon téléphone » ferait croire à un parcours plus long qu'il
 * ne l'est — il s'arrête justement là.
 */
type Step = 'code' | 'profile' | 'parent' | 'shield';

/**
 * Setting up Mino on the child's device.
 *
 * Three steps, in the order they can actually be done: attach the device to the
 * family, say whose device it is, then hand the phone to a parent for the one
 * thing only a parent may authorise.
 *
 * The child is asked for the family code and nothing else. At eight years old
 * every extra field is a wall, and an e-mail typed on a phone is the tallest of
 * them. Proving that an adult is present happens at the third step, where the
 * system's own screen-time authorisation asks for the parent's account — far
 * better than a form could.
 *
 * The code therefore carries the whole weight of the pairing, which is why it
 * is six characters and why the backend rate-limits attempts.
 */
export default function JoinFamily() {
  const router = useRouter();
  const joinFamily = useMinoStore((s) => s.joinFamily);
  const selectChild = useMinoStore((s) => s.selectChild);
  const lockDeviceTo = useMinoStore((s) => s.lockDeviceTo);
  const declarerUsage = useMinoStore((s) => s.declarerUsage);
  const ajouterParent = useMinoStore((s) => s.ajouterParent);
  const unlockParent = useMinoStore((s) => s.unlockParent);
  const rattacherParent = useMinoStore((s) => s.rattacherParent);
  const children = useChildren();
  const parents = useParents();
  const service = getScreenTimeService();

  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shield, setShield] = useState<ScreenTimeAuthorization | null>(null);
  const [prenomParent, setPrenomParent] = useState('');
  const [codeParent, setCodeParent] = useState('');
  const [ajoutOuvert, setAjoutOuvert] = useState(false);

  const join = async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await joinFamily({ code });
      if (!ok) {
        setError('Ce code ne correspond à aucune famille. Redemande-le à ton parent.');
        return;
      }
      setStep('profile');
    } catch (e) {
      // Le message porté par l'exception, quand il y en a un : il distingue
      // « le serveur ne répond pas » de « ce code est mauvais », et ces deux
      // phrases n'appellent pas du tout la même réaction — l'une envoie
      // chercher un parent, l'autre fait recopier un code déjà juste.
      const dit = e instanceof Error && e.message ? e.message : null;
      setError(dit ?? 'Connexion impossible. Vérifiez le réseau et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * « C'est l'appareil de qui ? » — et la réponse est appliquée.
   *
   * Elle ne l'était pas : choisir un enfant et choisir « Appareil partagé »
   * faisaient exactement la même chose, la question était posée pour rien. Or
   * c'est tout l'intérêt de cet écran — sur la tablette de Noah, Mino doit
   * rouvrir sur Noah, sans passer par le sélecteur.
   *
   * Le réglage reste modifiable dans Réglages : un enfant qui répondrait «
   * partagé » pour s'ouvrir les minos de son frère n'a rien gagné de
   * définitif, et un parent est de toute façon présent à l'étape suivante.
   */
  const pickChild = async (childId: string) => {
    selectChild(childId);
    // La même écriture unique que partout ailleurs : les trois champs de
    // l'appareil se posent ensemble ou pas du tout. Voir `etatsPourChoix`.
    await declarerUsage({ kind: 'enfant', childId }).catch(() => undefined);
    setStep('shield');
  };

  const pickShared = async () => {
    await declarerUsage({ kind: 'partage' }).catch(() => undefined);
    setStep('shield');
  };

  /**
   * Le téléphone de l'autre parent, et il n'avait aucune réponse.
   *
   * **Trouvé en conduisant le parcours avec un vrai second téléphone.** Un
   * parent installe Mino sur le téléphone de son conjoint, saisit le code
   * famille — et l'écran lui demande « c'est l'appareil de qui ? » en ne
   * proposant que les enfants et « partagé ». Il n'y a pas de bonne réponse :
   * répondre un prénom d'enfant réserverait ce téléphone à l'enfant, et
   * « partagé » enchaînerait sur le réglage du bouclier, qu'il n'y a rien à
   * poser ici.
   *
   * Ce que cette réponse ouvre est exactement ce qu'il faut : le code parent
   * appartient à la FAMILLE depuis hier, donc ce téléphone-là ouvre l'espace
   * parent avec les quatre chiffres, et `valider-mission` lui permet de
   * confirmer les missions. Le second parent est chez lui sans jamais avoir eu
   * à partager un mot de passe.
   */
  const pickParent = () => {
    setError(null);
    // Une famille qui n'a qu'un parent n'a rien à demander : la question
    // « lequel ? » avec une seule réponse est une étape pour rien. On ouvre
    // directement le champ du prénom — c'est le cas du conjoint qui arrive.
    setAjoutOuvert(parents.length <= 1);
    setStep('parent');
  };

  /**
   * « C'est le téléphone de Marc » — et il faut le prouver.
   *
   * **Le trou que ceci referme, et je l'avais ouvert moi-même.** Choisir un
   * parent existant ne demandait rien : le code FAMILLE suffisait. Or c'est
   * précisément celui que les enfants connaissent — il leur sert à s'appairer,
   * il est affiché dans les réglages, et il est écrit sur un bout de papier
   * dans la moitié des maisons. N'importe lequel d'entre eux pouvait donc
   * déclarer sa tablette « téléphone d'un parent », et cet appareil-là ne
   * re-verrouille plus jamais l'espace parent en arrière-plan.
   *
   * Et depuis que reprendre un profil donne de vrais droits d'écriture, la
   * preuve n'est plus seulement prudente : elle est la seule chose qui sépare
   * un enfant curieux d'un parent.
   */
  const reprendreLeProfil = async (parentId: string) => {
    if (!/^\d{4}$/.test(codeParent)) {
      return setError('Entrez le code parent à 4 chiffres pour continuer.');
    }
    setLoading(true);
    setError(null);
    try {
      await rattacherParent(parentId, codeParent);
      // Il vient de le prouver : le redemander une seconde plus tard serait une
      // cérémonie, pas une sécurité. Et c'est ce chemin qui garde les quatre
      // chiffres en mémoire, dont `valider-mission` a besoin.
      await unlockParent(codeParent).catch(() => undefined);
      router.replace('/parent');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Ce profil n’a pas pu être repris.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ajouter le parent qui manque, depuis son propre téléphone.
   *
   * **Pourquoi le code à quatre chiffres est demandé ici.** Cet appareil vient
   * de rejoindre la famille avec le code famille — celui que l'enfant connaît,
   * puisqu'il lui sert à s'appairer. Sans autre preuve, n'importe quel enfant
   * de la maison se déclarerait parent et ouvrirait tout. Le code parent est
   * la seule chose qui dise qu'un adulte est là, maintenant ; le serveur le
   * revérifie et compte les essais ratés sur la famille entière.
   */
  const ajouterLeParent = async () => {
    const prenom = prenomParent.trim();
    if (!prenom) return setError('Indiquez un prénom.');
    if (!/^\d{4}$/.test(codeParent)) {
      return setError('Le code parent fait 4 chiffres. Demandez-le au parent qui a créé la famille.');
    }
    setLoading(true);
    setError(null);
    try {
      const id = await ajouterParent({ prenom, code: codeParent });
      await declarerUsage({ kind: 'parent', parentId: id }).catch(() => undefined);
      /**
       * Il vient de taper le code : le redemander une seconde plus tard serait
       * une cérémonie, pas une sécurité.
       *
       * Et ce n'est pas qu'une politesse. `unlockParent` est le seul chemin qui
       * garde les quatre chiffres en mémoire vive, et c'est cette mémoire-là
       * que `valider-mission` exige à chaque geste depuis un appareil appairé.
       * Sans elle, la première mission qu'il confirme redemanderait le code.
       */
      await unlockParent(codeParent).catch(() => undefined);
      router.replace('/parent');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Ce parent n’a pas pu être ajouté.');
    } finally {
      setLoading(false);
    }
  };

  const authorize = async () => {
    setLoading(true);
    try {
      const next = await service.requestAuthorization();
      setShield(next);
      if (next === 'approved') await service.chooseApps();
    } finally {
      setLoading(false);
    }
  };

  const finish = () => router.replace('/child');

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={styles.content}>
        <ScreenHeader
          onBack={
            step === 'code'
              ? () => router.back()
              : step === 'parent'
                ? () => {
                    setError(null);
                    setStep('profile');
                  }
                : undefined
          }
        />

        <View style={styles.progress}>
          {(['code', 'profile', 'shield'] as Step[]).map((s) => (
            <View
              key={s}
              style={[styles.dot, (step === 'parent' ? 'profile' : step) === s && styles.dotOn]}
            />
          ))}
        </View>

        {step === 'code' ? (
          <>
            <View style={styles.hero}>
              <Mascot expression="happy" size={120} />
              <Text variant="hero" center>
                Rejoindre ma famille
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                Demande le code à ton parent. Il est dans son application, dans Réglages.
              </Text>
            </View>

            <Field
              label="Code famille"
              placeholder="MINO-7K2QX9"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))}
              error={error ?? undefined}
            />

            <Button
              label="CONTINUER"
              size="kid"
              onPress={join}
              loading={loading}
              disabled={code.replace(/[^A-Z0-9]/g, '').length < 10}
            />

            <Card elevation="none" background={colors.surfaceMuted}>
              <Text variant="caption" color={colors.textMuted}>
                Tu n’as ni compte, ni mot de passe, ni adresse e-mail à donner. Ce code suffit.
              </Text>
            </Card>
          </>
        ) : step === 'parent' ? (
          <>
            <View style={styles.hero}>
              <Mascot expression="happy" size={120} />
              <Text variant="hero" center>
                Quel parent êtes-vous ?
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                Ce téléphone portera votre prénom. Vous verrez les mêmes enfants, les mêmes
                missions et les mêmes demandes que l’autre parent — avec le même code à quatre
                chiffres, puisqu’il appartient à la famille.
              </Text>
            </View>

            {!ajoutOuvert ? (
              <>
                {/* Le code d'abord, les prénoms ensuite : l'ordre dit que la
                    preuve n'est pas une formalité de fin de parcours. */}
                <Field
                  label="Code parent de la famille"
                  placeholder="4 chiffres"
                  keyboardType="number-pad"
                  value={codeParent}
                  onChangeText={(v) => setCodeParent(v.replace(/[^0-9]/g, '').slice(0, 4))}
                  hint="Demandez-le au parent qui a créé la famille. Ce n’est pas le code famille."
                />
                {parents.map((p) => (
                  <Button
                    key={p.id}
                    label={`C’est le téléphone de ${p.displayName ?? 'ce parent'}`}
                    icon="👤"
                    variant="secondary"
                    loading={loading}
                    onPress={() => {
                      reprendreLeProfil(p.id).catch(() => undefined);
                    }}
                  />
                ))}
                <Button
                  label="Ajouter un parent"
                  icon="➕"
                  variant="ghost"
                  haptic={false}
                  onPress={() => {
                    setError(null);
                    setAjoutOuvert(true);
                  }}
                />
                <Text variant="caption" color={colors.textSubtle}>
                  Si ce parent avait déjà un téléphone, celui-ci le remplace : l’ancien n’ouvrira
                  plus l’espace parent.
                </Text>
              </>
            ) : (
              <>
                <Field
                  label="Votre prénom"
                  placeholder="Marc"
                  autoCapitalize="words"
                  autoCorrect={false}
                  value={prenomParent}
                  onChangeText={(v) => setPrenomParent(v.slice(0, 30))}
                />
                <Field
                  label="Code parent de la famille"
                  placeholder="4 chiffres"
                  keyboardType="number-pad"
                  value={codeParent}
                  onChangeText={(v) => setCodeParent(v.replace(/[^0-9]/g, '').slice(0, 4))}
                />
                <Text variant="caption" color={colors.textSubtle}>
                  C’est le code qui ouvre l’espace parent. Demandez-le au parent qui a créé la
                  famille : il le voit dans ses réglages, et peut en changer quand il veut.
                </Text>
                <Button label="C’EST MOI" onPress={ajouterLeParent} loading={loading} />
                {parents.length > 1 ? (
                  <Button
                    label="Choisir un parent déjà inscrit"
                    variant="ghost"
                    haptic={false}
                    onPress={() => {
                      setError(null);
                      setAjoutOuvert(false);
                    }}
                  />
                ) : null}
              </>
            )}

            {/* Un seul endroit pour le refus, quel que soit le champ en cause :
                « ce prénom est déjà pris » et « le code est faux » viennent du
                même serveur et se lisent au même endroit. Accroché sous le
                champ du code, le premier aurait désigné le mauvais coupable. */}
            {error ? (
              <Card background={colors.yellowSoft} elevation="none">
                <Text variant="body">{error}</Text>
              </Card>
            ) : null}
          </>
        ) : step === 'profile' ? (
          <>
            <View style={styles.hero}>
              <Mascot expression="motivated" size={120} />
              <Text variant="hero" center>
                C’est l’appareil de qui ?
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                Si c’est ton appareil à toi, choisis-toi : Mino s’ouvrira toujours sur ton profil.
                Si vous êtes plusieurs dessus, choisis « Appareil partagé ».
              </Text>
            </View>

            <View style={styles.children}>
              {children.map((child) => (
                <Pressable
                  key={child.id}
                  onPress={() => {
                    pickChild(child.id).catch(() => undefined);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`C’est l’appareil de ${child.firstName}`}
                  style={styles.childTile}
                >
                  <Avatar avatarKey={child.avatarKey} size={72} />
                  <Text variant="cardTitle">{child.firstName}</Text>
                </Pressable>
              ))}
            </View>

            <Button
              label="Appareil partagé"
              icon="👧👦"
              variant="secondary"
              onPress={() => {
                pickShared().catch(() => undefined);
              }}
            />

            <Button
              label="C’est le téléphone d’un parent"
              icon="📱"
              variant="ghost"
              haptic={false}
              onPress={pickParent}
            />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Mascot expression={shield === 'approved' ? 'proud' : 'surprised'} size={120} />
              <Text variant="hero" center>
                {shield === 'approved'
                  ? 'Tout est prêt !'
                  : shield === null
                    ? 'Passe le téléphone à un parent'
                    : 'C’est noté'}
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                {shield === 'approved'
                  ? 'Les applications choisies s’ouvriront le temps que tu auras gagné.'
                  : shield === null
                    ? 'Dernière étape : un adulte autorise Mino à verrouiller les applications de cet appareil. C’est à faire une seule fois.'
                    : 'Tu peux commencer : tes missions et ton compteur fonctionnent déjà.'}
              </Text>
            </View>

            {/*
              Les deux cartes envoient au guide au lieu de le mentionner.
              Elles disaient « le guide, côté parent, explique comment » et
              « un parent pourra l'activer plus tard dans ses réglages » sans
              donner le moindre chemin — à un parent debout, le téléphone de son
              enfant dans les mains, au seul moment où il est disponible pour le
              faire. Nommer un document sans y mener, c'est le rendre
              introuvable.
            */}
            {shield === 'unsupported' ? (
              <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
                <Text variant="cardTitle">À régler dans le téléphone</Text>
                <Text variant="body" color={colors.textMuted}>
                  Cette version ne verrouille pas encore les applications elle-même. Un parent doit
                  poser la limite dans le contrôle parental de l’appareil.
                </Text>
                <Button
                  label="Voir comment faire"
                  icon="📖"
                  variant="secondary"
                  onPress={() => router.push('/guide/blocage')}
                />
              </Card>
            ) : shield === 'denied' ? (
              <Card background={colors.yellowSoft} elevation="none" style={styles.block}>
                <Text variant="cardTitle">Autorisation refusée</Text>
                <Text variant="body" color={colors.textMuted}>
                  Ce n’est pas grave : les missions et le compteur fonctionnent quand même. Un
                  parent peut l’activer plus tard, depuis son espace.
                </Text>
                <Button
                  label="Voir comment faire"
                  icon="📖"
                  variant="secondary"
                  onPress={() => router.push('/guide/blocage')}
                />
              </Card>
            ) : shield === null ? (
              <Button label="AUTORISER MINO" icon="🔒" onPress={authorize} loading={loading} />
            ) : null}

            <Button
              label={shield === null ? 'Plus tard' : 'COMMENCER'}
              variant={shield === null ? 'secondary' : 'primary'}
              size={shield === null ? 'default' : 'kid'}
              onPress={finish}
            />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  progress: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  dot: { width: 28, height: 5, borderRadius: 3, backgroundColor: colors.surfaceSunken },
  dotOn: { backgroundColor: colors.blue },
  hero: { alignItems: 'center', gap: spacing.sm },
  block: { gap: spacing.sm },
  children: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  childTile: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
});
