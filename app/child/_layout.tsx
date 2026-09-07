import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';

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

  /**
   * Ce qui a déjà été fêté sur cet écran-ci, et pourquoi il faut s'en souvenir.
   *
   * Le marquage « célébré » part sur le réseau. Tant qu'il n'est pas revenu —
   * ou s'il échoue et que l'état revient en arrière — la complétion est
   * toujours « en attente de fête », et refermer l'écran le rouvrait aussitôt.
   * De l'intérieur, cela se voit comme un bouton mort : l'enfant appuie sur
   * « SUPER ! », rien ne semble se passer, il appuie encore.
   *
   * Cette mémoire-ci vit dans l'écran, pas dans la base : elle ne fait que
   * garantir qu'on ne fête pas deux fois la même chose pendant une session. Si
   * l'écriture a vraiment échoué, la célébration reviendra au prochain
   * lancement — ce qui est le bon comportement, et pas une boucle.
   */
  const vus = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (pathname === '/child/celebration') return;
    // Sans identifiant, et c'est le correctif : l'écran prend tout ce qui
    // attend et n'en fait qu'une célébration. En lui en désignant une, on en
    // empilait autant qu'il y avait de missions confirmées — huit écrans de
    // confettis à la file après une soirée de validations.
    const neufs = uncelebrated.filter((c) => !vus.current.has(c.id));
    if (neufs.length === 0) return;
    for (const c of neufs) vus.current.add(c.id);
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
