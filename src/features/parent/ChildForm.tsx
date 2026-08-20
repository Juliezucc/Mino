import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AVATARS, Avatar, Button, Chip, Field, Text } from '@/components/ui';
import { MAX_AGE, MIN_AGE, bandForAge } from '@/domain/ageBand';
import { AvatarKey } from '@/domain/types';
import { colors, spacing } from '@/theme';

export interface ChildFormValue {
  firstName: string;
  age: number;
  avatarKey: AvatarKey;
  /** Ask a parent before every session, even on this device. */
  requireApproval: boolean;
}

interface Props {
  initial?: Partial<ChildFormValue>;
  submitLabel: string;
  onSubmit: (value: ChildFormValue) => void | Promise<void>;
  loading?: boolean;
}

/** 4 to 17: Mino keeps working through adolescence, in a different register. */
const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);

/** Shared by onboarding and the parent area, so a child is created the same way everywhere. */
export function ChildForm({ initial, submitLabel, onSubmit, loading }: Props) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [age, setAge] = useState(initial?.age ?? 8);
  const [avatarKey, setAvatarKey] = useState<AvatarKey>(initial?.avatarKey ?? 'blue');
  const [requireApproval, setRequireApproval] = useState(initial?.requireApproval ?? false);
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (!firstName.trim()) {
      setError('Indique le prénom de l’enfant.');
      return;
    }
    setError(undefined);
    onSubmit({ firstName: firstName.trim(), age, avatarKey, requireApproval });
  };

  return (
    <View style={styles.wrap}>
      <Field
        label="Prénom"
        placeholder="Noah"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        error={error}
      />

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Âge
        </Text>
        <View style={styles.row}>
          {AGES.map((value) => (
            <Chip
              key={value}
              label={`${value} ans`}
              selected={age === value}
              onPress={() => setAge(value)}
            />
          ))}
        </View>
        <Text variant="caption" color={colors.textSubtle}>
          {bandForAge(age) === 'ado'
            ? 'À partir de 13 ans, Mino passe en version ado : minutes plutôt que minos, ton sobre, missions adaptées.'
            : 'Mino parle en minos et adapte les missions proposées à cet âge.'}
        </Text>
      </View>

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Utiliser son temps
        </Text>
        <View style={styles.row}>
          <Chip
            label="Il se lance tout seul"
            icon="▶️"
            selected={!requireApproval}
            onPress={() => setRequireApproval(false)}
          />
          <Chip
            label="Il me demande d’abord"
            icon="🙋"
            selected={requireApproval}
            onPress={() => setRequireApproval(true)}
          />
        </View>
        <Text variant="caption" color={colors.textSubtle}>
          {requireApproval
            ? 'Chaque session attendra votre accord, y compris sur l’appareil où Mino est installé.'
            : 'Sur l’appareil où Mino est installé, votre enfant démarre son temps lui-même. Les autres écrans passent toujours par vous.'}
        </Text>
      </View>

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Avatar
        </Text>
        <View style={styles.row}>
          {AVATARS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setAvatarKey(item.key)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: avatarKey === item.key }}
            >
              {/* 62pt targets stay comfortable for a parent and a child alike. */}
              <Avatar avatarKey={item.key} size={62} selected={avatarKey === item.key} />
            </Pressable>
          ))}
        </View>
      </View>

      <Button label={submitLabel} onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  block: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

export default ChildForm;
