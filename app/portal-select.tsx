import React from 'react';
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

export default function RoleSelectionScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.institutionTitle}>GLOBAL LMS</Text>
          <Text style={styles.tagline}>
            Church on the Rock • Seminary & Higher Education
          </Text>
        </View>

        {/* Role Selection Container */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Your Portal</Text>
          <Text style={styles.sectionSubtitle}>
            Choose your role to log in or register for an account
          </Text>
        </View>

        {/* Student Card */}
        <View style={[styles.roleCard, styles.studentCardBorder]}>
          <View style={styles.roleCardHeader}>
            <View style={[styles.iconCircle, styles.studentIconBg]}>
              <Ionicons name="school" size={28} color="#38BDF8" />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleTitle}>Student Portal</Text>
              <Text style={styles.roleBadge}>Undergraduate & Seminary</Text>
            </View>
          </View>
          <Text style={styles.roleDesc}>
            Access enrolled degree programs, video courses, interactive checkpoints, assignments, and transcripts.
          </Text>

          <TouchableOpacity
            style={styles.studentButton}
            onPress={() => router.push('/student/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Continue as Student</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subLink}
            onPress={() => router.push('/student/register')}
            activeOpacity={0.7}
          >
            <Text style={styles.subLinkText}>
              New Applicant? <Text style={styles.highlightText}>Register Here</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Faculty Card */}
        <View style={[styles.roleCard, styles.facultyCardBorder]}>
          <View style={styles.roleCardHeader}>
            <View style={[styles.iconCircle, styles.facultyIconBg]}>
              <Ionicons name="ribbon" size={28} color="#A855F7" />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleTitle}>Faculty Portal</Text>
              <Text style={[styles.roleBadge, styles.facultyBadge]}>Professors & Instructors</Text>
            </View>
          </View>
          <Text style={styles.roleDesc}>
            Manage courses, upload syllabi, review homework submissions, conduct live classes, and publish grades.
          </Text>

          <TouchableOpacity
            style={styles.facultyButton}
            onPress={() => router.push('/faculty/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Continue as Faculty</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
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
    backgroundColor: '#090D16',
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 44 : 20,
    paddingBottom: 36,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  institutionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  roleCard: {
    backgroundColor: '#131B2E',
    borderRadius: 20,
    padding: 20,
    
    marginBottom: 18,
    borderWidth: 1.5,
  },
  studentCardBorder: {
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  facultyCardBorder: {
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  studentIconBg: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  facultyIconBg: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  roleBadge: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  facultyBadge: {
    color: '#A855F7',
  },
  roleDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 19,
    marginBottom: 18,
  },
  studentButton: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  facultyButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  subLink: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  subLinkText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  highlightText: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  facultyHighlightText: {
    color: '#C084FC',
    fontWeight: '600',
  },
  systemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 8,
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 11,
    color: '#64748B',
  },
});
