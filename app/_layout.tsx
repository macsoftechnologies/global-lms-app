import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

function RootContent() {
  const { isDarkMode, theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.background,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="portal-select" />
        <Stack.Screen name="(student-tabs)" />
        <Stack.Screen name="(faculty-tabs)" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={styles.container}>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
