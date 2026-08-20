import { getSupabaseClient } from '@/data/supabaseRepository';

import { CompanionService } from './CompanionService';
import { EdgeCompanionService } from './EdgeCompanionService';
import { LocalCompanionService } from './LocalCompanionService';

export * from './CompanionService';
export { EdgeCompanionService, LocalCompanionService };

let instance: CompanionService | null = null;

/**
 * Avec un backend, Mino parle vraiment ; sans, il répond depuis une liste
 * écrite à la main. Dans les deux cas il répond : un enfant qui vient parler à
 * Mino ne doit jamais tomber sur un écran d'erreur.
 */
export function getCompanionService(): CompanionService {
  if (!instance) {
    const client = getSupabaseClient();
    instance = client
      ? new EdgeCompanionService(
          async (fn, body) => {
            const { data, error } = await client.functions.invoke(fn, {
              body: body as Record<string, unknown>,
            });
            return error ? null : (data as never);
          },
          async (childId) => {
            const { data } = await client.rpc('companion_left', { p_child_id: childId });
            return typeof data === 'number' ? data : null;
          },
        )
      : new LocalCompanionService();
  }
  return instance;
}

/** Test hook. */
export function setCompanionService(service: CompanionService | null) {
  instance = service;
}
