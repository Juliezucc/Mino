import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { getAuthService } from '@/services/auth';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';
import { useRetourBloque } from '@/hooks/useRetourBloque';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Le message d'une exception, d'où qu'elle vienne.
 *
 * Les erreurs de la base ne sont pas des `Error` : PostgREST rend un objet nu
 * `{ message, details, hint, code }`, et `e instanceof Error` y répond non.
 * On lisait donc un message par défaut à la place du seul texte utile.
 */
function phraseDErreur(e: unknown): string {
  const dit = (e as { message?: unknown } | null)?.message;
  return typeof dit === 'string' && dit.trim()
    ? dit
    : 'Impossible de créer la famille. Vérifiez votre connexion et réessayez.';
}

/**
 * Troisième écran : le compte du parent. Les enfants n'en ont jamais.
 *
 * Il était premier. Il est maintenant précédé de l'enfant et de sa première
 * mission, et c'est tout ce qui change — mais cela change tout : à ce
 * moment-là, le parent a vu sa famille exister. Taper une adresse n'est plus
 * un péage avant d'entrer, c'est ce qui lui permet de garder ce qu'il vient
 * de faire.
 *
 * D'où le titre, « Garder ma famille » plutôt que « Créer mon compte » : la
 * seconde formule décrit ce que la machine fait, la première ce que le parent
 * y gagne.
 */
