import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, ScreenHeader, Text, confirmer } from '@/components/ui';
import { isStore } from '@/domain/billing';
import { codeTropFacile } from '@/domain/parentGate';
import { getAuthService } from '@/services/auth';
import { useSession, useTitulaireDuCompte } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

/**
 * Le compte du parent : le changer, le quitter, l'effacer.
 *
 * Cet écran manquait, et son absence n'était pas silencieuse — la FAQ le
 * promettait déjà mot pour mot (« Depuis Réglages, section Compte », « Depuis
 * Réglages, "Supprimer le compte" »). Une promesse écrite dans le produit et
 * absente du produit est un mensonge, pas un manque.
 *
 * Trois choses s'y jouent, dans un ordre qui est celui du risque croissant :
 *
 *   1. changer son adresse ou son mot de passe — courant, réversible ;
 *   2. se déconnecter — rien ne se perd, mais il faut se souvenir de son mot
 *      de passe pour revenir, ce que l'écran dit avant et non après ;
 *   3. supprimer le compte — définitif, exigé par Apple (5.1.1(v)) et par le
 *      RGPD, et gardé par une confirmation qui demande d'écrire un mot.
 *
 * Sur la suppression, deux honnêtetés valent d'être tenues même si elles
 * coûtent : l'écran nomme ce qui part (les enfants, l'historique, les minutes
 * gagnées) au lieu de dire « vos données », et il dit que l'abonnement, lui,
 * ne s'annule pas ici — seul l'App Store ou le Play Store peut le faire.
 * Laisser croire le contraire produirait un prélèvement sur un compte effacé,
 * c'est-à-dire un litige sans interlocuteur.
 */
