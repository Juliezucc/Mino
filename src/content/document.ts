/**
 * A tiny document model for the pages that are mostly prose — the privacy
 * policy, the terms, the help section.
 *
 * They live as data rather than as JSX so the exact same text can be rendered
 * in the app and published on the website, and so a lawyer's edits land in one
 * file instead of being hunted down across screens.
 */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'bullets'; items: string[] }
  /** A highlighted callout, for the things a reader must not miss. */
  | { kind: 'note'; text: string }
  /** A definition row: term on the left, meaning on the right. */
  | { kind: 'rows'; rows: { label: string; value: string }[] }
  /**
   * Un texte à recopier, dont la mise en page fait partie du texte.
   *
   * **Pourquoi il lui faut un genre à lui.** Le formulaire type de
   * rétractation est repris mot pour mot d'une annexe réglementaire : ses
   * retours à la ligne, ses astérisques et l'ordre de ses champs en font
   * partie. Rangé dans un `note`, il héritait du style des avertissements —
   * carte colorée, texte gras — c'est-à-dire d'une emphase. Un formulaire
   * n'est pas une emphase : c'est un document que le lecteur doit pouvoir
   * lire ligne à ligne, et copier.
   *
   * La session du site a trouvé le même défaut de son côté, en pire : le
   * générateur rendait le formulaire dans un `<p>` unique, où HTML écrase les
   * retours à la ligne en espaces. Ici ils tiennent — `Text` de React Native
   * les honore — mais le style, lui, mentait sur la nature du bloc.
   */
  | { kind: 'form'; text: string };

export interface DocumentSection {
  title: string;
  blocks: Block[];
}

export interface LegalDocument {
  title: string;
  subtitle?: string;
  /** Shown as "Dernière mise à jour". */
  updatedAt: string;
  intro?: Block[];
  sections: DocumentSection[];
}

/**
 * The company behind Mino, from the Kbis of 3 April 2026.
 *
 * The president's home address appears on the Kbis and is deliberately NOT
 * reproduced here: the registered office is the only address a legal notice
 * needs.
 */
export const OPERATOR = {
  legalName: 'Agence Wheb',
  legalForm: 'société par actions simplifiée à associé unique au capital de 500 €',
  address: '47 rue Vivienne, 75002 Paris',
  rcs: '103 231 460 R.C.S. Paris',
  /** Confirmed by the operator against the VAT certificate. */
  vatNumber: 'FR67103231460',
  publisher: 'Julie Zucherman',
  email: 'contact@minoapp.fr',
  privacyEmail: 'privacy@minoapp.fr',
  host: 'Supabase (hébergement et base de données, région européenne)',
  /**
   * Le médiateur de la consommation, obligatoire pour toute vente aux
   * consommateurs en France.
   *
   * L'article R. 616-1 du Code de la consommation demande le nom du médiateur
   * et **l'adresse de son site internet** — pas son adresse postale. C'est
   * donc exactement ce qui figure ici : une adresse postale reproduite de
   * mémoire et devenue obsolète serait pire qu'absente, puisqu'elle enverrait
   * un client mécontent à un endroit qui ne le recevra pas.
   */
  mediator: {
    name: 'CM2C — Centre de la Médiation de la Consommation de Conciliateurs de Justice',
    website: 'www.cm2c.net',
  },
};
