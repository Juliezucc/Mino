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
 * Placeholders the operator has to fill before publishing. They are deliberately
 * loud: shipping a policy that still says [Raison sociale] is better than
 * shipping one that quietly names the wrong company.
 */
export const OPERATOR = {
  legalName: '[Raison sociale]',
  legalForm: '[Forme juridique]',
  address: '[Adresse du siège social]',
  siret: '[SIRET]',
  vatNumber: '[N° TVA intracommunautaire]',
  publisher: '[Nom du directeur de la publication]',
  email: 'contact@mino.app',
  privacyEmail: 'privacy@mino.app',
  host: 'Supabase (hébergement et base de données, région européenne)',
};
