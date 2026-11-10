import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LmsAuthService } from '../../src/services/lmsAuthService';
import { ENV } from '../../src/config/env';

export default function FacultyLoginScreen() {
  const params = useLocalSearchParams<{ email?: string }>();

  const [organizationCode, setOrganizationCode] = useState(ENV.DEFAULT_ORG_SLUG || 'org1');
  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [orgError, setOrgError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    let valid = true;
    setOrgError('');
    setEmailError('');
    setPasswordError('');

    if (!organizationCode.trim()) {
      setOrgError('Organization code is required');
      valid = false;
    }

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setEmailError('Academic email address is required');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(emailTrimmed)) {
      setEmailError('Please enter a valid academic email address');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      valid = false;
    }

    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    if (isSubmitting) return; // Prevent duplicate requests

    setIsSubmitting(true);
    try {
      const response = await LmsAuthService.loginFaculty(email, password, organizationCode);

      if (response.success && response.data) {
        Alert.alert(
          'Access Granted',
          `Welcome to Faculty Portal, ${response.data.user.fullName || 'Professor'}!`,
          [
            {
              text: 'Open Faculty Portal',
              onPress: () => router.replace('/(faculty-tabs)/dashboard'),
            },
          ]
        );
      } else {
        const errorMsg = response.error || 'Invalid credentials or organization code.';
        if (errorMsg.toLowerCase().includes('pending')) {
          Alert.alert(
            'Account Under Review',
            'Your faculty account is currently pending administrative activation. Please contact the administrator.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Authentication Failed', errorMsg);
        }
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar with Back Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace('/')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color="#1E293B" />
            </TouchableOpacity>
          </View>

          {/* Official Global LMS Logo Header */}
          <View style={styles.logoHeaderContainer}>
            <View style={styles.logoShadowWrapper}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.institutionName}>GLOBAL LMS</Text>
            <Text style={styles.institutionSubName}>Faculty & Academic Portal</Text>
          </View>

          {/* Main Card */}
          <View style={styles.card}>
            {/* Top Gradient Border Accent Bar */}
            <View style={styles.cardHeaderAccent}>
              <View style={[styles.gradientBar, { backgroundColor: '#7C3AED' }]} />
              <View style={[styles.gradientBar, { backgroundColor: '#6366F1' }]} />
              <View style={[styles.gradientBar, { backgroundColor: '#4F46E5' }]} />
              <View style={[styles.gradientBar, { backgroundColor: '#A855F7' }]} />
              <View style={[styles.gradientBar, { backgroundColor: '#EC4899' }]} />
            </View>

            <View style={styles.cardInnerPadding}>
              {/* Pill Badge: FACULTY PORTAL */}
              <View style={styles.badge}>
                <Ionicons name="school-outline" size={14} color="#7C3AED" style={{ marginRight: 6 }} />
                <Text style={styles.badgeText}>FACULTY PORTAL</Text>
              </View>

            {/* Title: Welcome Back */}
            <Text style={styles.title}>Welcome Back</Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>Sign in to access your faculty dashboard.</Text>

            {/* 1. ORGANIZATION CODE */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                ORGANIZATION CODE <Text style={styles.asterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, Boolean(orgError) && styles.inputErrorBorder]}
                placeholder="org1"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                value={organizationCode}
                onChangeText={(text) => {
                  setOrganizationCode(text);
                  if (orgError) setOrgError('');
                }}
              />
              {orgError ? <Text style={styles.errorText}>{orgError}</Text> : null}
            </View>

            {/* 2. ACADEMIC EMAIL */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                ACADEMIC EMAIL <Text style={styles.asterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, Boolean(emailError) && styles.inputErrorBorder]}
                placeholder="faculty@organization.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                }}
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            {/* 3. PASSWORD with show/hide icon */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                PASSWORD <Text style={styles.asterisk}>*</Text>
              </Text>
              <View
                style={[
                  styles.passwordContainer,
                  Boolean(passwordError) && styles.inputErrorBorder,
                ]}
              >
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError('');
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>

            {/* Primary Button: Sign In as Faculty */}
            <TouchableOpacity
              style={[styles.signInButton, isSubmitting && { opacity: 0.75 }]}
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In as Faculty</Text>
              )}
            </TouchableOpacity>

            {/* Administrative Notice */}
            <View style={styles.itNoticeBox}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color="#7C3AED"
                style={{ marginRight: 8, marginTop: 1 }}
              />
              <Text style={styles.itNoticeText}>
                Faculty accounts are provisioned exclusively by Academic Administration. Contact your administrator if you need access.
              </Text>
            </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  topBar: {
    marginBottom: 8,
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  logoHeaderContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoShadowWrapper: {
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 10,
  },
  logoImage: {
    width: 90,
    height: 90,
  },
  institutionName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1.5,
  },
  institutionSubName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeaderAccent: {
    height: 4,
    width: '100%',
    flexDirection: 'row',
  },
  gradientBar: {
    flex: 1,
    height: 4,
  },
  cardInnerPadding: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F3E8FF', // Soft lavender
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  badgeText: {
    color: '#7C3AED', // Primary purple
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A', // Heading color
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B', // Secondary text
    lineHeight: 22,
    marginBottom: 28,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  asterisk: {
    color: '#DC2626',
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 4,
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: '#7C3AED', // Primary purple
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  staticButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 10,
  },
  staticButtonText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '700',
  },
  itNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 24,
  },
  itNoticeText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 18,
  },
});
