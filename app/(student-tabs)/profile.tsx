import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import { LmsAuthService } from '../../src/services/lmsAuthService';
import { DashboardService } from '../../src/services/dashboardService';
import { useTheme } from '../../src/context/ThemeContext';

export default function StudentProfileScreen() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState<AuthSession['user'] | null>(null);

  useEffect(() => {
    AuthStorage.getUser().then((u) => {
      if (u) setUser(u);
    });
    DashboardService.getCurrentUser().then((res) => {
      if (res.data) setUser(res.data);
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your student portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await LmsAuthService.logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, !isDarkMode && { backgroundColor: '#F8FAFC' }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text
            style={[
              styles.badge,
              !isDarkMode && {
                backgroundColor: '#EEF2FF',
                borderColor: '#C7D2FE',
                color: '#4F46E5',
              },
            ]}
          >
            Student Account
          </Text>
          <Text style={[styles.title, !isDarkMode && { color: '#0F172A' }]}>Student Profile</Text>
        </View>

        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            !isDarkMode && {
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
            },
          ]}
        >
          <View
            style={[
              styles.avatarCircle,
              !isDarkMode && {
                backgroundColor: '#EEF2FF',
                borderColor: '#6366F1',
              },
            ]}
          >
            <Ionicons name="school" size={40} color={isDarkMode ? '#38BDF8' : '#4F46E5'} />
          </View>
          <Text style={[styles.studentName, !isDarkMode && { color: '#0F172A' }]}>
            {user?.fullName || 'Johnathan Doe'}
          </Text>
          <Text style={[styles.studentEmail, !isDarkMode && { color: '#64748B' }]}>
            {user?.email || 'student@example.com'}
          </Text>
          <View
            style={[
              styles.roleTag,
              !isDarkMode && { backgroundColor: '#EEF2FF' },
            ]}
          >
            <Text style={[styles.roleTagText, !isDarkMode && { color: '#4F46E5' }]}>
              Enrolled Student • ATA Accredited
            </Text>
          </View>
        </View>

        {/* Academic Details */}
        <View
          style={[
            styles.sectionCard,
            !isDarkMode && {
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, !isDarkMode && { color: '#0F172A' }]}>
            Academic Information
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, !isDarkMode && { color: '#64748B' }]}>Program</Text>
            <Text style={[styles.infoValue, !isDarkMode && { color: '#0F172A' }]}>
              Bachelor of Theology (B.Th)
            </Text>
          </View>
          <View style={[styles.divider, !isDarkMode && { backgroundColor: '#F1F5F9' }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, !isDarkMode && { color: '#64748B' }]}>Affiliation</Text>
            <Text style={[styles.infoValue, !isDarkMode && { color: '#0F172A' }]}>
              Asia Theological Association
            </Text>
          </View>
          <View style={[styles.divider, !isDarkMode && { backgroundColor: '#F1F5F9' }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, !isDarkMode && { color: '#64748B' }]}>Student ID</Text>
            <Text style={[styles.infoValue, !isDarkMode && { color: '#0F172A' }]}>
              {user?.id || 'SEM-2026-089'}
            </Text>
          </View>
          <View style={[styles.divider, !isDarkMode && { backgroundColor: '#F1F5F9' }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, !isDarkMode && { color: '#64748B' }]}>Current Status</Text>
            <Text style={[styles.infoValue, { color: '#10B981' }]}>Active Enrollee</Text>
          </View>
        </View>

        {/* Document Status */}
        <View
          style={[
            styles.sectionCard,
            !isDarkMode && {
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, !isDarkMode && { color: '#0F172A' }]}>
            Verification Documents
          </Text>
          <View style={styles.docItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={[styles.docName, !isDarkMode && { color: '#334155' }]}>
              Passport Photo &amp; ID Proof
            </Text>
            <Text style={styles.docStatusVerified}>Verified</Text>
          </View>
          <View style={[styles.divider, !isDarkMode && { backgroundColor: '#F1F5F9' }]} />
          <View style={styles.docItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={[styles.docName, !isDarkMode && { color: '#334155' }]}>
              High School Transcripts
            </Text>
            <Text style={styles.docStatusVerified}>Verified</Text>
          </View>
          <View style={[styles.divider, !isDarkMode && { backgroundColor: '#F1F5F9' }]} />
          <View style={styles.docItem}>
            <Ionicons name="time" size={18} color="#F59E0B" />
            <Text style={[styles.docName, !isDarkMode && { color: '#334155' }]}>
              Pastor Recommendation
            </Text>
            <Text style={styles.docStatusPending}>In Review</Text>
          </View>
        </View>

        {/* Appearance Preferences */}
        <View
          style={[
            styles.sectionCard,
            !isDarkMode && {
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, !isDarkMode && { color: '#0F172A' }]}>
            Preferences
          </Text>
          <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons
                name={isDarkMode ? 'moon' : 'sunny'}
                size={20}
                color={isDarkMode ? '#818CF8' : '#D97706'}
              />
              <Text style={[styles.infoLabel, !isDarkMode && { color: '#334155' }]}>
                Dark Mode
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E2E8F0', true: '#4F46E5' }}
              thumbColor={Platform.OS === 'android' ? (isDarkMode ? '#818CF8' : '#FFFFFF') : undefined}
            />
          </View>
        </View>

        {/* Account Security */}
        <View
          style={[
            styles.sectionCard,
            !isDarkMode && {
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, !isDarkMode && { color: '#0F172A' }]}>
            Account Security
          </Text>
          <TouchableOpacity
            style={[
              styles.securityActionRow,
              !isDarkMode && {
                backgroundColor: '#F8FAFC',
                borderColor: '#E2E8F0',
              },
            ]}
            onPress={() => router.push('/student/change-password')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Change Password"
          >
            <View
              style={[
                styles.securityIconBox,
                !isDarkMode && { backgroundColor: '#EEF2FF' },
              ]}
            >
              <Ionicons
                name="key-outline"
                size={18}
                color={isDarkMode ? '#38BDF8' : '#4F46E5'}
              />
            </View>
            <View style={styles.securityTextCol}>
              <Text style={[styles.securityTitle, !isDarkMode && { color: '#0F172A' }]}>
                Change Password
              </Text>
              <Text style={[styles.securitySubtitle, !isDarkMode && { color: '#64748B' }]}>
                Update your account password
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDarkMode ? '#64748B' : '#94A3B8'}
            />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[
            styles.logoutBtn,
            !isDarkMode && {
              backgroundColor: '#FEF2F2',
              borderColor: '#FECACA',
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out from Student Portal</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 36 : 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  profileCard: {
    backgroundColor: '#131B2E',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  studentName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 12,
  },
  roleTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleTagText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#131B2E',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    marginVertical: 2,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  docName: {
    flex: 1,
    fontSize: 13,
    color: '#E2E8F0',
    marginLeft: 8,
  },
  docStatusVerified: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  docStatusPending: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  securityActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    gap: 12,
  },
  securityIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTextCol: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  securitySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
});
