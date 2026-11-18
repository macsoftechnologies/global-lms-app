import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ENV } from '../src/config/env';
import { useTheme } from '../src/context/ThemeContext';
import { LmsAuthService } from '../src/services/lmsAuthService';
import { OrganizationInfo } from '../src/types';
import { resolveBackendMediaUrl } from '../src/utils/registrationHelpers';

export default function RoleSelectionScreen() {
  const { isDarkMode } = useTheme();
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);

  useEffect(() => {
    let active = true;
    LmsAuthService.getPublicOrganization().then((res) => {
      if (active && res.success && res.data) {
        setOrgInfo(res.data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const orgLogoUrl = useMemo(() => resolveBackendMediaUrl(orgInfo?.logoUrl), [orgInfo?.logoUrl]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={[styles.logoWrapper, isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' }]}>
            <Image
              source={orgLogoUrl ? { uri: orgLogoUrl } : require('../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.institutionTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            {orgInfo?.name || 'GLOBAL LMS'}
          </Text>
          <Text style={[styles.tagline, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {orgInfo?.slug
              ? `Institution Portal • ${orgInfo.slug.toUpperCase()}`
              : 'Seminary & Higher Education Learning Portal'}
          </Text>
        </View>

        {/* Role Selection Container */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            Select Your Portal
          </Text>
          <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Choose your role to log in or register for an account
          </Text>
        </View>

        {/* Student Card */}
        <View
          style={[
            styles.roleCard,
            {
              backgroundColor: isDarkMode ? '#161F30' : '#FFFFFF',
              borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.35)' : '#E0E7FF',
            },
          ]}
        >
          <View style={styles.cardAccentBar} />
          <View style={styles.cardBody}>
            <View style={styles.roleCardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }]}>
                <Ionicons name="school" size={26} color={isDarkMode ? '#818CF8' : '#4F46E5'} />
              </View>
              <View style={styles.roleInfo}>
                <Text style={[styles.roleTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                  Student Portal
                </Text>
                <Text style={[styles.roleBadge, { color: isDarkMode ? '#818CF8' : '#4F46E5' }]}>
                  Undergraduate &amp; Seminary
                </Text>
              </View>
            </View>
            <Text style={[styles.roleDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Access enrolled degree programs, video courses, interactive checkpoints, assignments, and transcripts.
            </Text>

            <TouchableOpacity
              style={styles.studentButton}
              onPress={() =>
                router.push(
                  orgInfo?.slug
                    ? { pathname: '/student/login', params: { organizationCode: orgInfo.slug } }
                    : '/student/login'
                )
              }
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Continue as Student</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.subLink}
              onPress={() =>
                router.push(
                  orgInfo?.slug
                    ? { pathname: '/student/register', params: { organizationCode: orgInfo.slug } }
                    : '/student/register'
                )
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.subLinkText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                New Applicant?{' '}
                <Text style={[styles.highlightText, { color: isDarkMode ? '#818CF8' : '#4F46E5' }]}>
                  Register Here
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Faculty Card */}
        <View
          style={[
            styles.roleCard,
            {
              backgroundColor: isDarkMode ? '#161F30' : '#FFFFFF',
              borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.35)' : '#F3E8FF',
            },
          ]}
        >
          <View style={[styles.cardAccentBar, { backgroundColor: '#A855F7' }]} />
          <View style={styles.cardBody}>
            <View style={styles.roleCardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#FAF5FF' }]}>
                <Ionicons name="ribbon" size={26} color="#A855F7" />
              </View>
              <View style={styles.roleInfo}>
                <Text style={[styles.roleTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                  Faculty Portal
                </Text>
                <Text style={[styles.roleBadge, { color: '#A855F7' }]}>
                  Professors &amp; Instructors
                </Text>
              </View>
            </View>
            <Text style={[styles.roleDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Manage courses, upload syllabi, review homework submissions, conduct live classes, and publish grades.
            </Text>

            <TouchableOpacity
              style={styles.facultyButton}
              onPress={() => router.push('/faculty/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Continue as Faculty</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* System & API Status Banner */}
        <View style={styles.systemFooter}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            LMS API: {ENV.IS_API_CONFIGURED ? ENV.API_URL : 'Preview / Offline Mode'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 16,
    paddingBottom: 36,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  logoImage: {
    width: 68,
    height: 68,
  },
  institutionTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  roleCard: {
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardAccentBar: {
    height: 4,
    width: '100%',
    backgroundColor: '#4F46E5',
  },
  cardBody: {
    padding: 20,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  roleDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  studentButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  facultyButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subLink: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  subLinkText: {
    fontSize: 13,
    fontWeight: '500',
  },
  highlightText: {
    fontWeight: '700',
  },
  systemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});
