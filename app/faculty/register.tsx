import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function FacultyRegisterScreen() {
  useEffect(() => {
    // Automatically redirect to faculty login
    const timer = setTimeout(() => {
      router.replace('/faculty/login');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={32} color="#7C3AED" />
          </View>
          <Text style={styles.title}>Faculty Portal</Text>
          <Text style={styles.subtitle}>
            Faculty and educator accounts are provisioned exclusively by the Academic Administration.
            Direct online application is disabled.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/faculty/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Go to Faculty Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
