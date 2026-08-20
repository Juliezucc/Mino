import { useRouter } from 'expo-router';
import React from 'react';

import { Screen, ScreenHeader } from '@/components/ui';
import { PRIVACY } from '@/content/privacy';
import { DocumentView } from '@/features/legal/DocumentView';
import { spacing } from '@/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg }}>
      <ScreenHeader onBack={() => router.back()} />
      <DocumentView document={PRIVACY} />
    </Screen>
  );
}