export default function CreateAccount() {
  // Le bouton retour d'Android sortait de l'inscription et rendait l'accueil :
  // vu du parent, une déconnexion au milieu de la création de sa famille.
  useRetourBloque();
  const router = useRouter();
  const createAccount = useMinoStore((s) => s.createAccount);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [aConfirmer, setAConfirmer] = useState(false);
  /**
   * Ce qui n'a sa place sous aucun champ.
   *
   * Les erreurs étaient toutes rangées sous un champ, et par défaut sous
   * l'e-mail. Le jour où l'écran a cessé d'afficher l'e-mail — quand le compte
   * existe déjà — ces messages-là ont cessé d'exister : le bouton semblait ne
   * rien faire. Une erreur rangée sous un champ qu'on n'affiche pas est une
   * erreur qu'on a supprimée.
   */
  const [erreur, setErreur] = useState<string | null>(null);
  /**
   * L'adresse du compte déjà ouvert, s'il y en a un.
   *
   * On arrive ici avec une session en cours plus souvent qu'on ne l'imagine :
   * il suffit d'avoir confirmé son adresse après coup, ou d'avoir refermé
   * l'application entre le compte et la famille. `who.tsx` propose alors
   * « Créer ma famille », qui mène ici. Sans ce test, l'écran redemandait une
   * adresse et un mot de passe pour un compte qui existe déjà — et l'envoi
   * échouait à tous les coups.
   */
  const [compteOuvert, setCompteOuvert] = useState<string | null>(null);
  /**
   * Un code parent est-il déjà posé sur ce compte ?
   *
   * Il l'est dès l'inscription. Le redemander à l'écran suivant ne protège
   * rien et laisse croire que le premier n'a pas été retenu — c'est ce qu'a
   * signalé la première personne à conduire le parcours en entier.
   */
  const [codeDejaPose, setCodeDejaPose] = useState(false);

  useEffect(() => {
    let vivant = true;
    getAuthService()
      .session()
      .then(async (s) => {
        if (!vivant || s.kind !== 'parent') return;
        setCompteOuvert(s.email);
        const pose = await getAuthService().hasParentPin();
        if (vivant) setCodeDejaPose(pose);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  /** Le code parent appartient à la création de la famille, pas à celle du compte. */
  const demandeLeCode = Boolean(compteOuvert) && !codeDejaPose;

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Indiquez votre prénom.';
    if (!compteOuvert) {
      if (!EMAIL_RE.test(email.trim())) next.email = 'Adresse e-mail invalide.';
      if (password.length < 8) next.password = 'Au moins 8 caractères.';
    }
    /**
     * Le code parent ne se demande qu'à la création de la FAMILLE.
     *
     * Il était réclamé dès l'inscription, à côté du mot de passe : deux
     * secrets à inventer et à retenir sur le même écran, avant même d'avoir
     * compris à quoi sert le second. Il n'a pourtant de sens qu'une fois qu'il
     * y a une famille et des appareils à protéger.
     */
    if (demandeLeCode) {
      if (!/^\d{4}$/.test(pin)) next.pin = 'Le code parent doit contenir 4 chiffres.';
      // A PIN identical to the last digits of the password helps nobody.
      if (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '0000') {
        next.pin = 'Trop facile à deviner. Choisissez autre chose.';
      }
    }
    setErrors(next);
    setErreur(null);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const result = await createAccount({
        parentName: name.trim(),
        email: compteOuvert ?? email.trim(),
        password: compteOuvert ? undefined : password,
        pin: demandeLeCode ? pin : undefined,
        /**
         * Le consentement a été recueilli à l'écran de l'enfant, avant que son
         * profil n'existe — c'est là qu'il doit l'être, et `fonderFamille` en a
         * déjà daté l'instant. On le repasse pour le seul cas où la famille
         * n'aurait pas été fondée ici : un parent venu de `who.tsx`, qui a un
         * compte et pas encore de famille.
         */
        consentAt: new Date().toISOString(),
      });

      if (result.pending) return setAConfirmer(true);
      if (!result.ok) {
        const texte = result.reason ?? 'Impossible de créer le compte.';
        // `field` dit quel champ est en cause quand ce n'est pas l'adresse — un
        // mot de passe refusé, par exemple. Sans lui, l'erreur s'affichait sous
        // l'e-mail et le parent corrigeait indéfiniment un champ intact.
        //
        // Encore faut-il que ce champ soit à l'écran : quand le compte existe
        // déjà, l'e-mail et le mot de passe n'y sont plus, et le message allait
        // se ranger derrière deux champs absents.
        if (compteOuvert || !result.field) setErreur(texte);
        else setErrors({ [result.field]: texte });
        return;
      }
      router.replace('/onboarding/abonnement');
    } catch (e) {
      // Sans ce filet, une exception laissait le bouton tourner sans fin et
      // sans un mot — l'écran le plus difficile à signaler, parce qu'il n'y a
      // rien à raconter au support.
      //
      // Et sans `phraseDErreur`, le filet lui-même était muet : une erreur de
      // PostgREST n'est pas une `Error`, c'est un objet nu. Le seul message
      // qui existait — celui qui nommait la table et la contrainte en cause —
      // était jeté au profit d'un « vérifiez votre connexion » qui envoyait
      // chercher une panne de réseau là où il n'y en avait aucune.
      setErreur(phraseDErreur(e));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Le compte est créé et attend sa confirmation. C'est une bonne nouvelle, et
   * elle s'affichait en rouge sous le champ e-mail, au-dessus d'un formulaire
   * intact et d'un bouton « Continuer » — c'est-à-dire au-dessus d'une invitation
   * à recommencer. Recommencer était pourtant la seule issue impossible :
   * l'adresse venait d'être prise, et une adresse prise reçoit exprès la même
   * réponse évasive que n'importe quelle autre. Le parent tournait en rond
   * jusqu'à abandonner, avec un compte parfaitement valable qui l'attendait.
   */
  if (aConfirmer) {
    return (
      <Screen contentStyle={styles.centre}>
        <Mascot expression="happy" size={140} />
        <Text variant="hero" center>
          Vérifiez vos e-mails
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Votre compte est créé. Nous venons d’envoyer un lien de confirmation à{' '}
          {email.trim()}. Ouvrez-le, puis revenez vous connecter.
        </Text>
        <Text variant="caption" color={colors.textSubtle} center>
          Le message met parfois une minute à arriver. Pensez aux indésirables.
        </Text>
        <Button label="Se connecter" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          title={compteOuvert ? 'Créer ma famille' : 'Garder ma famille'}
          subtitle={
            compteOuvert
              ? `Votre compte ${compteOuvert} est déjà ouvert. Il ne reste que la famille à créer.`
              : 'Pour la retrouver sur vos autres appareils, et si vous changez de téléphone. Aucune adresse n’est demandée aux enfants.'
          }
        />

        <View style={styles.form}>
          <Field
            label="Mon prénom"
            placeholder="Julie"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            error={errors.name}
          />
          {compteOuvert ? null : (
            <>
              <Field
                label="Mon e-mail"
                placeholder="julie@exemple.fr"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                error={errors.email}
              />
              {/**
               * L'adresse répétée, et pourquoi elle mérite trois lignes.
               *
               * Rien ne vérifie plus qu'elle existe : la confirmation par
               * e-mail a été retirée du parcours, parce qu'elle bloquait
               * l'entrée sans rien garantir. Une faute de frappe passerait
               * donc inaperçue jusqu'au jour où ce parent voudra récupérer son
               * mot de passe — c'est-à-dire au pire moment, et sans recours.
               *
               * La relire à voix haute est la seule barrière qui reste, et
               * elle est étonnamment efficace : on ne relit pas ce qu'on vient
               * de taper, mais on relit ce qu'on nous montre.
               */}
              {EMAIL_RE.test(email.trim()) ? (
                <Text variant="caption" color={colors.textMuted}>
                  {`Vos reçus et votre lien de récupération partiront à ${email.trim()}. Vérifiez-la : c’est elle qui vous rendra votre compte si vous changez de téléphone.`}
                </Text>
              ) : null}
              <Field
                label="Mon mot de passe"
                placeholder="8 caractères minimum"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry
                // Dire au système qu'il s'agit d'un mot de passe NEUF, et le
                // voilà qui en propose un fort, l'enregistre et le remplira
                // tout seul à la prochaine connexion. Sans ces deux lignes, on
                // demande à un parent pressé d'en inventer un — et il ressort
                // celui qu'il utilise partout, c'est-à-dire souvent celui que
                // la protection contre les fuites va refuser. La friction ne
                // venait pas de la protection : elle venait de l'invention.
                autoComplete="new-password"
                textContentType="newPassword"
                hint="C’est le seul mot de passe de Mino. Il ne se tape que sur votre téléphone."
                error={errors.password}
              />
            </>
          )}
          {demandeLeCode ? (
            <Field
              label="Code parent (4 chiffres)"
              placeholder="••••"
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              // Surtout PAS un mot de passe : sans ce démenti, le trousseau
              // propose d'enregistrer le code parent à la place de celui du
              // compte — deux champs masqués sur le même écran, il choisit le
              // dernier. Le parent se retrouve alors avec quatre chiffres
              // remplis automatiquement dans le champ mot de passe.
              autoComplete="off"
              textContentType="none"
              hint="Il protège l’espace parent : les enfants ne doivent pas le connaître."
              error={errors.pin}
            />
          ) : null}
        </View>

        {erreur ? (
          <Text variant="caption" color={colors.dangerInk} center>
            {erreur}
          </Text>
        ) : null}

        {/**
          * ------------------------------- la sortie de celui qui a déjà un compte
          *
          * **Le défaut.** Une inscription qui échoue sur l'adresse — le cas le
          * plus fréquent étant, de loin, une adresse déjà prise — laissait le
          * parent devant un message et rien d'autre. Il retape, il réessaie, il
          * abandonne, avec un compte parfaitement valable qui l'attendait.
          *
          * **Pourquoi on ne lui dit pas simplement « ce compte existe déjà ».**
          * `SupabaseAuthService` s'y refuse délibérément, et il a raison :
          * répondre différemment selon que l'adresse est prise ou libre livre
          * la liste des clients de Mino, une adresse à la fois. Pour une
          * application de familles, c'est dire qui a des enfants et lesquels
          * s'en servent.
          *
          * **Ce qu'on fait à la place.** On offre le chemin sans confirmer
          * quoi que ce soit. Cette phrase est vraie pour tout le monde : celui
          * qui n'a pas de compte ne trouvera rien au bout, celui qui en a un le
          * retrouve en une touche, et personne n'apprend rien sur personne.
          * L'adresse voyage avec lui — la retaper, c'est refaire le geste qui
          * vient d'échouer.
          */}
        {errors.email || erreur ? (
          <Button
            label="Se connecter avec cette adresse"
            variant="ghost"
            haptic={false}
            onPress={() =>
              router.replace({ pathname: '/login', params: { email: email.trim() } })
            }
          />
        ) : null}

        <Text variant="caption" color={colors.textSubtle}>
          Mino ne collecte aucune donnée inutile : pas de géolocalisation, pas de publicité, pas de
          suivi marketing côté enfant.
        </Text>

        <Button label="Continuer" onPress={submit} loading={loading} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  form: { gap: spacing.lg },
});
