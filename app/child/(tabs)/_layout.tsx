import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue, Platform, StyleSheet } from 'react-native';

import { Icon, IconName } from '@/components/icons/Icon';
import { colors, fonts, radii, shadows } from '@/theme';

/** Three destinations, big labels, icon + word. Nothing else. */
export default function ChildTabsLayout() {
  const tab = (name: IconName) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <Icon
        name={name}
        color={String(color)}
        size={focused ? 27 : 25}
        strokeWidth={focused ? 2.6 : 2.2}
      />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Missions', tabBarIcon: tab('missions') }} />
      <Tabs.Screen name="temps" options={{ title: 'Temps', tabBarIcon: tab('clock') }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: tab('profile') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 24 : 16,
    height: 74,
    paddingBottom: 0,
    paddingTop: 8,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    ...shadows.lifted,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    marginTop: 2,
  },
  item: { paddingVertical: 6 },
});
