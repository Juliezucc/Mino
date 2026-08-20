import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen, ScreenHeader, Text } from '@/components/ui';
import { useParent } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, shadows, spacing } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Keeps the parent area out of reach of a curious child. */
export default function ParentPin() {
  const router = useRouter();
  const parent = useParent();
  const unlockParent = useMinoStore((s) => s.unlockParent);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const press = (key: string) => {
    if (key === '' || checking) return;
    setError(null);

    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;

    const next = pin + key;
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  const submit = async (value: string) => {
    setChecking(true);
    // Verified by the auth service, which rate-limits it — never compared here.
    const result = await unlockParent(value);
    setChecking(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace('/parent');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    setError(result.reason ?? 'Code incorrect.');
    setTimeout(() => setPin(''), 220);
  };

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <ScreenHeader closeIcon onBack={() => router.replace('/who')} />

      <View style={styles.head}>
        <Text variant="title" center>
          Code parent
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {parent ? `Bonjour ${parent.displayName}, entre ton code à 4 chiffres.` : 'Entre ton code à 4 chiffres.'}
        </Text>
      </View>

      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        ))}
      </View>

      {error ? (
        <Text variant="label" color={colors.danger} center>
          {error}
        </Text>
      ) : (
        <View style={styles.errorSpacer} />
      )}

      <View style={styles.pad}>
        {KEYS.map((key, index) => (
          <Pressable
            key={`${key}-${index}`}
            onPress={() => press(key)}
            disabled={key === ''}
            accessibilityRole="button"
            accessibilityLabel={key === '⌫' ? 'Effacer' : key}
            style={({ pressed }) => [
              styles.key,
              key === '' && styles.keyHidden,
              pressed && key !== '' && styles.keyPressed,
            ]}
          >
            <Text variant="title" color={key === '⌫' ? colors.textMuted : colors.text}>
              {key}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.md },
  head: { gap: spacing.sm, marginTop: spacing.lg },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surfaceSunken,
  },
  dotFilled: { backgroundColor: colors.blue },
  dotError: { backgroundColor: colors.dangerSoft },
  errorSpacer: { height: 19 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  key: {
    width: 78,
    height: 68,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  keyHidden: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  keyPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
});
