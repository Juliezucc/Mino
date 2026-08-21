import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue, Platform, StyleSheet } from 'react-native';

import { Icon, IconName } from '@/components/icons/Icon';
import { colors, fonts, radii, shadows } from '@/theme';

/** Parent navigation: calmer than the child side, same rounded language. */
export default function ParentTabsLayout() {
  const tab = (name: IconName) =>
    ({ color }: { color: ColorValue }) => <Icon name={name} color={String(color)} size={24} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.purpleInk,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: tab('home') }} />
      <Tabs.Screen name="missions" options={{ title: 'Missions', tabBarIcon: tab('missions') }} />
      <Tabs.Screen name="enfants" options={{ title: 'Enfants', tabBarIcon: tab('children') }} />
      <Tabs.Screen name="reglages" options={{ title: 'Réglages', tabBarIcon: tab('settings') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 24 : 16,
    height: 72,
    paddingTop: 8,
    paddingBottom: 0,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    ...shadows.lifted,
  },
  label: { fontFamily: fonts.bold, fontSize: 11.5, marginTop: 2 },
});
