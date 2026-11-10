import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import { LmsAuthService } from '../../src/services/lmsAuthService';

export default function FacultyProfileScreen() {
  const [user, setUser] = useState<AuthSession['user'] | null>(null);

  useEffect(() => {
    AuthStorage.getUser().then(setUser);
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of the Faculty Portal?', [
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.badge}>Faculty Account</Text>
          <Text style={styles.title}>Faculty Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="ribbon" size={40} color="#A855F7" />
          </View>
          <Text style={styles.facultyName}>{user?.fullName || 'Dr. Eleanor Vance'}</Text>
          <Text style={styles.facultyEmail}>{user?.email || 'vance@seminary.edu'}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>Senior Professor • Biblical Languages</Text>
          </View>
        </View>

        {/* Academic Credentials */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Instructional Credentials</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Highest Degree</Text>
            <Text style={styles.infoValue}>Ph.D. in Biblical Exegesis</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>Biblical Studies</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Teaching Experience</Text>
            <Text style={styles.infoValue}>9 Years</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Faculty Status</Text>
            <Text style={[styles.infoValue, { color: '#10B981' }]}>Active Permanent Faculty</Text>
          </View>
        </View>

        {/* Faculty Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Administrative Shortcuts</Text>
          <View style={styles.docItem}>
            <Ionicons name="document-text-outline" size={18} color="#C084FC" />
            <Text style={styles.docName}>Curriculum Vitae (On Record)</Text>
            <Text style={styles.docStatusVerified}>Verified</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.docItem}>
            <Ionicons name="calendar-outline" size={18} color="#C084FC" />
            <Text style={styles.docName}>Semester Teaching Schedule</Text>
            <Text style={styles.docStatusVerified}>Updated</Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out from Faculty Portal</Text>
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
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: '#A855F7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: '#A855F7',
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
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#A855F7',
  },
  facultyName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  facultyEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 12,
  },
  roleTag: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleTagText: {
    fontSize: 12,
    color: '#C084FC',
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
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
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
