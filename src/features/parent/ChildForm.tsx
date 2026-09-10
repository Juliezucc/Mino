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
  /** Whether the child may talk to Mino once their time has run out. */
  companionEnabled: boolean;
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
  const [avatarKey, setAvatarKey] = useState<AvatarKey>(initial?.avatarKey ?? 'fox');
  const [requireApproval, setRequireApproval] = useState(initial?.requireApproval ?? false);
  const [companionEnabled, setCompanionEnabled] = useState(initial?.companionEnabled ?? true);
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (!firstName.trim()) {
      setError('Indique le prénom de l’enfant.');
      return;
    }
    setError(undefined);
    onSubmit({ firstName: firstName.trim(), age, avatarKey, requireApproval, companionEnabled });
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
          {bandForAge(age) === 'ado' ? 'Une fois les minutes gagnées' : 'Une fois les minos gagnés'}
        </Text>
        <View style={styles.row}>
          <Chip
            label="Sans me demander"
            icon="▶️"
            selected={!requireApproval}
            onPress={() => setRequireApproval(false)}
          />
          <Chip
            label="En me demandant d’abord"
            icon="🙋"
            selected={requireApproval}
            onPress={() => setRequireApproval(true)}
          />
        </View>
        {/* A parent adding their first child is discovering the app. The thing
            they need to hear is the guarantee, not the setting: a child can
            never start time they have not already earned and you have not
            already validated. */}
        <Text variant="caption" color={colors.textSubtle}>
          {requireApproval
            ? 'Même pour des minos déjà gagnés, chaque session attendra votre accord — y compris sur l’appareil où Mino est installé.'
            : 'Seuls des minos déjà gagnés et confirmés par vous peuvent être lancés, jamais plus que le compteur. Sur l’appareil où Mino est installé, la session démarre sans vous ; console, télévision et ordinateur passent toujours par vous.'}
        </Text>
      </View>

      <View style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Parler à Mino
        </Text>
        <View style={styles.row}>
          <Chip
            label="Oui"
            icon="💬"
            selected={companionEnabled}
            onPress={() => setCompanionEnabled(true)}
          />
          <Chip
            label="Non"
            icon="🔇"
            selected={!companionEnabled}
            onPress={() => setCompanionEnabled(false)}
          />
        </View>
        {/* Une famille peut très bien ne pas vouloir que son enfant parle à un
            personnage, et n'a aucune explication à donner. Ce qu'il faut dire
            ici, c'est ce que Mino fait — et surtout ce qu'il ne fait pas. */}
        <Text variant="caption" color={colors.textSubtle}>
          {companionEnabled
            ? 'Quand son temps d’écran est fini, Mino reste disponible pour discuter — une vingtaine d’échanges par jour, puis Mino l’envoie jouer. Mino ne confirme aucune mission, ne donne aucune minute, et vous pouvez lire toutes leurs conversations.'
            : 'Mino ne discutera pas. L’écran « plus de temps » proposera simplement ses missions.'}
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
