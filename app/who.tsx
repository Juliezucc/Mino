import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons/Icon';
import { Mascot } from '@/components/mascot';
import { Avatar, Button, Card, Logo, Screen, Text, TimeCapsules } from '@/components/ui';
import { ouvertureDeProfil } from '@/data/deviceProfile';
import { balanceOf } from '@/domain/ledger';
import { getAuthService } from '@/services/auth';
import { unitOf } from '@/domain/ageBand';
import { formatTime } from '@/domain/minos';
import { useFamily, useParentDeCetAppareil } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, shadows, spacing } from '@/theme';

/** Profile picker — a child taps their face, never types anything. */
export default function Who() {
  const router = useRouter();
  const data = useFamily();
  const selectChild = useMinoStore((s) => s.selectChild);
  const lockParent = useMinoStore((s) => s.lockParent);
  const device = useMinoStore((s) => s.device);
  const parentUnlocked = useMinoStore((s) => s.parentUnlocked);
  const parentIci = useParentDeCetAppareil();

  /**
   * Y a-t-il un parent connecté ? La réponse change ce qu'il faut lui proposer
   * quand il n'y a rien à ouvrir, et les deux cas n'ont rien à voir.
   */
  const [connecte, setConnecte] = React.useState<boolean | null>(null);

  /**
   * Le profil demandé AVANT le code, et rouvert après.
   *
   * **Le défaut, et il annulait la fonctionnalité entière.** Sur le téléphone
   * réservé à Manon, ouvrir le profil de Noah exige le code — c'est voulu. Le
   * chemin passait par `/parent-pin` puis revenait ici, et `router.replace`
   * ne réutilise pas l'écran déjà empilé : il en monte un NEUF, dont l'effet
   * de montage ci-dessous appelle `lockParent()`. Le déverrouillage obtenu une
   * seconde plus tôt était donc effacé à l'instant même où l'on revenait, et
   * retoucher Noah redemandait le code. Indéfiniment, sans qu'aucun texte
   * n'explique le refus.
   *
   * L'intention voyage donc avec le retour. On referme quand même l'espace
   * parent — le code servait à changer de profil, pas à rester — puis on
   * termine le geste qui l'avait demandé.
   */
  const { ouvrir } = useLocalSearchParams<{ ouvrir?: string }>();

  React.useEffect(() => {
    // Leaving a profile always re-locks the parent area.
    lockParent();
    if (typeof ouvrir === 'string' && ouvrir) {
      selectChild(ouvrir);
      router.replace('/child');
      return;
    }
    selectChild(null);
  }, [lockParent, selectChild, ouvrir, router]);

  React.useEffect(() => {
    let vivant = true;
    getAuthService()
      .session()
      .then((s) => vivant && setConnecte(s.kind === 'parent'))
      .catch(() => vivant && setConnecte(false));
    return () => {
      vivant = false;
    };
  }, []);

  /**
   * Aucune famille sur cet appareil.
   *
   * `return null` rendait un écran BLANC, sans rien pour en sortir. On y arrive
   * plus facilement qu'il n'y paraît : un parent qui se connecte sur un
   * nouveau téléphone, quelqu'un qui a abandonné l'inscription en route, ou
   * simplement un chargement qui n'aboutit pas parce qu'on est dans le métro.
   *
   * Trouvé en conduisant la connexion. Un écran vide n'est pas une erreur
   * rare : c'est une erreur muette, et c'est la pire des deux.
   */
  if (!data) {
    return (
      <Screen contentStyle={styles.empty}>
        <Mascot expression="surprised" size={120} />
        <Text variant="title" center>
          Rien à ouvrir sur cet appareil
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {connecte === false
            ? 'Aucun compte n’est ouvert sur cet appareil. Connectez-vous pour retrouver votre famille, créez-en une, ou rattachez cet appareil avec le code.'
            : 'Votre famille n’a pas été trouvée ici. Si vous venez de vous connecter, vérifiez votre connexion et réessayez ; sinon, créez votre famille ou rattachez cet appareil avec le code.'}
        </Text>
        {connecte === false ? (
          <Button label="Se connecter" onPress={() => router.replace('/login')} />
        ) : null}
        <Button
          label="Créer ma famille"
          variant={connecte === false ? 'secondary' : 'primary'}
          onPress={() => router.replace('/onboarding/account')}
        />
        <Button
          label="J’ai un code famille"
          icon="🔑"
          variant="secondary"
          onPress={() => router.replace('/join')}
        />
        <Button label="Revenir à l’accueil" variant="ghost" onPress={() => router.replace('/welcome')} />
      </Screen>
    );
  }

  const openChild = (childId: string) => {
    /**
     * Sur l'appareil réservé à un enfant, passer à un autre demande le code.
     *
     * Le sélecteur ouvrait n'importe quel profil d'une touche, y compris sur
     * la tablette de Manon : le profil de son frère, et surtout ses minutes,
     * étaient à portée. Sur la tablette du salon, en revanche, c'est le geste
     * ordinaire et il doit le rester. Voir `changementDeProfilLibre`.
     *
     * `parentUnlocked` suffit à lever la demande : un parent qui vient de
     * taper son code est là, et on ne le lui redemande pas deux fois.
     */
    const geste = ouvertureDeProfil(device, childId, parentUnlocked);
    if (geste.kind === 'demander-le-code') {
      // `ouvrir` est ce qui manquait : sans lui, le sélecteur remonté ne sait
      // plus quel profil on venait de demander, et redemande le code.
      router.push({ pathname: '/parent-pin', params: { ensuite: '/who', ouvrir: geste.ouvrir } });
      return;
    }
    selectChild(childId);
    router.replace('/child');
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Logo size={34} />
        <Text variant="title">Qui utilise Mino ?</Text>
      </View>

      <View style={styles.grid}>
        {data.children.map((child) => {
          const minutes = balanceOf(data.transactions, child.id);
          return (
            <Card
              key={child.id}
              onPress={() => openChild(child.id)}
              accessibilityLabel={`${child.firstName}, ${minutes} minutes disponibles`}
              style={styles.childCard}
              elevation="soft"
            >
              <Avatar avatarKey={child.avatarKey} size={84} />
              <Text variant="cardTitle">{child.firstName}</Text>
              <Text variant="label" color={colors.blueInk}>
                {formatTime(minutes, unitOf(child))}
              </Text>
              <TimeCapsules minutes={minutes} compact maxCapsules={8} />
            </Card>
          );
        })}
      </View>

      {data.children.length === 0 ? (
        <Card style={styles.empty}>
          <Mascot expression="motivated" size={110} />
          <Text variant="cardTitle" center>
            Aucun profil enfant pour l’instant
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Va dans l’espace parent pour créer le premier profil.
          </Text>
        </Card>
      ) : null}

      <Pressable
        onPress={() => router.push('/parent-pin')}
        accessibilityRole="button"
        accessibilityLabel="Espace parent"
        style={({ pressed }) => [styles.parentRow, pressed && styles.pressed]}
      >
        <View style={styles.lock}>
          <Icon name="lock" color={colors.purpleInk} size={22} />
        </View>
        <View style={styles.parentTexts}>
          <Text variant="bodyStrong">Espace parent</Text>
          <Text variant="caption" color={colors.textMuted}>
            {/* Le prénom est nul tant que l'inscription n'a pas atteint l'écran
                de compte, et une interpolation en rend alors le mot « null » —
                affiché tel quel à un parent, sous « Espace parent ». Ce n'est
                pas un cas d'école : c'est ce qu'a vu la première personne à
                revenir en arrière pendant son inscription. */}
            {/* Le parent de CET appareil, et non le premier de la liste : sur
                le téléphone du second parent, « Julie · protégé par un code »
                sous « Espace parent » désigne quelqu'un d'autre que celui qui
                lit. Voir `parentDeLAppareil`. */}
            {parentIci?.displayName?.trim()
              ? `${parentIci.displayName} · protégé par un code`
              : 'Protégé par un code'}
          </Text>
        </View>
        <Icon name="chevron-right" color={colors.textSubtle} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.xl },
  header: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  childCard: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.soft,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  lock: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentTexts: { flex: 1, gap: 2 },
});
