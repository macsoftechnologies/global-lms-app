import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardService } from '../../src/services/dashboardService';
import { AuthStorage } from '../../src/services/authStorage';
import { ProgramOption, StudentEnrollmentItem, StudentProgramEnrollment } from '../../src/types';
import { ENV } from '../../src/config/env';
import { useTheme } from '../../src/context/ThemeContext';

const COTR_LOGO = require('../../assets/logo.png');

/**
 * Clean Subject Item interface derived purely from backend API data
 */
export interface TermSubjectItem {
  id: string;
  title: string;
  code?: string;
  description?: string;
  credits?: number | string;
  creditHours?: number;
  examsCount?: number;
  isEnrolled: boolean;
  enrollmentStatus: string;
  termNumber: number;
  thumbnailUrl?: string;
}

/**
 * Resolves remote thumbnail URL against configured backend base URL
 */
export function resolveThumbnailUrl(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const backendBase = ENV.API_URL.replace(/\/api\/v1\/?$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${backendBase}${cleanPath}`;
}

export function resolveProgramImageUrl(program: ProgramOption): string {
  const rawUrl =
    program.imageUrl ||
    program.thumbnailUrl ||
    program.coverImage ||
    program.bannerUrl ||
    program.image;

  if (rawUrl) {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    const backendBase = ENV.API_URL.replace(/\/api\/v1\/?$/, '');
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${backendBase}${cleanPath}`;
  }
  return '';
}

export function formatBatchSchedule(program: ProgramOption): string {
  if (program.regionConfigs && program.regionConfigs.length > 0) {
    const config = program.regionConfigs[0];
    if (config.batchDateRanges && config.batchDateRanges.length > 0) {
      const ranges = config.batchDateRanges
        .map((r) => `${r.startMonth || 'Term'} – ${r.endMonth || 'Cycle'}`)
        .join(' • ');
      return ranges;
    }
  }
  return 'Standard Academic Calendar';
}

export function formatProgramDescription(program: ProgramOption): string {
  if (program.description && program.description.trim()) {
    return program.description.trim();
  }
  const semesters = program.totalSemesters || 1;
  const subjects = program.totalSubjects || 0;
  const years = program.maxDurationYears || 1;
  return `Academic curriculum structured across ${semesters} academic terms and ${subjects} subjects (${years} years duration).`;
}

/**
 * Status Access Mapping Helper
 * Evaluates whether an enrollment status grants learning player access
 */
export function doesStatusGrantAccess(status: string): boolean {
  const normalized = (status || '').toUpperCase();
  return ['ENROLLED', 'COMPLETED', 'ACTIVE', 'IN_PROGRESS', 'APPROVED', 'PAID'].includes(normalized);
}

export interface ProgramSemesterItem {
  id: string;
  name: string;
  termNumber: number;
  courseIds?: string[];
}

