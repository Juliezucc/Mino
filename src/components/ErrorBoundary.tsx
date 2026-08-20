import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { Mascot } from '@/components/mascot';
import { buildReport } from '@/domain/diagnostics';
import { deviceContext, getDiagnosticsService } from '@/services/diagnostics';
import { colors, spacing } from '@/theme';

/**
 * Ce qui reste quand tout le reste a cassé.
 *
 * Sans cela, une erreur de rendu donne un écran blanc : le parent ne sait pas
 * quoi faire, l'enfant croit avoir cassé quelque chose, et **le bug n'est jamais
 * signalé** — ce sont exactement les plus graves qui disparaissent ainsi.
 *
 * L'écran ne demande donc rien. Le rapport part tout seul, avec la pile
 * nettoyée ; on ne fait pas remplir un formulaire à quelqu'un dont
 * l'application vient de se fermer.
 *
 * Volontairement sans dépendance au store : si le store est la cause de la
 * panne, l'écran de secours doit tenir quand même.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  reference: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, reference: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const report = buildReport({
      kind: 'crash',
      message: '',
      stack: `${error.message}\n${error.stack ?? info.componentStack ?? ''}`,
      context: deviceContext(),
    });

    getDiagnosticsService()
      .send(report)
      .then((result) => this.setState({ reference: result.reference ?? null }))
      // Un échec d'envoi ne doit surtout pas relancer une erreur ici : ce serait
      // une boucle, et l'écran de secours disparaîtrait à son tour.
      .catch(() => undefined);
  }

  private retry = () => this.setState({ error: null, reference: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Screen contentStyle={styles.content}>
        <View style={styles.head}>
          <Mascot expression="sad" size={130} />
          <Text variant="hero" center>
            Mino s’est emmêlé
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Ce n’est pas votre faute, et rien n’est perdu : les minos de vos enfants sont en
            sécurité. Le problème nous a été signalé automatiquement.
          </Text>
        </View>

        {this.state.reference ? (
          <Text variant="caption" color={colors.textSubtle} center>
            {`Référence ${this.state.reference}`}
          </Text>
        ) : null}

        <Button label="Réessayer" onPress={this.retry} />
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingBottom: spacing.xl },
  head: { alignItems: 'center', gap: spacing.sm },
});
