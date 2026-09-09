import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Screen, ScreenHeader, Text, confirmer } from '@/components/ui';
import { childrenOfMission } from '@/domain/missions';
import { MissionForm, MissionFormValue } from '@/features/parent/MissionForm';
import { useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors } from '@/theme';

/**
 * Modifier une mission qui existe déjà.
 *
 * **Ce qui manquait, et qui se voyait dès la deuxième minute d'usage.** Une
 * routine crée huit missions d'un coup, toutes à quinze minutes et toutes à
 * confirmer. C'est un bon point de départ et un mauvais point d'arrivée : le
 * parent veut aussitôt mettre cinq minutes sur « se brosser les dents »,
 * laisser celle-là se compter toute seule, et retirer « donner à manger au
 * chien » au petit. Rien de tout cela n'était possible — l'onglet Missions ne
 * proposait que d'inverser la confirmation, ou de supprimer.
 *
 * Supprimer et recréer était donc le seul chemin, et c'est le pire : il efface
 * l'historique de ce que l'enfant a déjà accompli.
 */
export default function EditMission() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useFamily();
  const editMission = useMinoStore((s) => s.editMission);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const mission = data?.missions.find((m) => m.id === id);

  // Lu une fois : le formulaire tient ensuite son propre état, et une mise à
  // jour venue de l'autre téléphone ne doit pas effacer ce que le parent est
  // en train de taper.
  const initial = useMemo<MissionFormValue | null>(() => {
    if (!data || !mission) return null;
    return {
      title: mission.title,
      icon: mission.icon,
      minutes: mission.minutes,
      repeat: mission.repeat,
      childIds: childrenOfMission(data, mission.id),
      autoApprove: mission.autoApprove === true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.id]);

  if (!mission || !initial) {
    return (
      <Screen>
        <ScreenHeader onBack={() => router.back()} title="Mission introuvable" />
        <Text variant="body" color={colors.textMuted}>
          Cette mission a été supprimée.
        </Text>
      </Screen>
    );
  }

  const submit = async (value: MissionFormValue) => {
    setLoading(true);
    setError(undefined);
    try {
      await editMission(mission.id, value);
      router.back();
    } catch (e) {
      // Dit sur place plutôt qu'en silence : une modification qui n'a pas pris
      // et qui ferme l'écran quand même est une modification qu'on croit
      // faite.
      setError(e instanceof Error ? e.message : 'La modification n’a pas pu être enregistrée.');
    } finally {
      setLoading(false);
    }
  };

  const confirmMinutes = (value: MissionFormValue) => {
    // Le temps gagné change pour la suite, jamais pour ce qui est déjà fait.
    // Un parent qui divise une récompense par trois doit savoir que la demande
    // qui attend sur son accueil sera payée à l'ancien tarif : sans cela, il
    // croira à un bug.
    const enAttente = (data?.completions ?? []).some(
      (c) => c.missionId === mission.id && c.status === 'pending',
    );
    if (!enAttente || value.minutes === mission.minutes) return submit(value);

    void confirmer({
      titre: 'Une demande attend déjà',
      message: `Le nouveau temps s’appliquera aux prochaines fois. La demande en attente reste à ${mission.minutes} min, comme annoncé à l’enfant quand il a terminé.`,
      action: 'Enregistrer',
    }).then((oui) => {
      if (oui) void submit(value);
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          onBack={() => router.back()}
          title="Modifier la mission"
          subtitle="Le temps gagné, les jours, qui confirme, pour qui."
        />
        <MissionForm
          initial={initial}
          submitLabel="ENREGISTRER"
          onSubmit={confirmMinutes}
          loading={loading}
        />
        {error ? (
          <Text variant="caption" color={colors.dangerInk}>
            {error}
          </Text>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
