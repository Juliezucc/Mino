import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedMascot } from '@/components/mascot';
import { Button, Logo, Screen, Text } from '@/components/ui';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

const STEPS = [
  { icon: '📋', title: 'Je fais', text: 'mes missions' },
  { icon: '⏱️', title: 'Je gagne', text: 'du temps' },
  { icon: '🎮', title: 'Je profite', text: 'de mes écrans' },
];

export default function Welcome() {
  const router = useRouter();
  const startDemo = useMinoStore((s) => s.startDemo);
  const [loading, setLoading] = useState(false);

  const onDemo = async () => {
    setLoading(true);
    await startDemo();
    setLoading(false);
    router.replace('/who');
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Logo size={44} />
        <Text variant="hero" style={styles.claim}>
          Chaque minute{'\n'}se gagne.
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Mino accompagne les enfants au quotidien pour transformer leurs efforts en temps d’écran,
          simplement et positivement.
        </Text>
      </View>

      <AnimatedMascot expression="happy" size={190} style={styles.mascot} />

      <View style={styles.steps}>
        {STEPS.map((step) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.stepIcon}>
              <Text style={styles.emoji}>{step.icon}</Text>
            </View>
            <View>
              <Text variant="bodyStrong">{step.title}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {step.text}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Découvrir avec la démo" icon="✨" onPress={onDemo} loading={loading} />
        <Button
          label="Créer mon compte parent"
          variant="secondary"
          onPress={() => router.push('/onboarding/account')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl, gap: spacing.xl },
  header: { gap: spacing.md },
  claim: { marginTop: spacing.sm },
  mascot: { alignSelf: 'center' },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  actions: { gap: spacing.md },
});
