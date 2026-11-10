import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardService } from '../../src/services/dashboardService';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import {
  StudentEnrollmentItem,
  ProgramOption,
  MyGradesResponse,
  ExamResultItem,
  ExamAttemptItem,
  AttemptReviewResponse,
  VideoQuizResultItem,
  CyclicSemesterStatusResponse,
} from '../../src/types';
import { useTheme } from '../../src/context/ThemeContext';

/**
 * Standard Global LMS / ATA Grading Scale Point Conversion (J9 from Website)
 * A+: 4.3 | A: 4.0 | A-: 3.7 | B+: 3.3 | B: 3.0 | B-: 2.7 | C+: 2.3 | C: 2.0 | C-: 1.7 | F: 0.0
 */
function getGradePoints(grade?: string): number {
  if (!grade) return 0;
  const clean = grade.trim().toUpperCase();
  const scale: Record<string, number> = {
    'A+': 4.3,
    A: 4.0,
    'A-': 3.7,
    'B+': 3.3,
    B: 3.0,
    'B-': 2.7,
    'C+': 2.3,
    C: 2.0,
    'C-': 1.7,
    F: 0.0,
    'F+': 0.0,
  };
  return scale[clean] ?? 0;
}

type ResultsTabKey = 'progress' | 'transcripts' | 'final' | 'attempts' | 'video';

