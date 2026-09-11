import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, ScreenHeader, Text, confirmer } from '@/components/ui';
import { useParents, useTitulaireDuCompte } from '@/store/selectors';
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
 * **Un vrai parent, et pas un spectateur.** La première version n'écrivait
 * qu'un prénom : la ligne n'avait pas de `user_id`, donc `auth_is_parent()`
 * répondait non, donc son téléphone ne pouvait NI créer une mission, NI poser
 * une plage libre, NI offrir une minute — `missions_write`,
 * `free_windows_write` et `screen_time_transactions_insert` l'exigent toutes
 * les trois. L'écran promettait « il règle le quotidien » à quelqu'un qui ne
 * pouvait que regarder. Sa ligne porte désormais le `user_id` de SON appareil,
 * et il est parent pour la base comme pour l'interface.
 *
 * **Ce qu'il ne peut pas faire tient à l'adresse, pas à la confiance.**
 * Changer l'adresse du compte, résilier l'abonnement, supprimer la famille :
 * ces trois-là demandent de pouvoir revenir depuis n'importe quel téléphone,
 * et l'identité d'un appareil ne survit pas à sa perte. Le serveur le tient —
 * ce n'est pas une politesse d'interface.
 *
 * **Ce que cela déplace, et il faut le dire.** Le code à quatre chiffres
 * n'ouvre plus seulement une session : il inscrit durablement un appareil.
 * Changer le code ne révoque donc plus un téléphone — c'est cet écran-ci qui
 * le fait, d'un geste, et c'est plus net qu'un code changé en espérant.
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
  const titulaire = useTitulaireDuCompte();
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
      message: `Son téléphone cessera aussitôt d’ouvrir l’espace parent et de créer des missions. Les missions, l’historique et les minutes gagnées ne bougent pas — ${nom} n’avait pas de compte à lui, seulement un profil dans votre famille.`,
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
          L’autre parent installe Mino, saisit le code famille, se choisit dans la liste et donne
          le code à quatre chiffres. Il n’a ni adresse à donner ni mot de passe à retenir — et il
          voit, crée et confirme exactement comme vous.
        </Text>
        <Text variant="caption" color={colors.textSubtle}>
          S’il change de téléphone, il reprend son profil de la même façon : le nouvel appareil
          remplace l’ancien, qui n’ouvre plus rien.
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
                    : 'Parent · rejoint par le code famille'}
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
          touchent que depuis le compte qui l’a créée. Ces trois-là demandent de pouvoir revenir
          depuis n’importe quel téléphone, et le serveur les refuse à un autre — ce n’est pas
          seulement caché ici.
        </Text>
        <Text variant="caption" color={colors.textSubtle}>
          Retirer un parent est aussi la façon de révoquer son téléphone : le code à quatre
          chiffres, lui, ne suffit plus à le faire.
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
