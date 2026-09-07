import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorToast } from '@/features/ErrorToast';
import { getDiagnosticsService } from '@/services/diagnostics';
// Importé pour son effet, et il n'y a rien d'autre à en faire ici : le module
// s'abonne aux liens entrants dès le chargement du paquet, c'est-à-dire avant
// qu'un écran puisse être monté. C'est la seule position d'où l'on ne peut pas
// rater le lien de confirmation d'un parent qui a Mino déjà ouvert.
import '@/services/auth/lienEntrant';
import { useMinoStore } from '@/store/useMinoStore';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  const status = useMinoStore((s) => s.status);
  const bootstrap = useMinoStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
    // Ce qui n'avait pas pu partir la dernière fois — souvent le plus utile,
    // puisqu'un plantage et une mauvaise connexion vont souvent ensemble.
    getDiagnosticsService()
      .flush()
      .catch(() => undefined);
  }, [bootstrap]);

  const ready = fontsLoaded && status === 'ready';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {/* Sous le fournisseur de zones sûres, pour que l'écran de secours ne
            passe pas sous l'encoche : c'est le seul écran qu'on ne peut pas
            corriger après coup. */}
        <ErrorBoundary>
          {/* Au-dessus de la navigation, monté une seule fois : ce qui n'a pas
              pu être enregistré se dit de la même façon sur tous les écrans. */}
          {ready ? <ErrorToast /> : null}
          {ready ? (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
              }}
            />
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.blueInk} size="large" />
            </View>
          )}
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
