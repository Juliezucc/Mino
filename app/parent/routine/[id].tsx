import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, MinutesBadge, Screen, ScreenHeader, Text } from '@/components/ui';
import { ROUTINES, resolveTitle, suits } from '@/domain/missionLibrary';
import { ID } from '@/domain/types';
import { useChildren } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

/**
 * A routine, ready to accept. The parent picks the child, unticks what does not
 * apply, and gets a coherent set of missions in one go.
 *
 * The suggestions are re-filtered against whoever is selected: a routine looks
 * different for a 6-year-old and a 12-year-old, and sibling missions only make
 * sense when there is a sibling to name.
 */
export default function RoutineDetail() {
  const router = useRouter();
  const { id, childId } = useLocalSearchParams<{ id: string; childId?: string }>();
  const children = useChildren();
  const addMission = useMinoStore((s) => s.addMission);

  const routine = ROUTINES.find((r) => r.id === id);
  const [selectedChildren, setSelectedChildren] = useState<ID[]>(
    childId ? [childId] : children.length === 1 ? [children[0].id] : [],
  );
  const [skipped, setSkipped] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // What the picked children have in common — a mission goes to all of them at
  // once, so a suggestion is only offered if it suits every one of them.
  const items = useMemo(() => {
    if (!routine) return [];
    const picked = children.filter((c) => selectedChildren.includes(c.id));
    // Nobody picked yet: neutral wording, never the raw placeholder.
    if (picked.length === 0) {
      return routine.suggestions.map((s) => ({ suggestion: s, title: resolveTitle(s, []) }));
    }
    return routine.suggestions
      .filter((s) => picked.every((child) => suits(s, child, children.filter((c) => c.id !== child.id))))
      .map((s) => ({
        suggestion: s,
        // One child picked: their own sibling's name. Several: neutral wording.
        title: resolveTitle(s, picked.length === 1 ? children.filter((c) => c.id !== picked[0].id) : []),
      }));
  }, [routine, children, selectedChildren]);

  if (!routine) return null;

  const kept = items.filter((i) => !skipped.includes(i.suggestion.id));
  const total = kept.reduce((sum, i) => sum + i.suggestion.minutes, 0);

  const toggleChild = (cid: ID) =>
    setSelectedChildren((prev) => (prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid]));

  const toggle = (sid: string) =>
    setSkipped((prev) => (prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid]));

  const create = async () => {
    setLoading(true);
    try {
      for (const item of kept) {
        await addMission({
          title: item.title,
          icon: item.suggestion.icon,
          minutes: item.suggestion.minutes,
          repeat: routine.repeat,
          childIds: selectedChildren,
        });
      }
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const ready = selectedChildren.length > 0 && kept.length > 0;

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <Button
          label={
            kept.length > 0
              ? `AJOUTER ${kept.length} MISSION${kept.length > 1 ? 'S' : ''}`
              : 'AJOUTER LES MISSIONS'
          }
          onPress={create}
          disabled={!ready}
          loading={loading}
        />
      }
    >
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.hero}>
        <Text style={styles.heroIcon}>{routine.icon}</Text>
        <Text variant="hero" center>
          {routine.title}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {routine.tagline}
        </Text>
      </View>

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Pour qui ?
        </Text>
        {children.length === 0 ? (
          <Text variant="caption" color={colors.textSubtle}>
            Crée d’abord un profil enfant.
          </Text>
        ) : (
          <View style={styles.row}>
            {children.map((child) => {
              const selected = selectedChildren.includes(child.id);
              return (
                <Pressable
                  key={child.id}
                  onPress={() => toggleChild(child.id)}
                  accessibilityRole="button"
                  accessibilityLabel={child.firstName}
                  accessibilityState={{ selected }}
                  style={[styles.childTile, selected && styles.childTileSelected]}
                >
                  <Avatar avatarKey={child.avatarKey} size={36} />
                  <Text variant="label" color={selected ? colors.blueDark : colors.textMuted}>
                    {child.firstName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Les missions de cette routine
        </Text>
        {items.length === 0 ? (
          <Text variant="caption" color={colors.textSubtle}>
            Rien de vraiment adapté à cet âge dans cette routine.
          </Text>
        ) : (
          <View style={styles.list}>
            {items.map((item) => {
              const on = !skipped.includes(item.suggestion.id);
              return (
                <Card
                  key={item.suggestion.id}
                  onPress={() => toggle(item.suggestion.id)}
                  accessibilityLabel={
                    item.suggestion.safety
                      ? `${item.title}. ${item.suggestion.safety}`
                      : item.title
                  }
                  accessibilityState={{ selected: on }}
                  style={[styles.itemCard, !on && styles.itemOff]}
                >
                  <View style={styles.item}>
                    <View style={[styles.check, on && styles.checkOn]}>
                      <Text variant="label" color={on ? colors.onBrand : colors.textSubtle}>
                        {on ? '✓' : ''}
                      </Text>
                    </View>
                    <Text style={styles.itemIcon}>{item.suggestion.icon}</Text>
                    <Text variant="cardTitle" style={styles.itemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <MinutesBadge minutes={item.suggestion.minutes} size="sm" />
                  </View>

                  {/* Shown before the parent accepts, not buried in a help page:
                      a suggestion an app makes reads as one it vouches for. */}
                  {item.suggestion.safety ? (
                    <View style={styles.safety}>
                      <Text variant="caption" color={colors.textMuted}>
                        {`⚠️  ${item.suggestion.safety}`}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </View>

      {ready ? (
        <Text variant="caption" color={colors.textSubtle} center>
          {`Jusqu’à ${total} min à gagner par jour · tout reste modifiable ensuite`}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.xs },
  heroIcon: { fontSize: 52 },
  block: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm },
  itemCard: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemOff: { opacity: 0.45 },
  safety: {
    backgroundColor: colors.yellowSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemIcon: { fontSize: 26 },
  itemTitle: { flex: 1 },
  check: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },
  checkOn: { backgroundColor: colors.mint },
  childTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  childTileSelected: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
});
