import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui';
import { MissionForm, MissionFormValue } from '@/features/parent/MissionForm';
import { useMinoStore } from '@/store/useMinoStore';

/** Step 3 of onboarding: the first mission, then straight to the dashboard. */
export default function OnboardingMission() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const addMission = useMinoStore((s) => s.addMission);
  const [loading, setLoading] = useState(false);

  const submit = async (value: MissionFormValue) => {
    setLoading(true);
    await addMission(value);
    setLoading(false);
    router.replace('/parent');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          title="Ma première mission"
          subtitle="Une petite responsabilité du quotidien, et le temps d’écran qu’elle fait gagner."
        />
        <MissionForm
          initialChildIds={childId ? [childId] : []}
          onSubmit={submit}
          loading={loading}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
