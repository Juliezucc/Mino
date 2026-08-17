import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { useMinoStore } from '@/store/useMinoStore';

/** Parent area — unreachable without the PIN. */
export default function ParentLayout() {
  const unlocked = useMinoStore((s) => s.parentUnlocked);
  const hasFamily = useMinoStore((s) => !!s.data);

  if (!hasFamily) return <Redirect href="/welcome" />;
  if (!unlocked) return <Redirect href="/parent-pin" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