export default function CompteParent() {
  const router = useRouter();
  // Le TITULAIRE, et non « le premier de la liste » : cet écran ne parle que
  // de son adresse, de son mot de passe et de son abonnement.
  const parent = useTitulaireDuCompte();
  const signOut = useMinoStore((s) => s.signOut);
  const deleteAccount = useMinoStore((s) => s.deleteAccount);
  const subscription = useMinoStore((s) => s.subscription);
  const remote = useMinoStore((s) => s.repository.name) !== 'local';

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  /**
   * Cet écran n'est pas pour tout le monde, et il l'était.
   *
   * **La question n'est pas « est-ce un parent », c'est « a-t-il un compte ».**
   * Et les confondre a bien failli coûter la famille entière.
   *
   * Depuis que le code à quatre chiffres appartient à la famille, l'espace
   * parent s'ouvre sur la tablette d'un enfant comme sur le téléphone du
   * second parent — c'est tout l'intérêt. Le premier réflexe a été de fermer
   * cet écran aux sessions d'APPAREIL. Puis le second parent est devenu un
   * vrai parent, avec le `user_id` de son téléphone sur sa ligne : depuis, sa
   * session se décrit elle-même comme `parent`, puisque `decrire()` interroge
   * `auth_is_parent()`. Le filtre s'ouvrait donc à lui, en grand, bouton
   * « Supprimer le compte » compris — et, sans le garde ajouté côté SQL, le
   * serveur aurait obéi.
   *
   * Ce qui distingue le titulaire n'est pas d'être parent : c'est d'avoir une
   * ADRESSE. Elle seule permet de revenir depuis un autre téléphone, et elle
   * seule donne un sens à « changer mon adresse », « changer mon mot de
   * passe », « me déconnecter » et « supprimer le compte ». C'est exactement ce
   * que compte `delete_my_account()`, et les deux doivent dire la même chose.
   *
   * `null` tant qu'on ne sait pas : on n'affiche rien plutôt que de parier.
   */
  /**
   * **La question n'est pas « est-ce un parent », c'est « a-t-il un compte ».**
   * Et les confondre a bien failli coûter la famille entière.
   *
   * Le premier réflexe a été de fermer cet écran aux sessions d'APPAREIL. Puis
   * le second parent est devenu un vrai parent, avec le `user_id` de son
   * téléphone sur sa ligne : depuis, sa session se décrit elle-même comme
   * `parent`, puisque `decrire()` interroge `auth_is_parent()`. Le filtre
   * s'ouvrait donc à lui, en grand, bouton « Supprimer le compte » compris —
   * et, sans le garde ajouté côté SQL, le serveur aurait obéi.
   *
   * Ce qui distingue le titulaire n'est pas d'être parent : c'est d'avoir une
   * ADRESSE. Elle seule permet de revenir depuis un autre téléphone, et elle
   * seule donne un sens à « changer mon adresse », « changer mon mot de
   * passe », « me déconnecter » et « supprimer le compte ». C'est exactement ce
   * que compte `delete_my_account()`, et les deux doivent dire la même chose.
   *
   * `null` tant qu'on ne sait pas : on n'affiche rien plutôt que de parier.
   */
  const session = useSession();
  const estParent = session ? session.kind === 'parent' : null;
  const gereLeCompte = session ? session.kind === 'parent' && !!session.email : null;

  const changerEmail = async () => {
    setErreur(null);
    setMessage(null);
    if (!email.includes('@')) return setErreur('Cette adresse n’a pas l’air valable.');
    setOccupe(true);
    const r = await getAuthService().changeEmail(email);
    setOccupe(false);
    if (!r.ok) return setErreur(r.reason ?? 'Impossible de changer l’adresse.');
    setEmail('');
    setMessage(
      remote
        ? 'Un lien de confirmation est parti à la nouvelle adresse. L’ancienne reste active tant que vous ne l’avez pas ouvert.'
        : 'Adresse mise à jour.',
    );
  };

  const changerMotDePasse = async () => {
    setErreur(null);
    setMessage(null);
    if (motDePasse.length < 8) return setErreur('Au moins 8 caractères.');
    setOccupe(true);
    const r = await getAuthService().setPassword(motDePasse);
    setOccupe(false);
    if (!r.ok) return setErreur(r.reason ?? 'Impossible d’enregistrer le mot de passe.');
    setMotDePasse('');
    setMessage('Nouveau mot de passe enregistré.');
  };

  const changerCode = async () => {
    setErreur(null);
    setMessage(null);
    if (!/^\d{4}$/.test(code)) return setErreur('Le code doit contenir 4 chiffres.');
    /**
     * La troisième porte, et la seule qui laissait passer 0000.
     *
     * `codeTropFacile` gardait l'inscription et l'écran de pose du code ; pas
     * celui-ci. Un parent qui vient changer son code — c'est-à-dire, presque
     * toujours, celui dont l'enfant a vu le précédent — pouvait le remplacer
     * par 1234. La règle vit dans le domaine pour cette raison exacte : une
     * condition d'écran s'oublie sur le quatrième écran.
     */
    if (codeTropFacile(code)) {
      return setErreur('Trop facile à deviner. Choisissez autre chose.');
    }
    setOccupe(true);
    const r = await getAuthService().setParentPin(code);
    setOccupe(false);
    if (!r.ok) return setErreur(r.reason ?? 'Impossible d’enregistrer le code.');
    setCode('');
    setMessage('Nouveau code parent enregistré.');
  };

  const seDeconnecter = () => {
    void confirmer({
      titre: 'Se déconnecter ?',
      message:
        'Rien ne sera perdu : les profils, les missions et les minutes gagnées restent sur votre compte. Il faudra votre mot de passe pour revenir.',
      action: 'Se déconnecter',
    }).then(async (oui) => {
      if (!oui) return;
      await signOut();
      router.replace('/welcome');
    });
  };

  /**
   * La confirmation écrite, et pourquoi elle vaut mieux qu'un deuxième bouton.
   *
   * « Supprimer » se tape ; « Supprimer » ne se tape pas par accident dans une
   * poche, ni par un enfant qui explore les réglages du téléphone de ses
   * parents. Deux boutons d'affilée, si.
   */
  const supprimer = () => {
    if (confirmation.trim().toLowerCase() !== 'supprimer') {
      return setErreur('Écrivez « supprimer » dans le champ pour confirmer.');
    }
    /**
     * L'abonnement de boutique ne s'arrête pas avec le compte, et il faut le
     * dire ICI, pas en petits caractères plus bas.
     *
     * **Ce que la suppression fait vraiment.** Apple et Google ne nous
     * laissent pas résilier à la place de leur client : l'abonnement continue,
     * et il continue de prélever. Pire, le lien se coupe des deux côtés — le
     * jeton qui relie cet abonnement à la famille disparaît avec elle, et les
     * notifications de la boutique arrivent ensuite sans que le serveur sache
     * de qui elles parlent. Vu en vrai : dix-sept notifications enregistrées
     * pour un abonnement bien vivant, sans famille pour les recevoir.
     *
     * Le parent, lui, ne voit qu'une chose : un prélèvement chaque mois pour
     * une application qu'il a supprimée. La phrase existait déjà sur cet
     * écran, en légende, sous le champ de confirmation. Elle a sa place dans
     * la fenêtre qui demande « êtes-vous sûr ».
     */
    const abonnementDeBoutique = isStore(subscription?.source) && subscription?.status !== 'canceled';
    const ouResilier = subscription?.source === 'google' ? 'le Play Store' : 'l’App Store';

    void confirmer({
      titre: 'Supprimer définitivement ?',
      message: abonnementDeBoutique
        ? `Les profils de vos enfants, leurs missions, leur historique et les minutes gagnées seront effacés. Rien de tout cela ne peut être récupéré.\n\nEt votre abonnement continuera d’être prélevé : nous ne pouvons pas le résilier à votre place. Faites-le d’abord depuis ${ouResilier}, puis revenez ici.`
        : 'Les profils de vos enfants, leurs missions, leur historique et les minutes gagnées seront effacés. Rien de tout cela ne peut être récupéré.',
      action: 'Supprimer',
      destructif: true,
    }).then(async (oui) => {
      if (!oui) return;
      setOccupe(true);
      const r = await deleteAccount();
      setOccupe(false);
      if (!r.ok) return setErreur(r.reason ?? 'La suppression n’a pas abouti.');
      router.replace('/welcome');
    });
  };

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.head}>
        <Text variant="hero">Mon compte</Text>
        {/* L'adresse est celle du compte, et d'aucun autre : sur un appareil
            appairé, l'afficher sous « Mon compte » désignerait quelqu'un
            d'autre que celui qui lit. La carte ci-dessous le dit en toutes
            lettres, c'est assez. */}
        {gereLeCompte === true ? (
          <Text variant="body" color={colors.textMuted}>
            {parent?.email}
          </Text>
        ) : null}
      </View>

      {gereLeCompte === null ? null : gereLeCompte ? null : (
        <Card background={colors.blueSoft} elevation="none" style={styles.block}>
          <Text variant="bodyStrong" color={colors.blueInk}>
            Le compte se gère depuis le téléphone qui a créé la famille.
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {parent?.displayName
              ? `L’adresse, le mot de passe, le code à quatre chiffres et la suppression de la famille appartiennent au compte de ${parent.displayName}. Cet appareil-ci a rejoint la famille avec le code : il voit tout, il confirme les missions, il règle le quotidien — mais il ne touche pas au compte.`
              : 'L’adresse, le mot de passe, le code à quatre chiffres et la suppression de la famille appartiennent au compte qui a créé la famille. Cet appareil-ci l’a rejointe avec le code : il voit tout et règle le quotidien, mais il ne touche pas au compte.'}
          </Text>
          <Text variant="caption" color={colors.textSubtle}>
            Ce n’est pas qu’une question d’écran : le serveur refuse ces gestes à qui n’a pas
            l’adresse du compte, quel que soit le bouton sur lequel on appuie.
          </Text>
        </Card>
      )}

      {message ? (
        <Card style={styles.bonne}>
          <Text variant="body" color={colors.mintInk}>
            {message}
          </Text>
        </Card>
      ) : null}

      {erreur ? (
        <Card style={styles.mauvaise}>
          <Text variant="body" color={colors.pinkInk}>
            {erreur}
          </Text>
        </Card>
      ) : null}

      {/* Le code, lui, appartient à tout vrai parent : le second peut le
          changer, `set_parent_pin` l’accepte, et c’est la seule chose du
          compte qui ne demande pas d’adresse. La tablette d’un enfant, elle,
          n’est pas parent — même le code ouvert, le serveur refuserait. */}
      {estParent === true ? (
      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          CODE PARENT
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Les quatre chiffres qui ouvrent l’espace parent devant un enfant.
          Ce n’est pas votre mot de passe, et il ne doit pas lui ressembler.
          À changer sans hésiter le jour où votre enfant vous a vu le taper.
        </Text>
        {/* Pas de vérification de l'ancien code ici : on ne peut atteindre cet
            écran qu'en l'ayant déjà donné. Le redemander serait une cérémonie,
            pas une sécurité. */}
        <Field
          label="Nouveau code à 4 chiffres"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
        />
        <Button
          label="Changer le code parent"
          icon="🔢"
          variant="secondary"
          loading={occupe}
          onPress={changerCode}
        />
      </Card>
      ) : null}

      {gereLeCompte !== true ? null : (
        <>
        <Card style={styles.block}>
          <Text variant="label" color={colors.textMuted}>
            ADRESSE E-MAIL
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {remote
              ? 'La nouvelle adresse ne devient la vôtre qu’une fois le lien de confirmation ouvert sur cette boîte. Celui qui tape l’adresse doit pouvoir y lire le courrier.'
              : 'Sans serveur, l’adresse n’est qu’une étiquette : rien ne s’y envoie.'}
          </Text>
          <Field
            label="Nouvelle adresse"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Button
            label="Changer l’adresse"
            variant="secondary"
            loading={occupe}
            onPress={changerEmail}
          />
        </Card>

        <Card style={styles.block}>
          <Text variant="label" color={colors.textMuted}>
            MOT DE PASSE
          </Text>
          <Text variant="body" color={colors.textMuted}>
            Il ne protège pas seulement votre compte : il protège les profils de
            votre famille.
          </Text>
          <Field
            label="Nouveau mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Button
            label="Changer le mot de passe"
            variant="secondary"
            loading={occupe}
            onPress={changerMotDePasse}
          />
        </Card>

        <View style={styles.actions}>
          <Button label="Se déconnecter" icon="👋" variant="secondary" onPress={seDeconnecter} />
        </View>

        <Card style={styles.danger}>
          <Text variant="label" color={colors.pinkInk}>
            SUPPRIMER LE COMPTE
          </Text>
          <Text variant="body" color={colors.textMuted}>
            Les profils de vos enfants, leurs missions, leur historique et les
            minutes gagnées seront effacés. Rien ne peut être récupéré ensuite.
          </Text>
          <Text variant="caption" color={colors.textSubtle}>
            Votre abonnement, lui, ne s’annule pas ici : il se résilie depuis
            l’App Store ou le Play Store, et il vaut mieux le faire avant.
            Les factures déjà émises sont conservées dix ans, comme la loi
            comptable l’exige ; elles ne contiennent aucune donnée d’enfant.
          </Text>
          <Field
            label="Écrivez « supprimer » pour confirmer"
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="none"
          />
          <Button label="Supprimer mon compte" variant="danger" loading={occupe} onPress={supprimer} />
        </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  head: { gap: spacing.xs },
  block: { gap: spacing.sm },
  actions: { gap: spacing.md },
  danger: { gap: spacing.sm, borderColor: colors.pink, borderWidth: 1, borderRadius: radii.lg },
  bonne: { backgroundColor: colors.mintSoft },
  mauvaise: { backgroundColor: colors.pinkSoft },
});
