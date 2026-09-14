import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  balanceDetail,
  balanceOf,
  historyOf,
  pendingCompletions,
  uncelebratedCompletions,
} from '@/domain/ledger';
import { ChildMission, missionsForChild, prochaineJournee } from '@/domain/missions';
import { parentDeLAppareil, titulaireDuCompte } from '@/domain/parents';
import { Child, FamilyData, ID, Parent, ScreenTimeBalance } from '@/domain/types';

import { getAuthService } from '@/services/auth';
import type { Session } from '@/services/auth';

import { useMinoStore } from './useMinoStore';

const EMPTY: never[] = [];

/**
 * Qui tient cet appareil, du point de vue de la base.
 *
 * `parent` — un compte ou un second parent, tous deux reconnus par
 * `auth_is_parent()`. `device` — un appareil appairé par le code famille, qui
 * peut lire la famille et déclarer une mission faite, jamais décider.
 *
 * **Pourquoi un aller-retour serveur plutôt qu'un drapeau du magasin.** Parce
 * que la réponse peut changer sous nos pieds : un téléphone qui reprend un
 * profil de parent passe de `device` à `parent` sans que rien d'autre ne
 * bouge. Un drapeau posé au démarrage serait faux jusqu'au redémarrage
 * suivant, et l'écran qui s'y fie dirait des choses fausses avec aplomb.
 *
 * `null` tant qu'on n'a pas la réponse : les écrans n'ont pas le droit de
 * parier, et ce qu'ils affichent en attendant doit être vrai dans les deux cas.
 */
export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let vivant = true;
    getAuthService()
      .session()
      .then((s) => vivant && setSession(s))
      .catch(() => vivant && setSession({ kind: 'none', userId: null, email: null }));
    return () => {
      vivant = false;
    };
  }, []);

  return session;
}

export function useFamily(): FamilyData | null {
  return useMinoStore((s) => s.data);
}

export function useChildren(): Child[] {
  return useMinoStore((s) => s.data?.children ?? EMPTY);
}

/**
 * Le parent à qui appartient CET appareil.
 *
 * « Bonjour Julie » sur le téléphone du père était le premier symptôme, et le
 * plus bête : la famille n'avait qu'un parent à saluer. Le second rejoint avec
 * le code famille et dit qui il est au moment de l'appairage — voir
 * `ChoixDAppareil` — et c'est ce prénom-là que ses écrans doivent porter.
 *
 * Le repli sur le premier parent n'est pas un pis-aller : sur le téléphone du
 * titulaire, `parentId` n'a jamais été posé, et il ne le sera pas
 * rétroactivement.
 */
export function useParentDeCetAppareil(): Parent | null {
  const parents = useMinoStore((s) => s.data?.parents ?? EMPTY);
  const parentId = useMinoStore((s) => s.device.parentId);
  return useMemo(() => parentDeLAppareil(parents, parentId), [parents, parentId]);
}

/**
 * Le titulaire du compte : celui dont l'adresse permet de revenir.
 *
 * `useParent` rendait `parents[0]`, c'est-à-dire l'ordre d'un `select` qui
 * n'en promettait aucun. Voir `titulaireDuCompte`.
 */
export function useTitulaireDuCompte(): Parent | null {
  const parents = useParents();
  return useMemo(() => titulaireDuCompte(parents), [parents]);
}

/** Les parents de la famille, dans l'ordre où ils sont arrivés. */
export function useParents(): Parent[] {
  return useMinoStore((s) => s.data?.parents ?? EMPTY);
}

export function useChild(childId: ID | null | undefined): Child | null {
  const children = useChildren();
  return useMemo(
    () => (childId ? children.find((c) => c.id === childId) ?? null : null),
    [children, childId],
  );
}

/** The other children of the family — what makes sibling missions relevant. */
export function useSiblings(childId: ID | null | undefined): Child[] {
  const children = useChildren();
  return useMemo(
    () => (childId ? children.filter((c) => c.id !== childId) : EMPTY),
    [children, childId],
  );
}

export function useActiveChild(): Child | null {
  const activeChildId = useMinoStore((s) => s.activeChildId);
  return useChild(activeChildId);
}

export function useBalance(childId: ID | null | undefined): number {
  const transactions = useMinoStore((s) => s.data?.transactions ?? EMPTY);
  return useMemo(() => (childId ? balanceOf(transactions, childId) : 0), [transactions, childId]);
}

