/**
 * Ce que la fonction a répondu, et non ce que la bibliothèque en a dit.
 *
 * **Le défaut, et il s'affichait en anglais sur l'écran d'un parent.** Quand
 * une fonction Edge rend un code d'erreur, `functions.invoke` de
 * `@supabase/supabase-js` ne met pas le message du serveur dans `error.message`
 * : il y met sa propre phrase, toujours la même et toujours en anglais —
 * « Edge Function returned a non-2xx status code ». Le message français que la
 * fonction a pris soin d'écrire, lui, est dans le **corps** de la réponse, que
 * la bibliothèque laisse intact dans `error.context`.
 *
 * Le code qui relayait `error.message` affichait donc la phrase de la
 * bibliothèque : incompréhensible pour un parent, inutile pour nous, et une
 * infraction directe à la règle du projet — tous les messages d'erreur sont en
 * français. Pire : la vraie cause, celle que le serveur avait nommée, était
 * jetée à l'endroit précis où elle aurait servi.
 *
 * `fail()` dans `supabase/functions/_shared/mino.ts` répond toujours
 * `{ error: "…" }`. C'est ce champ qu'on va chercher.
 *
 * **Et rien de brut ne remonte à l'écran.** Ce qui n'est pas une phrase
 * française écrite par nous — une page HTML d'une passerelle, un texte vide,
 * un pavé — part dans la console et le parent reçoit le repli.
 */

/** Au-delà, ce n'est plus une phrase : c'est une page d'erreur ou une trace. */
const LONGUEUR_MAX = 300;

type AvecContexte = { context?: unknown };

/**
 * Un refus qui ne se rattrapera jamais tout seul, et pourquoi la distinction
 * vaut la peine d'être faite ici.
 *
 * Un achat dont la confirmation échoue sur un réseau coupé ou un 502 finira
 * par être repris : la notification serveur à serveur arrive de toute façon,
 * et le rattrapage la double. Annoncer un échec à ce parent-là le ferait payer
 * deux fois.
 *
 * Un 403 « cet achat appartient à un autre compte », lui, dira exactement la
 * même chose dans un mois. Le présenter comme une réussite laisse un parent
 * croire qu'il est abonné alors que rien n'est enregistré nulle part — c'est
 * ce qui s'est produit trois fois de suite en recette.
 *
 * On tranche donc sur le code HTTP, seule chose fiable ici : ce que le serveur
 * reproche à la demande (4xx) est définitif, ce qui lui arrive à lui (5xx),
 * ou l'absence de réponse, ne l'est pas. `429` fait exception — c'est une
 * demande de patienter, pas un refus.
 */
function refusDefinitif(erreur: unknown): boolean {
  const contexte = (erreur as AvecContexte | null)?.context as { status?: unknown } | undefined;
  const code = typeof contexte?.status === 'number' ? contexte.status : 0;
  return code >= 400 && code < 500 && code !== 429;
}

/**
 * Lire le corps sans jamais faire tomber l'appelant.
 *
 * Le corps peut avoir déjà été consommé, ne pas être du JSON, ou ne pas être
 * une réponse du tout — on est dans un chemin d'erreur, c'est exactement là
 * qu'il ne faut pas en ajouter une deuxième.
 */
async function messageDuCorps(erreur: unknown): Promise<string> {
  const contexte = (erreur as AvecContexte | null)?.context as
    | { json?: () => Promise<unknown> }
    | undefined;

  if (typeof contexte?.json !== 'function') return '';

  try {
    const corps = (await contexte.json()) as { error?: unknown } | null;
    const dit = typeof corps?.error === 'string' ? corps.error.trim() : '';
    return dit.length > 0 && dit.length <= LONGUEUR_MAX ? dit : '';
  } catch {
    return '';
  }
}

/**
 * La raison à montrer au parent.
 *
 * `repli` doit être une phrase française qui dit ce qui compte à cet instant —
 * pas « une erreur est survenue ».
 */
export async function raisonDeLaFonction(erreur: unknown, repli: string): Promise<string> {
  const duServeur = await messageDuCorps(erreur);
  if (duServeur) return duServeur;

  // Le texte de la bibliothèque ne s'affiche pas, mais il se lit : c'est lui
  // qui distingue un 500 d'un réseau coupé quand un parent nous écrit.
  const brut = erreur instanceof Error ? erreur.message.trim() : String(erreur ?? '');
  if (brut) console.warn('[mino] fonction Edge :', brut);

  return repli;
}

/**
 * L'erreur à relancer : la raison lisible, et si elle est sans appel.
 *
 * `definitif` voyage sur l'objet plutôt que dans un type à part, pour que les
 * appelants qui n'en ont que faire — le rattrapage, la restauration — n'aient
 * rien à changer.
 */
export async function echecDeLaFonction(erreur: unknown, repli: string): Promise<Error> {
  return Object.assign(new Error(await raisonDeLaFonction(erreur, repli)), {
    definitif: refusDefinitif(erreur),
  });
}

/** Ce refus est-il sans appel ? Faux pour tout ce qui n'en dit rien. */
export function estDefinitif(erreur: unknown): boolean {
  return (erreur as { definitif?: unknown } | null)?.definitif === true;
}
