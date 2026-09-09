import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui';
import { MissionForm, MissionFormValue } from '@/features/parent/MissionForm';
import { useMinoStore } from '@/store/useMinoStore';

/**
 * Deuxième écran : la première mission.
 *
 * C'est ici que Mino devient concret — un prénom, une responsabilité, et le
 * temps d'écran qu'elle fait gagner. Le parent a maintenant vu à quoi ressemble
 * ce qu'on lui demande d'adopter.
 *
 * D'où la suite : le compte. C'est le premier moment du parcours où taper une
 * adresse n'est plus un péage, mais un rangement — on ne lui demande de garder
 * sa famille qu'après lui avoir montré ce qu'il garderait.
 */
export default function OnboardingMission() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const addMission = useMinoStore((s) => s.addMission);
  const [loading, setLoading] = useState(false);

  const submit = async (value: MissionFormValue) => {
    setLoading(true);
    await addMission(value);
    setLoading(false);
    router.replace('/onboarding/account');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          title="Sa première mission"
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
