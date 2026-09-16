import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_PREFERENCES, NotificationPreferences } from '@/domain/notifications';

/**
 * Les préférences de notification de CET appareil, sur le disque.
 *
 * **Elles n'y étaient pas, et les trois pastilles des Réglages revenaient à
 * leur position d'origine à chaque lancement.** Le magasin est un zustand nu,
 * sans `persist` : `notifications` repartait de `DEFAULT_PREFERENCES` à chaque
 * ouverture. Un parent qui coupait les heures calmes les retrouvait actives le
 * lendemain, sans que rien ne l'en avertisse — le pire des réglages est celui
 * qui semble obéir puis oublie.
 *
 * Un fichier à part plutôt qu'un `persist` sur tout le magasin : ce qu'il
 * contient est minuscule et sans rapport avec les données de la famille, qui
 * ont leur propre dépôt et n'ont rien à faire dans le stockage local.
 */
const CLE = 'mino.notifications.v1';

export async function lirePreferences(): Promise<NotificationPreferences> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    if (!brut) return DEFAULT_PREFERENCES;
    const lu = JSON.parse(brut) as Partial<NotificationPreferences>;
    // Champ par champ, et jamais un étalement aveugle : une clé inconnue
    // restée d'une version précédente ne doit pas entrer dans l'état.
    return {
      parents: typeof lu.parents === 'boolean' ? lu.parents : DEFAULT_PREFERENCES.parents,
      child: typeof lu.child === 'boolean' ? lu.child : DEFAULT_PREFERENCES.child,
      quietHours:
        typeof lu.quietHours === 'boolean' ? lu.quietHours : DEFAULT_PREFERENCES.quietHours,
    };
  } catch {
    // Un stockage illisible ne doit pas empêcher Mino de s'ouvrir : on repart
    // du réglage le plus prudent, celui qui se tait la nuit.
    return DEFAULT_PREFERENCES;
  }
}

export async function ecrirePreferences(prefs: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(CLE, JSON.stringify(prefs)).catch(() => undefined);
}
