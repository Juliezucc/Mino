import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { getAuthService } from '@/services/auth';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

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

/** Step 1 of onboarding: the parent account. Children never create an account. */
export default function CreateAccount() {
  const router = useRouter();
  const createAccount = useMinoStore((s) => s.createAccount);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [consent, setConsent] = useState(false);
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

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Indique ton prénom.';
    if (!compteOuvert) {
      if (!EMAIL_RE.test(email.trim())) next.email = 'Adresse e-mail invalide.';
      if (password.length < 8) next.password = 'Au moins 8 caractères.';
    }
    if (!codeDejaPose) {
      if (!/^\d{4}$/.test(pin)) next.pin = 'Le code parent doit contenir 4 chiffres.';
      // A PIN identical to the last digits of the password helps nobody.
      if (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '0000') {
        next.pin = 'Trop facile à deviner. Choisissez autre chose.';
      }
    }
    // Le seul consentement qui ne se rattrape jamais. Mino encadre le temps
    // d'écran d'un enfant : c'est le titulaire de l'autorité parentale qui
    // l'autorise, et le dossier déposé chez Apple l'affirme. Ne pas le
    // demander ici, c'est affirmer chez Apple quelque chose que le binaire ne
    // fait pas — et ne pas pouvoir le prouver le jour où on le demande.
    if (!consent) next.consent = 'Cochez cette case pour continuer.';
    setErrors(next);
    setErreur(null);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const result = await createAccount({
        parentName: name.trim(),
        email: compteOuvert ?? email.trim(),
        password: compteOuvert ? undefined : password,
        pin: codeDejaPose ? undefined : pin,
        // L'instant du consentement, pas seulement le fait qu'il ait eu lieu :
        // c'est la date qui vaut preuve.
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
      router.replace('/onboarding/child');
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
          title={compteOuvert ? 'Créer ma famille' : 'Créer mon compte'}
          subtitle={
            compteOuvert
              ? `Votre compte ${compteOuvert} est déjà ouvert. Il ne reste que la famille à créer.`
              : 'Le compte appartient au parent. Aucun e-mail n’est demandé aux enfants.'
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
                hint="Il protège votre compte. Le code à 4 chiffres, lui, protège l’espace parent sur les appareils de la famille."
                error={errors.password}
              />
            </>
          )}
          {codeDejaPose ? null : (
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
          )}
        </View>

        <Pressable
          onPress={() => setConsent((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Je suis titulaire de l’autorité parentale et j’accepte les conditions générales et la politique de confidentialité."
          style={styles.consent}
          hitSlop={8}
        >
          <View style={[styles.box, consent && styles.boxOn]}>
            {consent ? (
              <Text variant="bodyStrong" color={colors.onBrand}>
                ✓
              </Text>
            ) : null}
          </View>
          <Text variant="caption" color={colors.textMuted} style={styles.consentText}>
            Je suis titulaire de l’autorité parentale sur les enfants que j’ajouterai, et
            j’accepte les{' '}
            <Text
              variant="caption"
              color={colors.blueInk}
              onPress={() => router.push('/legal/cgv')}
            >
              conditions générales
            </Text>{' '}
            et la{' '}
            <Text
              variant="caption"
              color={colors.blueInk}
              onPress={() => router.push('/legal/confidentialite')}
            >
              politique de confidentialité
            </Text>
            .
          </Text>
        </Pressable>
        {errors.consent ? (
          <Text variant="caption" color={colors.dangerInk}>
            {errors.consent}
          </Text>
        ) : null}

        {erreur ? (
          <Text variant="caption" color={colors.dangerInk} center>
            {erreur}
          </Text>
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
  consent: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  // 28 points, et non 20 : la case se coche avec un pouce, sur un écran tenu
  // d'une main, par quelqu'un qui a un enfant dans les bras.
  box: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  consentText: { flex: 1 },
});
