import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, ScreenHeader, Text, confirmer } from '@/components/ui';
import { useParent, useParents } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * Les parents de la famille — deux, parfois plus, un seul compte.
 *
 * **Ce qui manquait, trouvé avec un vrai second téléphone.** Une mère installe
 * Mino sur le téléphone de son mari, saisit le code famille, et l'application
 * lui demande à qui est l'appareil sans jamais proposer « à l'autre parent ».
 * Le père se retrouvait à ouvrir un espace parent qui le saluait du prénom de
 * sa femme — quand il ne réservait pas le téléphone à un enfant faute de
 * meilleure réponse.
 *
 * **Un profil, pas un compte, et c'est tout le choix de conception.** Le second
 * parent rejoint avec le code famille comme le reste de la maison : pas
 * d'adresse à donner, pas de mot de passe de plus, et le même code à quatre
 * chiffres — puisqu'il appartient à la famille et non au compte. Ce qu'il
 * peut faire est donc exactement ce que le code parent ouvre : voir,
 * confirmer, créer, régler. Ce qu'il ne peut pas faire tient à ce qu'un profil
 * n'est pas un compte : ni changer l'adresse, ni résilier l'abonnement, ni
 * supprimer la famille. Ces trois-là restent au titulaire, et le serveur le
 * tient — ce n'est pas une politesse d'interface.
 *
 * **Retirer, aussi.** Un prénom mal tapé serait autrement définitif : les
 * doublons sont refusés à l'ajout, et la base n'autorise chacun qu'à modifier
 * sa propre ligne. Le titulaire du compte, lui, ne se retire pas d'ici : il y
 * a un parcours entier pour cela, qui emporte la famille et demande d'écrire
 * un mot.
 */
export default function ParentsScreen() {
  const router = useRouter();
  const parents = useParents();
  const titulaire = useParent();
  const ajouterParent = useMinoStore((s) => s.ajouterParent);
  const retirerParent = useMinoStore((s) => s.retirerParent);

  const [prenom, setPrenom] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const ajouter = async () => {
    const nom = prenom.trim();
    if (!nom) return setErreur('Indiquez un prénom.');
    setOccupe(true);
    setErreur(null);
    try {
      await ajouterParent({ prenom: nom });
      setPrenom('');
    } catch (e) {
      setErreur(e instanceof Error && e.message ? e.message : 'Ce parent n’a pas pu être ajouté.');
    } finally {
      setOccupe(false);
    }
  };

  const retirer = (id: string, nom: string) => {
    void confirmer({
      titre: `Retirer ${nom} ?`,
      message: `Son profil disparaîtra de la famille. Les missions, l’historique et les minutes gagnées ne bougent pas — ${nom} n’avait pas de compte à lui. Son téléphone redemandera à qui il appartient.`,
      action: 'Retirer',
      destructif: true,
    }).then((oui) => {
      if (!oui) return;
      retirerParent(id).catch((e: unknown) => {
        setErreur(e instanceof Error && e.message ? e.message : 'Ce parent n’a pas pu être retiré.');
      });
    });
  };

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} title="Les parents" />

      <Card background={colors.blueSoft} elevation="none" style={styles.block}>
        <Text variant="bodyStrong" color={colors.blueInk}>
          Un seul compte, autant de parents qu’il en faut.
        </Text>
        <Text variant="body" color={colors.textMuted}>
          L’autre parent installe Mino, saisit le code famille et se choisit dans la liste. Il n’a
          ni adresse à donner ni mot de passe à retenir : c’est le même code à quatre chiffres qui
          ouvre l’espace parent, sur son téléphone comme sur le vôtre.
        </Text>
      </Card>

      <View style={styles.block}>
        <Text variant="section">Dans cette famille</Text>
        {parents.map((p) => {
          const estTitulaire = p.id === titulaire?.id;
          return (
            <Card key={p.id} style={styles.ligne}>
              <View style={styles.textes}>
                <Text variant="cardTitle">{p.displayName ?? 'Parent'}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {estTitulaire
                    ? `${p.email ?? 'Compte de la famille'} · gère l’abonnement`
                    : 'Rejoint par le code famille'}
                </Text>
              </View>
              {estTitulaire ? null : (
                <Button
                  label="Retirer"
                  variant="ghost"
                  size="small"
                  full={false}
                  haptic={false}
                  onPress={() => retirer(p.id, p.displayName ?? 'ce parent')}
                />
              )}
            </Card>
          );
        })}
      </View>

      <Card style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          AJOUTER UN PARENT
        </Text>
        <Field
          label="Son prénom"
          placeholder="Marc"
          autoCapitalize="words"
          autoCorrect={false}
          value={prenom}
          onChangeText={(v) => setPrenom(v.slice(0, 30))}
          error={erreur ?? undefined}
        />
        <Button label="Ajouter" icon="➕" onPress={ajouter} loading={occupe} />
        <Text variant="caption" color={colors.textSubtle}>
          Vous pouvez aussi le laisser s’ajouter lui-même : sur son téléphone, après le code
          famille, Mino lui demande qui il est.
        </Text>
      </Card>

      <Card elevation="none" background={colors.surfaceMuted} style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          CE QUI RESTE AU TITULAIRE
        </Text>
        <Text variant="body" color={colors.textMuted}>
          L’adresse du compte, le mot de passe, l’abonnement et la suppression de la famille ne se
          touchent que depuis le compte qui l’a créée. Un profil de parent ne le peut pas, et le
          serveur le refuse — ce n’est pas seulement caché ici.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  block: { gap: spacing.sm },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  textes: { flex: 1, gap: 2 },
});
