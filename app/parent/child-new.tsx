import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui';
import { ChildForm, ChildFormValue } from '@/features/parent/ChildForm';
import { useMinoStore } from '@/store/useMinoStore';

export default function NewChild() {
  const router = useRouter();
  const addChild = useMinoStore((s) => s.addChild);
  const [loading, setLoading] = useState(false);

  const submit = async (value: ChildFormValue) => {
    setLoading(true);
    await addChild(value);
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
          title="Nouvel enfant"
          subtitle="Prénom, âge et avatar. Aucune autre donnée n’est collectée."
        />
        <ChildForm submitLabel="Créer le profil" onSubmit={submit} loading={loading} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
