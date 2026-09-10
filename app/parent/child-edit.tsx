import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui';
import { ChildForm, ChildFormValue } from '@/features/parent/ChildForm';
import { useChild } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';

/**
 * Corriger le prénom, l'âge ou l'avatar d'un enfant déjà créé.
 *
 * **Le défaut que cet écran répare, et il ne se voyait pas parce qu'il ne
 * produit aucune erreur.** Ces trois champs n'étaient saisissables qu'à la
 * création. Passé cet instant, la fiche de l'enfant les *affichait* — « 9 ans »
 * — sans jamais permettre d'y toucher. Un parent qui se trompait d'une touche
 * n'avait qu'une sortie : supprimer le profil, et avec lui tout l'historique
 * des missions et des minutes.
 *
 * **Et l'âge n'est pas un détail d'état civil : c'est un réglage du produit.**
 * Il décide de deux choses. Du registre, au seuil de 13 ans — en dessous, des
 * minos, la mascotte, les confettis et de très grands boutons ; au-dessus, des
 * minutes, un ton sobre et une mise en page dense. Et des missions proposées,
 * dont certaines portent un avertissement de sécurité parce qu'elles supposent
 * un adolescent. Un âge faux, ce sont des suggestions fausses et un ton faux.
 *
 * **Une réserve, assumée, et qu'il faut avoir en tête.** L'âge est un nombre
 * figé, pas une date de naissance : il ne vieillit pas tout seul. Un enfant
 * inscrit à 12 ans aura toujours 12 ans dans Mino dans trois ans, et continuera
 * de recevoir la mascotte et les confettis d'un enfant de 12 ans. Cet écran
 * rend la correction possible ; il ne la déclenche pas. Le jour où cela
 * deviendra un vrai sujet — il le deviendra, c'est une question de calendrier
 * et non de risque — la réponse sera soit une invitation annuelle, soit un mois
 * et une année de naissance à la place du nombre.
 *
 * L'inscription depuis le site rend la correction plus utile encore : le
 * questionnaire n'y donne qu'un âge témoin, tiré de la tranche que le parent a
 * touchée. Pour un enfant de 10 ans dans « 10-12 », on enregistre 12.
 */
export default function EditChild() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const child = useChild(id);
  const editChild = useMinoStore((s) => s.editChild);
  const [loading, setLoading] = useState(false);

  if (!child) return null;

  const submit = async (value: ChildFormValue) => {
    setLoading(true);
    try {
      /**
       * Le prénom, l'âge et l'avatar, et rien d'autre.
       *
       * `ChildForm` rend aussi `requireApproval` et `companionEnabled`, qui se
       * règlent déjà par des puces sur la fiche de l'enfant. Les réécrire ici
       * serait sans effet visible dans le cas ordinaire — le formulaire part de
       * leurs valeurs actuelles — mais écraserait le choix du parent s'il l'a
       * changé sur l'autre appareil de la famille pendant qu'il remplissait
       * celui-ci. On n'envoie que ce que cet écran sert à modifier.
       */
      await editChild(child.id, {
        firstName: value.firstName,
        age: value.age,
        avatarKey: value.avatarKey,
      });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <ScreenHeader
          onBack={() => router.back()}
          title={`Modifier ${child.firstName}`}
          subtitle="Prénom, âge et avatar. Rien de ce qu’il a gagné n’est touché."
        />
        <ChildForm
          initial={child}
          submitLabel="Enregistrer"
          onSubmit={submit}
          loading={loading}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
