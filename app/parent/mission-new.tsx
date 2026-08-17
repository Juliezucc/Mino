import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui';
import { MissionForm, MissionFormValue } from '@/features/parent/MissionForm';
import { useMinoStore } from '@/store/useMinoStore';

export default function NewMission() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const addMission = useMinoStore((s) => s.addMission);
  const [loading, setLoading] = useState(false);

  const submit = async (value: MissionFormValue) => {
    setLoading(true);
    await addMission(value);
    setLoading(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          title="Nouvelle mission"
          subtitle="Un nom, un temps gagné, un enfant. C’est tout."
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