interface TabItem {
  key: ResultsTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const RESULTS_TABS: TabItem[] = [
  { key: 'progress', label: 'Degree Progress & Status', icon: 'ribbon-outline' },
  { key: 'transcripts', label: 'Official Grades & Transcripts', icon: 'document-text-outline' },
  { key: 'final', label: 'Final Exam Results', icon: 'trophy-outline' },
  { key: 'attempts', label: 'Exam & Quiz Attempts', icon: 'time-outline' },
  { key: 'video', label: 'In-Video Quizzes', icon: 'videocam-outline' },
];

export default function StudentResultsScreen() {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<ResultsTabKey>('progress');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authenticated User & Enrolled Programs
  const [userProfile, setUserProfile] = useState<AuthSession['user'] | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<StudentEnrollmentItem[]>([]);
  const [, setPublishedPrograms] = useState<ProgramOption[]>([]);
  const [activeProgram, setActiveProgram] = useState<ProgramOption | null>(null);

  // Results & Records States
  const [gradesData, setGradesData] = useState<MyGradesResponse>({ grades: [] });
  const [finalResults, setFinalResults] = useState<ExamResultItem[]>([]);
  const [attemptsList, setAttemptsList] = useState<ExamAttemptItem[]>([]);
  const [videoQuizzes, setVideoQuizzes] = useState<VideoQuizResultItem[]>([]);
  const [cyclicStatus, setCyclicStatus] = useState<CyclicSemesterStatusResponse | null>(null);

  // Review Modal State
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttemptItem | null>(null);
  const [reviewData, setReviewData] = useState<AttemptReviewResponse | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState<boolean>(false);
  const [isReviewModalVisible, setIsReviewModalVisible] = useState<boolean>(false);

  // 1. Fetch All Backend Results & Progress Data in Parallel
  const loadResultsData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const user = await AuthStorage.getUser();
      setUserProfile(user);
      const studentId = user?.id || 'me';

      const [
        enrollmentsRes,
        programsRes,
        gradesRes,
        finalRes,
        attemptsRes,
        videoQuizRes,
        publicProgramsRes,
      ] = await Promise.allSettled([
        DashboardService.getStudentEnrollments(studentId),
        DashboardService.getStudentPrograms(studentId),
        DashboardService.getMyGrades(),
        DashboardService.getFinalExamResults(),
        DashboardService.getStudentAttempts(),
        DashboardService.getVideoQuizResults(),
        DashboardService.getPublicPrograms(),
      ]);

      // Enrollments
      let courses: StudentEnrollmentItem[] = [];
      if (enrollmentsRes.status === 'fulfilled' && enrollmentsRes.value.success) {
        courses = enrollmentsRes.value.data || [];
        setEnrolledCourses(courses);
      }

      // Public & Enrolled Programs
      let allProgs: ProgramOption[] = [];
      if (publicProgramsRes.status === 'fulfilled' && publicProgramsRes.value.success) {
        allProgs = publicProgramsRes.value.data || [];
        setPublishedPrograms(allProgs);
      }

      let enrolledProgsList: any[] = [];
      if (programsRes.status === 'fulfilled' && programsRes.value.success) {
        enrolledProgsList = programsRes.value.data || [];
      }

      // Resolve Enrolled Program strictly matching Website logic
      const targetProgram =
        allProgs.find(
          (p) =>
            p.id === (user as any)?.programId ||
            (p as any)._id === (user as any)?.programId ||
            p.name?.toLowerCase().trim() === String((user as any)?.customProfile?.interestedCourse || '').toLowerCase().trim() ||
            (courses[0]?.programId && (p.id === courses[0].programId || (p as any)._id === courses[0].programId))
        ) ||
        (enrolledProgsList[0]?.program ? enrolledProgsList[0].program : enrolledProgsList[0]) ||
        allProgs[0] ||
        null;

      setActiveProgram(targetProgram);

      // Cyclic Semester Status
      if (targetProgram?.id) {
        try {
          const cyclicRes = await DashboardService.getCyclicSemesterStatus(studentId, targetProgram.id);
          if (cyclicRes.success && cyclicRes.data) {
            setCyclicStatus(cyclicRes.data);
          }
        } catch {
          // Keep null if not configured
        }
      }

      // Official Grades / Transcript
      if (gradesRes.status === 'fulfilled' && gradesRes.value.success && gradesRes.value.data) {
        setGradesData(gradesRes.value.data);
      }

      // Final Exam Results
      if (finalRes.status === 'fulfilled' && finalRes.value.success) {
        setFinalResults(finalRes.value.data || []);
      }

      // Exam Attempts
      if (attemptsRes.status === 'fulfilled' && attemptsRes.value.success) {
        setAttemptsList(attemptsRes.value.data || []);
      }

      // Video Quizzes
      if (videoQuizRes.status === 'fulfilled' && videoQuizRes.value.success) {
        setVideoQuizzes(videoQuizRes.value.data || []);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect to Global LMS server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      await loadResultsData();
    });
    return () => {
      isMounted = false;
    };
  }, [loadResultsData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadResultsData();
  };

  // 2. Computed Degree Progress Statistics strictly from Backend Data
  const progressStats = useMemo(() => {
    const completedCourses = enrolledCourses.filter(
      (c) => c.status === 'COMPLETED' || (c.progressPercentage ?? 0) >= 100
    );
    const completedCount = completedCourses.length;

    // Total subjects from active curriculum or default
    const totalSubjects = activeProgram?.totalSubjects || (enrolledCourses.length > 0 ? Math.max(enrolledCourses.length, 20) : 20);
    const pendingCount = Math.max(0, totalSubjects - completedCount);
    const completionPercentage = totalSubjects > 0 ? Math.min(100, Math.round((completedCount / totalSubjects) * 100)) : 0;

    // GPA calculations from official grades
    let totalCredits = 0;
    let totalScoreSum = 0;
    let qualityPointsSum = 0;

    (gradesData.grades || []).forEach((gr) => {
      const cr = Number(gr.course?.credits || gr.credits || 3);
      totalCredits += cr;
      totalScoreSum += Number(gr.totalScore || 0);
      const points = getGradePoints(gr.grade);
      qualityPointsSum += points * cr;
    });

    const cumulativeGpa =
      totalCredits > 0
        ? (qualityPointsSum / totalCredits).toFixed(1)
        : gradesData.cumulativeGpa
        ? String(gradesData.cumulativeGpa)
        : '0.0';

    return {
      completedCount,
      totalSubjects,
      pendingCount,
      completionPercentage,
      totalCredits,
      totalScoreSum,
      cumulativeGpa,
      programTitle: activeProgram?.name || activeProgram?.degreeTitle || 'Degree Curriculum',
    };
  }, [enrolledCourses, activeProgram, gradesData]);

  // 3. Open Attempt Review Handler
  const handleOpenReview = async (attempt: ExamAttemptItem) => {
    setSelectedAttempt(attempt);
    setIsReviewModalVisible(true);
    setIsLoadingReview(true);
    setReviewData(null);

    try {
      const examId = typeof attempt.examId === 'object' ? attempt.examId?.id || (attempt.examId as any)?._id : attempt.examId;
      const attemptId = attempt.id || (attempt as any)._id;

      if (examId && attemptId) {
        const res = await DashboardService.getExamAttemptReview(examId, attemptId);
        if (res.success && res.data) {
          setReviewData(res.data);
        }
      }
    } catch {
      // Review not available or failed
    } finally {
      setIsLoadingReview(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top', 'bottom']}>
      {/* Top Header / App Bar */}
      <View style={[styles.topBar, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1F2937' }]}>
        <TouchableOpacity
          style={[styles.backButton, isDarkMode && { backgroundColor: '#1E293B' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
        </TouchableOpacity>

        <View style={styles.topBarTitleGroup}>
          <Text style={styles.eyebrowText}>ACADEMIC PERFORMANCE & RECORDS</Text>
          <Text style={[styles.pageTitle, isDarkMode && { color: '#F8FAFC' }]} numberOfLines={1}>
            My Results & Degree Progress
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshButton, isDarkMode && { backgroundColor: '#1E293B' }]}
          onPress={handleRefresh}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
        </TouchableOpacity>
      </View>

      {/* Subtitle Bar matching Website */}
      <View style={[styles.subtitleContainer, isDarkMode && { backgroundColor: '#161F30' }]}>
        <Text style={[styles.subtitleText, isDarkMode && { color: '#94A3B8' }]}>
          Track your degree completion, completed vs pending subjects, and comprehensive examination grades.
        </Text>
      </View>

      {/* 5 Horizontal Scrollable Tabs matching Website */}
      <View style={[styles.tabsWrapper, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1F2937' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {RESULTS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? '#818CF8' : isDarkMode ? '#94A3B8' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, isActive ? styles.tabTextActive : isDarkMode && { color: '#94A3B8' }]}>
                  {tab.label}
                </Text>
                {isActive && <View style={[styles.tabIndicator, isDarkMode && { backgroundColor: '#818CF8' }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Body */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Fetching results & transcripts from backend...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Unable to Load Results</Text>
          <Text style={styles.errorSub}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#4F46E5"
              colors={['#4F46E5']}
            />
          }
        >
          {/* TAB 1: DEGREE PROGRESS & STATUS */}
          {activeTab === 'progress' && (
            <View style={styles.tabContentBlock}>
              {/* Four Summary Cards matching Website UI */}
              <View style={styles.summaryGrid}>
                {/* Card 1: Enrolled Degree Program */}
                <View style={[styles.summaryCard, styles.cardBorderPurple]}>
                  <Text style={styles.cardEyebrow}>ENROLLED DEGREE PROGRAM</Text>
                  <Text style={styles.cardHeading} numberOfLines={2}>
                    {progressStats.programTitle}
                  </Text>
                  <Text style={styles.cardSubPurple}>Active Student Status</Text>
                </View>

                {/* Card 2: Completed Subjects */}
                <View style={[styles.summaryCard, styles.cardBorderGreen]}>
                  <Text style={styles.cardEyebrow}>COMPLETED SUBJECTS</Text>
                  <View style={styles.valueRow}>
                    <Text style={styles.cardValueGreen}>{progressStats.completedCount}</Text>
                    <Text style={styles.cardValueTotal}> / {progressStats.totalSubjects}</Text>
                  </View>
                  <Text style={styles.cardSubGreen}>Passed & Accredited</Text>
                </View>

                {/* Card 3: Pending / In-Progress */}
                <View style={[styles.summaryCard, styles.cardBorderOrange]}>
                  <Text style={styles.cardEyebrow}>PENDING / IN-PROGRESS</Text>
                  <View style={styles.valueRow}>
                    <Text style={styles.cardValueOrange}>{progressStats.pendingCount}</Text>
                    <Text style={styles.cardValueSubText}> Subjects Remaining</Text>
                  </View>
                  <Text style={styles.cardSubOrange}>To Complete Degree</Text>
                </View>

                {/* Card 4: Cumulative GPA */}
                <View style={[styles.summaryCard, styles.cardBorderViolet]}>
                  <Text style={styles.cardEyebrow}>CUMULATIVE GPA</Text>
                  <View style={styles.valueRow}>
                    <Text style={styles.cardValueViolet}>{progressStats.cumulativeGpa}</Text>
                    <Text style={styles.cardValueTotal}> / 4.3</Text>
                  </View>
                  <Text style={styles.cardSubViolet}>
                    {progressStats.totalCredits} Total Credits Earned
                  </Text>
                </View>
              </View>

              {/* Card 5: Degree Completion Progress */}
              <View style={styles.cardBox}>
                <View style={styles.cardHeaderBetween}>
                  <Text style={styles.boxTitle}>Degree Completion Progress</Text>
                  <Text style={styles.boxProgressPercentage}>
                    {progressStats.completionPercentage}% Complete
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.max(2, progressStats.completionPercentage)}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Semester Progression (Cyclic Status) if returned by Backend */}
              {cyclicStatus && Array.isArray(cyclicStatus.semesters) && cyclicStatus.semesters.length > 0 && (
                <View style={styles.cardBox}>
                  <Text style={styles.boxTitle}>Academic Semester Progression</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    <View style={styles.cyclicTermsRow}>
                      {cyclicStatus.semesters.map((sem, idx) => {
                        const isCurrent = sem.status === 'CURRENT';
                        const isDone = sem.status === 'COMPLETED';
                        return (
                          <View
                            key={sem.semesterId || `sem_${idx}`}
                            style={[
                              styles.cyclicTermPill,
                              isCurrent && styles.cyclicTermPillCurrent,
                              isDone && styles.cyclicTermPillDone,
                            ]}
                          >
                            <Ionicons
                              name={isDone ? 'checkmark-circle' : isCurrent ? 'time' : 'ellipse-outline'}
                              size={14}
                              color={isDone ? '#059669' : isCurrent ? '#4F46E5' : '#94A3B8'}
                              style={{ marginRight: 5 }}
                            />
                            <Text
                              style={[
                                styles.cyclicTermText,
                                isCurrent && styles.cyclicTermTextCurrent,
                                isDone && styles.cyclicTermTextDone,
                              ]}
                            >
                              {sem.name || `Term ${sem.semesterNumber || idx + 1}`}
                            </Text>
                            <View
                              style={[
                                styles.cyclicStatusBadge,
                                isDone ? styles.badgeGreen : isCurrent ? styles.badgePurple : styles.badgeGrey,
                              ]}
                            >
                              <Text style={styles.cyclicBadgeText}>
                                {isDone ? 'DONE' : isCurrent ? 'ACTIVE' : 'UPCOMING'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Card 6: Course & Subject Completion Breakdown */}
              <View style={styles.cardBox}>
                <Text style={styles.boxTitle}>Course & Subject Completion Breakdown</Text>
                {enrolledCourses.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="book-outline" size={38} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No enrolled subjects found</Text>
                    <Text style={styles.emptySub}>Enroll in courses to start tracking your academic progress.</Text>
                  </View>
                ) : (
                  <View style={styles.subjectsList}>
                    {enrolledCourses.map((e, idx) => {
                      const title = e.course?.title || e.courseTitle || 'Academic Subject';
                      const cohort = e.batch?.name || `${(userProfile?.customProfile as any)?.ataStatus || 'ATA'} Matriculation`;
                      const credits = e.course?.credits || e.course?.creditHours || e.credits || 3;
                      const isCompleted = e.status === 'COMPLETED' || (e.progressPercentage ?? 0) >= 100;
                      const progress = e.progressPercentage || (isCompleted ? 100 : 0);

                      return (
                        <View key={e.id || `c_${idx}`} style={styles.subjectItemRow}>
                          <View style={styles.subjectLeftBar} />
                          <View style={styles.subjectInfoCol}>
                            <Text style={styles.subjectItemTitle} numberOfLines={2}>
                              {title}
                            </Text>
                            <Text style={styles.subjectCohortText}>Cohort: {cohort}</Text>
                            <View style={styles.subjectMetaRow}>
                              <Text style={styles.subjectCreditsText}>{credits}.00 Credits</Text>
                              <Text style={styles.subjectBullet}>•</Text>
                              <Text style={styles.subjectProgressNumber}>{progress}% Progress</Text>
                            </View>
                            <View style={styles.miniProgressTrack}>
                              <View
                                style={[
                                  styles.miniProgressFill,
                                  {
                                    width: `${Math.max(2, progress)}%`,
                                    backgroundColor: isCompleted ? '#10B981' : '#4F46E5',
                                  },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={styles.subjectStatusCol}>
                            <View style={[styles.statusPill, isCompleted ? styles.pillCompleted : styles.pillInProgress]}>
                              <Ionicons
                                name={isCompleted ? 'checkmark-circle' : 'time-outline'}
                                size={12}
                                color={isCompleted ? '#15803D' : '#B45309'}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[styles.statusPillText, isCompleted ? styles.textCompleted : styles.textInProgress]}>
                                {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 2: OFFICIAL GRADES & TRANSCRIPTS */}
          {activeTab === 'transcripts' && (
            <View style={styles.tabContentBlock}>
              {/* Official Academic Details Banner */}
              <View style={styles.transcriptBanner}>
                <View style={styles.transcriptBannerRow}>
                  <View>
                    <Text style={styles.transcriptStudentName}>
                      {userProfile?.fullName || 'Enrolled Student'}
                    </Text>
                    <Text style={styles.transcriptStudentId}>
                      Student ID: {userProfile?.id?.slice(0, 8).toUpperCase() || 'COT-2026'} • {progressStats.programTitle}
                    </Text>
                  </View>
                  <View style={styles.statusGoodStandingBadge}>
                    <Ionicons name="shield-checkmark" size={13} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.goodStandingText}>Good Standing</Text>
                  </View>
                </View>
              </View>

              {/* Grades Table / List */}
              {gradesData.grades.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="document-text-outline" size={44} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No official grades yet</Text>
                  <Text style={styles.emptySub}>
                    Your grades and credits will appear here once faculty evaluates coursework and publishes mid-term/final reports.
                  </Text>
                </View>
              ) : (
                <View style={styles.cardBox}>
                  <Text style={styles.boxTitle}>Official Transcript Records</Text>
                  <View style={styles.gradesList}>
                    {gradesData.grades.map((gr, idx) => {
                      const cTitle = gr.course?.title || gr.courseTitle || 'Subject';
                      const cCredits = Number(gr.course?.credits || gr.credits || 3);
                      const points = getGradePoints(gr.grade);

                      return (
                        <View key={gr.id || `gr_${idx}`} style={styles.gradeCard}>
                          <View style={styles.gradeCardHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.gradeCourseTitle}>{cTitle}</Text>
                              {gr.code ? <Text style={styles.gradeCourseCode}>{gr.code}</Text> : null}
                            </View>
                            <View style={styles.gradePillBox}>
                              <Text style={styles.gradePillText}>{gr.grade || '—'}</Text>
                            </View>
                          </View>

                          <View style={styles.gradeScoresGrid}>
                            <View style={styles.scoreBlock}>
                              <Text style={styles.scoreBlockLabel}>Assessment (/65)</Text>
                              <Text style={[styles.scoreBlockValue, { color: '#4F46E5' }]}>
                                {gr.assignmentScore ?? '—'}
                              </Text>
                            </View>
                            <View style={styles.scoreBlock}>
                              <Text style={styles.scoreBlockLabel}>Attendance (/5)</Text>
                              <Text style={[styles.scoreBlockValue, { color: '#059669' }]}>
                                {gr.attendanceScore ?? '—'}
                              </Text>
                            </View>
                            <View style={styles.scoreBlock}>
                              <Text style={styles.scoreBlockLabel}>Final Exam (/30)</Text>
                              <Text style={[styles.scoreBlockValue, { color: '#7C3AED' }]}>
                                {gr.finalExamScore ?? '—'}
                              </Text>
                            </View>
                            <View style={styles.scoreBlock}>
                              <Text style={styles.scoreBlockLabel}>Total (/100)</Text>
                              <Text style={[styles.scoreBlockValue, { color: '#0F172A', fontWeight: '800' }]}>
                                {gr.totalScore ?? '0'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.gradeCardFooter}>
                            <Text style={styles.gradeFooterMeta}>
                              Credits: <Text style={{ fontWeight: '700' }}>{cCredits.toFixed(0)}</Text>
                            </Text>
                            <Text style={styles.gradeFooterMeta}>
                              Grade Points: <Text style={{ fontWeight: '700', color: '#4F46E5' }}>{points.toFixed(1)}</Text>
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Summary / Total Row matching Website */}
                  <View style={styles.transcriptSummaryBox}>
                    <View style={styles.summaryRowBetween}>
                      <Text style={styles.summaryTotalLabel}>Total Credits Earned</Text>
                      <Text style={styles.summaryTotalValue}>{progressStats.totalCredits} Credits</Text>
                    </View>
                    <View style={styles.summaryRowBetween}>
                      <Text style={styles.summaryTotalLabel}>Cumulative GPA</Text>
                      <Text style={[styles.summaryTotalValue, { color: '#7C3AED' }]}>
                        {progressStats.cumulativeGpa} / 4.3
                      </Text>
                    </View>
                    <View style={styles.summaryRowBetween}>
                      <Text style={styles.summaryTotalLabel}>Grading Scale Standard</Text>
                      <Text style={styles.summaryScaleValue}>4.3 ATA Grade Point Scale</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* TAB 3: FINAL EXAM RESULTS */}
          {activeTab === 'final' && (
            <View style={styles.tabContentBlock}>
              {finalResults.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="trophy-outline" size={44} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No final results yet</Text>
                  <Text style={styles.emptySub}>
                    Your comprehensive examination results and published marks will appear here once declared.
                  </Text>
                </View>
              ) : (
                <View style={styles.cardBox}>
                  <Text style={styles.boxTitle}>Published Examination Results</Text>
                  <View style={styles.examResultsList}>
                    {finalResults.map((item, idx) => {
                      const eTitle =
                        item.exam?.title ||
                        (typeof item.examId === 'object' ? item.examId?.title : null) ||
                        'Proctored Final Exam';
                      const cTitle =
                        item.course?.title ||
                        (typeof item.courseId === 'object' ? item.courseId?.title : null) ||
                        'Academic Course';
                      const isPassed = Boolean(item.isPassed);

                      return (
                        <View key={item.id || `fr_${idx}`} style={styles.examResultCard}>
                          <View style={styles.examResultHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.examResultTitle}>{eTitle}</Text>
                              <Text style={styles.examResultCourse}>{cTitle}</Text>
                            </View>
                            <View style={[styles.passFailBadge, isPassed ? styles.badgeGreen : styles.badgeRed]}>
                              <Ionicons
                                name={isPassed ? 'checkmark-circle' : 'close-circle'}
                                size={12}
                                color={isPassed ? '#059669' : '#EF4444'}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[styles.passFailText, isPassed ? styles.textGreen : styles.textRed]}>
                                {isPassed ? 'Passed' : 'Failed'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.examScoreRow}>
                            <View style={styles.scoreItem}>
                              <Text style={styles.scoreItemLabel}>Score</Text>
                              <Text style={styles.scoreItemValue}>
                                {item.marksObtained ?? 0} / {item.totalMarks ?? '100'}
                              </Text>
                            </View>
                            {item.grade ? (
                              <View style={styles.scoreItem}>
                                <Text style={styles.scoreItemLabel}>Grade</Text>
                                <Text style={[styles.scoreItemValue, { color: '#4F46E5' }]}>{item.grade}</Text>
                              </View>
                            ) : null}
                            <View style={styles.scoreItem}>
                              <Text style={styles.scoreItemLabel}>Date</Text>
                              <Text style={styles.scoreItemValue}>
                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* TAB 4: EXAM & QUIZ ATTEMPTS */}
          {activeTab === 'attempts' && (
            <View style={styles.tabContentBlock}>
              {attemptsList.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="time-outline" size={44} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No exam attempts yet</Text>
                  <Text style={styles.emptySub}>
                    Your online test submissions, timer logs, and answer reviews will appear here.
                  </Text>
                </View>
              ) : (
                <View style={styles.cardBox}>
                  <Text style={styles.boxTitle}>Exam & Quiz Submission History</Text>
                  <View style={styles.attemptsList}>
                    {attemptsList.map((att, idx) => {
                      const eTitle =
                        (typeof att.examId === 'object' ? att.examId?.title : null) || 'Academic Assessment';
                      const cTitle =
                        (typeof att.examId === 'object' && typeof att.examId?.courseId === 'object'
                          ? att.examId?.courseId?.title
                          : null) || 'Curriculum Course';
                      const attNum = att.attemptNumber || idx + 1;
                      const status = (att.status || 'SUBMITTED').toUpperCase();

                      return (
                        <View key={att.id || `att_${idx}`} style={styles.attemptCard}>
                          <View style={styles.attemptCardHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.attemptTitle}>{eTitle}</Text>
                              <Text style={styles.attemptCourse}>{cTitle}</Text>
                            </View>
                            <View style={styles.attemptNumberBadge}>
                              <Text style={styles.attemptNumberText}>Attempt #{attNum}</Text>
                            </View>
                          </View>

                          <View style={styles.attemptDetailsRow}>
                            <View style={styles.attemptScoreCol}>
                              <Text style={styles.attemptScoreLabel}>Score</Text>
                              <Text style={styles.attemptScoreValue}>
                                {att.marksObtained ?? 0} / {att.totalMarks ?? '—'}
                              </Text>
                            </View>

                            <View style={styles.attemptStatusCol}>
                              <Text style={styles.attemptScoreLabel}>Status</Text>
                              <View
                                style={[
                                  styles.statusPillSmall,
                                  status === 'EVALUATED'
                                    ? styles.pillCompleted
                                    : status === 'IN_PROGRESS'
                                    ? styles.pillPurple
                                    : styles.pillInProgress,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusPillSmallText,
                                    status === 'EVALUATED'
                                      ? styles.textCompleted
                                      : status === 'IN_PROGRESS'
                                      ? styles.textPurple
                                      : styles.textInProgress,
                                  ]}
                                >
                                  {status}
                                </Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={styles.reviewButton}
                              onPress={() => handleOpenReview(att)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.reviewButtonText}>Review</Text>
                              <Ionicons name="arrow-forward" size={12} color="#4F46E5" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* TAB 5: IN-VIDEO QUIZZES */}
          {activeTab === 'video' && (
            <View style={styles.tabContentBlock}>
              {videoQuizzes.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="videocam-outline" size={44} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No video quizzes answered</Text>
                  <Text style={styles.emptySub}>
                    Interactive checkpoint questions answered during video lecture streams will appear here with instant score analytics.
                  </Text>
                </View>
              ) : (
                <View style={styles.cardBox}>
                  <Text style={styles.boxTitle}>Interactive Video Checkpoints</Text>
                  <View style={styles.videoQuizList}>
                    {videoQuizzes.map((vq, idx) => {
                      const cTitle =
                        (typeof vq.lessonId === 'object' && typeof vq.lessonId?.courseId === 'object'
                          ? vq.lessonId?.courseId?.title
                          : null) || 'Course Lecture';
                      const lTitle = (typeof vq.lessonId === 'object' ? vq.lessonId?.title : null) || 'Video Lesson';
                      const qText = (typeof vq.quizId === 'object' ? vq.quizId?.questionText : null) || 'Lecture Checkpoint';
                      const maxMarks = (typeof vq.quizId === 'object' ? vq.quizId?.maxMarks : null) || 1;
                      const isCorrect = Boolean(vq.isCorrect);

                      return (
                        <View key={vq.id || `vq_${idx}`} style={styles.videoQuizCard}>
                          <View style={styles.videoQuizHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.videoQuizCourse}>{cTitle}</Text>
                              <Text style={styles.videoQuizLesson}>{lTitle}</Text>
                            </View>
                            <View style={[styles.passFailBadge, isCorrect ? styles.badgeGreen : styles.badgeRed]}>
                              <Ionicons
                                name={isCorrect ? 'checkmark-circle' : 'alert-circle'}
                                size={12}
                                color={isCorrect ? '#059669' : '#EF4444'}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[styles.passFailText, isCorrect ? styles.textGreen : styles.textRed]}>
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.videoQuizQuestionText}>&ldquo;{qText}&rdquo;</Text>

                          <View style={styles.videoQuizFooter}>
                            <Text style={styles.videoQuizScoreText}>
                              Score: <Text style={{ fontWeight: '700' }}>{vq.marks ?? (isCorrect ? 1 : 0)} / {maxMarks}</Text>
                            </Text>
                            <Text style={styles.videoQuizDateText}>
                              {vq.createdAt ? new Date(vq.createdAt).toLocaleDateString() : 'Recorded'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Interactive Attempt Review Modal */}
      <Modal
        visible={isReviewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Attempt Answers & Review</Text>
                <Text style={styles.modalSub}>
                  {typeof selectedAttempt?.examId === 'object'
                    ? selectedAttempt?.examId?.title
                    : 'Examination Attempt'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsReviewModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {isLoadingReview ? (
              <View style={styles.modalCenterBox}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.loadingText}>Fetching submitted answers & explanations...</Text>
              </View>
            ) : reviewData && reviewData.questions && reviewData.questions.length > 0 ? (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.modalScoreCard}>
                  <Text style={styles.modalScoreTitle}>Final Exam Score</Text>
                  <Text style={styles.modalScoreBig}>
                    {reviewData.score} / {reviewData.totalMarks} ({reviewData.percentage}%)
                  </Text>
                </View>

                {reviewData.questions.map((q, qIdx) => (
                  <View key={q.questionId || `rq_${qIdx}`} style={styles.reviewQuestionCard}>
                    <Text style={styles.reviewQuestionHeader}>Question {qIdx + 1}</Text>
                    <Text style={styles.reviewQuestionText}>{q.questionText}</Text>

                    {q.options && q.options.length > 0 ? (
                      <View style={styles.optionsList}>
                        {q.options.map((opt, optIdx) => {
                          const isSelected = String(q.selectedOption) === String(optIdx) || q.selectedOption === opt;
                          const isCorrect = String(q.correctOption) === String(optIdx) || q.correctOption === opt;

                          return (
                            <View
                              key={`opt_${optIdx}`}
                              style={[
                                styles.optionRow,
                                isCorrect && styles.optionRowCorrect,
                                isSelected && !isCorrect && styles.optionRowWrong,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.optionText,
                                  isCorrect && styles.optionTextCorrect,
                                  isSelected && !isCorrect && styles.optionTextWrong,
                                ]}
                              >
                                {opt}
                              </Text>
                              {isCorrect && (
                                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                              )}
                              {isSelected && !isCorrect && (
                                <Ionicons name="close-circle" size={16} color="#EF4444" />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ) : q.textAnswer ? (
                      <View style={styles.essayAnswerBox}>
                        <Text style={styles.essayLabel}>Submitted Essay Answer:</Text>
                        <Text style={styles.essayText}>{q.textAnswer}</Text>
                      </View>
                    ) : null}

                    {q.explanation ? (
                      <View style={styles.explanationBox}>
                        <Text style={styles.explanationLabel}>Faculty Feedback / Explanation:</Text>
                        <Text style={styles.explanationText}>{q.explanation}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.modalCenterBox}>
                <Ionicons name="document-text-outline" size={42} color="#94A3B8" />
                <Text style={styles.emptyTitle}>Detailed review not available</Text>
                <Text style={styles.emptySub}>
                  Detailed question review is published once all students complete the evaluation window.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  topBarTitleGroup: {
    flex: 1,
  },
  eyebrowText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  refreshButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  subtitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsContainer: {
    paddingHorizontal: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
  },
  tabButtonActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 3,
    backgroundColor: '#4F46E5',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  errorSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContentBlock: {
    gap: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardBorderPurple: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  cardBorderGreen: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  cardBorderOrange: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  cardBorderViolet: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  cardEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeading: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  cardValueGreen: {
    fontSize: 22,
    fontWeight: '900',
    color: '#059669',
  },
  cardValueOrange: {
    fontSize: 22,
    fontWeight: '900',
    color: '#D97706',
  },
  cardValueViolet: {
    fontSize: 22,
    fontWeight: '900',
    color: '#7C3AED',
  },
  cardValueTotal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  cardValueSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  cardSubPurple: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 2,
  },
  cardSubGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  cardSubOrange: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 2,
  },
  cardSubViolet: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    marginTop: 2,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  boxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  boxProgressPercentage: {
    fontSize: 14,
    fontWeight: '900',
    color: '#4F46E5',
  },
  progressBarTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 999,
  },
  cyclicTermsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cyclicTermPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cyclicTermPillCurrent: {
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  cyclicTermPillDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  cyclicTermText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 6,
  },
  cyclicTermTextCurrent: {
    color: '#4F46E5',
  },
  cyclicTermTextDone: {
    color: '#059669',
  },
  cyclicStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgePurple: {
    backgroundColor: '#E0E7FF',
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  badgeGrey: {
    backgroundColor: '#F1F5F9',
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
  },
  cyclicBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
  },
  subjectsList: {
    marginTop: 12,
    gap: 12,
  },
  subjectItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subjectLeftBar: {
    width: 3,
    height: '80%',
    backgroundColor: '#4F46E5',
    borderRadius: 2,
    marginRight: 10,
  },
  subjectInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  subjectItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  subjectCohortText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  subjectMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  subjectCreditsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  subjectBullet: {
    marginHorizontal: 6,
    color: '#CBD5E1',
    fontSize: 10,
  },
  subjectProgressNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  miniProgressTrack: {
    width: 120,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    marginTop: 4,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  subjectStatusCol: {
    alignItems: 'flex-end',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillCompleted: {
    backgroundColor: '#DCFCE7',
  },
  pillInProgress: {
    backgroundColor: '#FEF3C7',
  },
  pillPurple: {
    backgroundColor: '#EEF2FF',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textCompleted: {
    color: '#15803D',
  },
  textInProgress: {
    color: '#B45309',
  },
  textPurple: {
    color: '#4F46E5',
  },
  transcriptBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transcriptBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transcriptStudentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  transcriptStudentId: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  statusGoodStandingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  goodStandingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  gradesList: {
    marginTop: 12,
    gap: 10,
  },
  gradeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gradeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeCourseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  gradeCourseCode: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  gradePillBox: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  gradePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  gradeScoresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scoreBlock: {
    alignItems: 'center',
  },
  scoreBlockLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  scoreBlockValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  gradeCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  gradeFooterMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  transcriptSummaryBox: {
    marginTop: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  summaryRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  summaryTotalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryScaleValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  examResultsList: {
    marginTop: 12,
    gap: 10,
  },
  examResultCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  examResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  examResultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  examResultCourse: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  passFailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  passFailText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textGreen: {
    color: '#059669',
  },
  textRed: {
    color: '#EF4444',
  },
  examScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreItemLabel: {
    fontSize: 9,
    color: '#64748B',
  },
  scoreItemValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  attemptsList: {
    marginTop: 12,
    gap: 10,
  },
  attemptCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  attemptCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  attemptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  attemptCourse: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  attemptNumberBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  attemptNumberText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  attemptDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
  },
  attemptScoreCol: {
    alignItems: 'flex-start',
  },
  attemptScoreLabel: {
    fontSize: 9,
    color: '#64748B',
  },
  attemptScoreValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  attemptStatusCol: {
    alignItems: 'center',
  },
  statusPillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  statusPillSmallText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    gap: 4,
  },
  reviewButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  videoQuizList: {
    marginTop: 12,
    gap: 10,
  },
  videoQuizCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  videoQuizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  videoQuizCourse: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  videoQuizLesson: {
    fontSize: 11,
    color: '#64748B',
  },
  videoQuizQuestionText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#334155',
    marginVertical: 4,
    lineHeight: 16,
  },
  videoQuizFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  videoQuizScoreText: {
    fontSize: 11,
    color: '#475569',
  },
  videoQuizDateText: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCenterBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  modalScroll: {
    marginTop: 12,
  },
  modalScoreCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalScoreTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
  },
  modalScoreBig: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  reviewQuestionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewQuestionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    textTransform: 'uppercase',
  },
  reviewQuestionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginVertical: 6,
    lineHeight: 18,
  },
  optionsList: {
    gap: 6,
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionRowCorrect: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  optionRowWrong: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  optionText: {
    fontSize: 12,
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  optionTextCorrect: {
    fontWeight: '700',
    color: '#15803D',
  },
  optionTextWrong: {
    fontWeight: '700',
    color: '#B91C1C',
  },
  essayAnswerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  essayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  essayText: {
    fontSize: 12,
    color: '#0F172A',
    lineHeight: 16,
  },
  explanationBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  explanationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  explanationText: {
    fontSize: 11.5,
    color: '#334155',
    lineHeight: 16,
  },
});
