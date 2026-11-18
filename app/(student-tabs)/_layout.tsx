import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

export default function StudentTabsLayout() {
  const { isDarkMode } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDarkMode ? '#818CF8' : '#4F46E5',
        tabBarInactiveTintColor: isDarkMode ? '#94A3B8' : '#64748B',
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
          borderTopColor: isDarkMode ? '#1F2937' : '#E2E8F0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 66,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          paddingTop: 8,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: isDarkMode ? 0.35 : 0.05,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[styles.iconWrapper, focused && (isDarkMode ? styles.activeWrapperDark : styles.activeWrapperLight)]}>
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={22}
                color={color as string}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'My Courses',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[styles.iconWrapper, focused && (isDarkMode ? styles.activeWrapperDark : styles.activeWrapperLight)]}>
              <Ionicons
                name={focused ? 'book' : 'book-outline'}
                size={22}
                color={color as string}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[styles.iconWrapper, focused && (isDarkMode ? styles.activeWrapperDark : styles.activeWrapperLight)]}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={color as string}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWrapperLight: {
    backgroundColor: '#EEF2FF',
  },
  activeWrapperDark: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
});
