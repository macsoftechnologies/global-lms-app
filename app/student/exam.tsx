import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { DashboardService } from '../../src/services/dashboardService';
import { useTheme } from '../../src/context/ThemeContext';
import {
  CourseExamItem,
  ExamQuestionItem,
  ExamAttemptItem,
  ExamStartAttemptResponse,
  ExamSubmitAnswerItem,
  AttemptReviewResponse,
} from '../../src/types';

type ScreenViewMode = 'list' | 'details' | 'taking' | 'review';

export default function StudentExamScreen() {
  const { isDarkMode } = useTheme();
  const params = useLocalSearchParams<{
    courseId?: string;
    title?: string;
    examId?: string;
    attemptId?: string;
  }>();

  const courseId = params.courseId || '';
  const courseTitle = params.title || 'Course Exams';

  // Overall screen mode
  const [viewMode, setViewMode] = useState<ScreenViewMode>('list');

  // Exam list data
  const [exams, setExams] = useState<CourseExamItem[]>([]);
  const [attemptsByExam, setAttemptsByExam] = useState<Record<string, ExamAttemptItem[]>>({});
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Active / Selected Exam Details
  const [selectedExam, setSelectedExam] = useState<CourseExamItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Active Taking Exam State
  const [activeAttempt, setActiveAttempt] = useState<ExamStartAttemptResponse | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionItem[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Answers map: questionId -> string | { fileUrl?: string; fileName?: string; textAnswer?: string }
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);
  const [isSubmitModalVisible, setIsSubmitModalVisible] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Review State
  const [reviewData, setReviewData] = useState<AttemptReviewResponse | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Debounced Autosave Timer Ref
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==========================================
  // 1. Select Exam & Load Details
  // ==========================================
  const handleSelectExam = useCallback(async (exam: CourseExamItem) => {
    const eId = exam._id || exam.id;
    setSelectedExam(exam);
    setViewMode('details');

    if (!eId) return;
    setIsLoadingDetails(true);
    try {
      const detailsResp = await DashboardService.getExamDetails(eId);
      if (detailsResp.success && detailsResp.data) {
        const d = detailsResp.data;
        setSelectedExam((prev) => (prev ? { ...prev, ...d } : d));
      }
      // Refresh attempts for this exam
      const attResp = await DashboardService.getExamAttempts(eId);
      if (attResp.success && Array.isArray(attResp.data)) {
        const freshAttempts = attResp.data;
        setAttemptsByExam((prev) => ({ ...prev, [eId]: freshAttempts }));
      }
    } catch {
      // Keep basic exam item if detailed fetch fails
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // ==========================================
  // 2. Fetch Exams List & Attempts
  // ==========================================
  const fetchExamsAndAttempts = useCallback(
    async (showSpinner = true) => {
      if (!courseId) {
        setIsLoadingList(false);
        setIsRefreshingList(false);
        setListError('Course identifier is missing.');
        return;
      }

      if (showSpinner) setIsLoadingList(true);
      setListError(null);

      try {
        const resp = await DashboardService.getCourseExams(courseId);
        if (!resp.success) {
          setListError(resp.error || 'Failed to load course exams.');
          setIsLoadingList(false);
          setIsRefreshingList(false);
          return;
        }

        const rawList = resp.data || [];
        const published = rawList.filter(
          (e) => e.isPublished !== false && e.status !== 'DRAFT'
        );
        setExams(published);

        // Fetch attempts for each exam
        const attemptsMap: Record<string, ExamAttemptItem[]> = {};
        await Promise.all(
          published.map(async (exam) => {
            const eId = exam._id || exam.id;
            if (!eId) return;
            try {
              const attResp = await DashboardService.getExamAttempts(eId);
              if (attResp.success && Array.isArray(attResp.data)) {
                attemptsMap[eId] = attResp.data;
              } else {
                attemptsMap[eId] = [];
              }
            } catch {
              attemptsMap[eId] = [];
            }
          })
        );
        setAttemptsByExam(attemptsMap);

        // If examId was passed via params, open that exam details
        if (params.examId && viewMode === 'list') {
          const match = published.find(
            (e) => (e._id || e.id) === params.examId
          );
          if (match) {
            void handleSelectExam(match);
          }
        }
      } catch (err: unknown) {
        setListError(err instanceof Error ? err.message : 'Network error loading exams.');
      } finally {
        setIsLoadingList(false);
        setIsRefreshingList(false);
      }
    },
    [courseId, params.examId, viewMode, handleSelectExam]
  );

  const handleRefreshList = () => {
    setIsRefreshingList(true);
    void fetchExamsAndAttempts(false);
  };

  // ==========================================
  // 3. Load Attempt Review
  // ==========================================
  const loadAttemptReview = useCallback(async (examId: string, attemptId: string) => {
    setViewMode('review');
    setIsLoadingReview(true);
    setReviewData(null);

    try {
      const resp = await DashboardService.getExamAttemptReview(examId, attemptId);
      if (resp.success && resp.data) {
        setReviewData(resp.data);
      } else {
        // Fallback to my-result endpoint
        const resResp = await DashboardService.getExamResult(examId);
        if (resResp.success && resResp.data) {
          const r = resResp.data;
          setReviewData({
            attemptId,
            examTitle: typeof r.exam === 'object' ? r.exam?.title || 'Exam' : 'Exam',
            score: r.marksObtained || 0,
            totalMarks: r.totalMarks || 100,
            percentage: r.percentage || 0,
            status: r.isPassed ? 'PASSED' : 'FAILED',
            questions: [],
          });
        }
      }
    } catch {
      // Failed to load review
    } finally {
      setIsLoadingReview(false);
    }
  }, []);

  // ==========================================
  // 4. Final Exam Submission
  // ==========================================
  const executeFinalSubmit = useCallback(async () => {
    if (!selectedExam || isSubmittingExam) return;
    const eId = selectedExam._id || selectedExam.id;
    if (!eId) return;

    setIsSubmittingExam(true);
    setIsSubmitModalVisible(false);

    try {
      const answersPayload: ExamSubmitAnswerItem[] = questions.map((q) => {
        const qId = q._id || q.id;
        const ans = userAnswers[qId];

        if (q.type === 'BOOK_REVIEW' || q.type === 'RESEARCH_PAPER') {
          const obj = typeof ans === 'object' && ans !== null ? ans : {};
          return {
            questionId: qId,
            fileUrl: obj.fileUrl || '',
            fileName: obj.fileName || 'Submitted Document',
            textAnswer: obj.textAnswer || (typeof ans === 'string' ? ans : ''),
          };
        } else if (q.type === 'SHORT_ANSWER' || q.type === 'ESSAY') {
          return {
            questionId: qId,
            textAnswer: typeof ans === 'object' ? ans.textAnswer || '' : ans || '',
          };
        } else {
          // MCQ or TRUE_FALSE
          return {
            questionId: qId,
            selectedOption: typeof ans === 'string' ? ans : '',
          };
        }
      });

      const resp = await DashboardService.submitExamAttempt(eId, {
        answers: answersPayload,
      });

      if (resp.success) {
        Alert.alert(
          'Exam Submitted!',
          'Your exam attempt was submitted successfully. You can now review your attempt results.',
          [
            {
              text: 'View Result',
              onPress: () => {
                const attId = activeAttempt?._id || activeAttempt?.id;
                if (attId) {
                  void loadAttemptReview(eId, attId);
                } else {
                  setViewMode('details');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Submission Error', resp.error || 'Failed to submit exam attempt.');
      }
    } catch (err: unknown) {
      Alert.alert('Submission Failed', err instanceof Error ? err.message : 'Network error submitting exam.');
    } finally {
      setIsSubmittingExam(false);
      // Refresh list
      void fetchExamsAndAttempts(false);
    }
  }, [
    selectedExam,
    isSubmittingExam,
    questions,
    userAnswers,
    activeAttempt,
    loadAttemptReview,
    fetchExamsAndAttempts,
  ]);

  // ==========================================
  // 5. Initial Data Fetch Effect
  // ==========================================
  useEffect(() => {
    Promise.resolve().then(() => {
      void fetchExamsAndAttempts(true);
    });
  }, [fetchExamsAndAttempts]);

  // ==========================================
  // 6. Start or Resume Exam Attempt
  // ==========================================
  const handleStartExamAttempt = async () => {
    if (!selectedExam) return;
    const eId = selectedExam._id || selectedExam.id;
    if (!eId) return;

    // Check if an in-progress attempt already exists
    const existingAttempts = attemptsByExam[eId] || [];
    const inProgressAttempt = existingAttempts.find((a) => a.status === 'IN_PROGRESS');

    Alert.alert(
      inProgressAttempt ? 'Resume Exam Attempt' : 'Start Exam',
      inProgressAttempt
        ? 'You have an active attempt in progress. Would you like to resume now?'
        : `Are you ready to begin "${selectedExam.title}"?\n\nDuration: ${selectedExam.durationMinutes} minutes.\nThe timer will start immediately and cannot be paused.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: inProgressAttempt ? 'Resume' : 'Start Now',
          style: 'default',
          onPress: async () => {
            setIsLoadingDetails(true);
            try {
              let attemptData: ExamStartAttemptResponse;
              if (inProgressAttempt) {
                attemptData = {
                  id: inProgressAttempt._id || inProgressAttempt.id,
                  _id: inProgressAttempt._id,
                  examId: eId,
                  createdAt: inProgressAttempt.createdAt || inProgressAttempt.startedAt || new Date().toISOString(),
                  durationMinutes: selectedExam.durationMinutes,
                };
              } else {
                const startResp = await DashboardService.startExamAttempt(eId);
                if (!startResp.success || !startResp.data) {
                  Alert.alert('Unable to Start Exam', startResp.error || 'Failed to start attempt.');
                  setIsLoadingDetails(false);
                  return;
                }
                attemptData = startResp.data;
              }

              // Load Questions
              const qResp = await DashboardService.getExamQuestions(eId);
              if (!qResp.success || !Array.isArray(qResp.data) || qResp.data.length === 0) {
                Alert.alert('No Questions', 'This exam currently has no questions configured.');
                setIsLoadingDetails(false);
                return;
              }

              // Initialize Attempt State
              setActiveAttempt(attemptData);
              setQuestions(qResp.data);
              setCurrentQuestionIndex(0);
              setUserAnswers({});

              // Calculate remaining time
              const createdTimestamp = new Date(attemptData.createdAt).getTime();
              const durationMs = (selectedExam.durationMinutes || 30) * 60 * 1000;
              const elapsedSecs = Math.max(0, Math.floor((Date.now() - createdTimestamp) / 1000));
              const remainingSecs = Math.max(0, Math.floor(durationMs / 1000) - elapsedSecs);

              setTimeLeftSeconds(remainingSecs);
              setViewMode('taking');
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not begin exam.');
            } finally {
              setIsLoadingDetails(false);
            }
          },
        },
      ]
    );
  };

  // ==========================================
  // 7. Countdown Timer & Auto-Submit
  // ==========================================
  useEffect(() => {
    if (viewMode !== 'taking' || isSubmittingExam) return;

    if (timeLeftSeconds <= 0 && activeAttempt) {
      const timeoutId = setTimeout(() => {
        Alert.alert('Time Is Up!', 'Your exam duration has ended. Auto-submitting answers now...');
        void executeFinalSubmit();
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          Alert.alert('Time Is Up!', 'Your exam duration has ended. Auto-submitting answers now...');
          void executeFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewMode, timeLeftSeconds, isSubmittingExam, activeAttempt, executeFinalSubmit]);

  // Format MM:SS
  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ==========================================
  // 5. Answer Selection & Debounced Autosave
  // ==========================================
  const triggerAutosaveDraft = useCallback(
    (questionId: string, answerVal: any) => {
      if (!selectedExam) return;
      const eId = selectedExam._id || selectedExam.id;
      if (!eId) return;

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      setAutosaveStatus('saving');
      autosaveTimerRef.current = setTimeout(async () => {
        try {
          const payload =
            typeof answerVal === 'object' && answerVal !== null
              ? {
                  questionId,
                  fileUrl: answerVal.fileUrl || '',
                  fileName: answerVal.fileName || '',
                  textAnswer: answerVal.textAnswer || '',
                }
              : typeof answerVal === 'string' && answerVal.length > 0
              ? {
                  questionId,
                  selectedOption: answerVal,
                  textAnswer: answerVal,
                }
              : { questionId };

          const res = await DashboardService.saveExamDraftAnswer(eId, payload);
          if (res.success) {
            setAutosaveStatus('saved');
          } else {
            setAutosaveStatus('error');
          }
        } catch {
          setAutosaveStatus('error');
        }
      }, 700);
    },
    [selectedExam]
  );

  const handleSelectOptionAnswer = (questionId: string, optionVal: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionVal }));
    triggerAutosaveDraft(questionId, optionVal);
  };

  const handleUpdateTextAnswer = (questionId: string, text: string) => {
    setUserAnswers((prev) => {
      const current = prev[questionId];
      if (typeof current === 'object' && current !== null) {
        return { ...prev, [questionId]: { ...current, textAnswer: text } };
      }
      return { ...prev, [questionId]: text };
    });
    triggerAutosaveDraft(questionId, text);
  };

  const handlePickQuestionFile = async (questionId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setUserAnswers((prev) => {
          const current = prev[questionId] || {};
          return {
            ...prev,
            [questionId]: {
              ...(typeof current === 'object' ? current : {}),
              fileUrl: file.uri,
              fileName: file.name,
            },
          };
        });
        triggerAutosaveDraft(questionId, {
          fileUrl: file.uri,
          fileName: file.name,
        });
      }
    } catch {
      Alert.alert('Error', 'Unable to pick document for question.');
    }
  };

  // ==========================================
  // 6. Final Exam Submission
  // ==========================================
  const answeredCount = useMemo(() => {
    let count = 0;
    questions.forEach((q) => {
      const qId = q._id || q.id;
      const ans = userAnswers[qId];
      if (ans !== undefined && ans !== null && ans !== '') {
        if (typeof ans === 'object') {
          if (ans.fileUrl || (ans.textAnswer && ans.textAnswer.trim())) count++;
        } else {
          count++;
        }
      }
    });
    return count;
  }, [questions, userAnswers]);

  // Current Question in Taking Mode
  const currentQ = questions[currentQuestionIndex];
  const currentQId = currentQ?._id || currentQ?.id || '';
  const currentQAnswer = userAnswers[currentQId];

  // ==========================================
  // RENDER: Screen
  // ==========================================
  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDarkMode ? '#090D16' : '#F8FAFC' },
      ]}
    >
      {/* ==================================================== */}
      {/* 1. TOP HEADER                                        */}
      {/* ==================================================== */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
            borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (viewMode === 'taking') {
              Alert.alert(
                'Leave Exam?',
                'Your timer is still running on the server. You can resume before it expires.',
                [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: () => setViewMode('details') },
                ]
              );
            } else if (viewMode === 'review') {
              setViewMode('details');
            } else if (viewMode === 'details') {
              setViewMode('list');
            } else {
              router.back();
            }
          }}
          accessibilityLabel="Back"
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDarkMode ? '#F8FAFC' : '#0F172A'}
          />
        </TouchableOpacity>

        <View style={styles.titleCol}>
          <Text style={styles.badge}>
            {viewMode === 'taking'
              ? 'Exam in Progress'
              : viewMode === 'review'
              ? 'Attempt Review'
              : 'Course Exams'}
          </Text>
          <Text
            style={[styles.headerTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}
            numberOfLines={1}
          >
            {viewMode === 'taking' || viewMode === 'details'
              ? selectedExam?.title || courseTitle
              : courseTitle}
          </Text>
        </View>

        {/* Header Right Accessory */}
        {viewMode === 'taking' ? (
          <View
            style={[
              styles.timerBox,
              timeLeftSeconds < 300
                ? { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }
                : { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF', borderColor: '#6366F1' },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={15}
              color={timeLeftSeconds < 300 ? '#DC2626' : '#6366F1'}
            />
            <Text
              style={[
                styles.timerText,
                { color: timeLeftSeconds < 300 ? '#DC2626' : '#6366F1' },
              ]}
            >
              {formatCountdown(timeLeftSeconds)}
            </Text>
          </View>
        ) : viewMode === 'list' ? (
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={handleRefreshList}
            disabled={isLoadingList || isRefreshingList}
          >
            {isRefreshingList ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={20}
                color={isDarkMode ? '#94A3B8' : '#64748B'}
              />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ==================================================== */}
      {/* 2. MODE: 'list' (Exams List)                         */}
      {/* ==================================================== */}
      {viewMode === 'list' && (
        <>
          {isLoadingList ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={[styles.loadingText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Loading course exams...
              </Text>
            </View>
          ) : listError ? (
            <View style={styles.centerContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={[styles.errorTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                Unable to Load Exams
              </Text>
              <Text style={[styles.errorSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                {listError}
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchExamsAndAttempts(true)}
              >
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : exams.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.centerContainer}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingList}
                  onRefresh={handleRefreshList}
                  tintColor="#6366F1"
                />
              }
            >
              <View
                style={[
                  styles.emptyIconBox,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' },
                ]}
              >
                <Ionicons name="school-outline" size={44} color="#6366F1" />
              </View>
              <Text style={[styles.emptyTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                No Exams Available
              </Text>
              <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                There are currently no exams scheduled or published for this course.
              </Text>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingList}
                  onRefresh={handleRefreshList}
                  tintColor="#6366F1"
                />
              }
            >
              <Text
                style={[
                  styles.sectionHeading,
                  { color: isDarkMode ? '#E2E8F0' : '#1E293B' },
                ]}
              >
                Available Exams ({exams.length})
              </Text>

              {exams.map((exam, index) => {
                const eId = exam._id || exam.id;
                const attempts = (eId && attemptsByExam[eId]) || [];
                const maxAttempts = exam.maxAttempts || 3;
                const hasInProgress = attempts.some((a) => a.status === 'IN_PROGRESS');
                const evaluatedCount = attempts.filter((a) => a.status !== 'IN_PROGRESS').length;
                const scores = attempts
                  .map((a) => a.marksObtained)
                  .filter((m): m is number => typeof m === 'number');
                const highestScore = scores.length > 0 ? Math.max(...scores) : null;

                return (
                  <TouchableOpacity
                    key={eId || `exam_${index}`}
                    style={[
                      styles.card,
                      {
                        backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                        borderColor: hasInProgress
                          ? '#10B981'
                          : isDarkMode
                          ? '#1E293B'
                          : '#E2E8F0',
                        borderWidth: hasInProgress ? 2 : 1,
                      },
                    ]}
                    onPress={() => handleSelectExam(exam)}
                    activeOpacity={0.85}
                  >
                    {/* Header Row */}
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={[
                            styles.cardTitle,
                            { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                          ]}
                        >
                          {exam.title}
                        </Text>
                        <Text
                          style={[
                            styles.dueText,
                            { color: isDarkMode ? '#94A3B8' : '#64748B' },
                          ]}
                        >
                          Duration: {exam.durationMinutes} mins • Passing: {exam.passingPercentage}%
                        </Text>
                      </View>

                      {hasInProgress ? (
                        <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                          <Ionicons name="play" size={12} color="#15803D" />
                          <Text style={[styles.statusBadgeText, { color: '#15803D' }]}>
                            IN PROGRESS
                          </Text>
                        </View>
                      ) : evaluatedCount >= maxAttempts ? (
                        <View style={[styles.statusBadge, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.statusBadgeText, { color: '#64748B' }]}>
                            COMPLETED
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: '#EEF2FF' }]}>
                          <Text style={[styles.statusBadgeText, { color: '#4F46E5' }]}>
                            READY
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Description */}
                    {exam.description ? (
                      <Text
                        style={[
                          styles.cardDescription,
                          { color: isDarkMode ? '#94A3B8' : '#475569' },
                        ]}
                        numberOfLines={2}
                      >
                        {exam.description}
                      </Text>
                    ) : null}

                    {/* Stats Grid */}
                    <View
                      style={[
                        styles.metaBar,
                        {
                          backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                          borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                        },
                      ]}
                    >
                      <View style={styles.metaStat}>
                        <Text style={[styles.metaLabel, { color: isDarkMode ? '#64748B' : '#64748B' }]}>
                          Total Marks
                        </Text>
                        <Text style={[styles.metaValue, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                          {exam.totalMarks}
                        </Text>
                      </View>

                      <View style={styles.metaStat}>
                        <Text style={[styles.metaLabel, { color: isDarkMode ? '#64748B' : '#64748B' }]}>
                          Attempts Used
                        </Text>
                        <Text
                          style={[
                            styles.metaValue,
                            {
                              color: hasInProgress
                                ? '#10B981'
                                : evaluatedCount >= maxAttempts
                                ? '#EF4444'
                                : isDarkMode
                                ? '#F8FAFC'
                                : '#0F172A',
                            },
                          ]}
                        >
                          {hasInProgress ? `${evaluatedCount} / ${maxAttempts} (Active)` : `${evaluatedCount} / ${maxAttempts}`}
                        </Text>
                      </View>

                      <View style={styles.metaStat}>
                        <Text style={[styles.metaLabel, { color: isDarkMode ? '#64748B' : '#64748B' }]}>
                          Highest Score
                        </Text>
                        <Text style={[styles.metaValue, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                          {highestScore !== null ? `${highestScore} / ${exam.totalMarks}` : '—'}
                        </Text>
                      </View>
                    </View>

                    {/* Action Button */}
                    <View
                      style={[
                        styles.actionBtn,
                        hasInProgress
                          ? { backgroundColor: '#10B981' }
                          : { backgroundColor: '#6366F1' },
                      ]}
                    >
                      <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                        {hasInProgress ? 'Resume In-Progress Attempt' : 'View Guidelines & Start'}
                      </Text>
                      <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {/* ==================================================== */}
      {/* 3. MODE: 'details' (Exam Details & Guidelines)       */}
      {/* ==================================================== */}
      {viewMode === 'details' && selectedExam && (
        <ScrollView
          contentContainerStyle={styles.detailsContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingDetails ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          ) : null}

          {/* Exam Title & Overview Box */}
          <View
            style={[
              styles.detailsHeroBox,
              {
                backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
              },
            ]}
          >
            <Text
              style={[
                styles.detailsHeroTitle,
                { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              {selectedExam.title}
            </Text>

            {selectedExam.description ? (
              <Text
                style={[
                  styles.detailsHeroDesc,
                  { color: isDarkMode ? '#94A3B8' : '#475569' },
                ]}
              >
                {selectedExam.description}
              </Text>
            ) : null}

            {/* Quick Metrics */}
            <View style={styles.metricsRow}>
              <View
                style={[
                  styles.metricChip,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' },
                ]}
              >
                <Ionicons name="time-outline" size={16} color="#6366F1" />
                <Text style={styles.metricChipText}>
                  {selectedExam.durationMinutes} Minutes
                </Text>
              </View>
              <View
                style={[
                  styles.metricChip,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' },
                ]}
              >
                <Ionicons name="ribbon-outline" size={16} color="#6366F1" />
                <Text style={styles.metricChipText}>
                  {selectedExam.totalMarks} Marks
                </Text>
              </View>
              <View
                style={[
                  styles.metricChip,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color="#6366F1" />
                <Text style={styles.metricChipText}>
                  Pass: {selectedExam.passingPercentage}%
                </Text>
              </View>
            </View>
          </View>

          {/* Guidelines / Instructions */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
              },
            ]}
          >
            <Text
              style={[
                styles.infoCardTitle,
                { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              Exam Instructions & Rules
            </Text>
            <Text
              style={[
                styles.infoCardContent,
                { color: isDarkMode ? '#CBD5E1' : '#334155' },
              ]}
            >
              {selectedExam.instructions ||
                '1. Ensure you have a stable network connection before starting.\n2. Once started, the timer runs continuously.\n3. Draft answers are autosaved as you make changes.\n4. You may navigate freely between questions.\n5. Click "Submit Exam" once you have reviewed all answers.'}
            </Text>
          </View>

          {/* Start Exam CTA */}
          <TouchableOpacity
            style={styles.startBtn}
            onPress={handleStartExamAttempt}
            activeOpacity={0.85}
          >
            <Ionicons name="play-circle" size={20} color="#FFFFFF" />
            <Text style={styles.startBtnText}>
              {((selectedExam._id || selectedExam.id) &&
                attemptsByExam[selectedExam._id || selectedExam.id]?.some(
                  (a) => a.status === 'IN_PROGRESS'
                ))
                ? 'Resume Active Attempt'
                : 'Start Exam Attempt'}
            </Text>
          </TouchableOpacity>

          {/* Past Attempts History */}
          {(() => {
            const eId = selectedExam._id || selectedExam.id;
            const past = (eId && attemptsByExam[eId]) || [];
            if (past.length === 0) return null;

            return (
              <View style={styles.historySection}>
                <Text
                  style={[
                    styles.sectionHeading,
                    { color: isDarkMode ? '#E2E8F0' : '#1E293B', marginTop: 24 },
                  ]}
                >
                  Attempt History ({past.length})
                </Text>

                {past.map((att, idx) => {
                  const attId = att._id || att.id;
                  const isPassed =
                    typeof att.percentage === 'number'
                      ? att.percentage >= (selectedExam.passingPercentage || 50)
                      : false;

                  return (
                    <View
                      key={attId || `past_${idx}`}
                      style={[
                        styles.pastAttemptCard,
                        {
                          backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                          borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pastAttemptTitle,
                            { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                          ]}
                        >
                          Attempt {att.attemptNumber || idx + 1}
                        </Text>
                        <Text
                          style={[
                            styles.pastAttemptDate,
                            { color: isDarkMode ? '#94A3B8' : '#64748B' },
                          ]}
                        >
                          {att.submittedAt
                            ? new Date(att.submittedAt).toLocaleDateString()
                            : att.createdAt
                            ? new Date(att.createdAt).toLocaleDateString()
                            : 'Date not available'}
                        </Text>
                        <Text
                          style={[
                            styles.pastAttemptScore,
                            {
                              color:
                                att.status === 'IN_PROGRESS'
                                  ? '#3B82F6'
                                  : isPassed
                                  ? '#10B981'
                                  : '#EF4444',
                            },
                          ]}
                        >
                          {att.status === 'IN_PROGRESS'
                            ? 'Currently In Progress'
                            : `Score: ${att.marksObtained ?? 0} / ${att.totalMarks ?? selectedExam.totalMarks} (${att.percentage ?? 0}%)`}
                        </Text>
                      </View>

                      {att.status !== 'IN_PROGRESS' && attId ? (
                        <TouchableOpacity
                          style={styles.reviewBtn}
                          onPress={() => loadAttemptReview(eId, attId)}
                        >
                          <Text style={styles.reviewBtnText}>Review</Text>
                          <Ionicons name="arrow-forward" size={13} color="#6366F1" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </ScrollView>
      )}

      {/* ==================================================== */}
      {/* 4. MODE: 'taking' (Exam Questions & Navigation)      */}
      {/* ==================================================== */}
      {viewMode === 'taking' && currentQ && (
        <View style={{ flex: 1 }}>
          {/* Question Numbers Horizontal Palette */}
          <View
            style={[
              styles.paletteContainer,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
              },
            ]}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {questions.map((q, idx) => {
                const qId = q._id || q.id;
                const isAnswered =
                  userAnswers[qId] !== undefined &&
                  userAnswers[qId] !== null &&
                  userAnswers[qId] !== '';
                const isCurrent = idx === currentQuestionIndex;

                return (
                  <TouchableOpacity
                    key={qId || `pal_${idx}`}
                    style={[
                      styles.paletteBtn,
                      isCurrent && { borderColor: '#6366F1', borderWidth: 2 },
                      isAnswered
                        ? { backgroundColor: '#10B981' }
                        : { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' },
                    ]}
                    onPress={() => setCurrentQuestionIndex(idx)}
                  >
                    <Text
                      style={[
                        styles.paletteBtnText,
                        {
                          color: isAnswered
                            ? '#FFFFFF'
                            : isDarkMode
                            ? '#94A3B8'
                            : '#475569',
                          fontWeight: isCurrent ? '800' : '600',
                        },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Autosave Status Pill */}
            <View style={styles.autosavePill}>
              {autosaveStatus === 'saving' ? (
                <>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.autosaveText}>Saving draft...</Text>
                </>
              ) : autosaveStatus === 'saved' ? (
                <>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={[styles.autosaveText, { color: '#10B981' }]}>Draft saved</Text>
                </>
              ) : autosaveStatus === 'error' ? (
                <>
                  <Ionicons name="alert-circle" size={14} color="#F59E0B" />
                  <Text style={[styles.autosaveText, { color: '#F59E0B' }]}>Save failed</Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Question Card Scroll Area */}
          <ScrollView
            style={styles.takingScroll}
            contentContainerStyle={styles.takingContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Question Info Bar */}
            <View style={styles.questionInfoBar}>
              <Text
                style={[
                  styles.questionNumberText,
                  { color: isDarkMode ? '#6366F1' : '#4F46E5' },
                ]}
              >
                Question {currentQuestionIndex + 1} of {questions.length}
              </Text>
              <Text
                style={[
                  styles.marksText,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                [{currentQ.marks} {currentQ.marks === 1 ? 'Mark' : 'Marks'}]
              </Text>
            </View>

            {/* Question Text */}
            <Text
              style={[
                styles.questionPrompt,
                { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              {currentQ.questionText}
            </Text>

            {/* Render based on Question Type */}
            {currentQ.type === 'MCQ' ? (
              <View style={styles.optionsStack}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>MULTIPLE CHOICE</Text>
                </View>

                {(currentQ.options || []).map((opt, optIdx) => {
                  const optVal = opt.text || (typeof opt === 'string' ? opt : `Option ${optIdx + 1}`);
                  const isSelected = currentQAnswer === optVal;

                  return (
                    <TouchableOpacity
                      key={opt._id || opt.id || `opt_${optIdx}`}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: isSelected
                            ? isDarkMode
                              ? '#1E1B4B'
                              : '#EEF2FF'
                            : isDarkMode
                            ? '#151E2E'
                            : '#FFFFFF',
                          borderColor: isSelected
                            ? '#6366F1'
                            : isDarkMode
                            ? '#1E293B'
                            : '#E2E8F0',
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => handleSelectOptionAnswer(currentQId, optVal)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          {
                            borderColor: isSelected ? '#6366F1' : '#94A3B8',
                            backgroundColor: isSelected ? '#6366F1' : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          {
                            color: isSelected
                              ? isDarkMode
                                ? '#C7D2FE'
                                : '#4338CA'
                              : isDarkMode
                              ? '#E2E8F0'
                              : '#1E293B',
                            fontWeight: isSelected ? '600' : '400',
                          },
                        ]}
                      >
                        {optVal}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : currentQ.type === 'TRUE_FALSE' ? (
              <View style={styles.optionsStack}>
                <View style={[styles.typeBadge, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={[styles.typeBadgeText, { color: '#0369A1' }]}>
                    TRUE OR FALSE
                  </Text>
                </View>

                {['True', 'False'].map((tfVal) => {
                  const isSelected = currentQAnswer === tfVal;
                  return (
                    <TouchableOpacity
                      key={tfVal}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: isSelected
                            ? isDarkMode
                              ? '#082F49'
                              : '#F0F9FF'
                            : isDarkMode
                            ? '#151E2E'
                            : '#FFFFFF',
                          borderColor: isSelected
                            ? '#0284C7'
                            : isDarkMode
                            ? '#1E293B'
                            : '#E2E8F0',
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => handleSelectOptionAnswer(currentQId, tfVal)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          {
                            borderColor: isSelected ? '#0284C7' : '#94A3B8',
                            backgroundColor: isSelected ? '#0284C7' : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          {
                            color: isSelected
                              ? isDarkMode
                                ? '#BAE6FD'
                                : '#0369A1'
                              : isDarkMode
                              ? '#E2E8F0'
                              : '#1E293B',
                            fontWeight: isSelected ? '600' : '400',
                          },
                        ]}
                      >
                        {tfVal}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : currentQ.type === 'BOOK_REVIEW' || currentQ.type === 'RESEARCH_PAPER' ? (
              <View style={styles.optionsStack}>
                <View style={[styles.typeBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.typeBadgeText, { color: '#B45309' }]}>
                    {currentQ.type === 'BOOK_REVIEW'
                      ? 'BOOK REVIEW (Upload & Abstract)'
                      : 'RESEARCH PAPER (Upload & Abstract)'}
                  </Text>
                </View>

                {/* Upload File Box */}
                <TouchableOpacity
                  style={[
                    styles.docUploadBox,
                    {
                      backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                    },
                  ]}
                  onPress={() => handlePickQuestionFile(currentQId)}
                >
                  <Ionicons name="document-attach" size={24} color="#6366F1" />
                  <Text
                    style={[
                      styles.docUploadTitle,
                      { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                    ]}
                  >
                    {typeof currentQAnswer === 'object' && currentQAnswer?.fileName
                      ? currentQAnswer.fileName
                      : 'Upload Document (PDF, Word DOCX)'}
                  </Text>
                  <Text
                    style={[
                      styles.docUploadHint,
                      { color: isDarkMode ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    Tap to browse and attach document
                  </Text>
                </TouchableOpacity>

                {/* Text Commentary */}
                <TextInput
                  style={[
                    styles.descriptiveInput,
                    {
                      backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                      color: isDarkMode ? '#F8FAFC' : '#0F172A',
                    },
                  ]}
                  multiline
                  numberOfLines={4}
                  placeholder="Enter abstract, commentary, or review notes..."
                  placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                  value={
                    typeof currentQAnswer === 'object' && currentQAnswer !== null
                      ? currentQAnswer.textAnswer || ''
                      : typeof currentQAnswer === 'string'
                      ? currentQAnswer
                      : ''
                  }
                  onChangeText={(txt) => handleUpdateTextAnswer(currentQId, txt)}
                />
              </View>
            ) : (
              // SHORT_ANSWER or ESSAY
              <View style={styles.optionsStack}>
                <View style={[styles.typeBadge, { backgroundColor: '#F1F5F9' }]}>
                  <Text style={[styles.typeBadgeText, { color: '#475569' }]}>
                    WRITTEN ANSWER
                  </Text>
                </View>

                <TextInput
                  style={[
                    styles.descriptiveInput,
                    {
                      backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                      color: isDarkMode ? '#F8FAFC' : '#0F172A',
                    },
                  ]}
                  multiline
                  numberOfLines={6}
                  placeholder="Type your answer here..."
                  placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                  value={
                    typeof currentQAnswer === 'object' && currentQAnswer !== null
                      ? currentQAnswer.textAnswer || ''
                      : typeof currentQAnswer === 'string'
                      ? currentQAnswer
                      : ''
                  }
                  onChangeText={(txt) => handleUpdateTextAnswer(currentQId, txt)}
                />
              </View>
            )}
          </ScrollView>

          {/* Bottom Navigation Buttons */}
          <View
            style={[
              styles.takingFooter,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                borderTopColor: isDarkMode ? '#1E293B' : '#E2E8F0',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.navBtn,
                currentQuestionIndex === 0 && { opacity: 0.4 },
                { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
              ]}
              onPress={() =>
                setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
              }
              disabled={currentQuestionIndex === 0}
            >
              <Ionicons
                name="arrow-back"
                size={16}
                color={isDarkMode ? '#F8FAFC' : '#0F172A'}
              />
              <Text
                style={[
                  styles.navBtnText,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Previous
              </Text>
            </TouchableOpacity>

            {currentQuestionIndex < questions.length - 1 ? (
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: '#6366F1' }]}
                onPress={() =>
                  setCurrentQuestionIndex((prev) =>
                    Math.min(questions.length - 1, prev + 1)
                  )
                }
              >
                <Text style={[styles.navBtnText, { color: '#FFFFFF' }]}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: '#10B981' }]}
                onPress={() => setIsSubmitModalVisible(true)}
              >
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                <Text style={[styles.navBtnText, { color: '#FFFFFF' }]}>Review & Submit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ==================================================== */}
      {/* 5. MODE: 'review' (Attempt Submission Review)        */}
      {/* ==================================================== */}
      {viewMode === 'review' && (
        <ScrollView
          contentContainerStyle={styles.reviewContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingReview ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={[styles.loadingText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Loading attempt review...
              </Text>
            </View>
          ) : !reviewData ? (
            <View style={styles.centerContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={[styles.errorTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                Attempt Not Found
              </Text>
              <Text style={[styles.errorSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Could not retrieve review data for this attempt.
              </Text>
            </View>
          ) : (
            <>
              {/* Review Score Summary Banner */}
              <View
                style={[
                  styles.reviewBanner,
                  {
                    backgroundColor:
                      reviewData.status === 'PASSED'
                        ? isDarkMode
                          ? '#064E3B'
                          : '#F0FDF4'
                        : isDarkMode
                        ? '#1E1B4B'
                        : '#EEF2FF',
                    borderColor:
                      reviewData.status === 'PASSED' ? '#10B981' : '#6366F1',
                  },
                ]}
              >
                <Ionicons
                  name={
                    reviewData.status === 'PASSED'
                      ? 'trophy-outline'
                      : 'ribbon-outline'
                  }
                  size={36}
                  color={
                    reviewData.status === 'PASSED' ? '#10B981' : '#6366F1'
                  }
                />
                <Text
                  style={[
                    styles.reviewBannerTitle,
                    {
                      color:
                        reviewData.status === 'PASSED'
                          ? '#10B981'
                          : isDarkMode
                          ? '#F8FAFC'
                          : '#0F172A',
                    },
                  ]}
                >
                  {reviewData.status === 'PASSED' ? 'Passed!' : 'Submission Complete'}
                </Text>
                <Text
                  style={[
                    styles.reviewBannerScore,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  Score: {reviewData.score} / {reviewData.totalMarks} ({reviewData.percentage}%)
                </Text>
              </View>

              {/* Questions Breakdown */}
              {(reviewData.questions || reviewData.AttemptQuestions || []).length > 0 ? (
                <View style={{ marginTop: 20 }}>
                  <Text
                    style={[
                      styles.sectionHeading,
                      { color: isDarkMode ? '#E2E8F0' : '#1E293B' },
                    ]}
                  >
                    Question-by-Question Review
                  </Text>

                  {(reviewData.questions || reviewData.AttemptQuestions || []).map((rq, rIdx) => (
                    <View
                      key={rq.questionId || `rq_${rIdx}`}
                      style={[
                        styles.reviewCard,
                        {
                          backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                          borderColor: rq.isCorrect
                            ? '#10B981'
                            : isDarkMode
                            ? '#1E293B'
                            : '#E2E8F0',
                        },
                      ]}
                    >
                      <View style={styles.reviewCardHeader}>
                        <Text
                          style={[
                            styles.reviewCardQNum,
                            { color: isDarkMode ? '#6366F1' : '#4F46E5' },
                          ]}
                        >
                          Question {rIdx + 1}
                        </Text>
                        {rq.isCorrect !== undefined ? (
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: rq.isCorrect ? '#DCFCE7' : '#FEE2E2',
                              },
                            ]}
                          >
                            <Ionicons
                              name={rq.isCorrect ? 'checkmark-circle' : 'close-circle'}
                              size={12}
                              color={rq.isCorrect ? '#15803D' : '#DC2626'}
                            />
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: rq.isCorrect ? '#15803D' : '#DC2626' },
                              ]}
                            >
                              {rq.isCorrect ? 'CORRECT' : 'INCORRECT'}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text
                        style={[
                          styles.reviewQuestionText,
                          { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                        ]}
                      >
                        {rq.questionText}
                      </Text>

                      {/* Student Answer */}
                      {rq.selectedOption || rq.textAnswer ? (
                        <View style={styles.reviewAnswerRow}>
                          <Text
                            style={[
                              styles.reviewAnswerLabel,
                              { color: isDarkMode ? '#94A3B8' : '#64748B' },
                            ]}
                          >
                            Your Answer:
                          </Text>
                          <Text
                            style={[
                              styles.reviewAnswerVal,
                              { color: isDarkMode ? '#E2E8F0' : '#1E293B' },
                            ]}
                          >
                            {String(rq.selectedOption || rq.textAnswer)}
                          </Text>
                        </View>
                      ) : null}

                      {/* Correct Option if available */}
                      {rq.correctOption || rq.correctAnswer ? (
                        <View style={styles.reviewAnswerRow}>
                          <Text
                            style={[
                              styles.reviewAnswerLabel,
                              { color: '#10B981' },
                            ]}
                          >
                            Correct Answer:
                          </Text>
                          <Text
                            style={[
                              styles.reviewAnswerVal,
                              { color: '#10B981', fontWeight: '600' },
                            ]}
                          >
                            {String(rq.correctOption || rq.correctAnswer)}
                          </Text>
                        </View>
                      ) : null}

                      {/* Explanation */}
                      {rq.explanation ? (
                        <View
                          style={[
                            styles.reviewExplanationBox,
                            {
                              backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                            },
                          ]}
                        >
                          <Text style={styles.explanationLabel}>Explanation:</Text>
                          <Text
                            style={[
                              styles.explanationText,
                              { color: isDarkMode ? '#CBD5E1' : '#334155' },
                            ]}
                          >
                            {rq.explanation}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      {/* ==================================================== */}
      {/* 6. SUBMISSION CONFIRMATION MODAL                     */}
      {/* ==================================================== */}
      <Modal
        visible={isSubmitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSubmitModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.confirmDialog,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
              },
            ]}
          >
            <Ionicons name="help-circle-outline" size={44} color="#6366F1" />
            <Text
              style={[
                styles.confirmTitle,
                { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              Submit Exam Attempt?
            </Text>

            <Text
              style={[
                styles.confirmMessage,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              You have answered {answeredCount} of {questions.length} questions.
              {answeredCount < questions.length
                ? '\n\n⚠️ You still have unanswered questions! Are you sure you want to finalize submission now?'
                : '\n\nOnce submitted, answers cannot be modified.'}
            </Text>

            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={[
                  styles.cancelModalBtn,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' },
                ]}
                onPress={() => setIsSubmitModalVisible(false)}
                disabled={isSubmittingExam}
              >
                <Text
                  style={[
                    styles.cancelModalBtnText,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  Continue Exam
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmModalBtn, { backgroundColor: '#10B981' }]}
                onPress={executeFinalSubmit}
                disabled={isSubmittingExam}
              >
                {isSubmittingExam ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmModalBtnText}>Confirm Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  titleCol: {
    flex: 1,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  refreshIconBtn: {
    padding: 6,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 18,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  dueText: {
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  metaBar: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 12,
    justifyContent: 'space-around',
  },
  metaStat: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailsHeroBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  detailsHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailsHeroDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  metricChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoCardContent: {
    fontSize: 13,
    lineHeight: 20,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 12,
  },
  pastAttemptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  pastAttemptTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  pastAttemptDate: {
    fontSize: 12,
    marginTop: 2,
  },
  pastAttemptScore: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    gap: 4,
  },
  reviewBtnText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
  },
  paletteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  paletteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  paletteBtnText: {
    fontSize: 13,
  },
  autosavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  autosaveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
  },
  takingScroll: {
    flex: 1,
  },
  takingContent: {
    padding: 16,
    paddingBottom: 40,
  },
  questionInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumberText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  marksText: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionPrompt: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 16,
  },
  optionsStack: {
    gap: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#EEF2FF',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  docUploadBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  docUploadTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  docUploadHint: {
    fontSize: 11,
  },
  descriptiveInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
    minHeight: 120,
  },
  takingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reviewContent: {
    padding: 16,
    paddingBottom: 40,
  },
  reviewBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  reviewBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  reviewBannerScore: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  reviewCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewCardQNum: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reviewQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  reviewAnswerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  reviewAnswerLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  reviewAnswerVal: {
    fontSize: 13,
  },
  reviewExplanationBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
  },
  explanationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 2,
  },
  explanationText: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmDialog: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
