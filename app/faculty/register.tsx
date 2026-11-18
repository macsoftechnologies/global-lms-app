import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';

export default function FacultyRegisterScreen() {
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/faculty/login');
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={styles.container}>
        <View style={[styles.card, { backgroundColor: isDarkMode ? '#161F30' : '#FFFFFF', borderColor: isDarkMode ? '#1F2937' : '#E2E8F0' }]}>
          <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#FAF5FF' }]}>
            <Ionicons name="lock-closed" size={32} color="#A855F7" />
          </View>
          <Text style={[styles.title, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Faculty Portal</Text>
          <Text style={[styles.subtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Faculty and educator accounts are provisioned exclusively by the Academic Administration.
            Direct online application is disabled.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/faculty/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Go to Faculty Sign In</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 26,
    fontWeight: '400',
  },
  button: {
    backgroundColor: '#7C3AED',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
