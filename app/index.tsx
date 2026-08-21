import { Redirect } from 'expo-router';
import React, { useEffect } from 'react';

import { useMinoStore } from '@/store/useMinoStore';

/**
 * Où l'on arrive en ouvrant Mino.
 *
 * Quatre cas, dans cet ordre :
 *
 *   0. le serveur n'a pas répondu → l'écran hors ligne, et surtout PAS
 *      l'accueil : proposer « Créer mon compte » à quelqu'un qui en a déjà un
 *      lui annonce que sa famille a disparu ;
 *   1. pas de famille → l'accueil ;
 *   2. un profil à reprendre → directement dedans. C'est le cas courant, et
 *      celui qui compte le plus : un enfant qui rouvre son application n'a
 *      aucune raison de retomber sur « Qui utilise Mino ? » tous les jours ;
 *   3. sinon → le sélecteur de profil.
 *
 * Le profil repris vient de l'appareil, pas du compte : la tablette du salon
 * rouvre sur le dernier qui s'en est servi, le téléphone de Noah rouvre
 * toujours sur Noah.
 */
export default function Index() {
  const status = useMinoStore((s) => s.status);
  const data = useMinoStore((s) => s.data);
  const offline = useMinoStore((s) => s.offline);
  const activeChildId = useMinoStore((s) => s.activeChildId);
  const resumeChildId = useMinoStore((s) => s.resumeChildId);
  const selectChild = useMinoStore((s) => s.selectChild);

  const resume = status === 'ready' && data ? resumeChildId() : null;

  // Dans un effet, pas pendant le rendu : sélectionner un profil écrit dans le
  // store et sur le disque, et un rendu qui a des effets de bord finit toujours
  // par se rejouer une fois de trop.
  useEffect(() => {
    if (resume && activeChildId !== resume) selectChild(resume);
  }, [resume, activeChildId, selectChild]);

  // Tant que le profil de l'appareil n'est pas lu, ne rien décider : rediriger
  // trop tôt ferait apparaître le sélecteur une fraction de seconde avant de
  // l'escamoter.
  if (status !== 'ready') return null;
  // L'ordre de ces deux lignes est tout : « pas de réseau » d'abord, « pas de
  // famille » ensuite. Inversés, un parent hors ligne se voit proposer de
  // créer le compte qu'il a déjà.
  if (offline) return <Redirect href="/hors-ligne" />;
  if (!data) return <Redirect href="/welcome" />;

  if (resume) return activeChildId === resume ? <Redirect href="/child" /> : null;
  return <Redirect href="/who" />;
}
