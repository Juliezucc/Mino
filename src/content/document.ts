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
  | { kind: 'rows'; rows: { label: string; value: string }[] };

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
 * Two fields still carry a placeholder, on purpose — publishing a document that
 * visibly says [à compléter] is far better than one that quietly states
 * something wrong:
 *
 *  - `vatNumber` is the number computed from the SIREN by the standard French
 *    key formula. It is almost always the one the tax authority assigns, but it
 *    is not proof: check it against the VAT certificate before publishing, and
 *    if the company is under the franchise en base de TVA, replace this line
 *    with the "TVA non applicable, article 293 B du CGI" wording instead.
 *  - `mediator` has to be an actual subscription to a consumer mediator, which
 *    is mandatory before selling to consumers in France.
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
  vatNumber: 'FR67103231460',
  publisher: 'Julie Zucherman',
  email: 'contact@mino.app',
  privacyEmail: 'privacy@mino.app',
  host: 'Supabase (hébergement et base de données, région européenne)',
  mediator: '[Nom et coordonnées du médiateur de la consommation]',
};
