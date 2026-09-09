import { getAccessToken } from '@/data/supabaseRepository';

/**
 * Demander au serveur d'écrire à ce parent.
 *
 * **Ce que l'application ne fait jamais ici : rédiger, ni choisir à qui.** Elle
 * ne transmet qu'un genre de message ; le destinataire est lu dans la base à
 * partir du jeton, et le texte vit dans la fonction `courrier`. Un client qui
 * pourrait nommer l'adresse serait un client capable d'écrire aux parents des
 * autres familles, avec notre domaine et notre réputation d'expéditeur.
 *
 * **Et ce n'est jamais bloquant.** Un e-mail de bienvenue qui ne part pas ne
 * doit pas retenir un parent sur l'écran d'inscription — il vient de créer sa
 * famille, elle existe, c'est ce qui compte. L'échec se lit dans les journaux
 * de la fonction, pas à l'écran.
 */
export type GenreDeCourrier = 'bienvenue' | 'fin_essai' | 'reconduction';

const API_URL = process.env.EXPO_PUBLIC_BILLING_API_URL;

export async function envoyerCourrier(genre: GenreDeCourrier): Promise<void> {
  if (!API_URL) return;
  const token = await getAccessToken();
  if (!token) return;

  await fetch(`${API_URL}/courrier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ genre }),
  });
}
