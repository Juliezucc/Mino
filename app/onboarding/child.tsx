import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui';
import { ChildForm, ChildFormValue } from '@/features/parent/ChildForm';
import { useMinoStore } from '@/store/useMinoStore';

/** Step 2 of onboarding: the first child profile. */
export default function OnboardingChild() {
  const router = useRouter();
  const addChild = useMinoStore((s) => s.addChild);
  const [loading, setLoading] = useState(false);

  const submit = async (value: ChildFormValue) => {
    setLoading(true);
    const childId = await addChild(value);
    setLoading(false);
    router.replace({ pathname: '/onboarding/mission', params: { childId } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          title="Mon premier enfant"
          subtitle="Un prénom et un avatar suffisent. Aucun compte, aucun e-mail pour l’enfant."
        />
        <ChildForm submitLabel="Continuer" onSubmit={submit} loading={loading} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
