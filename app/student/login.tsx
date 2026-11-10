import React, { useEffect, useState } from 'react';
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
import { AuthStorage } from '../../src/services/authStorage';
import { ENV } from '../../src/config/env';

export default function StudentLoginScreen() {
  const params = useLocalSearchParams<{ email?: string; organizationCode?: string }>();

  const [organizationCode, setOrganizationCode] = useState(
    params.organizationCode || ENV.DEFAULT_ORG_SLUG || 'org1'
  );
  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [orgError, setOrgError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize Organization Code from params, local storage, or live public organization API
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (params.organizationCode) {
        setOrganizationCode(params.organizationCode);
      } else {
        const storedCode = await AuthStorage.getOrganizationCode();
        if (storedCode && isMounted) {
          setOrganizationCode(storedCode);
        } else {
          try {
            const orgRes = await LmsAuthService.getPublicOrganization();
            if (orgRes.success && orgRes.data?.slug && isMounted) {
              setOrganizationCode(orgRes.data.slug);
            }
          } catch {
            // Keep default fallback
          }
        }
      }

      if (params.email && isMounted) {
        setEmail(params.email);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [params.organizationCode, params.email]);

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
      setEmailError('Email address is required');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(emailTrimmed)) {
      setEmailError('Please enter a valid email address');
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
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await LmsAuthService.loginStudent(email, password, organizationCode);

      if (response.success && response.data) {
        Alert.alert(
          'Login Successful',
          `Welcome back, ${response.data.user.fullName || 'Student'}!`,
          [
            {
              text: 'Open Student Portal',
              onPress: () => router.replace('/(student-tabs)/dashboard'),
            },
          ],
          {
            cancelable: true,
            onDismiss: () => router.replace('/(student-tabs)/dashboard'),
          }
        );
      } else {
        const errorMsg = response.error || 'Invalid credentials or organization code.';
        if (errorMsg.toLowerCase().includes('pending')) {
          Alert.alert(
            'Application Under Review',
            'Your registration application has been submitted and is currently pending administrative review. We will notify you once your interview has been scheduled.',
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
          {/* Top Bar Switch / Navigation */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.portalSwitchBtn}
              onPress={() => router.push('/portal-select')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="apps-outline" size={18} color="#475569" />
              <Text style={styles.portalSwitchText}>Portals</Text>
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
            <Text style={styles.institutionSubName}>Church on the Rock • India</Text>
          </View>

          {/* Main Login Card matching user reference image */}
          <View style={styles.card}>
            {/* Top Gradient Border Accent Bar */}
            <View style={styles.cardHeaderAccent}>
              <View style={[styles.gradientBar, { backgroundColor: '#4F46E5' }]} />
              <View style={[styles.gradientBar, { backgroundColor: '#6366F1' }]} />
              <View style={[styles.gradientBar, { backgroundColor: '#8B5CF6' }]} />
              <View style={[styles.gradientBar, { backgroundColor: '#D946EF' }]} />
              <View style={[styles.gradientBar, { backgroundColor: '#EC4899' }]} />
            </View>

            <View style={styles.cardInnerPadding}>
              {/* Pill Badge: SIGN IN */}
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>SIGN IN</Text>
              </View>

              {/* Heading: Welcome back */}
              <Text style={styles.cardTitle}>Welcome back</Text>

              {/* Subtitle: Enter your organization credentials to continue. */}
              <Text style={styles.cardSubtitle}>
                Enter your organization credentials to continue.
              </Text>

              {/* ORGANIZATION CODE * */}
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

              {/* EMAIL * */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  EMAIL <Text style={styles.asterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, Boolean(emailError) && styles.inputErrorBorder]}
                  placeholder="you@organization.com"
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

              {/* PASSWORD * */}
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
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              </View>

              {/* Primary Sign In Button */}
              <TouchableOpacity
                style={[
                  styles.signInButton,
                  isSubmitting && { opacity: 0.75 },
                ]}
                onPress={handleLogin}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Divider Line */}
              <View style={styles.divider} />

              {/* New student? Register here */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>New student? </Text>
                <TouchableOpacity onPress={() => router.push('/student/register')} activeOpacity={0.7}>
                  <Text style={styles.registerLink}>Register here</Text>
                </TouchableOpacity>
              </View>

              {/* Faculty Portal Link */}
              <View style={[styles.footerRow, { marginTop: 14 }]}>
                <Text style={styles.footerText}>Faculty member? </Text>
                <TouchableOpacity onPress={() => router.push('/faculty/login')} activeOpacity={0.7}>
                  <Text style={[styles.registerLink, { color: '#6366F1' }]}>Sign in here</Text>
                </TouchableOpacity>
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
    paddingTop: 10,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  portalSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  portalSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    marginLeft: 5,
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
    width: 96,
    height: 96,
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
  pillBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  pillBadgeText: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 26,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  asterisk: {
    color: '#EF4444',
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    paddingVertical: 12,
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
    color: '#EF4444',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: '#5B50F6',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#5B50F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 24,
    marginBottom: 18,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B50F6',
  },
  demoAccountsContainer: {
    marginTop: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  demoChipsRow: {
    gap: 8,
  },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
});