export default function StudentProgramsScreen() {
  const { isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { programId: routeProgramId, termNumber } = useLocalSearchParams<{ programId?: string; termNumber?: string }>();
  const initialTermNum = parseInt(termNumber || '1', 10) || 1;

  // State Management
  const [activeProgramId, setActiveProgramId] = useState<string | undefined>(routeProgramId);
  const [enrolledPrograms, setEnrolledPrograms] = useState<StudentProgramEnrollment[]>([]);
  const [activeProgram, setActiveProgram] = useState<ProgramOption | null>(null);
  const [semesters, setSemesters] = useState<ProgramSemesterItem[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [activeSemesterId, setActiveSemesterId] = useState<string>('');
  const [allCourses, setAllCourses] = useState<TermSubjectItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Complete Backend API Integration
   * Purely API-driven data loading with zero static/mock fallback
   */
  const loadCurriculumData = useCallback(async () => {
    try {
      setErrorMessage(null);

      // 1. Resolve Authenticated Student ID
      const user = await AuthStorage.getUser();
      const studentId = user?.id || 'me';

      // 2. Fetch Student Enrolled Programs and Course Enrollments
      const [programsRes, enrollmentsRes] = await Promise.all([
        DashboardService.getStudentPrograms(studentId),
        DashboardService.getStudentEnrollments(studentId),
      ]);

      const userPrograms = programsRes.data || [];
      setEnrolledPrograms(userPrograms);

      // Map confirmed enrollments by course ID with their actual backend status
      const enrollmentStatusMap = new Map<string, string>();
      const enrolledSet = new Set<string>();
      const enrolledList: StudentEnrollmentItem[] = enrollmentsRes.data || [];
      for (const e of enrolledList) {
        const rawStatus = (e.status || 'ACTIVE').toUpperCase();
        const cId = (e as any).courseId?._id || (e as any).courseId?.id || e.courseId || e.course?.id;
        if (cId) {
          const strId = String(cId);
          enrolledSet.add(strId);
          enrollmentStatusMap.set(strId, rawStatus);
        }
      }

      // 3. Determine Active Program ID strictly from student enrollment or explicit route param
      let targetProgramId = '';
      if (activeProgramId && userPrograms.some((p) => (p.programId || p.program?.id || p.id) === activeProgramId)) {
        targetProgramId = activeProgramId;
      } else if (userPrograms.length > 0) {
        const first = userPrograms[0];
        targetProgramId = first.programId || first.program?.id || first.id || '';
      } else if (activeProgramId) {
        targetProgramId = activeProgramId;
      } else if ((user as any)?.programId) {
        targetProgramId = (user as any).programId;
      }

      // If student is not enrolled in any program and no program ID can be resolved:
      if (!targetProgramId) {
        setActiveProgram(null);
        setSemesters([]);
        setAllCourses([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // 4. Fetch Program Details, Program Semesters, and Program Courses in parallel
      const [programDetailsRes, semestersRes, coursesRes] = await Promise.all([
        DashboardService.getProgramById(targetProgramId),
        DashboardService.getSemestersForProgram(targetProgramId),
        DashboardService.getCoursesForProgram(targetProgramId),
      ]);

      if (!programDetailsRes.success || !programDetailsRes.data) {
        throw new Error(programDetailsRes.error || 'Failed to load program details from backend.');
      }

      const programData: ProgramOption = programDetailsRes.data;
      setActiveProgram(programData);

      // 5. Build Academic Terms (Semesters) strictly from backend API
      let rawSemesters: any[] = semestersRes.data || [];
      if (rawSemesters.length === 0 && programData && Array.isArray((programData as any).semesters)) {
        rawSemesters = (programData as any).semesters;
      }

      // If backend returned semesters array, filter for this program and sort by term number
      let parsedSemesters: ProgramSemesterItem[] = [];
      if (rawSemesters.length > 0) {
        const filteredSems = rawSemesters.filter((s) => s.programId === targetProgramId || !s.programId);
        filteredSems.sort((a, b) => {
          const numA = parseInt((a.name || a.term || String(a.semesterNumber) || '').replace(/\D/g, '')) || 0;
          const numB = parseInt((b.name || b.term || String(b.semesterNumber) || '').replace(/\D/g, '')) || 0;
          return numA - numB;
        });

        parsedSemesters = filteredSems.map((s, idx) => {
          const semNum = Number(s.semesterNumber || s.termNumber || parseInt((s.name || '').replace(/\D/g, '')) || idx + 1);
          const semName = (s.name || s.term || `Term ${semNum}`).replace(/semester/i, 'Term');
          return {
            id: String(s.id || s._id || `term-${semNum}`),
            name: semName,
            termNumber: semNum,
            courseIds: Array.isArray(s.courseIds)
              ? s.courseIds.map(String)
              : Array.isArray(s.courses)
              ? s.courses.map((c: any) => String(c.id || c._id || c))
              : undefined,
          };
        });
      }

      // If no semesters objects exist in backend, construct from totalSemesters definition
      if (parsedSemesters.length === 0) {
        const total = programData.totalSemesters || 1;
        for (let t = 1; t <= total; t++) {
          parsedSemesters.push({
            id: `term-${t}`,
            name: `Term ${t}`,
            termNumber: t,
          });
        }
      }

      setSemesters(parsedSemesters);

      // Resolve the student's active semester ID
      const userActiveSemId =
        (user as any)?.semesterId ||
        userPrograms.find((p) => (p.programId || p.program?.id) === targetProgramId)?.batch?.id ||
        parsedSemesters[0]?.id ||
        '';
      setActiveSemesterId(userActiveSemId);

      // Select initial semester: either matching active semester or matching initialTermNum
      const matchedInitialSem =
        parsedSemesters.find((s) => s.termNumber === initialTermNum) ||
        parsedSemesters.find((s) => s.id === userActiveSemId) ||
        parsedSemesters[0];
      if (matchedInitialSem) {
        setSelectedSemesterId(matchedInitialSem.id);
      }

      // 6. Map Courses strictly from backend
      let rawCourses: any[] = coursesRes.data || [];
      if (rawCourses.length === 0 && enrolledList.length > 0) {
        rawCourses = enrolledList.map((e) => e.course || e).filter(Boolean);
      }

      const mappedCourses: TermSubjectItem[] = rawCourses.map((raw) => {
        const courseId = String(
          (raw.course && (raw.course.id || raw.course._id)) ||
          (raw.courseId && typeof raw.courseId === 'object' && (raw.courseId.id || raw.courseId._id)) ||
          (typeof raw.courseId === 'string' && raw.courseId) ||
          raw.id ||
          raw._id ||
          ''
        );
        const title = raw.title || raw.name || raw.course?.title || 'Academic Course';
        const code = raw.code || raw.course?.code;
        const description = raw.description || raw.course?.description;
        const credits = raw.credits ?? raw.creditHours ?? raw.course?.credits ?? '3.00.00';
        const creditHours = raw.creditHours ?? raw.course?.creditHours ?? 3;
        const examsCount = raw.examsCount ?? raw.totalExams ?? raw.course?.examsCount ?? 0;
        const thumbnailUrl = raw.thumbnailUrl || raw.thumbnail || raw.course?.thumbnailUrl;

        const backendStatus =
          enrollmentStatusMap.get(courseId) ||
          (enrolledSet.has(courseId) ? 'ENROLLED' : 'LOCKED');
        const isEnrolled = doesStatusGrantAccess(backendStatus);

        const rawSemId = raw.semesterId || raw.semester?.id || raw.semester?._id || raw.course?.semesterId;
        const semNum = Number(raw.termNumber || raw.semesterNumber || raw.term || raw.semester?.semesterNumber || 0);

        return {
          id: courseId,
          title,
          code,
          description,
          credits,
          creditHours,
          examsCount,
          isEnrolled,
          enrollmentStatus: backendStatus,
          termNumber: semNum,
          thumbnailUrl,
          semesterId: rawSemId ? String(rawSemId) : undefined,
        } as TermSubjectItem & { semesterId?: string };
      });

      setAllCourses(mappedCourses);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect to backend.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeProgramId, initialTermNum]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      await loadCurriculumData();
    });
    return () => {
      isMounted = false;
    };
  }, [loadCurriculumData]);

  // Automatically re-fetch curriculum on screen focus (e.g. returning after purchasing a course)
  useFocusEffect(
    useCallback(() => {
      loadCurriculumData();
    }, [loadCurriculumData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCurriculumData();
  };

  // Selected Semester Object
  const selectedSemester = useMemo(() => {
    return semesters.find((s) => s.id === selectedSemesterId) || semesters[0] || null;
  }, [semesters, selectedSemesterId]);

  // Current Subjects for Selected Semester strictly using backend relationship
  const currentSubjects = useMemo(() => {
    if (!selectedSemester) return [];
    return allCourses.filter((course: any) => {
      // 1. Direct courseIds array in semester definition
      if (selectedSemester.courseIds && selectedSemester.courseIds.length > 0) {
        return selectedSemester.courseIds.includes(course.id);
      }
      // 2. Direct semesterId match
      if (course.semesterId && selectedSemester.id) {
        return course.semesterId === selectedSemester.id;
      }
      // 3. Semester number match
      const courseSemNum = Number(course.termNumber || course.semesterNumber);
      if (courseSemNum > 0 && selectedSemester.termNumber > 0 && courseSemNum === selectedSemester.termNumber) {
        return true;
      }
      return false;
    });
  }, [allCourses, selectedSemester]);

  // Subject count for any semester chip
  const getSemesterSubjectCount = useCallback(
    (sem: ProgramSemesterItem) => {
      if (sem.courseIds && sem.courseIds.length > 0) {
        return sem.courseIds.length;
      }
      return allCourses.filter((course: any) => {
        if (course.semesterId && sem.id) return course.semesterId === sem.id;
        const courseSemNum = Number(course.termNumber || course.semesterNumber);
        return courseSemNum > 0 && sem.termNumber > 0 && courseSemNum === sem.termNumber;
      }).length;
    },
    [allCourses]
  );

  // Enrolled subjects count in current term
  const enrolledCountInSelectedTerm = useMemo(() => {
    return currentSubjects.filter((s) => s.isEnrolled).length;
  }, [currentSubjects]);

  // Is all subjects enrolled in selected term
  const isAllEnrolledInSelectedTerm = useMemo(() => {
    return currentSubjects.length > 0 && currentSubjects.every((s) => s.isEnrolled);
  }, [currentSubjects]);

  // Has at least one enrolled subject in selected term
  const isSelectedTermEnrolled = useMemo(() => {
    return enrolledCountInSelectedTerm > 0;
  }, [enrolledCountInSelectedTerm]);

  // Is this the student's Active Term?
  const isCurrentActiveTerm = useMemo(() => {
    if (!selectedSemester) return false;
    return selectedSemester.id === activeSemesterId || semesters[0]?.id === selectedSemester.id;
  }, [selectedSemester, activeSemesterId, semesters]);

  // Navigate to Course Learning screen (ONLY for Accessible / Enrolled courses)
  const handleContinueLearning = (subject: TermSubjectItem) => {
    const targetCourseId = (subject as any).courseId || subject.id;
    if (!targetCourseId) {
      Alert.alert(
        'Course Unavailable',
        'Unable to resolve the backend course ID for this subject.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!subject.isEnrolled) {
      Alert.alert(
        'Access Restricted',
        `Enrollment in "${subject.title}" is not yet confirmed. Contact the academic office or complete enrollment to unlock lessons.`,
        [{ text: 'OK' }]
      );
      return;
    }

    router.push({
      pathname: '/student/learn',
      params: {
        id: targetCourseId,
        courseId: targetCourseId,
        title: subject.title,
        programId: activeProgram?.id,
      },
    });
  };

  // Handle Locked Course tap -> Directly navigate to Course Details
  const handleLockedCoursePress = (subject: TermSubjectItem) => {
    const targetCourseId = (subject as any).courseId || subject.id;
    if (!targetCourseId) {
      Alert.alert(
        'Course Unavailable',
        'Unable to resolve the backend course ID for this locked subject.',
        [{ text: 'OK' }]
      );
      return;
    }

    router.push({
      pathname: '/student/course-details',
      params: {
        id: targetCourseId,
        courseId: targetCourseId,
        title: subject.title,
        isEnrolled: 'false',
        isLocked: 'true',
        enrollmentStatus: subject.enrollmentStatus || 'LOCKED',
        programId: activeProgram?.id || '',
      },
    });
  };

  // Render individual Subject Card specifically formatted for React Native Mobile
  const renderSubjectCard = (subject: TermSubjectItem) => {
    const remoteImage = resolveThumbnailUrl(subject.thumbnailUrl);
    const isAccessible = subject.isEnrolled;

    return (
      <TouchableOpacity
        key={subject.id}
        style={[
          styles.subjectCard,
          isAccessible ? styles.subjectCardAccessible : styles.subjectCardLocked,
        ]}
        activeOpacity={isAccessible ? 1 : 0.88}
        onPress={() => {
          if (!isAccessible) {
            handleLockedCoursePress(subject);
          }
        }}
      >
        {/* Course Thumbnail Container with Mobile Optimized Banner */}
        <View style={styles.thumbnailContainer}>
          {remoteImage ? (
            <Image
              source={{ uri: remoteImage }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <Image source={COTR_LOGO} style={styles.fallbackLogoImage} resizeMode="contain" />
          )}

          {/* Locked Scrim Overlay if not enrolled */}
          {!isAccessible && (
            <View style={styles.lockedScrimOverlay}>
              <View style={styles.lockedIconPill}>
                <Ionicons name="lock-closed" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.lockedPillText}>Content Locked</Text>
              </View>
            </View>
          )}

          {/* Access Badge on Top-Right of Thumbnail */}
          <View style={styles.thumbnailBadgePosition}>
            {isAccessible ? (
              <View style={styles.enrolledStatusChip}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.enrolledStatusChipText}>
                  {subject.enrollmentStatus === 'COMPLETED' ? 'Completed' : 'Enrolled'}
                </Text>
              </View>
            ) : (
              <View style={styles.lockedStatusChip}>
                <Ionicons name="lock-closed" size={12} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.lockedStatusChipText}>
                  {subject.enrollmentStatus === 'PENDING' ? 'Pending Approval' : 'Not Enrolled'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.subjectTitle,
                !isAccessible && styles.subjectTitleLocked,
              ]}
              numberOfLines={2}
            >
              {subject.title}
            </Text>
            {isAccessible ? (
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            ) : (
              <Ionicons name="lock-closed" size={18} color="#94A3B8" />
            )}
          </View>

          {/* Description if returned by backend */}
          {subject.description ? (
            <Text style={styles.subjectDescription} numberOfLines={2}>
              {subject.description}
            </Text>
          ) : null}

          {/* Metadata Chips: Credits, Exams, and Subject Code strictly from Backend */}
          <View style={styles.metaRow}>
            {subject.code ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{subject.code}</Text>
              </View>
            ) : null}

            {subject.credits !== undefined && subject.credits !== null && (
              <View style={styles.metaChip}>
                <Ionicons name="school-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.metaChipText}>{subject.credits} Credits</Text>
              </View>
            )}

            {subject.examsCount !== undefined && subject.examsCount !== null && (
              <View style={styles.metaChip}>
                <Ionicons name="document-text-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.metaChipText}>{subject.examsCount} Exams</Text>
              </View>
            )}

            {isAccessible && (
              <View style={[styles.metaChip, { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkmark-circle" size={12} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={[styles.metaChipText, { color: '#059669', fontWeight: '600' }]}>
                  {subject.enrollmentStatus === 'COMPLETED' ? 'Completed' : 'Enrolled'}
                </Text>
              </View>
            )}
          </View>

          {/* Callout Notice for Locked Courses */}
          {!isAccessible && (
            <View style={styles.lockedNoticeBox}>
              <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.lockedNoticeText}>
                {subject.enrollmentStatus === 'PENDING'
                  ? 'Your admission is currently pending review. Lessons will unlock once approved.'
                  : 'Enrollment required. Contact academic advisor to unlock lectures and learning materials.'}
              </Text>
            </View>
          )}

          {/* Action Button: Continue Learning (Accessible) vs Locked Button */}
          {isAccessible ? (
            <TouchableOpacity
              style={styles.continueLearningBtn}
              onPress={() => handleContinueLearning(subject)}
              activeOpacity={0.88}
            >
              <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.continueLearningBtnText}>Continue Learning</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.lockedBtn}
              onPress={() => handleLockedCoursePress(subject)}
              activeOpacity={0.8}
            >
              <Ionicons name="lock-closed" size={15} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.lockedBtnText}>Course Locked • View Details</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render Horizontal Academic Terms Selector for Mobile Screens
  const renderHorizontalTermsSelector = () => {
    return (
      <View style={styles.termsSelectorSection}>
        <View style={styles.termsHeaderRow}>
          <View style={styles.termsTitleGroup}>
            <Ionicons name="layers-outline" size={18} color="#7C3AED" style={{ marginRight: 6 }} />
            <Text style={styles.termsSectionTitle}>Academic Terms</Text>
          </View>
          <View style={styles.termsCountBadge}>
            <Text style={styles.termsCountBadgeText}>{semesters.length} Terms</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.termsScrollContainer}
        >
          {semesters.map((sem) => {
            const isSelected = selectedSemesterId === sem.id;
            const count = getSemesterSubjectCount(sem);
            const isActive = sem.id === activeSemesterId;

            return (
              <TouchableOpacity
                key={`term_chip_${sem.id}`}
                style={[
                  styles.termChip,
                  isSelected && styles.termChipActive,
                ]}
                onPress={() => setSelectedSemesterId(sem.id)}
                activeOpacity={0.8}
              >
                <View style={styles.termChipTopRow}>
                  <View
                    style={[
                      styles.indicatorDot,
                      { backgroundColor: isActive ? '#10B981' : '#94A3B8' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.termChipTitle,
                      isSelected && styles.termChipTitleActive,
                    ]}
                  >
                    {sem.name}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.termChipSubtitle,
                    isSelected && styles.termChipSubtitleActive,
                  ]}
                >
                  {count} {count === 1 ? 'Subject' : 'Subjects'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top', 'bottom']}>
      {/* Top Mobile Header */}
      <View style={[styles.topHeader, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1F2937' }]}>
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
            style={[styles.backButton, isDarkMode && { backgroundColor: '#1E293B' }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={[styles.pageTitle, isDarkMode && { color: '#F8FAFC' }]} numberOfLines={1}>Academic Curriculum & Term Subjects</Text>
            <Text style={[styles.pageSubtitle, isDarkMode && { color: '#94A3B8' }]} numberOfLines={1}>
              {activeProgram?.name
                ? `${activeProgram.name} • Select courses or enroll in your active term pack.`
                : 'Select courses or enroll in your active term pack (5 subjects per term).'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.refreshIconBtn, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        </View>

        {/* Multi-Program Switcher if student is enrolled in more than one program */}
        {enrolledPrograms.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.programSwitcherContainer}
          >
            {enrolledPrograms.map((ep) => {
              const pId = ep.programId || ep.program?.id;
              const isSelected = activeProgram?.id === pId;
              return (
                <TouchableOpacity
                  key={ep.id || pId}
                  style={[styles.programPill, isSelected && styles.programPillActive]}
                  onPress={() => {
                    if (pId) {
                      setActiveProgramId(pId);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.programPillText, isSelected && styles.programPillTextActive]}>
                    {ep.program?.name || 'Program'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Main Responsive Body */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Fetching curriculum from backend...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={54} color="#EF4444" />
          <Text style={styles.errorTitle}>Unable to Load Curriculum</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadCurriculumData}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : !activeProgram ? (
        <View style={styles.centerContainer}>
          <Ionicons name="school-outline" size={56} color="#7C3AED" />
          <Text style={styles.errorTitle}>No Active Degree Program</Text>
          <Text style={styles.errorMessage}>
            Your student account is not currently enrolled in any academic degree program.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => router.replace('/(student-tabs)/dashboard')}
          >
            <Text style={styles.retryBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#7C3AED']}
              tintColor="#7C3AED"
            />
          }
        >
          {/* 1. Horizontal Terms Selector for Mobile */}
          {renderHorizontalTermsSelector()}

          {/* 2. Active Term Status Banner */}
          <View style={styles.termBannerCard}>
            <View style={styles.termBannerHeaderRow}>
              <Text style={styles.termBannerTitle}>
                {selectedSemester ? selectedSemester.name : 'Curriculum'} — {currentSubjects.length}{' '}
                {currentSubjects.length === 1 ? 'Subject' : 'Subjects'}
              </Text>

              {isCurrentActiveTerm ? (
                <View style={styles.activeTermBadge}>
                  <View style={styles.activeTermDot} />
                  <Text style={styles.activeTermBadgeText}>Active Term</Text>
                </View>
              ) : (
                <View style={styles.lockedTermBadge}>
                  <Ionicons name="lock-closed" size={11} color="#64748B" style={{ marginRight: 4 }} />
                  <Text style={styles.lockedTermBadgeText}>Upcoming Term</Text>
                </View>
              )}
            </View>

            <Text style={styles.enrolledStatusNotice}>
              {isCurrentActiveTerm
                ? isAllEnrolledInSelectedTerm
                  ? '✓ You are enrolled in all subjects for this term'
                  : isSelectedTermEnrolled
                  ? `✓ Enrolled in ${enrolledCountInSelectedTerm} of ${currentSubjects.length} subjects for this term`
                  : `${currentSubjects.length} subjects available to enroll`
                : 'This term will unlock in the next academic cycle. You can preview subjects below.'}
            </Text>
          </View>

          {/* 3. Subject Cards List */}
          {currentSubjects.length === 0 ? (
            <View style={styles.emptyTermContainer}>
              <Ionicons name="folder-open-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyTermTitle}>No Subjects Found</Text>
              <Text style={styles.emptyTermText}>
                No subjects are currently assigned to {selectedSemester?.name || 'this term'} in the backend curriculum.
              </Text>
            </View>
          ) : (
            <View style={isTablet ? styles.tabletGridContainer : styles.mobileListContainer}>
              {currentSubjects.map((sub) => renderSubjectCard(sub))}
            </View>
          )}

          {/* Footer Copyright */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>
              © 2026 Cotr Global Online. All rights reserved.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    marginHorizontal: 12,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  programSwitcherContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  programPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  programPillActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#7C3AED',
  },
  programPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  programPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  termsSelectorSection: {
    marginBottom: 16,
  },
  termsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  termsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  termsSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  termsCountBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  termsCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  termsScrollContainer: {
    gap: 10,
    paddingVertical: 2,
  },
  termChip: {
    minWidth: 105,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  termChipActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF',
  },
  termChipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  termChipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  termChipTitleActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  termChipSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  termChipSubtitleActive: {
    color: '#6D28D9',
    fontWeight: '600',
  },
  termBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  termBannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  termBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeTermBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeTermDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 6,
  },
  activeTermBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  lockedTermBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockedTermBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  enrolledStatusNotice: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 18,
  },
  mobileListContainer: {
    gap: 16,
  },
  tabletGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  subjectCardAccessible: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  subjectCardLocked: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
  },
  thumbnailContainer: {
    height: 170,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  fallbackLogoImage: {
    width: 140,
    height: 140,
  },
  lockedScrimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  lockedPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  thumbnailBadgePosition: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  enrolledStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  enrolledStatusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  lockedStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  lockedStatusChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  cardBody: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subjectTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 8,
    lineHeight: 22,
  },
  subjectTitleLocked: {
    color: '#475569',
  },
  subjectDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  lockedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  lockedNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  continueLearningBtn: {
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  continueLearningBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  lockedBtn: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  unassignedSection: {
    marginTop: 20,
  },
  unassignedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  emptyTermContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTermTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyTermText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
