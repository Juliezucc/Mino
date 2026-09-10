import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  MinutesBadge,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
  TimeCapsules,
  confirmer,
} from '@/components/ui';
import { balanceDetail } from '@/domain/ledger';
import { missionsForChild } from '@/domain/missions';
import { MissionCard } from '@/features/child/MissionCard';
import { HistoryList } from '@/features/history/HistoryList';
import { useChild, useFamily, useHistory } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/** One child seen from the parent side: balance, missions, full history. */
export default function ParentChildDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const child = useChild(id);
  const data = useFamily();
  const history = useHistory(id);
  const adjustBalance = useMinoStore((s) => s.adjustBalance);
  const deleteChild = useMinoStore((s) => s.deleteChild);
  const editChild = useMinoStore((s) => s.editChild);

  if (!child || !data) return null;

  const balance = balanceDetail(data.transactions, child.id);
  const missions = missionsForChild(data, child.id);

  const adjust = (delta: number) => {
    adjustBalance(child.id, delta, delta > 0 ? 'Bonus parent' : 'Retrait parent').catch(
      () => undefined,
    );
  };

  const confirmDelete = () => {
    void confirmer({
      titre: 'Supprimer le profil ?',
      message: `Toutes les données de ${child.firstName} seront effacées de cet appareil.`,
      action: 'Supprimer',
      destructif: true,
    }).then(async (oui) => {
      if (!oui) return;
      await deleteChild(child.id);
      router.back();
    });
  };

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} />

      <Card style={styles.identity}>
        <Avatar avatarKey={child.avatarKey} size={82} />
        <Text variant="title">{child.firstName}</Text>
        <Text variant="body" color={colors.textMuted}>
          {`${child.age} ans`}
        </Text>
        {/**
         * Le bouton qui manquait, juste sous ce qu'il sert à corriger.
         *
         * L'âge s'affichait ici sans être modifiable nulle part : un parent qui
         * s'était trompé d'une touche n'avait que la suppression du profil —
         * donc la perte de tout l'historique — pour se rattraper. Or l'âge
         * décide du registre de l'application au seuil de 13 ans, et des
         * missions proposées.
         */}
        <Button
          label="Modifier le profil"
          icon="✏️"
          variant="secondary"
          full={false}
          onPress={() =>
            router.push({ pathname: '/parent/child-edit', params: { id: child.id } })
          }
        />
        <Text variant="display" color={colors.blueInk}>
          {`${balance.minutes}:00`}
        </Text>
        <Text variant="label" color={colors.textMuted}>
          min disponibles
        </Text>
        <TimeCapsules minutes={balance.minutes} />
        <View style={styles.badges}>
          <MinutesBadge minutes={balance.earnedToday} tone="mint" />
          {balance.usedToday > 0 ? <MinutesBadge minutes={-balance.usedToday} tone="muted" /> : null}
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title="Une fois qu’il a gagné des minos"
          subtitle="Il ne peut jamais lancer plus que son compteur, ni du temps que vous n’avez pas confirmé"
        />
        <View style={styles.row}>
          <Chip
            label="Il s’en sert quand il veut"
            icon="▶️"
            selected={!child.requireApproval}
            onPress={() => editChild(child.id, { requireApproval: false }).catch(() => undefined)}
          />
          <Chip
            label="Il me demande d’abord"
            icon="🙋"
            selected={child.requireApproval === true}
            onPress={() => editChild(child.id, { requireApproval: true }).catch(() => undefined)}
          />
        </View>
        <Text variant="caption" color={colors.textSubtle}>
          Console, télévision et ordinateur passent toujours par vous, quel que soit ce réglage.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Parler à Mino"
          subtitle="Quand son temps d’écran est fini, Mino reste et discute avec lui"
        />
        <View style={styles.row}>
          <Chip
            label="Oui"
            icon="💬"
            selected={child.companionEnabled !== false}
            onPress={() => editChild(child.id, { companionEnabled: true }).catch(() => undefined)}
          />
          <Chip
            label="Non"
            icon="🔇"
            selected={child.companionEnabled === false}
            onPress={() => editChild(child.id, { companionEnabled: false }).catch(() => undefined)}
          />
        </View>
        <Text variant="caption" color={colors.textSubtle}>
          Une vingtaine d’échanges par jour, puis Mino l’envoie jouer. Il ne confirme aucune mission
          et ne donne aucune minute.
        </Text>
        <Button
          label="Lire leurs conversations"
          icon="📖"
          variant="secondary"
          onPress={() => router.push({ pathname: '/parent/conversations', params: { childId: child.id } })}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Ajustement" subtitle="Chaque ajustement est tracé dans l’historique" />
        <View style={styles.adjustRow}>
          <Button label="− 5 min" variant="secondary" full={false} style={styles.adjustButton} onPress={() => adjust(-5)} />
          <Button label="+ 5 min" variant="secondary" full={false} style={styles.adjustButton} onPress={() => adjust(5)} />
          <Button label="+ 15 min" variant="secondary" full={false} style={styles.adjustButton} onPress={() => adjust(15)} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Ses missions"
          action={{
            label: 'Ajouter',
            onPress: () =>
              router.push({ pathname: '/parent/mission-new', params: { childId: child.id } }),
          }}
        />
        {missions.length === 0 ? (
          <Card elevation="none" background={colors.surfaceMuted}>
            <Text variant="body" color={colors.textMuted} center>
              Aucune mission pour aujourd’hui.
            </Text>
          </Card>
        ) : (
          // Ouvrable ici aussi : c'est l'écran où un parent regarde ce que fait
          // son enfant, donc celui où il se dit « celle-là vaut cinq minutes,
          // pas quinze ». L'envoyer chercher la mission dans l'autre onglet
          // pour la même pensée, c'est la lui faire abandonner.
          missions.map((item) => (
            <MissionCard
              key={item.mission.id}
              item={item}
              onPress={() =>
                router.push({
                  pathname: '/parent/mission/[id]',
                  params: { id: item.mission.id },
                })
              }
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Historique" />
        <HistoryList transactions={history} limit={30} />
      </View>

      <Button label="Supprimer le profil" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.xl },
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  section: { gap: spacing.md },
  adjustRow: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  adjustButton: { flex: 1 },
});
