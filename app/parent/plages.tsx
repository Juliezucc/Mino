import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Field, Screen, ScreenHeader, Text, confirmer } from '@/components/ui';
import {
  JOURS,
  decritFenetre,
  heure,
  openWindowAt,
  valideFenetre,
} from '@/domain/freeWindows';
import { useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

/**
 * Les plages libres, côté parent.
 *
 * Le mercredi après-midi, les vacances, l'anniversaire d'un copain. Dans une
 * vraie famille, tout n'est pas mérité — et une application qui l'ignorerait
 * obligerait un parent à inventer une fausse mission « c'est mercredi » pour
 * obtenir ce qu'il veut vraiment dire.
 *
 * CE QUE L'ÉCRAN DOIT DIRE, et qui n'est pas évident : une plage ne coûte
 * rien. Ni ne rapporte. Le compteur de l'enfant est exactement le même avant
 * et après. C'est écrit en toutes lettres plus bas, parce que c'est la
 * première question qu'un parent se pose et qu'aucun réglage ne l'y répond
 * tout seul.
 */
export default function PlagesLibres() {
  const router = useRouter();
  const data = useFamily();
  const addFreeWindow = useMinoStore((s) => s.addFreeWindow);
  const toggleFreeWindow = useMinoStore((s) => s.toggleFreeWindow);
  const removeFreeWindow = useMinoStore((s) => s.removeFreeWindow);

  const [ouvertFormulaire, setOuvertFormulaire] = useState(false);
  const [label, setLabel] = useState('');
  const [jours, setJours] = useState<number[]>([]);
  const [debut, setDebut] = useState('14:00');
  const [fin, setFin] = useState('16:00');
  const [enfants, setEnfants] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const plages = data?.freeWindows ?? [];
  const prenoms = new Map((data?.children ?? []).map((c) => [c.id, c.firstName]));

  const enMinutes = (texte: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(texte.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };

  const basculeJour = (jour: number) =>
    setJours((actuels) =>
      actuels.includes(jour) ? actuels.filter((j) => j !== jour) : [...actuels, jour],
    );

  const basculeEnfant = (id: string) =>
    setEnfants((actuels) => {
      if (actuels === null) return [id];
      const suivant = actuels.includes(id)
        ? actuels.filter((e) => e !== id)
        : [...actuels, id];
      // Plus personne de coché : on revient à « toute la famille » plutôt que
      // d'enregistrer une plage qui n'ouvrirait rien à personne.
      return suivant.length === 0 ? null : suivant;
    });

  const enregistrer = async () => {
    setErreur(null);
    const startMinute = enMinutes(debut);
    const endMinute = enMinutes(fin);
    if (startMinute === null || endMinute === null) {
      return setErreur('Les horaires s’écrivent comme 14:00.');
    }

    const entree = { label, childIds: enfants, days: jours, startMinute, endMinute };
    const probleme = valideFenetre(entree);
    if (probleme) return setErreur(probleme);

    setEnvoi(true);
    try {
      await addFreeWindow(entree);
      setOuvertFormulaire(false);
      setLabel('');
      setJours([]);
      setEnfants(null);
    } catch {
      setErreur('Impossible d’enregistrer cette plage. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = (id: string, nom: string) =>
    void confirmer({
      titre: 'Supprimer cette plage ?',
      message: `« ${nom} » ne s’ouvrira plus.`,
      action: 'Supprimer',
      destructif: true,
    }).then((oui) => {
      if (oui) removeFreeWindow(id).catch(() => undefined);
    });

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} title="Plages libres" />

      <Card background={colors.blueSoft} elevation="none" style={styles.block}>
        <Text variant="cardTitle">Du temps qu’on n’a pas eu à gagner</Text>
        <Text variant="body" color={colors.textMuted}>
          Le mercredi après-midi, les vacances, un anniversaire. Pendant une
          plage libre, les écrans s’ouvrent sans que rien ne se dépense.
        </Text>
        {/* La première question d'un parent, répondue avant qu'il la pose. */}
        <Text variant="caption" color={colors.textSubtle}>
          Aucun compteur ne bouge : une plage libre n’enlève aucune minute, et
          n’en ajoute aucune.
        </Text>
      </Card>

      {plages.length === 0 && !ouvertFormulaire ? (
        <Card elevation="none" background={colors.surfaceMuted} style={styles.block}>
          <Text variant="body" color={colors.textMuted}>
            Aucune plage pour l’instant : tout le temps d’écran se gagne par les
            missions.
          </Text>
        </Card>
      ) : null}

      {plages.map((plage) => {
        const ouverte = openWindowAt([plage], null) !== null;
        return (
          <Card key={plage.id} style={styles.block}>
            <View style={styles.ligne}>
              <Text variant="cardTitle">{plage.label}</Text>
              {ouverte ? (
                <View style={styles.pastille}>
                  <Text variant="caption" color={colors.mintInk}>
                    OUVERTE
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="body" color={colors.textMuted}>
              {decritFenetre(plage, prenoms)}
            </Text>
            {!plage.enabled ? (
              <Text variant="caption" color={colors.textSubtle}>
                Suspendue — elle ne s’ouvre plus, mais reste prête à reprendre.
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Chip
                label={plage.enabled ? 'Suspendre' : 'Reprendre'}
                icon={plage.enabled ? '⏸️' : '▶️'}
                onPress={() => toggleFreeWindow(plage.id).catch(() => undefined)}
              />
              <Chip
                label="Supprimer"
                icon="🗑️"
                onPress={() => supprimer(plage.id, plage.label)}
              />
            </View>
          </Card>
        );
      })}

      {ouvertFormulaire ? (
        <Card style={styles.block}>
          <Text variant="label" color={colors.textMuted}>
            NOUVELLE PLAGE
          </Text>

          <Field
            label="Nom"
            value={label}
            onChangeText={setLabel}
            placeholder="Mercredi après-midi"
          />

          <Text variant="label" color={colors.textMuted}>
            JOURS
          </Text>
          <View style={styles.jours}>
            {JOURS.map((jour) => (
              <Chip
                key={jour.valeur}
                label={jour.long.slice(0, 3)}
                selected={jours.includes(jour.valeur)}
                onPress={() => basculeJour(jour.valeur)}
              />
            ))}
          </View>

          <View style={styles.horaires}>
            <View style={styles.moitie}>
              <Field label="De" value={debut} onChangeText={setDebut} placeholder="14:00" />
            </View>
            <View style={styles.moitie}>
              <Field label="À" value={fin} onChangeText={setFin} placeholder="16:00" />
            </View>
          </View>

          <Text variant="label" color={colors.textMuted}>
            POUR QUI
          </Text>
          <View style={styles.jours}>
            <Chip
              label="Toute la famille"
              icon="👨‍👩‍👧"
              selected={enfants === null}
              onPress={() => setEnfants(null)}
            />
            {(data?.children ?? []).map((enfant) => (
              <Chip
                key={enfant.id}
                label={enfant.firstName}
                selected={enfants?.includes(enfant.id) ?? false}
                onPress={() => basculeEnfant(enfant.id)}
              />
            ))}
          </View>

          {erreur ? (
            <Text variant="body" color={colors.pinkInk}>
              {erreur}
            </Text>
          ) : null}

          <Button label="Enregistrer" onPress={enregistrer} loading={envoi} />
          <Button
            label="Annuler"
            variant="ghost"
            haptic={false}
            onPress={() => {
              setOuvertFormulaire(false);
              setErreur(null);
            }}
          />
        </Card>
      ) : (
        <Button label="Ouvrir une plage" icon="🗓️" onPress={() => setOuvertFormulaire(true)} />
      )}

      <Text variant="caption" color={colors.textSubtle}>
        Une plage ne traverse pas minuit. Pour interdire les écrans le soir,
        c’est le contrôle parental de l’appareil qu’il faut régler — Mino
        n’ouvre du temps, il n’en retire jamais.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  block: { gap: spacing.sm },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  pastille: {
    backgroundColor: colors.mintSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  jours: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  horaires: { flexDirection: 'row', gap: spacing.md },
  moitie: { flex: 1 },
});
