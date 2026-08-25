import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons/Icon';
import { Mascot } from '@/components/mascot';
import { Avatar, Button, Card, Logo, Screen, Text, TimeCapsules } from '@/components/ui';
import { balanceOf } from '@/domain/ledger';
import { getAuthService } from '@/services/auth';
import { unitOf } from '@/domain/ageBand';
import { formatTime } from '@/domain/minos';
import { useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, shadows, spacing } from '@/theme';

/** Profile picker — a child taps their face, never types anything. */
export default function Who() {
  const router = useRouter();
  const data = useFamily();
  const selectChild = useMinoStore((s) => s.selectChild);
  const lockParent = useMinoStore((s) => s.lockParent);

  /**
   * Y a-t-il un parent connecté ? La réponse change ce qu'il faut lui proposer
   * quand il n'y a rien à ouvrir, et les deux cas n'ont rien à voir.
   */
  const [connecte, setConnecte] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // Leaving a profile always re-locks the parent area.
    lockParent();
    selectChild(null);
  }, [lockParent, selectChild]);

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
            {data.parents[0] ? `${data.parents[0].displayName} · protégé par un code` : 'Protégé par un code'}
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
