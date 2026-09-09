import { Alert, Platform } from 'react-native';

import { confirmer } from '@/components/ui/confirmer';

/**
 * Le défaut que ce test empêche de revenir.
 *
 * `Alert.alert` n'existe pas sur React Native Web : l'appel ne lève rien,
 * n'affiche rien, et le `onPress` n'arrive jamais. Onze actions de l'espace
 * parent en dépendaient — se déconnecter, supprimer un enfant, résilier — et
 * toutes répondaient « rien » sur app.minoapp.fr, sans une ligne dans la
 * console. Une panne invisible se remet toute seule si personne ne la surveille.
 */

const commePlateforme = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

describe('confirmer', () => {
  const osInitial = Platform.OS;
  const fenetreInitiale = (global as { window?: unknown }).window;

  afterEach(() => {
    commePlateforme(osInitial);
    (global as { window?: unknown }).window = fenetreInitiale;
    jest.restoreAllMocks();
  });

  it('passe par la boîte du système sur un téléphone, et rend le choix', async () => {
    commePlateforme('ios');
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
      // On appuie sur le bouton qui agit, le second.
      boutons?.[1]?.onPress?.();
    });

    await expect(
      confirmer({ titre: 'Se déconnecter ?', action: 'Se déconnecter' }),
    ).resolves.toBe(true);

    const [titre, , boutons] = alerte.mock.calls[0];
    expect(titre).toBe('Se déconnecter ?');
    expect(boutons?.map((b) => b.text)).toEqual(['Annuler', 'Se déconnecter']);
  });

  it('rend faux quand le parent annule sur un téléphone', async () => {
    commePlateforme('ios');
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
      boutons?.[0]?.onPress?.();
    });

    await expect(confirmer({ titre: 'Supprimer ?', action: 'Supprimer' })).resolves.toBe(false);
  });

  it('n’appelle pas Alert sur le web — il n’y est pas implémenté', async () => {
    commePlateforme('web');
    const alerte = jest.spyOn(Alert, 'alert');
    const demande = jest.fn(() => true);
    (global as { window?: unknown }).window = { confirm: demande };

    await expect(
      confirmer({ titre: 'Résilier ?', message: 'Rien ne sera prélevé.', action: 'Résilier' }),
    ).resolves.toBe(true);

    expect(alerte).not.toHaveBeenCalled();
    expect(demande).toHaveBeenCalledWith('Résilier ?\n\nRien ne sera prélevé.');
  });

  it('refuse plutôt que de supposer quand il n’y a pas de fenêtre', async () => {
    commePlateforme('web');
    (global as { window?: unknown }).window = undefined;

    await expect(confirmer({ titre: 'Supprimer ?', action: 'Supprimer' })).resolves.toBe(false);
  });
});
