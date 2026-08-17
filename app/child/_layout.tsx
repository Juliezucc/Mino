import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';

import { useMinoStore } from '@/store/useMinoStore';
import { useUncelebrated } from '@/store/selectors';

/**
 * Child area.
 *
 * The watcher below is what makes the core journey feel alive: the moment a
 * parent validates a mission, the child gets the celebration wherever they are
 * in the app — no refresh, no notification to tap.
 */
export default function ChildLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const activeChildId = useMinoStore((s) => s.activeChildId);
  const uncelebrated = useUncelebrated(activeChildId);

  useEffect(() => {
    if (uncelebrated.length === 0) return;
    if (pathname === '/child/celebration') return;
    router.push({
      pathname: '/child/celebration',
      params: { completionId: uncelebrated[0].id },
    });
  }, [uncelebrated, pathname, router]);

  if (!activeChildId) return <Redirect href="/who" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="celebration" options={{ animation: 'fade' }} />
    </Stack>
  );
}
