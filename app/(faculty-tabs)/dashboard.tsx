import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage, type AuthSession } from '../../src/services/authStorage';
import { ENV } from '../../src/config/env';

export default function FacultyDashboardScreen() {
  const [user, setUser] = useState<AuthSession['user'] | null>(null);

  useEffect(() => {
    AuthStorage.getUser().then((u) => {
      if (u) {
        setUser(u);
      }
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Faculty Portal</Text>
          </View>
          <Text style={styles.greeting}>
            Welcome, {user?.fullName || 'Professor'}! 🎓
          </Text>
          <Text style={styles.subtitle}>
            Department of Biblical Studies & Systematic Theology
          </Text>
        </View>

        {/* Teaching Metrics */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>142</Text>
            <Text style={styles.statLabel}>Students Taught</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>Active Courses</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>8</Text>
            <Text style={styles.statLabel}>Pending Reviews</Text>
          </View>
        </View>

        {/* Upcoming Live Lecture Banner */}
        <View style={styles.liveBanner}>
          <View style={styles.liveIconBox}>
            <Ionicons name="videocam" size={28} color="#A855F7" />
          </View>
          <View style={styles.liveInfo}>
            <Text style={styles.liveTag}>Upcoming Interactive Session</Text>
            <Text style={styles.liveTitle} numberOfLines={1}>
              Greek Exegesis Q&A - Romans Ch. 8
            </Text>
            <Text style={styles.liveTime}>
              Scheduled: Tomorrow at 10:00 AM IST
            </Text>
          </View>
          <TouchableOpacity
            style={styles.startLiveBtn}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert('Session Ready', 'Virtual classroom launcher initialized. Opening meeting stream...');
            }}
          >
            <Text style={styles.startLiveText}>Launch</Text>
          </TouchableOpacity>
        </View>

        {/* Faculty Action Shortcuts */}
        <Text style={styles.sectionTitle}>Instructional Management</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(faculty-tabs)/courses')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Ionicons name="school-outline" size={22} color="#A855F7" />
            </View>
            <Text style={styles.actionTitle}>My Courses</Text>
            <Text style={styles.actionDesc}>Manage Syllabus & Lessons</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(faculty-tabs)/courses')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Ionicons name="create-outline" size={22} color="#38BDF8" />
            </View>
            <Text style={styles.actionTitle}>Gradebook</Text>
            <Text style={styles.actionDesc}>Assignments & Exam Scores</Text>
          </TouchableOpacity>
        </View>

        {/* Backend & Endpoint Status */}
        <View style={styles.apiCard}>
          <Text style={styles.apiCardTitle}>Faculty API Architecture Notice</Text>
          <Text style={styles.apiDesc}>
            Connected to production backend API at {ENV.API_URL}. Active courses and live session schedules are synchronized.
          </Text>
          <View style={styles.apiDetailRow}>
            <Text style={styles.apiDetailLabel}>Authentication Endpoint:</Text>
            <Text style={styles.apiDetailValue}>POST /api/v1/auth/login</Text>
          </View>
          <View style={styles.apiDetailRow}>
            <Text style={styles.apiDetailLabel}>Environment Base URL:</Text>
            <Text style={styles.apiDetailValue}>
              {ENV.IS_API_CONFIGURED ? ENV.API_URL : 'Preview / Offline Mode'}
            </Text>
          </View>
        </View>
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
    marginBottom: 10,
  },
  badgeText: {
    color: '#A855F7',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#131B2E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#A855F7',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  liveIconBox: {
    marginRight: 12,
  },
  liveInfo: {
    flex: 1,
  },
  liveTag: {
    fontSize: 11,
    color: '#C084FC',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  liveTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  liveTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  startLiveBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  startLiveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#131B2E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: '#94A3B8',
  },
  apiCard: {
    backgroundColor: '#131B2E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  apiCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C084FC',
    marginBottom: 6,
  },
  apiDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 10,
  },
  apiDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  apiDetailLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  apiDetailValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C084FC',
  },
});
