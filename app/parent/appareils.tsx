import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import {
  DEVICE_KINDS,
  DEVICE_SUGGESTIONS,
  DeviceKind,
  activeDevices,
  deviceIcon,
} from '@/domain/devices';
import { useFamily } from '@/store/selectors';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

/**
 * The family's other screens.
 *
 * Declaring them is not bookkeeping: it is where the parent learns, once and
 * clearly, that only the device running Mino is automatic and everything else
 * goes through them. A family that discovers that at bedtime instead stops
 * trusting the app.
 */
export default function DevicesScreen() {
  const router = useRouter();
  const data = useFamily();
  const addDevice = useMinoStore((s) => s.addDevice);
  const removeDevice = useMinoStore((s) => s.removeDevice);

  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<DeviceKind>('console');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!data) return null;

  const devices = activeDevices(data.devices);

  const add = async (value: string, deviceKind: DeviceKind) => {
    if (!value.trim()) return setError('Donne un nom à cet appareil.');
    setLoading(true);
    try {
      await addDevice({ label: value.trim(), kind: deviceKind });
      setLabel('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’ajouter cet appareil.');
    } finally {
      setLoading(false);
    }
  };

  const confirmRemove = (id: string, name: string) => {
    Alert.alert('Retirer cet appareil ?', `« ${name} » ne sera plus proposé à vos enfants.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          removeDevice(id).catch(() => undefined);
        },
      },
    ]);
  };

  const alreadyAdded = (name: string) =>
    devices.some((d) => d.label.toLowerCase() === name.toLowerCase());

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} title="Appareils de la maison" />

      <Card background={colors.blueSoft} elevation="none" style={styles.intro}>
        <Text variant="bodyStrong" color={colors.blueInk}>
          Un seul écran est automatique : le téléphone ou la tablette où Mino est installé.
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Mino existe sur iPhone, iPad et Android. Sur un de ces appareils, votre enfant lance
          lui-même son temps et le minuteur démarre tout de suite.
        </Text>
        <Text variant="body" color={colors.textMuted}>
          Une console, une télévision ou un ordinateur n’ouvrent leur temps de jeu à aucune
          application extérieure : Mino ne peut ni les démarrer, ni les arrêter. Pour ces écrans-là,
          votre enfant fait une demande et c’est vous qui lancez le minuteur.
        </Text>
      </Card>

      <View style={styles.block}>
        <Text variant="section">Mes appareils</Text>
        {devices.length === 0 ? (
          <Card elevation="none" background={colors.surfaceMuted}>
            <Text variant="body" color={colors.textMuted} center>
              Aucun appareil déclaré. Vos enfants ne peuvent utiliser leur temps que sur l’appareil
              où Mino est installé.
            </Text>
          </Card>
        ) : (
          devices.map((device) => (
            <Card key={device.id} style={styles.device}>
              <Text style={styles.deviceIcon}>{deviceIcon(device.kind)}</Text>
              <View style={styles.deviceTexts}>
                <Text variant="cardTitle">{device.label}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  Validation par un parent
                </Text>
              </View>
              <Button
                label="Retirer"
                variant="ghost"
                size="small"
                full={false}
                haptic={false}
                onPress={() => confirmRemove(device.id, device.label)}
              />
            </Card>
          ))
        )}
      </View>

      <View style={styles.block}>
        <Text variant="section">Ajouter en un geste</Text>
        <View style={styles.row}>
          {DEVICE_SUGGESTIONS.filter((s) => !alreadyAdded(s.label)).map((suggestion) => (
            <Chip
              key={suggestion.label}
              label={suggestion.label}
              icon={deviceIcon(suggestion.kind)}
              onPress={() => add(suggestion.label, suggestion.kind)}
            />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text variant="section">Ou nommez le vôtre</Text>
        <Field
          label="Nom de l’appareil"
          placeholder="Switch de la chambre"
          value={label}
          onChangeText={setLabel}
          error={error ?? undefined}
        />
        <View style={styles.row}>
          {DEVICE_KINDS.map((option) => (
            <Pressable
              key={option.kind}
              onPress={() => setKind(option.kind)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: kind === option.kind }}
              style={[styles.kind, kind === option.kind && styles.kindOn]}
            >
              <Text style={styles.kindIcon}>{option.icon}</Text>
              <Text
                variant="caption"
                color={kind === option.kind ? colors.blueDark : colors.textMuted}
                center
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          label="AJOUTER CET APPAREIL"
          icon="＋"
          onPress={() => add(label, kind)}
          loading={loading}
          disabled={!label.trim()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.xl },
  intro: { gap: spacing.sm },
  block: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  device: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deviceIcon: { fontSize: 28 },
  deviceTexts: { flex: 1, gap: 2 },
  kind: {
    width: 84,
    gap: spacing.xs,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  kindOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  kindIcon: { fontSize: 24 },
});
