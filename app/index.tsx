import React, { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthStorage } from '../src/services/authStorage';
import OnboardingScreen from '../src/components/OnboardingScreen';
import StudentLoginScreen from './student/login';
import { useTheme } from '../src/context/ThemeContext';

export default function IndexScreen() {
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AuthStorage.hasCompletedOnboarding()
      .then((completed) => {
        if (isMounted) {
          setHasCompletedOnboarding(completed);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.splashContainer, isDarkMode && { backgroundColor: '#0B0F19' }]}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={isDarkMode ? '#818CF8' : '#4F46E5'} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingScreen onFinish={() => setHasCompletedOnboarding(true)} />;
  }

  return <StudentLoginScreen />;
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 120,
    height: 120,
  },
  loader: {
    marginTop: 24,
  },
});
