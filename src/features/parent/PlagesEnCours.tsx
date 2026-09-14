import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, SectionHeader, Text } from '@/components/ui';
import { FreeWindow, dansSonCreneau, estInterrompue, heure } from '@/domain/freeWindows';
import { useChildren } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * ------------------------------------------------ arrêter la plage en cours
 *
 * **Demandé par Julie après un test dans sa propre famille, en une phrase :
 * « plage libre : il faut que le parent puisse quand même arrêter quand il
 * veut. Pas besoin de compteur de temps d'écran, juste "enfant - arrêter". »**
 *
 * Une plage libre ouvre l'écran sans rien débiter — le mercredi après-midi,
 * les vacances. Une fois commencée, elle allait jusqu'au bout : le seul geste
 * existant, `toggleFreeWindow`, suspend la plage POUR TOUJOURS, ce qui n'est
 * pas ce qu'un parent veut dire quand il dit « ça suffit pour aujourd'hui ».
 * Il l'aurait retrouvée éteinte le mercredi suivant, sans s'en souvenir.
 *
 * D'où un arrêt qui ne vaut que pour le jour même, et qui se périme seul.
 *
 * **Et pas de compte à rebours ici.** Ce n'est pas du temps gagné qui
 * s'écoule : rien ne se dépense pendant une plage, et afficher des minutes qui
 * descendent donnerait à voir exactement ce que la fonctionnalité n'est pas.
 * L'heure de fin suffit, elle est fixe.
 */

/**
 * L'heure, relue chaque minute.
 *
 * Sans cela, la carte resterait celle du moment où l'écran s'est affiché : une
 * plage finie à 16 h y serait encore à 16 h 20, avec un bouton « Arrêter » qui
 * n'arrête plus rien. Même battement que `useJourCivil` dans `selectors.ts`,
 * pour la même raison.
 */
function useMinuteCourante(): number {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const battement = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 30_000);
    return () => clearInterval(battement);
  }, []);
  return minute;
}

export function PlagesEnCours() {
  const minute = useMinuteCourante();
  const plages = useMinoStore((s) => s.data?.freeWindows);
  const enfants = useChildren();
  const interrompre = useMinoStore((s) => s.interromprePlage);
  const reprendre = useMinoStore((s) => s.reprendrePlage);

  const maintenant = new Date(minute * 60_000);
  // Celles dont c'est l'heure, arrêtées ou non : le parent doit pouvoir
  // arrêter, et revenir sur son arrêt tant que l'heure n'est pas passée.
  const enCours = (plages ?? []).filter((p) => dansSonCreneau(p, maintenant));
  if (enCours.length === 0) return null;

  /** Qui la plage concerne, en toutes lettres — jamais un nombre d'enfants. */
  const qui = (plage: FreeWindow): string => {
    const vises =
      plage.childIds === null
        ? enfants
        : enfants.filter((e) => plage.childIds?.includes(e.id));
    const prenoms = vises.map((e) => e.firstName);
    if (prenoms.length === 0) return 'Toute la famille';
    if (prenoms.length === 1) return prenoms[0];
    return `${prenoms.slice(0, -1).join(', ')} et ${prenoms[prenoms.length - 1]}`;
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        title={enCours.length > 1 ? 'Plages libres en cours' : 'Plage libre en cours'}
        subtitle="L’écran est ouvert sans rien dépenser"
      />
      {enCours.map((plage) => {
        const arretee = estInterrompue(plage, maintenant);
        return (
          <Card
            key={plage.id}
            background={arretee ? colors.surfaceMuted : colors.mintSoft}
            elevation="none"
            style={styles.carte}
          >
            <View style={styles.texte}>
              <Text variant="cardTitle">{qui(plage)}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {arretee
                  ? `${plage.label} · arrêtée pour aujourd’hui`
                  : `${plage.label} · écran libre jusqu’à ${heure(plage.endMinute)}`}
              </Text>
            </View>
            {arretee ? (
              <Button
                label="Reprendre"
                icon="↩️"
                variant="secondary"
                onPress={() => void reprendre(plage.id).catch(() => undefined)}
              />
            ) : (
              <Button
                label="Arrêter"
                icon="✋"
                variant="secondary"
                onPress={() => void interrompre(plage.id).catch(() => undefined)}
              />
            )}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  carte: { gap: spacing.md },
  texte: { gap: spacing.xs },
});
