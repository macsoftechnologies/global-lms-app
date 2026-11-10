import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface TeachingCourse {
  id: string;
  code: string;
  title: string;
  enrolledStudents: number;
  pendingReviews: number;
  nextSession: string;
}

const TEACHING_COURSES: TeachingCourse[] = [
  {
    id: 'fc-1',
    code: 'GRK-201',
    title: 'Biblical Greek & Exegesis',
    enrolledStudents: 48,
    pendingReviews: 5,
    nextSession: 'Tomorrow, 10:00 AM',
  },
  {
    id: 'fc-2',
    code: 'HERM-301',
    title: 'Advanced Hermeneutics & Homiletics',
    enrolledStudents: 36,
    pendingReviews: 3,
    nextSession: 'Thursday, 02:30 PM',
  },
  {
    id: 'fc-3',
    code: 'SEM-405',
    title: 'Pastoral Theology & Leadership',
    enrolledStudents: 58,
    pendingReviews: 0,
    nextSession: 'Friday, 11:00 AM',
  },
];

export default function FacultyCoursesScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.badge}>Assigned Courses</Text>
          <Text style={styles.title}>Teaching Courses</Text>
          <Text style={styles.subtitle}>
            Subjects and student batches under your academic instruction
          </Text>
        </View>

        <View style={styles.courseList}>
          {TEACHING_COURSES.map((course) => (
            <View key={course.id} style={styles.courseCard}>
              <View style={styles.cardHeader}>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{course.code}</Text>
                </View>
                {course.pendingReviews > 0 ? (
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewText}>{course.pendingReviews} To Review</Text>
                  </View>
                ) : (
                  <View style={styles.allDoneBadge}>
                    <Text style={styles.allDoneText}>All Graded</Text>
                  </View>
                )}
              </View>

              <Text style={styles.courseTitle}>{course.title}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={16} color="#94A3B8" />
                  <Text style={styles.metaText}>{course.enrolledStudents} Students Enrolled</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color="#94A3B8" />
                  <Text style={styles.metaText}>{course.nextSession}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.manageBtn} activeOpacity={0.8}>
                  <Text style={styles.manageBtnText}>Manage Curriculum</Text>
                  <Ionicons name="settings-outline" size={14} color="#C084FC" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.rosterBtn} activeOpacity={0.8}>
                  <Text style={styles.rosterBtnText}>View Class Roster</Text>
                  <Ionicons name="chevron-forward" size={14} color="#A855F7" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  courseList: {
    gap: 16,
  },
  courseCard: {
    backgroundColor: '#131B2E',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reviewText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },
  allDoneBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  allDoneText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  courseTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  metaRow: {
    gap: 6,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.08)',
    paddingTop: 12,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  rosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rosterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C084FC',
  },
});
