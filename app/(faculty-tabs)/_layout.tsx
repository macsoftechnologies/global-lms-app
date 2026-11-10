import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function FacultyTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#A855F7',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: 'rgba(168, 85, 247, 0.15)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={size}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Teaching',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'school' : 'school-outline'}
              size={size}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color as string}
            />
          ),
        }}
      />
    </Tabs>
  );
}
