import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function StudentTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 86 : 62,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
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
              size={size - 2}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'My Courses',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={size - 2}
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
              size={size - 2}
              color={color as string}
            />
          ),
        }}
      />
    </Tabs>
  );
}
