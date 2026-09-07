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
    // Sans identifiant, et c'est le correctif : l'écran prend tout ce qui
    // attend et n'en fait qu'une célébration. En lui en désignant une, on en
    // empilait autant qu'il y avait de missions confirmées — huit écrans de
    // confettis à la file après une soirée de validations.
    router.push('/child/celebration');
  }, [uncelebrated, pathname, router]);

  if (!activeChildId) return <Redirect href="/who" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="celebration" options={{ animation: 'fade' }} />
    </Stack>
  );
}
