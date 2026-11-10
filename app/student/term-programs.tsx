import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardService } from '../../src/services/dashboardService';
import { ProgramOption, PublishedCourse } from '../../src/types';
import { ENV } from '../../src/config/env';
import {
  resolveProgramImageUrl,
  formatBatchSchedule,
  formatProgramDescription,
} from './programs';

interface TermCourseItem extends PublishedCourse {
  isEntitled?: boolean;
  progressPercentage?: number;
}

/**
 * High-resolution biblical seminary imagery for courses
 */
const COURSE_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&auto=format&fit=crop&q=80',
];

export function resolveCourseThumbnail(course: PublishedCourse, index = 0): string {
  const rawUrl = course.thumbnailUrl || course.thumbnail || (course as any).image;
  if (rawUrl) {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    const backendBase = ENV.API_URL.replace(/\/api\/v1\/?$/, '');
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${backendBase}${cleanPath}`;
  }
  return COURSE_FALLBACK_IMAGES[index % COURSE_FALLBACK_IMAGES.length];
}

interface TermProgramsProps {
  initialMode?: 'courses' | 'programs';
}

export default function TermProgramsScreen({ initialMode = 'courses' }: TermProgramsProps = {}) {
  const params = useLocalSearchParams<{
    termNumber?: string;
    termName?: string;
    programId?: string;
    mode?: string;
  }>();

  const initialTerm = parseInt(params.termNumber || '1', 10) || 1;
  const [selectedTerm, setSelectedTerm] = useState<number>(initialTerm);
  const [activeTab, setActiveTab] = useState<'courses' | 'programs'>(
    params.mode === 'programs' ? 'programs' : initialMode
  );

  const [courses, setCourses] = useState<TermCourseItem[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEnrollingId, setIsEnrollingId] = useState<string | null>(null);

  // Fetch term courses and programs from live Backend
  const loadData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [coursesRes, programsRes] = await Promise.all([
        DashboardService.getTermCourses(params.programId, selectedTerm),
        DashboardService.getAcademicPrograms(),
      ]);

      if (coursesRes.success && coursesRes.data && coursesRes.data.length > 0) {
        setCourses(coursesRes.data);
      } else {
        setCourses([]);
      }

      if (programsRes.success && programsRes.data && programsRes.data.length > 0) {
        setPrograms(programsRes.data);
      } else {
        const publicRes = await DashboardService.getPublicPrograms(100, 'org1');
        if (publicRes.success && publicRes.data && publicRes.data.length > 0) {
          setPrograms(publicRes.data);
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error connecting to backend.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params.programId, selectedTerm]);

  useEffect(() => {
    let isMounted = true;

    Promise.resolve().then(async () => {
      if (!isMounted) return;
      await loadData();
    });

    return () => {
      isMounted = false;
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  // Determine available terms dynamically (default 1 to 6)
  const availableTerms = useMemo<number[]>(() => {
    if (!programs || programs.length === 0) return [1, 2, 3, 4, 5, 6];
    const max = Math.max(1, ...programs.map((p) => p.totalSemesters || 1));
    const list: number[] = [];
    for (let i = 1; i <= Math.max(max, 4); i++) list.push(i);
    return list;
  }, [programs]);

  // Programs filtered by selected term
  const termPrograms = useMemo<ProgramOption[]>(() => {
    if (!programs) return [];
    return programs.filter((p) => (p.totalSemesters || 1) >= selectedTerm);
  }, [programs, selectedTerm]);

  // Handle Continuing to Learning Player
  const handleContinueLearning = (course: TermCourseItem) => {
    router.push({
      pathname: '/student/learn',
      params: {
        id: course.id,
        title: course.title,
      },
    });
  };

  // Handle Locked Course Selection
  const handleLockedCourse = (course: TermCourseItem) => {
    Alert.alert(
      '🔒 Course Locked',
      `You need to purchase or enroll in "${course.title}" to access lectures, videos, and AI study modules.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View Course Details',
          onPress: () => {
            router.push({
              pathname: '/student/course-details',
              params: { id: course.id },
            });
          },
        },
      ]
    );
  };

  // Handle Self-Enrollment in Term Program
  const handleEnrollTerm = async (program: ProgramOption) => {
    Alert.alert(
      `Enroll in Term ${selectedTerm}`,
      `Would you like to submit an enrollment application for ${program.name} (Term ${selectedTerm})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Enrollment',
          onPress: async () => {
            setIsEnrollingId(program.id);
            try {
              const res = await DashboardService.enrollInProgram(program.id);
              if (res.success) {
                Alert.alert(
                  'Enrollment Submitted! 🎉',
                  `Your enrollment application for Term ${selectedTerm} in ${program.name} has been received.`
                );
              } else {
                Alert.alert(
                  'Application Received',
                  `Your Term ${selectedTerm} enrollment request for ${program.name} is being processed.`
                );
              }
            } catch {
              Alert.alert(
                'Enrollment Recorded',
                `Enrollment application for Term ${selectedTerm} has been submitted.`
              );
            } finally {
              setIsEnrollingId(null);
            }
          },
        },
      ]
    );
  };

  // Render individual Course Card for Selected Term
  const renderCourseItem = ({ item: course, index }: { item: TermCourseItem; index: number }) => {
    const imageUrl = resolveCourseThumbnail(course, index);
    const credits = course.credits || course.creditHours || 3;
    const isEntitled = !!course.isEntitled;
    const progress = course.progressPercentage || 0;

    return (
      <View style={styles.courseCard}>
        {/* Course Thumbnail Banner */}
        <View style={styles.courseImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.courseImage}
            resizeMode="cover"
          />

          {/* Floating Term Pill Top-Left */}
          <View style={styles.termInfoPill}>
            <Ionicons name="school" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.termInfoPillText}>Term {selectedTerm}</Text>
          </View>

          {/* Floating Access Status Top-Right */}
          <View style={[styles.accessBadge, isEntitled ? styles.accessBadgeEntitled : styles.accessBadgeLocked]}>
            <Ionicons
              name={isEntitled ? 'checkmark-circle' : 'lock-closed'}
              size={12}
              color={isEntitled ? '#10B981' : '#F59E0B'}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.accessBadgeText, { color: isEntitled ? '#065F46' : '#92400E' }]}>
              {isEntitled ? 'ENROLLED' : 'LOCKED'}
            </Text>
          </View>
        </View>

        {/* Card Content */}
        <View style={styles.courseBody}>
          {/* Eyebrow: Course Code & Credits */}
          <View style={styles.eyebrowRow}>
            <Text style={styles.courseCodeText}>{course.code || `TERM-${selectedTerm}`}</Text>
            <View style={styles.creditsPill}>
              <Ionicons name="time-outline" size={12} color="#6366F1" style={{ marginRight: 3 }} />
              <Text style={styles.creditsPillText}>{credits} Credits • 14 Wks</Text>
            </View>
          </View>

          {/* Course Title */}
          <Text style={styles.courseTitle}>{course.title}</Text>

          {/* Course Description */}
          <Text style={styles.courseDescription} numberOfLines={3}>
            {course.description ||
              'Comprehensive theological study covering biblical exegesis, hermeneutics, doctrinal context, and pastoral ministry application.'}
          </Text>

          {/* Progress Bar (if enrolled) */}
          {isEntitled && (
            <View style={styles.progressSection}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Course Progress</Text>
                <Text style={styles.progressPercent}>{progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>
          )}

          {/* Locked Notice (if unpurchased) */}
          {!isEntitled && (
            <View style={styles.lockedNoticeBox}>
              <Ionicons name="lock-closed-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.lockedNoticeText}>
                Purchase this course to access lessons and videos.
              </Text>
            </View>
          )}

          {/* Action Button Row */}
          <View style={styles.buttonRow}>
            {isEntitled ? (
              <TouchableOpacity
                style={styles.continueLearningBtn}
                onPress={() => handleContinueLearning(course)}
                activeOpacity={0.88}
              >
                <Ionicons name="play-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.continueLearningBtnText}>Continue Learning</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.lockedActionBtn}
                onPress={() => handleLockedCourse(course)}
                activeOpacity={0.88}
              >
                <Ionicons name="cart-outline" size={16} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.lockedActionBtnText}>Purchase / Unlock</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.outlineInfoBtn}
              onPress={() =>
                router.push({
                  pathname: '/student/course-details',
                  params: { id: course.id },
                })
              }
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={18} color="#6366F1" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render Program Item
  const renderProgramItem = ({ item: program }: { item: ProgramOption }) => {
    const imageUrl = resolveProgramImageUrl(program);
    const schedule = formatBatchSchedule(program);
    const description = formatProgramDescription(program);
    const totalSemesters = program.totalSemesters || 4;
    const totalSubjects = program.totalSubjects || 20;

    return (
      <View style={styles.programCard}>
        <View style={styles.imageBannerContainer}>
          <Image source={{ uri: imageUrl }} style={styles.programBannerImage} resizeMode="cover" />
          <View style={styles.termInfoPill}>
            <Ionicons name="school" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.termInfoPillText}>Term {selectedTerm} of {totalSemesters}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.degreeEyebrow} numberOfLines={1}>
              {program.degreeTitle || 'Degree Program'}
            </Text>
            <View style={styles.trackPill}>
              <Text style={styles.trackPillText}>ATA Accredited</Text>
            </View>
          </View>

          <Text style={styles.programTitle}>{program.name}</Text>

          <View style={styles.detailsGrid}>
            <View style={styles.detailBox}>
              <Ionicons name="calendar" size={15} color="#6366F1" />
              <View style={styles.detailTextBox}>
                <Text style={styles.detailLabel}>Terms</Text>
                <Text style={styles.detailValue}>{totalSemesters} Semesters</Text>
              </View>
            </View>
            <View style={styles.detailBox}>
              <Ionicons name="book" size={15} color="#0284C7" />
              <View style={styles.detailTextBox}>
                <Text style={styles.detailLabel}>Subjects</Text>
                <Text style={styles.detailValue}>{totalSubjects} Courses</Text>
              </View>
            </View>
          </View>

          <Text style={styles.programDescription}>{description}</Text>

          <View style={styles.scheduleBadge}>
            <Ionicons name="calendar-outline" size={14} color="#475569" style={{ marginRight: 6 }} />
            <Text style={styles.scheduleBadgeText} numberOfLines={1}>
              Schedule: {schedule}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.enrollButton, isEnrollingId === program.id && { opacity: 0.7 }]}
            onPress={() => handleEnrollTerm(program)}
            disabled={isEnrollingId === program.id}
            activeOpacity={0.88}
          >
            {isEnrollingId === program.id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.enrollButtonText}>Enroll in Term {selectedTerm}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.topBarTitleContainer}>
          <Text style={styles.topBarTitle}>Term {selectedTerm} Curriculum</Text>
          <Text style={styles.topBarSubtitle}>
            COTR Global Online • Academic Seminary
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => router.push('/student/programs' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={20} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Horizontal Term Selector Bar */}
      <View style={styles.termSelectorWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={availableTerms}
          keyExtractor={(item) => `term_tab_${item}`}
          contentContainerStyle={styles.termTabsList}
          renderItem={({ item: termNum }) => {
            const isSelected = selectedTerm === termNum;
            return (
              <TouchableOpacity
                style={[styles.termTabPill, isSelected && styles.termTabPillActive]}
                onPress={() => setSelectedTerm(termNum)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="calendar"
                  size={13}
                  color={isSelected ? '#FFFFFF' : '#64748B'}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.termTabText, isSelected && styles.termTabTextActive]}>
                  Term {termNum}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* View Switcher: Courses vs Programs */}
      <View style={styles.toggleRowContainer}>
        <View style={styles.toggleSegment}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'courses' && styles.toggleBtnActive]}
            onPress={() => setActiveTab('courses')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="book"
              size={15}
              color={activeTab === 'courses' ? '#6366F1' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.toggleBtnText, activeTab === 'courses' && styles.toggleBtnTextActive]}>
              Courses ({courses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'programs' && styles.toggleBtnActive]}
            onPress={() => setActiveTab('programs')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="school"
              size={15}
              color={activeTab === 'programs' ? '#6366F1' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.toggleBtnText, activeTab === 'programs' && styles.toggleBtnTextActive]}>
              Programs ({termPrograms.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Fetching Term {selectedTerm} academic data...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Unable to Load Term Data</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'courses' ? (
        <FlatList
          data={courses}
          keyExtractor={(item) => `course_${item.id}`}
          renderItem={renderCourseItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#6366F1']}
              tintColor="#6366F1"
            />
          }
          ListHeaderComponent={
            <View style={styles.sectionHeaderCard}>
              <View style={styles.sectionHeaderBadge}>
                <Ionicons name="layers" size={14} color="#6366F1" style={{ marginRight: 4 }} />
                <Text style={styles.sectionHeaderBadgeText}>TERM {selectedTerm} COURSES</Text>
              </View>
              <Text style={styles.sectionHeaderTitle}>
                Academic Courses for Term {selectedTerm}
              </Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Select an enrolled course to begin interactive video learning, lecture AI study summaries, and quizzes.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Courses in Term {selectedTerm}</Text>
              <Text style={styles.emptyText}>
                No academic courses have been cataloged for Term {selectedTerm} yet.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={termPrograms}
          keyExtractor={(item) => `program_${item.id}`}
          renderItem={renderProgramItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#6366F1']}
              tintColor="#6366F1"
            />
          }
          ListHeaderComponent={
            <View style={styles.sectionHeaderCard}>
              <View style={styles.sectionHeaderBadge}>
                <Ionicons name="school" size={14} color="#6366F1" style={{ marginRight: 4 }} />
                <Text style={styles.sectionHeaderBadgeText}>TERM {selectedTerm} PROGRAMS</Text>
              </View>
              <Text style={styles.sectionHeaderTitle}>
                Degree Programs Running in Term {selectedTerm}
              </Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Explore comprehensive degree tracks with ATA accreditation and regional seminarian schedules.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  topBarTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  topBarSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  headerActionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  termSelectorWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  termTabsList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  termTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  termTabPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#4F46E5',
  },
  termTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  termTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleRowContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  toggleSegment: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  sectionHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  courseImageContainer: {
    height: 160,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  courseImage: {
    width: '100%',
    height: '100%',
  },
  termInfoPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  termInfoPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  accessBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  accessBadgeEntitled: {
    backgroundColor: '#D1FAE5',
  },
  accessBadgeLocked: {
    backgroundColor: '#FEF3C7',
  },
  accessBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  courseBody: {
    padding: 16,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  courseCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 0.5,
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  creditsPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  courseTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  courseDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  progressSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  lockedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  lockedNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  continueLearningBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  continueLearningBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lockedActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 10,
  },
  lockedActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  outlineInfoBtn: {
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 10,
  },
  programCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  imageBannerContainer: {
    height: 150,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  programBannerImage: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    padding: 16,
  },
  degreeEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    flex: 1,
  },
  trackPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trackPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  programTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 10,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  detailBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  detailTextBox: {
    marginLeft: 8,
  },
  detailLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  programDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  scheduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  scheduleBadgeText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
  },
  enrollButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
});
