import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';

import * as notify from '@/domain/notifications';
import { getNotificationService } from '@/services/notifications';
import { useMinoStore } from '@/store/useMinoStore';
import { useChildren, useRunningSession, useUncelebrated } from '@/store/selectors';

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
  const children = useChildren();

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
    /**
     * On nomme ce qu'on a vu, et c'est le correctif de l'écran blanc.
     *
     * L'écran refaisait le calcul à son montage, quelques images plus tard. Il
     * suffisait qu'un rafraîchissement venu du serveur passe entre les deux —
     * et il passe, justement quand le parent vient de valider depuis le même
     * appareil — pour qu'il trouve une liste vide et n'affiche rien du tout :
     * un écran blanc, sans bouton, sur le profil d'un enfant de cinq ans.
     */
    router.push({
      pathname: '/child/celebration',
      params: { completionId: neufs.map((c) => c.id).join(',') },
    });
  }, [uncelebrated, pathname, router]);

  /**
   * « Plus que 5 minutes » — programmé ici, et nulle part ailleurs.
   *
   * **Ce que faisait le code, et c'est pire que de ne rien faire.** Le magasin
   * annonçait `sessionEndingSoon` au démarrage d'une séance ; la charge
   * portait bien un `inSeconds` calculé pour sonner cinq minutes avant la fin.
   * Mais `pousserAuxAutres` ne transmettait pas ce champ (il envoie titre,
   * corps, route et genre, rien d'autre), et la branche locale est coupée dès
   * qu'un dépôt distant existe. Résultat : l'avertissement partait par le
   * serveur, DANS LA SECONDE. Un enfant obtenait trente minutes et son écran
   * lui annonçait aussitôt qu'il ne lui en restait que cinq — puis plus rien à
   * la vingt-cinquième. Et quand c'est lui qui lançait la séance, `notify`
   * écarte l'appareil appelant : il ne recevait strictement rien.
   *
   * Une notification à retardement ne peut pas voyager par une notification
   * poussée : Expo la remet tout de suite. Elle doit être PROGRAMMÉE, et donc
   * sur l'appareil où elle doit sonner — celui de l'enfant.
   *
   * D'où cet effet plutôt qu'un appel dans le magasin : il voit la séance quel
   * que soit l'écran ouvert, et surtout que la séance ait été lancée ici ou
   * par le parent depuis son téléphone — le cas que le magasin ne pouvait pas
   * couvrir, puisqu'il s'exécutait alors sur le mauvais appareil.
   *
   * Et il annule : une séance arrêtée avant l'heure emporterait sinon un
   * avertissement qui sonnerait dans le vide, après coup.
   */
  const seance = useRunningSession(activeChildId);
  const avertissement = useRef<{ sessionId: string; notifId: string } | null>(null);

  useEffect(() => {
    const service = getNotificationService();
    const encours = avertissement.current;

    if (!seance) {
      if (encours) {
        void service.cancel(encours.notifId).catch(() => undefined);
        avertissement.current = null;
      }
      return;
    }
    if (encours?.sessionId === seance.id) return;
    if (encours) void service.cancel(encours.notifId).catch(() => undefined);

    const enfant = children.find((c) => c.id === activeChildId);
    if (!enfant) return;
    const charge = notify.sessionEndingSoon(enfant, seance.endsAt);
    // `null` quand il reste moins de trente secondes avant l'heure de
    // l'avertissement : une séance plus courte que le préavis n'en reçoit pas.
    if (!charge) return;

    avertissement.current = { sessionId: seance.id, notifId: '' };
    void service.schedule(charge).then((id) => {
      if (id) avertissement.current = { sessionId: seance.id, notifId: id };
    });
  }, [seance, activeChildId, children]);

  if (!activeChildId) return <Redirect href="/who" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="celebration" options={{ animation: 'fade' }} />
    </Stack>
  );
}