export function useBalanceDetail(childId: ID | null | undefined): ScreenTimeBalance | null {
  const transactions = useMinoStore((s) => s.data?.transactions ?? EMPTY);
  return useMemo(
    () => (childId ? balanceDetail(transactions, childId) : null),
    [transactions, childId],
  );
}

/**
 * Le jour civil courant, et ce qui le fait changer d'avis.
 *
 * **Le défaut que ceci répare.** `missionsForChild` décide de ce qu'un enfant
 * a « encore à faire aujourd'hui » en comparant la date de sa déclaration à
 * MAINTENANT. Appelée dans un `useMemo` qui ne dépend que des données, elle
 * fige ce « maintenant » au moment du calcul — et sur la tablette d'un enfant,
 * qui reste allumée toute la nuit sans qu'une seule ligne de la famille ne
 * change, le mémo n'est jamais rejoué. Le matin, l'écran rend la liste
 * calculée la veille au soir : « se brosser les dents » y est encore marquée
 * faite, et la mission quotidienne n'a pas l'air de revenir.
 *
 * On ajoute donc le jour aux dépendances. Il change de deux façons, et il
 * fallait les deux : au retour au premier plan — le geste que l'enfant fait
 * vraiment le matin — et au passage de minuit pour un appareil resté ouvert,
 * qu'un minuteur surveille sans rien coûter.
 */
function useJourCivil(): string {
  const [jour, setJour] = useState(() => new Date().toDateString());

  useEffect(() => {
    const relire = () => setJour(new Date().toDateString());

    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') relire();
    });
    // Une minute : assez fin pour que minuit se voie tout de suite, assez large
    // pour ne rien coûter. Le calcul ne se refait que si la CHAÎNE change.
    const battement = setInterval(relire, 60_000);

    return () => {
      abonnement.remove();
      clearInterval(battement);
    };
  }, []);

  return jour;
}

export function useChildMissions(childId: ID | null | undefined): ChildMission[] {
  const data = useFamily();
  const jour = useJourCivil();
  return useMemo(
    () => (data && childId ? missionsForChild(data, childId) : EMPTY),
    // `jour` n'est pas lu dans le corps, et c'est voulu : il n'est là que pour
    // forcer le recalcul quand la date civile change. Voir `useJourCivil`.
    [data, childId, jour],
  );
}

export function usePendingRequests() {
  const data = useFamily();
  return useMemo(() => (data ? pendingCompletions(data) : EMPTY), [data]);
}

export function useUncelebrated(childId: ID | null | undefined) {
  const data = useFamily();
  return useMemo(
    () => (data && childId ? uncelebratedCompletions(data, childId) : EMPTY),
    [data, childId],
  );
}

export function useHistory(childId: ID | null | undefined) {
  const transactions = useMinoStore((s) => s.data?.transactions ?? EMPTY);
  return useMemo(() => (childId ? historyOf(transactions, childId) : EMPTY), [transactions, childId]);
}

/** The child's pending "can I play on the console?" request, if any. */
export function useRequestedSession(childId: ID | null | undefined) {
  const sessions = useMinoStore((s) => s.data?.sessions ?? EMPTY);
  return useMemo(
    () =>
      childId ? sessions.find((s) => s.childId === childId && s.status === 'requested') ?? null : null,
    [sessions, childId],
  );
}

/** Every child's screen request waiting on a parent, newest first. */
export function useScreenRequests() {
  const sessions = useMinoStore((s) => s.data?.sessions ?? EMPTY);
  return useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'requested')
        .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? '')),
    [sessions],
  );
}

/** Sessions currently running, so a parent can watch and close them. */
export function useRunningSessions() {
  const sessions = useMinoStore((s) => s.data?.sessions ?? EMPTY);
  return useMemo(() => sessions.filter((s) => s.status === 'running'), [sessions]);
}

export function useRunningSession(childId: ID | null | undefined) {
  const sessions = useMinoStore((s) => s.data?.sessions ?? EMPTY);
  return useMemo(
    () => (childId ? sessions.find((s) => s.childId === childId && s.status === 'running') ?? null : null),
    [sessions, childId],
  );
}

/**
 * Ce qui attend cet enfant, quand rien ne l'attend aujourd'hui.
 *
 * Voir `prochaineJournee` : cinq routines sur douze ne tournent pas tous les
 * jours, et un enfant à qui l'on annonce « pas encore de mission » un samedi
 * alors que cinq l'attendent lundi n'apprend rien de vrai.
 */
export function useProchaineJournee(childId: ID | null | undefined) {
  const data = useFamily();
  return useMemo(
    () => (data && childId ? prochaineJournee(data, childId) : null),
    [data, childId],
  );
}
