import React from 'react';
import { Tabs } from 'expo-router';
import { colors, typography } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.surface },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontWeight: typography.weight.semibold,
          fontSize: typography.size.md,
        },
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderTopColor: colors.tab.border,
        },
        tabBarActiveTintColor: colors.tab.activeText,
        tabBarInactiveTintColor: colors.tab.inactiveText,
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.medium,
        },
      }}
    >
      <Tabs.Screen
        name="myday"
        options={{
          title: 'My Day',
          tabBarLabel: 'My Day',
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarLabel: 'Accounts',
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarLabel: 'Contacts',
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarLabel: 'Calendar',
        }}
      />
    </Tabs>
  );
}
