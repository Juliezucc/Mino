import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Chip, Field, Text } from '@/components/ui';
import { resolveTitle, suggestionsFor } from '@/domain/missionLibrary';
import { ID, RepeatKind, RepeatRule, Weekday } from '@/domain/types';
import { useChildren } from '@/store/selectors';
import { colors, radii, spacing } from '@/theme';

export interface MissionFormValue {
  title: string;
  icon: string;
  minutes: number;
  repeat: RepeatRule;
  childIds: ID[];
}

interface Props {
  initialChildIds?: ID[];
  submitLabel?: string;
  onSubmit: (value: MissionFormValue) => void | Promise<void>;
  loading?: boolean;
}

const ICONS = ['🛏️', '🧸', '🍽️', '🪥', '🎒', '📚', '🧺', '🐶', '🚿', '🧹', '🥣', '⭐'];
const QUICK_MINUTES = [5, 10, 15, 20, 30];
const DAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'M' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];

export function MissionForm({ initialChildIds = [], submitLabel = 'CRÉER LA MISSION', onSubmit, loading }: Props) {
  const children = useChildren();

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [minutes, setMinutes] = useState(15);
  const [customMinutes, setCustomMinutes] = useState('');
  const [repeatKind, setRepeatKind] = useState<RepeatKind>('daily');
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [childIds, setChildIds] = useState<ID[]>(initialChildIds);
  const [error, setError] = useState<string | undefined>();

  // Suggestions follow whoever is selected: age-appropriate, and only naming a
  // brother or sister when there is one.
  const suggestions = useMemo(() => {
    const picked = children.filter((c) => childIds.includes(c.id));
    const child = picked.length === 1 ? picked[0] : null;
    const siblings = child ? children.filter((c) => c.id !== child.id) : [];
    return suggestionsFor(child, siblings)
      .slice(0, 10)
      .map((s) => ({ ...s, label: resolveTitle(s, siblings) }));
  }, [children, childIds]);

  const toggleChild = (id: ID) =>
    setChildIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const toggleDay = (day: Weekday) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const submit = () => {
    if (!title.trim()) return setError('Donne un nom à la mission.');
    if (minutes <= 0) return setError('Choisis le temps gagné.');
    if (childIds.length === 0) return setError('Choisis au moins un enfant.');
    setError(undefined);

    onSubmit({
      title: title.trim(),
      icon,
      minutes,
      childIds,
      repeat: repeatKind === 'weekdays' ? { kind: 'weekdays', days } : { kind: repeatKind },
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Missions prêtes à l’emploi
        </Text>
        <View style={styles.row}>
          {suggestions.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              icon={s.icon}
              selected={title === s.label}
              onPress={() => {
                setTitle(s.label);
                setIcon(s.icon);
                setMinutes(s.minutes);
                setCustomMinutes('');
              }}
            />
          ))}
        </View>
      </View>

      <Field
        label="Nom de la mission"
        placeholder="Ranger ma chambre"
        value={title}
        onChangeText={setTitle}
      />

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Icône
        </Text>
        <View style={styles.row}>
          {ICONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => setIcon(emoji)}
              accessibilityRole="button"
              accessibilityLabel={`Icône ${emoji}`}
              accessibilityState={{ selected: icon === emoji }}
              style={[styles.iconTile, icon === emoji && styles.iconTileSelected]}
            >
              <Text style={styles.iconGlyph}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Temps gagné
        </Text>
        <View style={styles.row}>
          {QUICK_MINUTES.map((value) => (
            <Chip
              key={value}
              label={`+${value} min`}
              selected={minutes === value && !customMinutes}
              onPress={() => {
                setMinutes(value);
                setCustomMinutes('');
              }}
            />
          ))}
        </View>
        <Field
          placeholder="Valeur personnalisée (en minutes)"
          keyboardType="number-pad"
          value={customMinutes}
          onChangeText={(v) => {
            const clean = v.replace(/\D/g, '').slice(0, 3);
            setCustomMinutes(clean);
            if (clean) setMinutes(Number(clean));
          }}
        />
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
              const selected = childIds.includes(child.id);
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
          Répéter
        </Text>
        <View style={styles.row}>
          <Chip label="Jamais" selected={repeatKind === 'never'} onPress={() => setRepeatKind('never')} />
          <Chip
            label="Tous les jours"
            selected={repeatKind === 'daily'}
            onPress={() => setRepeatKind('daily')}
          />
          <Chip
            label="Certains jours"
            selected={repeatKind === 'weekdays'}
            onPress={() => setRepeatKind('weekdays')}
          />
        </View>
        {repeatKind === 'weekdays' ? (
          <View style={styles.row}>
            {DAYS.map((day, index) => (
              <Pressable
                key={`${day.value}-${index}`}
                onPress={() => toggleDay(day.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: days.includes(day.value) }}
                style={[styles.day, days.includes(day.value) && styles.daySelected]}
              >
                <Text
                  variant="label"
                  color={days.includes(day.value) ? colors.onBrand : colors.textMuted}
                >
                  {day.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Button label={submitLabel} onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  block: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileSelected: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  iconGlyph: { fontSize: 24 },
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
  day: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  daySelected: { backgroundColor: colors.blue, borderColor: colors.blue },
});

export default MissionForm;
