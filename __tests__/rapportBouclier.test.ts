import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

/**
 * Tout statut que l'application peut envoyer doit être accepté par la base.
 *
 * **Deux listes tenues à la main, et elles ont divergé des deux côtés.**
 * `report_shield` refusait `telephone-parent` et `unsupported`, et acceptait
 * `unavailable` que personne n'envoie.
 *
 * Le refus ne se voit nulle part, et c'est ce qui le rend coûteux : l'appel est
 * un RAPPORT, pas une action, donc l'appelant avale l'erreur à dessein
 * (`supabaseRepository.ts`, « un rapport qui n'arrive pas se lit dans
 * `seenAt` »). L'appareil cesse simplement de donner de ses nouvelles. Au bout
 * de 72 h il passe « sans nouvelles » chez le parent — sur un téléphone
 * parfaitement vivant, qui a rapporté fidèlement à chaque lancement.
 *
 * Le commentaire de la fonction SQL décrivait DÉJÀ ce défaut, pour
 * `compteur-seul`, ajouté après coup. Il est revenu deux fois. C'est le signe
 * qu'une liste recopiée ne tient pas : il fallait la comparer à sa source.
 */
describe('les statuts de bouclier', () => {
  /** Ce que l'application peut réellement envoyer, lu dans les types. */
  const statutsEnvoyables = (): string[] => {
    const service = lire('src/services/screenTime/ScreenTimeService.ts');
    const i = service.indexOf('export type ScreenTimeAuthorization =');
    const bloc = service.slice(i, service.indexOf(';', i));
    const autorisations = [...bloc.matchAll(/\|\s*'([a-z-]+)'/g)].map((m) => m[1]);

    // Les deux que le dépôt ajoute à l'union, côté dépôt de données.
    const repo = lire('src/data/repository.ts');
    const j = repo.indexOf("status: ScreenTimeAuthorization | ");
    const extras = [...repo.slice(j, j + 120).matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

    return [...new Set([...autorisations, ...extras])];
  };

  /** Ce que la base accepte, lu dans la liste de `report_shield`. */
  const statutsAcceptes = (): string[] => {
    const sql = lire('supabase/schema.sql');
    const i = sql.indexOf('and p_status not in (');
    const bloc = sql.slice(i, sql.indexOf(')', i + 20));
    return [...bloc.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  };

  it('l’application en envoie plusieurs, et on les a bien lus', () => {
    const envoyables = statutsEnvoyables();
    // Garde-fou sur la lecture elle-même : un essai qui extrait zéro statut
    // passerait triomphalement sans rien vérifier.
    expect(envoyables.length).toBeGreaterThanOrEqual(6);
    expect(envoyables).toContain('telephone-parent');
    expect(envoyables).toContain('unsupported');
  });

  it('et la base les accepte TOUS', () => {
    const acceptes = statutsAcceptes();
    expect(acceptes.length).toBeGreaterThanOrEqual(6);
    for (const statut of statutsEnvoyables()) {
      // Un statut refusé ne lève rien de visible : il éteint silencieusement
      // les nouvelles de cet appareil-là.
      expect(acceptes).toContain(statut);
    }
  });

  it('et n’en accepte pas que personne n’envoie', () => {
    // `unavailable` traînait ici sans émetteur. Un fantôme dans une liste de
    // sécurité, c'est une ligne que plus personne n'ose retirer.
    const envoyables = statutsEnvoyables();
    for (const accepte of statutsAcceptes()) {
      expect(envoyables).toContain(accepte);
    }
  });
});
