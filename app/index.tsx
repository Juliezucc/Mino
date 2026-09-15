import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { inscriptionInachevee } from '@/domain/firstRun';
import { usageDeLAppareil } from '@/domain/notifications';
import { destinationEnAttente, oublierLAppui } from '@/services/notifications/appuiNotification';
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

  const usagePersonnel = useMinoStore((s) => s.device.usagePersonnel);

  /**
   * Une notification vient d'être touchée, et Mino était fermé.
   *
   * L'appui a déposé une intention au chargement du paquet — voir
   * `services/notifications/appuiNotification`, qui dit pourquoi elle ne peut
   * pas naviguer elle-même. On la lit ici, où les destinations s'arbitrent
   * déjà.
   *
   * Gelée au premier rendu : lue réactivement, elle rendrait une SECONDE
   * redirection à l'instant où on l'efface, et c'est la seconde qui gagnerait.
   * Le gel est sûr parce que cet écran n'est monté qu'une fois `status` passé à
   * `ready` — le profil de l'appareil est alors connu, et la garde qui s'appuie
   * dessus ne peut pas passer au vert par ignorance.
   */
  const usage = useMinoStore((s) => usageDeLAppareil(s.device));
  const [venantDUneNotification] = useState(() => destinationEnAttente(usage));

  useEffect(() => {
    // Consommée même quand on ne l'a pas suivie : une intention refusée ne doit
    // pas ressortir au lancement suivant.
    oublierLAppui();
  }, []);

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

  /**
   * Une inscription abandonnée se reprend, elle ne s'oublie pas.
   *
   * La famille se fonde au premier écran de l'inscription — il en faut une
   * pour y attacher un enfant — et le parent ne se présente que deux écrans
   * plus loin. Entre les deux, la ligne ci-dessus voyait une famille et
   * ouvrait l'application : le paywall, l'adresse e-mail et le mot de passe
   * étaient sautés, non par une faille mais parce que plus rien ne les
   * réclamait. Le parent se retrouvait dans Mino sans avoir payé, sans compte
   * récupérable, et le sélecteur de profil lui affichait « null ».
   *
   * On le remet donc où il s'était arrêté. Ce n'est pas un verrou : c'est la
   * suite de son inscription, avec ce qu'il a déjà saisi encore en place.
   */
  if (inscriptionInachevee(data)) return <Redirect href="/onboarding/account" />;

  /**
   * Après les trois gardes ci-dessus, et pas avant : hors ligne va à l'écran
   * hors ligne, notification ou pas, sans quoi on annoncerait à un parent que
   * sa famille a disparu. Avant la reprise de profil, en revanche : sur la
   * tablette du salon, laisser la reprise gagner voudrait dire que l'appui ne
   * marche jamais là où le serveur écrit quand la famille n'a pas de téléphone
   * de parent.
   *
   * La destination sort d'une table fermée écrite dans le domaine, jamais de la
   * chaîne reçue : voir `destinationDeLAppui`.
   */
  if (venantDUneNotification) return <Redirect href={venantDUneNotification} />;

  if (resume) return activeChildId === resume ? <Redirect href="/child" /> : null;

  /**
   * Sur le téléphone d'un parent, on ouvre l'espace parent.
   *
   * **Le défaut, à chaque lancement.** Faute de profil d'enfant à rouvrir — et
   * il n'y en a aucun ici, c'est la définition de cet appareil — le parent
   * atterrissait sur « Qui utilise Mino ? », un sélecteur qui n'a rien à lui
   * proposer d'utile, avec l'espace parent en petit tout en bas. Tous les
   * jours, sur son propre téléphone.
   *
   * `/parent` et non `/parent/(tabs)` : la porte du code est derrière, et elle
   * s'ouvre ou se ferme selon ce que le parent a déjà donné.
   */
  if (usagePersonnel) return <Redirect href="/parent" />;

  return <Redirect href="/who" />;
}
