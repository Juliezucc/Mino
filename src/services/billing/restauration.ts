/**
 * Quand un échec de paiement se répare par « Restaurer mes achats ».
 *
 * **Le défaut, vécu par Julie sur son propre iPhone.** Elle avait payé Mino
 * une première fois, puis recréé un compte avec une autre adresse pour
 * retester l'inscription. Apple a refusé le second achat — « cet achat
 * appartient à un autre compte » — et l'écran affichait ce refus tel quel,
 * sans rien en faire. Le geste qui débloque, lui, était douze centimètres plus
 * bas, en bouton fantôme, sous les formules et le bloc de réassurance.
 *
 * Et la confusion est fondée : dans Mino, le compte, c'est une adresse
 * e-mail ; dans la boutique, c'est le compte Apple ou Google du téléphone.
 * Changer le premier ne change rien au second. Le message doit le dire.
 *
 * Le lien entre le message et le bouton passe par cette constante, et pas par
 * une chaîne recopiée : un libellé qu'on retouche d'un côté sans l'autre
 * rendrait la carte muette exactement le jour où elle sert.
 */
export const RESTAURER = 'Restaurer mes achats';

/** Ce message-là invite à restaurer : la carte d'erreur porte alors le bouton. */
export function inviteARestaurer(message: string | null | undefined): boolean {
  return !!message && message.includes(RESTAURER);
}
