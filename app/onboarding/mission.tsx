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
    // Et surtout PAS le tableau de bord. L'inscription s'y terminait, et le
    // parent devait trouver seul le chemin du blocage — personne ne le fait.
    // La question de l'appareil est la dernière marche de l'installation, et
    // c'est elle qui conduit au bouclier.
    router.replace('/onboarding/appareil');
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
