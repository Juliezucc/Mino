import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons/Icon';
import { Avatar, Button, Card, EmptyState, MinutesBadge, Screen, SectionHeader, Text } from '@/components/ui';
import { balanceDetail } from '@/domain/ledger';
import { useChildren, useFamily } from '@/store/selectors';
import { colors, spacing, tabBarSpace } from '@/theme';

export default function ParentChildren() {
  const router = useRouter();
  const children = useChildren();
  const data = useFamily();

  if (!data) return null;

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader title="Enfants" subtitle="Profils, soldes et historique" />

      <Button
        label="Ajouter un enfant"
        icon="＋"
        onPress={() => router.push('/parent/child-new')}
      />

      {children.length === 0 ? (
        <EmptyState
          title="Aucun profil enfant"
          message="Crée un profil pour commencer à proposer des missions."
          expression="happy"
        />
      ) : (
        <View style={styles.list}>
          {children.map((child) => {
            const balance = balanceDetail(data.transactions, child.id);
            return (
              <Card
                key={child.id}
                onPress={() =>
                  router.push({ pathname: '/parent/child/[id]', params: { id: child.id } })
                }
              >
                <View style={styles.row}>
                  <Avatar avatarKey={child.avatarKey} size={54} />
                  <View style={styles.texts}>
                    <Text variant="cardTitle">{child.firstName}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {`${child.age} ans`}
                    </Text>
                  </View>
                  <MinutesBadge minutes={balance.minutes} signed={false} />
                  <Icon name="chevron-right" color={colors.textSubtle} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: tabBarSpace, gap: spacing.lg },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texts: { flex: 1, gap: 2 },
});
