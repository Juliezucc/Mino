import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Card, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { buildReport } from '@/domain/diagnostics';
import { searchFaq } from '@/domain/support';
import { deviceContext, getDiagnosticsService } from '@/services/diagnostics';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * Signaler un problème.
 *
 * Deux choses se passent ici, et l'ordre compte.
 *
 * D'abord, pendant que le parent écrit, la base de connaissance cherche déjà.
 * S'il tape « ça bloque pas », la réponse s'affiche sous ses doigts avant qu'il
 * ait fini sa phrase. C'est le seul moyen honnête de réduire le SAV : répondre
 * plus vite, pas rendre le contact plus difficile.
 *
 * Ensuite, ce qui part. Le message est nettoyé de tout ce qui identifie
 * quelqu'un — prénoms des enfants en tête — et le contexte technique est
 * affiché en clair avant l'envoi. Un parent doit pouvoir lire ce qu'il envoie.
 */
export default function SignalerUnProbleme() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const data = useMinoStore((s) => s.data);
  const repository = useMinoStore((s) => s.repository);

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const trimmed = message.trim();
  // Cherche pendant qu'il écrit, dès qu'il y a de quoi chercher.
  const suggestions = useMemo(() => (trimmed.length >= 8 ? searchFaq(trimmed, undefined, 2) : []), [trimmed]);

  const context = useMemo(
    () =>
      deviceContext({
        route: params.from,
        repository: repository.name,
        counts: data
          ? { children: data.children.length, missions: data.missions.length, devices: data.devices.length }
          : undefined,
      }),
    [data, params.from, repository.name],
  );

  const send = async () => {
    if (trimmed.length < 10 || sending) return;
    setSending(true);

    const report = buildReport({
      kind: 'manual',
      message: trimmed,
      context,
      // Les prénoms viennent de la famille elle-même : deviner un prénom dans
      // une phrase française n'a pas de solution fiable, mais l'application
      // connaît exactement ceux qu'elle a enregistrés.
      firstNames: data?.children.map((c) => c.firstName) ?? [],
    });

    const result = await getDiagnosticsService()
      .send(report)
      .catch(() => ({ ok: false, reference: undefined }));

    setSending(false);
    setReference(result.reference ?? null);
  };

  if (reference) {
    return (
      <Screen contentStyle={styles.content}>
        <ScreenHeader onBack={() => router.back()} />
        <View style={styles.head}>
          <Mascot expression="happy" size={120} />
          <Text variant="hero" center>
            C’est envoyé
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Merci. Chaque signalement est lu, et ceux qui reviennent souvent passent devant.
          </Text>
        </View>

        <Card background={colors.surfaceMuted} elevation="none" style={styles.block}>
          <Text variant="label" color={colors.textMuted}>
            Votre référence
          </Text>
          <Text variant="cardTitle">{reference}</Text>
          <Text variant="caption" color={colors.textSubtle}>
            Gardez-la si vous nous réécrivez : elle nous mène droit au problème.
          </Text>
        </Card>

        <Button label="Revenir" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.head}>
        <Mascot expression="motivated" size={96} />
        <Text variant="hero" center>
          Signaler un problème
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Racontez ce qui s’est passé, comme vous le diriez à quelqu’un.
        </Text>
      </View>

      <Field
        placeholder="Ex. : j’ai confirmé une mission et le compteur n’a pas bougé"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={5}
        style={styles.textarea}
        accessibilityLabel="Décrire le problème"
        hint="Dix caractères au minimum. Les prénoms de vos enfants sont retirés automatiquement."
      />

      {suggestions.length > 0 ? (
        <View style={styles.block}>
          <Text variant="label" color={colors.textMuted}>
            Cela répond peut-être déjà
          </Text>
          {suggestions.map(({ entry }) => (
            <Card key={entry.id} background={colors.blueSoft} elevation="none" style={styles.suggestion}>
              <Text variant="bodyStrong" color={colors.blueInk}>
                {entry.question}
              </Text>
              <Text variant="body" color={colors.textMuted}>
                {entry.answer}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}

      <Card background={colors.surfaceMuted} elevation="none" style={styles.block}>
        <Text variant="label" color={colors.textMuted}>
          Ce qui part avec votre message
        </Text>
        <Text variant="caption" color={colors.textSubtle}>
          {`Version ${context.appVersion} · ${context.platform} ${context.osVersion ?? ''} · ${context.repository}`}
        </Text>
        {context.counts ? (
          <Text variant="caption" color={colors.textSubtle}>
            {`${context.counts.children} enfant(s), ${context.counts.missions} mission(s), ${context.counts.devices} appareil(s) déclaré(s)`}
          </Text>
        ) : null}
        <Text variant="caption" color={colors.textSubtle}>
          Aucun prénom, aucune adresse, aucun code, aucun historique.
        </Text>
      </Card>

      <Button
        label="Envoyer"
        onPress={send}
        loading={sending}
        disabled={trimmed.length < 10}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.sm },
  block: { gap: 4 },
  suggestion: { gap: 4 },
  textarea: { minHeight: 130, textAlignVertical: 'top', paddingTop: spacing.md },
});
