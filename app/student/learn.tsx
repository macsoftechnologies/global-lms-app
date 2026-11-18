import React, { useState, useEffect, useMemo, useCallback, useRef, ComponentRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  LayoutAnimation,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView, WebViewProps } from 'react-native-webview';
import { DashboardService } from '../../src/services/dashboardService';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import { useTheme } from '../../src/context/ThemeContext';
import {
  QuizSubmissionAnswer,
  QuizSubmissionResult,
  SacredAiCompanionModal,
  StudyModuleView,
} from '../../src/components/SacredAiCompanionModal';
import {
  CourseModule,
  CourseLesson,
  CourseProgressData,
  LessonAiStudyData,
  PublishedCourse,
  VideoLessonTranscript,
} from '../../src/types';
import {
  REWATCH_RESTRICTED_MESSAGE,
  PlayerTelemetryEvent,
  accumulateActivePlaybackMs,
  evaluateLessonWatchState,
  formatClockSeconds,
  isBackendWatchRestrictionError,
  parseBackendLessonDurationSeconds,
  parseRawIframePostMessage,
  resolveTrackedVideoSource,
  shouldSyncWatchTime,
} from '../../src/utils/learnWatchTime';

interface CleanLesson extends CourseLesson {
  completed?: boolean;
  backendDurationSec?: number;
  isWatchRestricted?: boolean;
  restrictionReason?: string;
}

interface CleanModule extends CourseModule {
  lessons?: CleanLesson[];
}

export default function StudentLearnScreen() {
  const { isDarkMode } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isWideLayout = screenWidth >= 768;
  const mobileModulesMaxHeight = Math.min(480, Math.max(340, Math.round(screenHeight * 0.52)));
  const params = useLocalSearchParams<{ id?: string; courseId?: string; title?: string }>();
  const courseId = params.id || params.courseId || '';

  // Navigation & User State
  const [currentUser, setCurrentUser] = useState<AuthSession['user'] | null>(null);
  const [activeHeaderTab, setActiveHeaderTab] = useState<'lessons' | 'exams' | 'assignments' | 'overview'>('lessons');

  // Course & Access Entitlement State
  const [, setCourse] = useState<PublishedCourse | null>(null);
  const [courseTitle, setCourseTitle] = useState<string>(params.title || 'Academic Course');
  const [isEntitled, setIsEntitled] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(true);
  const [, setIsLoadingCurriculum] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Curriculum & Lesson State
  const [modules, setModules] = useState<CleanModule[]>([]);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<CleanLesson | null>(null);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [courseProgress, setCourseProgress] = useState<CourseProgressData | null>(null);
  const [isMarkingComplete, setIsMarkingComplete] = useState<boolean>(false);
  const [isModulesPanelOpen, setIsModulesPanelOpen] = useState<boolean>(true);
  const modulesScrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const moduleOffsetsRef = useRef<Record<string, number>>({});
  const lessonOffsetsRef = useRef<Record<string, number>>({});

  // Video Playback, Watch-Time Tracking & One-Time Viewing State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(0);
  const [watchedSecondsDisplay, setWatchedSecondsDisplay] = useState<number>(0);
  const [initialResumeSec, setInitialResumeSec] = useState<number>(0);
  const [isVerifyingWatchStatus, setIsVerifyingWatchStatus] = useState<boolean>(false);
  const [restrictedLessonsById, setRestrictedLessonsById] = useState<Record<string, string>>({});
  const [watchSyncError, setWatchSyncError] = useState<string | null>(null);

  const webViewRef = useRef<WebView<WebViewProps>>(null);
  const webIframeRef = useRef<HTMLIFrameElement | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState || 'active') as AppStateStatus);
  const isScreenFocusedRef = useRef<boolean>(true);
  const isActivelyPlayingRef = useRef<boolean>(false);
  const isBufferingRef = useRef<boolean>(false);
  const lastPlaySampleAtRef = useRef<number | null>(null);
  const lastMediaProgressAtRef = useRef<number>(0);
  const activeWatchMsByLessonRef = useRef<Record<string, number>>({});
  const lastSyncedSecondsByLessonRef = useRef<Record<string, number>>({});
  const lastSyncAttemptAtByLessonRef = useRef<Record<string, number>>({});
  const inFlightSyncTargetByLessonRef = useRef<Record<string, number>>({});
  const restrictedLessonsRef = useRef<Record<string, string>>({});
  const activeContextRef = useRef<{
    courseId: string;
    moduleId: string;
    lessonId: string;
    videoType: string;
  }>({
    courseId: '',
    moduleId: '',
    lessonId: '',
    videoType: 'none',
  });
  const rawMsgStateRef = useRef<{ lastTime: number; lastDuration: number }>({
    lastTime: 0,
    lastDuration: 0,
  });
  const lessonSelectionSeqRef = useRef<number>(0);
  const autoCompleteTriggeredForLessonRef = useRef<Record<string, boolean>>({});
  const authPausedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!selectedLesson?.id) return;
    if (!isWideLayout && !isModulesPanelOpen) return;
    const targetId = selectedLesson.id;
    const timer = setTimeout(() => {
      const y = lessonOffsetsRef.current[targetId];
      if (typeof y === 'number' && y >= 0) {
        modulesScrollRef.current?.scrollTo({ y: Math.max(0, y - 48), animated: true });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedLesson?.id, isModulesPanelOpen, isWideLayout, modules.length]);

  // Pure UI transition helper for smooth accordion expand/collapse
  const animateLayoutTransition = useCallback(() => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
      );
    }
  }, []);

  // Module Expand / Collapse Helpers
  const isModuleExpanded = useCallback(
    (moduleId: string) => {
      return expandedModules[moduleId] !== undefined ? expandedModules[moduleId] : true;
    },
    [expandedModules]
  );

  const toggleModule = useCallback((moduleId: string) => {
    animateLayoutTransition();
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !(prev[moduleId] !== undefined ? prev[moduleId] : true),
    }));
  }, [animateLayoutTransition]);

  const areAllModulesExpanded = useMemo(() => {
    if (modules.length === 0) return false;
    return modules.every((m) => isModuleExpanded(m.id));
  }, [modules, isModuleExpanded]);

  const handleToggleAllModules = useCallback(() => {
    animateLayoutTransition();
    const nextState = !areAllModulesExpanded;
    const updated: Record<string, boolean> = {};
    modules.forEach((m) => {
      updated[m.id] = nextState;
    });
    setExpandedModules(updated);
  }, [animateLayoutTransition, areAllModulesExpanded, modules]);

  // AI Learning Module State & Modals
  const [aiData, setAiData] = useState<LessonAiStudyData | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiDataCacheRef = useRef<Record<string, LessonAiStudyData>>({});
  const inFlightAiLessonKeyRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const aiRequestSeqRef = useRef<number>(0);
  const [modalType, setModalType] = useState<'ask' | 'transcript' | null>(null);
  const [companionVisible, setCompanionVisible] = useState<boolean>(false);
  const [companionView, setCompanionView] = useState<StudyModuleView>(null);
  const [companionSessionKey, setCompanionSessionKey] = useState<number>(0);
  const [transcriptData, setTranscriptData] = useState<VideoLessonTranscript | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);
  const [transcriptSearch, setTranscriptSearch] = useState<string>('');
  const [askQuery, setAskQuery] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'ai'; text: string }[]>([
    {
      sender: 'ai',
      text: 'Greetings! I am your AI Theological Tutor. Ask me any question about this lecture or tap a study module below.',
    },
  ]);

  // Filtered transcript cues by search query
  const filteredCues = useMemo(() => {
    if (!transcriptData?.cues) return [];
    if (!transcriptSearch.trim()) return transcriptData.cues;
    const q = transcriptSearch.toLowerCase().trim();
    return transcriptData.cues.filter((c) => c.text && c.text.toLowerCase().includes(q));
  }, [transcriptData, transcriptSearch]);

  const formatCueTime = useCallback((sec?: number) => {
    if (sec === undefined || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }, []);

  // 0. AI Companion Q&A Handler
  const handleSendAsk = (questionText?: string) => {
    const q = (questionText || askQuery).trim();
    if (!q) return;

    const userMsg = { sender: 'user' as const, text: q };
    setChatMessages((prev) => [...prev, userMsg]);
    setAskQuery('');

    // Answer intelligently using genuine live lesson briefing and syllabus
    setTimeout(() => {
      let reply = '';
      const qLower = q.toLowerCase();
      if (qLower.includes('summar') || qLower.includes('brief')) {
        reply = aiData?.summary || 'This lecture explores core mission principles, historical developments, and church outreach strategies.';
      } else if (qLower.includes('concept') || qLower.includes('context')) {
        if (aiData?.backstory && aiData.backstory.length > 0) {
          reply = aiData.backstory.map((c) => `• ${c.topic}: ${c.explanation}`).join('\n\n');
        } else {
          reply = 'The lecture establishes foundational principles and biblical framework for 21st-century missional leadership.';
        }
      } else if (qLower.includes('takeaway') || qLower.includes('point') || qLower.includes('action')) {
        if (aiData?.key_takeaways && aiData.key_takeaways.length > 0) {
          reply = aiData.key_takeaways.map((t, i) => `${i + 1}. ${t}`).join('\n');
        } else {
          reply = 'Key takeaways emphasize sound doctrine, cross-cultural competence, and historical theological awareness.';
        }
      } else {
        reply = `Regarding "${q}": In "${courseTitle}", current missiological research emphasizes engaging contextual challenges while preserving biblical fidelity. Review the Executive Summary and Knowledge Check for more details.`;
      }

      setChatMessages((prev) => [...prev, { sender: 'ai' as const, text: reply }]);
    }, 350);
  };

  // 1. Load User Profile for Watermark
  useEffect(() => {
    let isMounted = true;
    AuthStorage.getUser().then((user) => {
      if (isMounted && user) setCurrentUser(user);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Shared helper: Merge authoritative backend course progress into curriculum and active lesson
  const applyLessonProgressToModules = useCallback(
    (
      sourceModules: CleanModule[],
      freshProgress: CourseProgressData | null | undefined,
      restrictionOverrides?: Record<string, string>
    ): CleanModule[] => {
      return sourceModules.map((mod) => ({
        ...mod,
        lessons: mod.lessons?.map((les) => {
          const evalState = evaluateLessonWatchState(
            les,
            freshProgress,
            null,
            les.backendDurationSec
          );
          const mergedWatchedSec = Math.max(
            evalState.watchedSeconds,
            Math.floor((activeWatchMsByLessonRef.current[les.id] || 0) / 1000)
          );
          activeWatchMsByLessonRef.current[les.id] = Math.max(
            activeWatchMsByLessonRef.current[les.id] || 0,
            evalState.watchedSeconds * 1000
          );
          lastSyncedSecondsByLessonRef.current[les.id] = Math.max(
            lastSyncedSecondsByLessonRef.current[les.id] || 0,
            evalState.watchedSeconds
          );
          const explicitRestrictionMsg =
            restrictionOverrides?.[les.id] || restrictedLessonsRef.current[les.id];
          const isRestricted = Boolean(evalState.isWatchRestricted || explicitRestrictionMsg);
          if (isRestricted && explicitRestrictionMsg) {
            restrictedLessonsRef.current[les.id] = explicitRestrictionMsg;
          }
          return {
            ...les,
            completed: evalState.completed,
            watchedSeconds: mergedWatchedSec,
            isWatchRestricted: isRestricted,
            restrictionReason: explicitRestrictionMsg || evalState.restrictionReason,
          };
        }),
      }));
    },
    []
  );

  const applyBackendCourseProgress = useCallback(
    (freshProgress: CourseProgressData, restrictionOverrides?: Record<string, string>) => {
      setCourseProgress(freshProgress);
      if (typeof freshProgress.progressPercentage === 'number') {
        setProgressPercentage(freshProgress.progressPercentage);
      }

      setModules((prev) => applyLessonProgressToModules(prev, freshProgress, restrictionOverrides));

      setSelectedLesson((prev) => {
        if (!prev) return null;
        const evalState = evaluateLessonWatchState(
          prev,
          freshProgress,
          null,
          prev.backendDurationSec
        );
        const explicitRestrictionMsg =
          restrictionOverrides?.[prev.id] || restrictedLessonsRef.current[prev.id];
        const isRestricted = Boolean(evalState.isWatchRestricted || explicitRestrictionMsg);
        const mergedWatchedSec = Math.max(
          evalState.watchedSeconds,
          Math.floor((activeWatchMsByLessonRef.current[prev.id] || 0) / 1000)
        );
        activeWatchMsByLessonRef.current[prev.id] = Math.max(
          activeWatchMsByLessonRef.current[prev.id] || 0,
          evalState.watchedSeconds * 1000
        );
        lastSyncedSecondsByLessonRef.current[prev.id] = Math.max(
          lastSyncedSecondsByLessonRef.current[prev.id] || 0,
          evalState.watchedSeconds
        );
        return {
          ...prev,
          completed: evalState.completed,
          watchedSeconds: mergedWatchedSec,
          isWatchRestricted: isRestricted,
          restrictionReason: explicitRestrictionMsg || evalState.restrictionReason,
        };
      });
    },
    [applyLessonProgressToModules]
  );

  // Player command helpers (work on both native WebView and Web iframe/video)
  const pauseEmbeddedPlayer = useCallback(() => {
    if (Platform.OS === 'web') {
      if (webVideoRef.current && typeof webVideoRef.current.pause === 'function') {
        try {
          webVideoRef.current.pause();
        } catch {
          // Ignore DOM pause errors
        }
      }
      const win = webIframeRef.current?.contentWindow;
      if (win) {
        try {
          if (activeContextRef.current.videoType === 'vimeo') {
            win.postMessage(JSON.stringify({ method: 'pause' }), 'https://player.vimeo.com');
          } else if (activeContextRef.current.videoType === 'youtube') {
            win.postMessage(
              JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
              '*'
            );
          }
        } catch {
          // Ignore iframe postMessage errors
        }
      }
      return;
    }

    webViewRef.current?.injectJavaScript('window.__pauseLmsVideo && window.__pauseLmsVideo(); true;');
  }, []);

  const commitCurrentActiveMs = useCallback((nowMs: number = Date.now()) => {
    const activeLessonId = activeContextRef.current.lessonId;
    if (!activeLessonId) return;

    const currentMs = activeWatchMsByLessonRef.current[activeLessonId] || 0;
    const { nextTotalMs, nextSampleMs } = accumulateActivePlaybackMs({
      currentMs,
      lastSampleMs: lastPlaySampleAtRef.current,
      nowMs,
      isActivelyPlaying: isActivelyPlayingRef.current,
      isAppActive: appStateRef.current === 'active',
      isScreenFocused: isScreenFocusedRef.current,
      isBuffering: isBufferingRef.current,
    });

    activeWatchMsByLessonRef.current[activeLessonId] = nextTotalMs;
    lastPlaySampleAtRef.current = nextSampleMs;
    const nextSeconds = Math.floor(nextTotalMs / 1000);
    setWatchedSecondsDisplay(nextSeconds);
  }, []);

  const syncWatchTimeForLesson = useCallback(
    async (
      targetCourseId: string,
      targetModuleId: string,
      targetLessonId: string,
      forceFlush: boolean
    ) => {
      if (!targetCourseId || !targetLessonId) return;
      if (restrictedLessonsRef.current[targetLessonId]) return;

      const totalWatchedSeconds = Math.floor(
        (activeWatchMsByLessonRef.current[targetLessonId] || 0) / 1000
      );
      const lastSent = lastSyncedSecondsByLessonRef.current[targetLessonId] || 0;
      const lastAttemptAt = lastSyncAttemptAtByLessonRef.current[targetLessonId] || 0;
      const now = Date.now();

      if (
        !shouldSyncWatchTime({
          totalWatchedSeconds,
          lastSentSeconds: lastSent,
          lastSyncAtMs: lastAttemptAt,
          nowMs: now,
          forceFlush,
        })
      ) {
        return;
      }

      const inFlightTarget = inFlightSyncTargetByLessonRef.current[targetLessonId] || 0;
      if (inFlightTarget >= totalWatchedSeconds) {
        return;
      }

      inFlightSyncTargetByLessonRef.current[targetLessonId] = totalWatchedSeconds;
      lastSyncAttemptAtByLessonRef.current[targetLessonId] = now;

      try {
        const res = await DashboardService.updateLessonWatchTime(
          targetCourseId,
          targetModuleId || '',
          targetLessonId,
          totalWatchedSeconds
        );

        if (res.success) {
          const confirmedSec = Math.max(
            totalWatchedSeconds,
            Number(res.data?.watchedSeconds || 0) || 0
          );
          lastSyncedSecondsByLessonRef.current[targetLessonId] = Math.max(
            lastSyncedSecondsByLessonRef.current[targetLessonId] || 0,
            confirmedSec
          );
          setWatchSyncError(null);

          if (typeof res.data?.progressPercentage === 'number') {
            setProgressPercentage(res.data.progressPercentage);
          }

          const backendCompletedOrBlocked = Boolean(
            res.data?.completed ||
              res.data?.isCompleted ||
              res.data?.isWatched ||
              res.data?.fullyWatched ||
              res.data?.canWatch === false ||
              res.data?.rewatchAllowed === false ||
              res.data?.allowRewatch === false ||
              res.data?.watchLimitReached === true ||
              res.data?.maxWatchesReached === true ||
              res.data?.viewingRestricted === true
          );

          if (backendCompletedOrBlocked) {
            const reason = res.data?.message || REWATCH_RESTRICTED_MESSAGE;
            restrictedLessonsRef.current[targetLessonId] = reason;
            setRestrictedLessonsById((prev) => ({ ...prev, [targetLessonId]: reason }));
            if (activeContextRef.current.lessonId === targetLessonId) {
              isActivelyPlayingRef.current = false;
              isBufferingRef.current = false;
              lastPlaySampleAtRef.current = null;
              setIsPlaying(false);
              pauseEmbeddedPlayer();
            }
            const fresh = await DashboardService.getCourseProgress(targetCourseId);
            if (fresh.success && fresh.data) {
              applyBackendCourseProgress(fresh.data);
            }
          }
          return;
        }

        if (res.status === 401) {
          authPausedRef.current = true;
          if (activeContextRef.current.lessonId === targetLessonId) {
            isActivelyPlayingRef.current = false;
            isBufferingRef.current = false;
            lastPlaySampleAtRef.current = null;
            setIsPlaying(false);
            pauseEmbeddedPlayer();
          }
          setWatchSyncError('Session expired. Please sign in again to save watch progress.');
          return;
        }

        if (isBackendWatchRestrictionError(res.status, res.error, res.data)) {
          const reason = res.error || REWATCH_RESTRICTED_MESSAGE;
          restrictedLessonsRef.current[targetLessonId] = reason;
          setRestrictedLessonsById((prev) => ({ ...prev, [targetLessonId]: reason }));
          if (activeContextRef.current.lessonId === targetLessonId) {
            isActivelyPlayingRef.current = false;
            isBufferingRef.current = false;
            lastPlaySampleAtRef.current = null;
            setIsPlaying(false);
            pauseEmbeddedPlayer();
          }
          const fresh = await DashboardService.getCourseProgress(targetCourseId);
          if (fresh.success && fresh.data) {
            applyBackendCourseProgress(fresh.data);
          }
          return;
        }

        if (res.error) {
          setWatchSyncError(res.error);
        }
      } finally {
        if (inFlightSyncTargetByLessonRef.current[targetLessonId] === totalWatchedSeconds) {
          delete inFlightSyncTargetByLessonRef.current[targetLessonId];
        }
      }
    },
    [applyBackendCourseProgress, pauseEmbeddedPlayer]
  );

  const stopAndFlushActivePlayback = useCallback(
    async (shouldPauseMedia: boolean = true) => {
      const { courseId: cId, moduleId: mId, lessonId: lId } = activeContextRef.current;
      commitCurrentActiveMs(Date.now());
      isActivelyPlayingRef.current = false;
      isBufferingRef.current = false;
      lastPlaySampleAtRef.current = null;
      setIsPlaying(false);
      if (shouldPauseMedia) {
        pauseEmbeddedPlayer();
      }
      if (cId && lId) {
        await syncWatchTimeForLesson(cId, mId, lId, true);
      }
    },
    [commitCurrentActiveMs, pauseEmbeddedPlayer, syncWatchTimeForLesson]
  );

  // 2. Verify Course Purchase Entitlement & Load Course Data
  const initializeCourse = useCallback(async () => {
    if (!courseId) {
      setIsCheckingAccess(false);
      setIsLoadingCurriculum(false);
      return;
    }
    try {
      await stopAndFlushActivePlayback();
      setIsCheckingAccess(true);
      
      const user = await AuthStorage.getUser();
      const studentId = user?.id || 'me';

      const [accessRes, courseDetailsRes, progressRes] = await Promise.all([
        DashboardService.verifyCourseAccess(courseId, studentId),
        DashboardService.getCourseById(courseId),
        DashboardService.getCourseProgress(courseId),
      ]);

      // Strictly enforce course entitlement from backend response
      const canAccess = Boolean(accessRes.canAccess);
      setIsEntitled(canAccess);

      if (courseDetailsRes.success && courseDetailsRes.data) {
        setCourse(courseDetailsRes.data);
        if (courseDetailsRes.data.title) {
          setCourseTitle(courseDetailsRes.data.title);
        }
      }

      const freshProgress = progressRes.success && progressRes.data ? progressRes.data : null;
      if (freshProgress) {
        setCourseProgress(freshProgress);
        setProgressPercentage(freshProgress.progressPercentage || 0);
      }

      // 3. Load Modules & Lessons from API only if entitled
      if (canAccess) {
        const modulesRes = await DashboardService.getCourseModules(courseId);
        if (modulesRes.success && modulesRes.data && modulesRes.data.length > 0) {
          const liveModules: CleanModule[] = [];
          for (const mod of modulesRes.data) {
            const lessonsRes = await DashboardService.getModuleLessons(courseId, mod.id);
            const lessonsList: CleanLesson[] =
              lessonsRes.success && lessonsRes.data
                ? lessonsRes.data.map((l) => {
                    const backendDurationSec = parseBackendLessonDurationSeconds(l);
                    const evalState = evaluateLessonWatchState(
                      l,
                      freshProgress,
                      null,
                      backendDurationSec
                    );
                    activeWatchMsByLessonRef.current[l.id] = Math.max(
                      activeWatchMsByLessonRef.current[l.id] || 0,
                      evalState.watchedSeconds * 1000
                    );
                    lastSyncedSecondsByLessonRef.current[l.id] = Math.max(
                      lastSyncedSecondsByLessonRef.current[l.id] || 0,
                      evalState.watchedSeconds
                    );
                    return {
                      ...l,
                      duration: l.duration || '20:00',
                      backendDurationSec,
                      completed: evalState.completed,
                      watchedSeconds: evalState.watchedSeconds,
                      isWatchRestricted: evalState.isWatchRestricted,
                      restrictionReason: evalState.restrictionReason,
                    };
                  })
                : [];
            liveModules.push({
              ...mod,
              lessons: lessonsList.length > 0 ? lessonsList : undefined,
            });
          }
          setModules(liveModules);

          // By default expand all modules so student can see full curriculum vertically
          const initialExpanded: Record<string, boolean> = {};
          liveModules.forEach((m) => {
            initialExpanded[m.id] = true;
          });
          setExpandedModules(initialExpanded);

          // Continue Learning auto-selection:
          // 1. Check if backend returned currentLessonId or lastLessonId
          // 2. Otherwise find the first incomplete lesson
          // 3. Otherwise fall back to the first lesson
          let targetLesson: CleanLesson | null = null;
          let targetModuleId = '';

          const preferredLessonId =
            freshProgress?.currentLessonId || freshProgress?.lastLessonId;

          if (preferredLessonId) {
            for (const m of liveModules) {
              const found = m.lessons?.find((l) => l.id === preferredLessonId);
              if (found) {
                targetLesson = found;
                targetModuleId = m.id;
                break;
              }
            }
          }

          if (!targetLesson) {
            for (const m of liveModules) {
              const uncompleted = m.lessons?.find((l) => !l.completed);
              if (uncompleted) {
                targetLesson = uncompleted;
                targetModuleId = m.id;
                break;
              }
            }
          }

          if (
            !targetLesson &&
            liveModules.length > 0 &&
            liveModules[0].lessons &&
            liveModules[0].lessons.length > 0
          ) {
            targetLesson = liveModules[0].lessons[0];
            targetModuleId = liveModules[0].id;
          }

          if (targetLesson) {
            const evalState = evaluateLessonWatchState(
              targetLesson,
              freshProgress,
              null,
              targetLesson.backendDurationSec
            );
            const resumeAt =
              !evalState.isWatchRestricted &&
              evalState.watchedSeconds > 0 &&
              (!targetLesson.backendDurationSec ||
                evalState.watchedSeconds < targetLesson.backendDurationSec - 2)
                ? evalState.watchedSeconds
                : 0;
            setSelectedModuleId(targetModuleId);
            setSelectedLesson(targetLesson);
            setInitialResumeSec(resumeAt);
            setCurrentTimeSec(resumeAt);
            setVideoDurationSec(targetLesson.backendDurationSec || 0);
            setWatchedSecondsDisplay(evalState.watchedSeconds);
            rawMsgStateRef.current = {
              lastTime: resumeAt,
              lastDuration: targetLesson.backendDurationSec || 0,
            };
          } else {
            setSelectedLesson(null);
          }
        } else {
          setModules([]);
          setSelectedLesson(null);
        }
      } else {
        setModules([]);
        setSelectedLesson(null);
      }
    } catch (err) {
      console.warn('[StudentLearn] Initialization error:', err);
    } finally {
      setIsCheckingAccess(false);
      setIsLoadingCurriculum(false);
      setIsRefreshing(false);
    }
  }, [courseId, stopAndFlushActivePlayback]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      await initializeCourse();
    });
    return () => {
      isMounted = false;
    };
  }, [initializeCourse]);

  // 3. Cache-first Lesson AI Data loader (real backend API, separated from UI synthesis animation)
  const loadLessonAiData = useCallback(
    async (lessonId: string, options?: { force?: boolean }) => {
      if (!courseId || !lessonId) {
        setAiData(null);
        setAiError(null);
        setIsLoadingAi(false);
        return;
      }

      const cacheKey = `${courseId}::${lessonId}`;
      const forceRefresh = Boolean(options?.force);

      if (!forceRefresh && aiDataCacheRef.current[cacheKey]) {
        setAiData(aiDataCacheRef.current[cacheKey]);
        setAiError(null);
        setIsLoadingAi(false);
        return;
      }

      if (!forceRefresh && inFlightAiLessonKeyRef.current?.key === cacheKey) {
        setIsLoadingAi(true);
        await inFlightAiLessonKeyRef.current.promise;
        return;
      }

      aiRequestSeqRef.current += 1;
      const seq = aiRequestSeqRef.current;
      setIsLoadingAi(true);
      setAiError(null);

      const task = (async () => {
        try {
          const res = await DashboardService.getLessonAiData(courseId, lessonId);
          if (aiRequestSeqRef.current !== seq) return;
          if (res.success && res.data) {
            aiDataCacheRef.current[cacheKey] = res.data;
            setAiData(res.data);
            setAiError(null);
          } else {
            setAiData(null);
            setAiError(res.error || 'Failed to load AI study materials for this lesson.');
          }
        } catch (err: unknown) {
          if (aiRequestSeqRef.current !== seq) return;
          setAiData(null);
          setAiError(
            err instanceof Error
              ? err.message
              : 'Network error while loading lesson AI study materials.'
          );
        } finally {
          if (inFlightAiLessonKeyRef.current?.key === cacheKey) {
            inFlightAiLessonKeyRef.current = null;
          }
          if (aiRequestSeqRef.current === seq) {
            setIsLoadingAi(false);
          }
        }
      })();

      inFlightAiLessonKeyRef.current = { key: cacheKey, promise: task };
      await task;
    },
    [courseId]
  );

  // 3b. Fetch Lesson Video Transcript (Vimeo / Backend)
  const loadLessonTranscript = useCallback(async (lessonId: string) => {
    if (!lessonId) {
      setTranscriptData(null);
      return;
    }
    try {
      setIsLoadingTranscript(true);
      const res = await DashboardService.getLessonTranscript(lessonId);
      if (res.success && res.data && res.data.cues && res.data.cues.length > 0) {
        setTranscriptData(res.data);
      } else {
        if (courseId) {
          const courseRes = await DashboardService.getCourseTranscripts(courseId);
          if (courseRes.success && courseRes.data) {
            const raw = courseRes.data;
            const list = Array.isArray(raw) ? raw : (raw as any)?.transcripts || [];
            const found = list.find((t: any) => t.lessonId === lessonId || t.id === lessonId);
            if (found && Array.isArray(found.cues)) {
              setTranscriptData({
                lessonId,
                vimeoId: found.vimeoId,
                language: found.language || 'en',
                cues: found.cues,
              });
              return;
            }
          }
        }
        setTranscriptData(null);
      }
    } catch {
      setTranscriptData(null);
    } finally {
      setIsLoadingTranscript(false);
    }
  }, [courseId]);

  const selectedLessonId = selectedLesson?.id || (selectedLesson as any)?._id || '';

  useEffect(() => {
    let isMounted = true;
    if (selectedLessonId && courseId) {
      Promise.resolve().then(async () => {
        if (!isMounted) return;
        await Promise.all([
          loadLessonTranscript(selectedLessonId),
          loadLessonAiData(selectedLessonId),
        ]);
      });
    } else {
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setAiData(null);
        setAiError(null);
        setTranscriptData(null);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [
    courseId,
    selectedLessonId,
    loadLessonTranscript,
    loadLessonAiData,
  ]);

  // 4. Flatten all lessons for Next Lesson / Previous navigation
  const allLessons = useMemo(() => {
    const list: { moduleTitle: string; moduleId: string; lesson: CleanLesson }[] = [];
    for (const mod of modules) {
      if (mod.lessons) {
        for (const les of mod.lessons) {
          list.push({ moduleTitle: mod.title, moduleId: mod.id, lesson: les });
        }
      }
    }
    return list;
  }, [modules]);

  const currentLessonIndex = useMemo(() => {
    if (!selectedLesson) return -1;
    return allLessons.findIndex((item) => (item.lesson.id || (item.lesson as any)._id) === (selectedLesson.id || (selectedLesson as any)._id));
  }, [allLessons, selectedLesson]);

  const activeModuleTitle = useMemo(() => {
    if (!selectedModuleId) return '';
    return modules.find((m) => m.id === selectedModuleId)?.title || '';
  }, [modules, selectedModuleId]);

  const completedLessonsCount = useMemo(
    () => allLessons.filter((item) => item.lesson.completed).length,
    [allLessons]
  );

  // Extract backend video URL string independently from watch-time progress updates
  const rawVideoUrl = useMemo(() => {
    const rawLesson = selectedLesson as any;
    return (
      rawLesson?.videoUrl ||
      rawLesson?.video_url ||
      rawLesson?.streamUrl ||
      rawLesson?.stream_url ||
      (typeof rawLesson?.video === 'string'
        ? rawLesson?.video
        : rawLesson?.video?.url || rawLesson?.video?.streamUrl) ||
      (typeof rawLesson?.vimeo === 'string'
        ? rawLesson?.vimeo
        : rawLesson?.vimeo?.url || rawLesson?.vimeoUrl) ||
      rawLesson?.contentUrl ||
      rawLesson?.content_url ||
      (typeof rawLesson?.content === 'object' && rawLesson?.content
        ? rawLesson?.content?.videoUrl || rawLesson?.content?.url
        : '') ||
      (typeof rawLesson?.url === 'string' &&
      (rawLesson.url.includes('vimeo') ||
        rawLesson.url.includes('youtu') ||
        rawLesson.url.includes('.mp4') ||
        rawLesson.url.includes('.m3u8'))
        ? rawLesson.url
        : '') ||
      (Array.isArray(rawLesson?.attachments)
        ? rawLesson.attachments.find(
            (a: any) =>
              a.mimeType?.includes('video') ||
              (typeof a.url === 'string' &&
                (a.url.includes('.mp4') || a.url.includes('vimeo')))
          )?.url
        : '') ||
      ''
    );
  }, [selectedLesson]);

  // Resolve tracked player source only when selected lesson or initial resume point changes
  const videoSource = useMemo(() => {
    const resolved = resolveTrackedVideoSource(rawVideoUrl, initialResumeSec);
    if (selectedLessonId) {
      console.log('[LearnVideoDebug] Selected Lesson ID:', selectedLessonId, 'Type:', resolved.type);
    }
    return resolved;
  }, [selectedLessonId, rawVideoUrl, initialResumeSec]);

  const effectiveDurationSec = useMemo(() => {
    if (videoDurationSec > 0) return videoDurationSec;
    if (selectedLesson?.backendDurationSec && selectedLesson.backendDurationSec > 0) {
      return selectedLesson.backendDurationSec;
    }
    return parseBackendLessonDurationSeconds(selectedLesson);
  }, [videoDurationSec, selectedLesson]);

  const currentWatchEvaluation = useMemo(
    () =>
      evaluateLessonWatchState(
        selectedLesson,
        courseProgress,
        null,
        effectiveDurationSec > 0 ? effectiveDurationSec : undefined
      ),
    [selectedLesson, courseProgress, effectiveDurationSec]
  );

  const isCurrentLessonRestricted = Boolean(
    selectedLesson &&
      (currentWatchEvaluation.isWatchRestricted ||
        selectedLesson.isWatchRestricted ||
        restrictedLessonsById[selectedLesson.id])
  );

  const currentRestrictionMessage =
    (selectedLesson?.id && restrictedLessonsById[selectedLesson.id]) ||
    currentWatchEvaluation.restrictionReason ||
    selectedLesson?.restrictionReason ||
    REWATCH_RESTRICTED_MESSAGE;

  const isRestrictedRef = useRef<boolean>(false);
  useEffect(() => {
    isRestrictedRef.current = isCurrentLessonRestricted;
    activeContextRef.current = {
      courseId,
      moduleId: selectedModuleId,
      lessonId: selectedLessonId,
      videoType: videoSource.type,
    };
    if (isCurrentLessonRestricted && isActivelyPlayingRef.current) {
      isActivelyPlayingRef.current = false;
      isBufferingRef.current = false;
      lastPlaySampleAtRef.current = null;
      setIsPlaying(false);
      pauseEmbeddedPlayer();
    }
  }, [courseId, selectedModuleId, selectedLessonId, videoSource.type, isCurrentLessonRestricted, pauseEmbeddedPlayer]);

  const playEmbeddedPlayer = useCallback(() => {
    if (
      isRestrictedRef.current ||
      authPausedRef.current ||
      appStateRef.current !== 'active' ||
      !isScreenFocusedRef.current
    ) {
      return;
    }

    if (Platform.OS === 'web') {
      if (webVideoRef.current && typeof webVideoRef.current.play === 'function') {
        try {
          void webVideoRef.current.play();
        } catch {
          // Ignore DOM play errors
        }
      }
      const win = webIframeRef.current?.contentWindow;
      if (win) {
        try {
          if (activeContextRef.current.videoType === 'vimeo') {
            win.postMessage(JSON.stringify({ method: 'play' }), 'https://player.vimeo.com');
          } else if (activeContextRef.current.videoType === 'youtube') {
            win.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
          }
        } catch {
          // Ignore iframe postMessage errors
        }
      }
      return;
    }

    webViewRef.current?.injectJavaScript('window.__playLmsVideo && window.__playLmsVideo(); true;');
  }, []);

  const completeLessonOnBackend = useCallback(
    async (
      targetCourseId: string,
      targetModuleId: string,
      targetLessonId: string,
      silentIfAuto: boolean
    ) => {
      if (!targetCourseId || !targetModuleId || !targetLessonId) return;
      if (silentIfAuto && autoCompleteTriggeredForLessonRef.current[targetLessonId]) {
        return;
      }

      if (silentIfAuto) {
        autoCompleteTriggeredForLessonRef.current[targetLessonId] = true;
      } else {
        setIsMarkingComplete(true);
      }

      try {
        await stopAndFlushActivePlayback(true);
        const completeRes = await DashboardService.markLessonComplete(
          targetCourseId,
          targetModuleId,
          targetLessonId
        );

        const freshProg = await DashboardService.getCourseProgress(targetCourseId);

        if (completeRes.success) {
          restrictedLessonsRef.current[targetLessonId] = REWATCH_RESTRICTED_MESSAGE;
          setRestrictedLessonsById((prev) => ({
            ...prev,
            [targetLessonId]: REWATCH_RESTRICTED_MESSAGE,
          }));

          if (freshProg.success && freshProg.data) {
            applyBackendCourseProgress(freshProg.data, {
              [targetLessonId]: REWATCH_RESTRICTED_MESSAGE,
            });
          } else {
            setModules((prev) =>
              prev.map((m) => ({
                ...m,
                lessons: m.lessons?.map((l) =>
                  l.id === targetLessonId
                    ? {
                        ...l,
                        completed: true,
                        isWatchRestricted: true,
                        restrictionReason: REWATCH_RESTRICTED_MESSAGE,
                      }
                    : l
                ),
              }))
            );
            setSelectedLesson((prev) =>
              prev && prev.id === targetLessonId
                ? {
                    ...prev,
                    completed: true,
                    isWatchRestricted: true,
                    restrictionReason: REWATCH_RESTRICTED_MESSAGE,
                  }
                : prev
            );
          }

          if (!silentIfAuto) {
            Alert.alert(
              'Progress Recorded! ✅',
              'Lesson marked complete. Progress updated from backend.'
            );
          }
        } else {
          if (silentIfAuto) {
            delete autoCompleteTriggeredForLessonRef.current[targetLessonId];
          }
          // Verify whether backend already had completion recorded even if POST rejected
          if (freshProg.success && freshProg.data) {
            applyBackendCourseProgress(freshProg.data);
          }
          if (!silentIfAuto) {
            Alert.alert(
              'Unable to Mark Complete',
              completeRes.error ||
                'Could not confirm lesson completion with the server. Please try again.'
            );
          } else if (completeRes.error) {
            setWatchSyncError(completeRes.error);
          }
        }
      } catch {
        if (silentIfAuto) {
          delete autoCompleteTriggeredForLessonRef.current[targetLessonId];
        } else {
          Alert.alert(
            'Connection Error',
            'Failed to reach the server to confirm lesson completion.'
          );
        }
      } finally {
        if (!silentIfAuto) {
          setIsMarkingComplete(false);
        }
      }
    },
    [applyBackendCourseProgress, stopAndFlushActivePlayback]
  );

  // Unified handler for live WebView & Web iframe telemetry events
  const handlePlayerTelemetry = useCallback(
    (evt: PlayerTelemetryEvent) => {
      if (!evt || evt.source !== 'lms-player') return;
      const { courseId: cId, moduleId: mId, lessonId: lId } = activeContextRef.current;
      if (!lId) return;

      // Never allow playback when lesson is watch-restricted or auth is invalid
      if (isRestrictedRef.current || authPausedRef.current) {
        if (evt.type === 'play' || evt.type === 'timeupdate') {
          isActivelyPlayingRef.current = false;
          lastPlaySampleAtRef.current = null;
          setIsPlaying(false);
          pauseEmbeddedPlayer();
        }
        return;
      }

      if (typeof evt.duration === 'number' && Number.isFinite(evt.duration) && evt.duration > 0) {
        rawMsgStateRef.current.lastDuration = evt.duration;
        setVideoDurationSec(Math.floor(evt.duration));
      }

      const hasValidTime =
        typeof evt.currentTime === 'number' &&
        Number.isFinite(evt.currentTime) &&
        evt.currentTime >= 0;

      if (evt.type === 'ready') {
        isBufferingRef.current = false;
        return;
      }

      if (evt.type === 'duration') {
        return;
      }

      if (evt.type === 'play') {
        if (appStateRef.current !== 'active' || !isScreenFocusedRef.current) {
          pauseEmbeddedPlayer();
          return;
        }
        const now = Date.now();
        isActivelyPlayingRef.current = true;
        isBufferingRef.current = false;
        lastPlaySampleAtRef.current = now;
        lastMediaProgressAtRef.current = now;
        setIsPlaying(true);
        if (hasValidTime && evt.currentTime !== undefined) {
          rawMsgStateRef.current.lastTime = evt.currentTime;
          setCurrentTimeSec(Math.floor(evt.currentTime));
        }
        return;
      }

      if (evt.type === 'pause') {
        commitCurrentActiveMs(Date.now());
        isActivelyPlayingRef.current = false;
        isBufferingRef.current = false;
        lastPlaySampleAtRef.current = null;
        setIsPlaying(false);
        if (hasValidTime && evt.currentTime !== undefined) {
          rawMsgStateRef.current.lastTime = evt.currentTime;
          setCurrentTimeSec(Math.floor(evt.currentTime));
        }
        if (cId && lId) {
          void syncWatchTimeForLesson(cId, mId, lId, true);
        }
        return;
      }

      if (evt.type === 'buffering') {
        commitCurrentActiveMs(Date.now());
        isBufferingRef.current = true;
        lastPlaySampleAtRef.current = null;
        return;
      }

      if (evt.type === 'seeked') {
        // Update scrubber position on seek without counting skipped jump seconds
        commitCurrentActiveMs(Date.now());
        if (hasValidTime && evt.currentTime !== undefined) {
          rawMsgStateRef.current.lastTime = evt.currentTime;
          setCurrentTimeSec(Math.floor(evt.currentTime));
        }
        lastMediaProgressAtRef.current = Date.now();
        return;
      }

      if (evt.type === 'timeupdate') {
        const now = Date.now();
        if (hasValidTime && evt.currentTime !== undefined) {
          if (Math.abs(evt.currentTime - rawMsgStateRef.current.lastTime) > 0.05) {
            lastMediaProgressAtRef.current = now;
          }
          rawMsgStateRef.current.lastTime = evt.currentTime;
          const curSec = Math.floor(evt.currentTime);
          setCurrentTimeSec(curSec);
        }

        if (
          appStateRef.current === 'active' &&
          isScreenFocusedRef.current &&
          !isActivelyPlayingRef.current
        ) {
          isActivelyPlayingRef.current = true;
          isBufferingRef.current = false;
          lastPlaySampleAtRef.current = now;
          setIsPlaying(true);
        }

        isBufferingRef.current = false;
        commitCurrentActiveMs(now);
        if (cId && lId) {
          void syncWatchTimeForLesson(cId, mId, lId, false);
        }
        return;
      }

      if (evt.type === 'ended') {
        commitCurrentActiveMs(Date.now());
        isActivelyPlayingRef.current = false;
        isBufferingRef.current = false;
        lastPlaySampleAtRef.current = null;
        setIsPlaying(false);
        if (hasValidTime && evt.currentTime !== undefined) {
          rawMsgStateRef.current.lastTime = evt.currentTime;
          setCurrentTimeSec(Math.floor(evt.currentTime));
        }
        if (cId && mId && lId) {
          void completeLessonOnBackend(cId, mId, lId, true);
        }
      }
    },
    [
      commitCurrentActiveMs,
      completeLessonOnBackend,
      pauseEmbeddedPlayer,
      syncWatchTimeForLesson,
    ]
  );

  // Centralized lesson selection with rapid-tap protection + fresh backend watch verification
  const selectLessonForPlayback = useCallback(
    async (modId: string, les: CleanLesson) => {
      if (!les?.id) return;
      if (selectedLessonId === les.id && !isVerifyingWatchStatus) {
        return;
      }

      const reqSeq = ++lessonSelectionSeqRef.current;
      await stopAndFlushActivePlayback(true);

      if (reqSeq !== lessonSelectionSeqRef.current) return;

      const durationHint =
        les.backendDurationSec || parseBackendLessonDurationSeconds(les);
      setSelectedModuleId(modId);
      setSelectedLesson(les);
      setInitialResumeSec(0);
      setCurrentTimeSec(0);
      setVideoDurationSec(durationHint);
      setWatchedSecondsDisplay(les.watchedSeconds || 0);
      setIsPlaying(false);
      setWatchSyncError(null);
      setExpandedModules((prev) => ({ ...prev, [modId]: true }));
      rawMsgStateRef.current = { lastTime: 0, lastDuration: durationHint };

      if (!courseId) return;

      setIsVerifyingWatchStatus(true);
      try {
        const freshProg = await DashboardService.getCourseProgress(courseId);
        if (reqSeq !== lessonSelectionSeqRef.current) return;

        if (freshProg.status === 401) {
          authPausedRef.current = true;
          setWatchSyncError('Session expired. Please sign in again.');
          return;
        }

        const progressData = freshProg.success && freshProg.data ? freshProg.data : courseProgress;
        if (freshProg.success && freshProg.data) {
          applyBackendCourseProgress(freshProg.data);
        }

        const evalState = evaluateLessonWatchState(
          les,
          progressData,
          null,
          durationHint > 0 ? durationHint : undefined
        );
        const explicitRestrictionMsg = restrictedLessonsRef.current[les.id];
        const isRestricted = Boolean(evalState.isWatchRestricted || explicitRestrictionMsg);

        activeWatchMsByLessonRef.current[les.id] = Math.max(
          activeWatchMsByLessonRef.current[les.id] || 0,
          evalState.watchedSeconds * 1000
        );
        lastSyncedSecondsByLessonRef.current[les.id] = Math.max(
          lastSyncedSecondsByLessonRef.current[les.id] || 0,
          evalState.watchedSeconds
        );
        setWatchedSecondsDisplay(evalState.watchedSeconds);

        const resumeAt =
          !isRestricted &&
          evalState.watchedSeconds > 0 &&
          (!durationHint || evalState.watchedSeconds < durationHint - 2)
            ? evalState.watchedSeconds
            : 0;

        setInitialResumeSec(resumeAt);
        setCurrentTimeSec(resumeAt);
        rawMsgStateRef.current.lastTime = resumeAt;
      } finally {
        if (reqSeq === lessonSelectionSeqRef.current) {
          setIsVerifyingWatchStatus(false);
        }
      }
    },
    [
      applyBackendCourseProgress,
      courseId,
      courseProgress,
      isVerifyingWatchStatus,
      selectedLessonId,
      stopAndFlushActivePlayback,
    ]
  );

  // Handle Lesson Selection from Curriculum List
  const handleSelectLesson = useCallback(
    (modId: string, les: CleanLesson) => {
      void selectLessonForPlayback(modId, les);
    },
    [selectLessonForPlayback]
  );

  // Active playback 1s heartbeat (only ticks when actively playing in foreground + focused)
  useEffect(() => {
    if (!isPlaying || isCurrentLessonRestricted) return;

    const timer = setInterval(() => {
      if (
        !isActivelyPlayingRef.current ||
        appStateRef.current !== 'active' ||
        !isScreenFocusedRef.current ||
        isBufferingRef.current
      ) {
        return;
      }

      const now = Date.now();
      // Do not count frozen/stalled time if media currentTime has not progressed recently
      if (lastMediaProgressAtRef.current > 0 && now - lastMediaProgressAtRef.current > 3500) {
        lastPlaySampleAtRef.current = now;
        return;
      }

      commitCurrentActiveMs(now);
      const { courseId: cId, moduleId: mId, lessonId: lId } = activeContextRef.current;
      if (cId && lId) {
        void syncWatchTimeForLesson(cId, mId, lId, false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, isCurrentLessonRestricted, commitCurrentActiveMs, syncWatchTimeForLesson]);

  // Handle AppState foreground / background transitions cleanly (never count background time)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState !== 'active') {
        void stopAndFlushActivePlayback(true);
      } else if (prevState !== 'active' && courseId && isEntitled) {
        void DashboardService.getCourseProgress(courseId).then((res) => {
          if (res.success && res.data) {
            applyBackendCourseProgress(res.data);
          }
        });
      }
    });

    return () => subscription.remove();
  }, [courseId, isEntitled, stopAndFlushActivePlayback, applyBackendCourseProgress]);

  // Handle screen focus / blur via Expo Router
  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      if (courseId && isEntitled) {
        void DashboardService.getCourseProgress(courseId).then((res) => {
          if (res.success && res.data) {
            applyBackendCourseProgress(res.data);
          }
        });
      }
      return () => {
        isScreenFocusedRef.current = false;
        void stopAndFlushActivePlayback(true);
      };
    }, [courseId, isEntitled, applyBackendCourseProgress, stopAndFlushActivePlayback])
  );

  // Flush remaining watch time on component unmount
  useEffect(() => {
    return () => {
      void stopAndFlushActivePlayback(true);
    };
  }, [stopAndFlushActivePlayback]);

  // Web-specific iframe message listener + tab visibility/unload flush
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onWindowMessage = (event: MessageEvent) => {
      const telemetry = parseRawIframePostMessage(
        event.data,
        event.origin || '',
        rawMsgStateRef.current
      );
      if (telemetry) {
        handlePlayerTelemetry(telemetry);
      }
    };

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        void stopAndFlushActivePlayback(true);
      }
    };

    const onBeforeUnload = () => {
      void stopAndFlushActivePlayback(false);
    };

    window.addEventListener('message', onWindowMessage);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('message', onWindowMessage);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [handlePlayerTelemetry, stopAndFlushActivePlayback]);

  // 5. Handle Next Lesson
  const handleNextLesson = () => {
    if (currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1) {
      const nextItem = allLessons[currentLessonIndex + 1];
      void selectLessonForPlayback(nextItem.moduleId, nextItem.lesson);
    } else if (allLessons.length > 0) {
      Alert.alert(
        'Course Completed! 🎉',
        'You have reached the final lecture in this course curriculum.'
      );
    }
  };

  // 5b. Handle Previous Lesson
  const handlePreviousLesson = () => {
    if (currentLessonIndex > 0) {
      const prevItem = allLessons[currentLessonIndex - 1];
      void selectLessonForPlayback(prevItem.moduleId, prevItem.lesson);
    }
  };

  // 5c. Play / Pause toggle control (disabled when restricted)
  const handleTogglePlayPause = () => {
    if (!selectedLesson || isCurrentLessonRestricted || videoSource.type === 'none') {
      return;
    }
    if (isPlaying) {
      void stopAndFlushActivePlayback(true);
    } else {
      playEmbeddedPlayer();
    }
  };

  // 6. Handle Mark Complete
  const handleMarkComplete = async () => {
    if (!selectedLesson || !selectedModuleId) return;
    await completeLessonOnBackend(courseId, selectedModuleId, selectedLesson.id, false);
  };

  // 7. Handle Back Navigation cleanly after flushing watch time
  const handleNavigateBack = useCallback(() => {
    void stopAndFlushActivePlayback(true);
    router.back();
  }, [stopAndFlushActivePlayback]);

  // 7b. Handle Header Tabs Navigation
  const handleHeaderTabPress = (tab: 'lessons' | 'exams' | 'assignments' | 'overview') => {
    if (tab !== 'lessons') {
      void stopAndFlushActivePlayback(true);
    }
    setActiveHeaderTab(tab);
    if (tab === 'exams') {
      router.push({
        pathname: '/student/exam',
        params: { courseId, title: courseTitle },
      } as any);
    } else if (tab === 'assignments') {
      router.push({
        pathname: '/student/assignment',
        params: { courseId, title: courseTitle },
      } as any);
    } else if (tab === 'overview') {
      router.push({
        pathname: '/student/course-details',
        params: { id: courseId },
      });
    }
  };

  const activeLessonId = selectedLesson?.id || (selectedLesson as any)?._id || '';

  // Any of the 4 inline AI Learning cards triggers the shared Neural Engine Synthesis workflow
  // and automatically transitions to the 4-card Final AI Study Companion Dashboard.
  const handleOpenStudyCompanion = useCallback(
    async (_triggeredCard?: StudyModuleView) => {
      setCompanionView(null);
      setCompanionSessionKey((prev) => prev + 1);
      setCompanionVisible(true);

      if (!courseId || !activeLessonId) {
        return;
      }

      const cacheKey = `${courseId}::${activeLessonId}`;
      const cached = aiDataCacheRef.current[cacheKey];
      const hasInFlight = inFlightAiLessonKeyRef.current?.key === cacheKey;

      if (cached && !aiError && !hasInFlight) {
        setAiData(cached);
        setAiError(null);
        return;
      }

      await loadLessonAiData(activeLessonId);
    },
    [activeLessonId, aiError, courseId, loadLessonAiData]
  );

  const handleCloseStudyCompanion = useCallback(() => {
    setCompanionVisible(false);
    setCompanionView(null);
  }, []);

  const handleCompanionQuizSubmit = useCallback(
    async (answers: QuizSubmissionAnswer[]): Promise<QuizSubmissionResult> => {
      if (!courseId || !activeLessonId || answers.length === 0) {
        return { success: false, error: 'Missing course or lesson details.' };
      }
      try {
        const res = await DashboardService.submitLessonAiQuiz(courseId, activeLessonId, answers);
        if (res.success) {
          await loadLessonAiData(activeLessonId, { force: true });
          const attempt = res.data?.latest_attempt ?? res.data?.attempt ?? null;
          return { success: true, latestAttempt: attempt };
        }
        return {
          success: false,
          error: res.error || 'Could not submit quiz attempt.',
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Network error submitting quiz.',
        };
      }
    },
    [activeLessonId, courseId, loadLessonAiData]
  );

  // Watermark String Matching Reference Screenshot: 🔒 Student7 (7bc839)
  const watermarkText = useMemo(() => {
    const rawUser = currentUser as any;
    const name = rawUser?.name || rawUser?.fullName || 'Student7';
    const rawId = rawUser?.id || rawUser?._id || rawUser?.studentId || '7bc839';
    const shortId = typeof rawId === 'string' ? rawId.substring(0, 6) : '7bc839';
    return `🔒 ${name} (${shortId})`;
  }, [currentUser]);

  // Format Time seconds to MM:SS / H:MM:SS
  const formatTime = (secs: number) => formatClockSeconds(secs);

  // Guard: If no course ID provided
  if (!courseId) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top', 'bottom']}>
        <View style={[styles.topHeaderLocked, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1F2937' }]}>
          <TouchableOpacity
            style={[styles.backButton, isDarkMode && { backgroundColor: '#1E293B' }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
            <Text style={[styles.backButtonText, isDarkMode && { color: '#F8FAFC' }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.lockedHeaderTitle, isDarkMode && { color: '#F8FAFC' }]}>Course Learning</Text>
        </View>
        <View style={styles.lockedBodyContainer}>
          <Ionicons name="school-outline" size={54} color="#7C3AED" />
          <Text style={[styles.lockedHeading, isDarkMode && { color: '#F8FAFC' }]}>No Course Selected</Text>
          <Text style={[styles.lockedSubheading, isDarkMode && { color: '#94A3B8' }]}>
            Please select an enrolled subject from My Programs to access video lectures.
          </Text>
          <TouchableOpacity style={styles.unlockButton} onPress={() => router.replace('/student/programs')}>
            <Text style={styles.unlockButtonText}>Go to My Programs</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Guard: Loading while checking access
  if (isCheckingAccess) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top', 'bottom']}>
        <View style={[styles.topHeaderLocked, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1F2937' }]}>
          <TouchableOpacity
            style={[styles.backButton, isDarkMode && { backgroundColor: '#1E293B' }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
            <Text style={[styles.backButtonText, isDarkMode && { color: '#F8FAFC' }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.lockedHeaderTitle, isDarkMode && { color: '#F8FAFC' }]}>Course Learning</Text>
        </View>
        <View style={[styles.lockedBodyContainer, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[styles.lockedSubheading, isDarkMode && { color: '#94A3B8' }, { marginTop: 16 }]}>
            Verifying course entitlement from backend...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Guard: If course is Locked / Unpurchased, show Locked Screen
  if (!isCheckingAccess && !isEntitled) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top', 'bottom']}>
        {/* Top Header */}
        <View style={[styles.topHeaderLocked, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1F2937' }]}>
          <TouchableOpacity
            style={[styles.backButton, isDarkMode && { backgroundColor: '#1E293B' }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
            <Text style={[styles.backButtonText, isDarkMode && { color: '#F8FAFC' }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.lockedHeaderTitle, isDarkMode && { color: '#F8FAFC' }]}>Protected Course</Text>
        </View>

        {/* Locked Body */}
        <View style={styles.lockedBodyContainer}>
          <View style={styles.lockedIconCircle}>
            <Ionicons name="lock-closed" size={48} color="#D97706" />
          </View>

          <Text style={[styles.lockedHeading, isDarkMode && { color: '#F8FAFC' }]}>Course Access Locked</Text>
          <Text style={[styles.lockedSubheading, isDarkMode && { color: '#94A3B8' }]}>
            Purchase this course to access lessons and videos.
          </Text>

          <View
            style={[
              styles.lockedCourseInfoCard,
              isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' },
            ]}
          >
            <Text style={[styles.lockedCourseTitle, isDarkMode && { color: '#F8FAFC' }]}>{courseTitle}</Text>
            <Text style={[styles.lockedCourseMeta, isDarkMode && { color: '#94A3B8' }]}>
              COTR Global Online • Academic Theological Seminary
            </Text>
            <View style={styles.lockedBadgeRow}>
              <View style={[styles.lockedTag, isDarkMode && { backgroundColor: '#1E293B' }]}>
                <Ionicons name="shield-checkmark" size={13} color="#6366F1" style={{ marginRight: 4 }} />
                <Text style={[styles.lockedTagText, isDarkMode && { color: '#CBD5E1' }]}>ATA Accredited</Text>
              </View>
              <View style={[styles.lockedTag, isDarkMode && { backgroundColor: '#1E293B' }]}>
                <Ionicons name="time" size={13} color="#059669" style={{ marginRight: 4 }} />
                <Text style={[styles.lockedTagText, isDarkMode && { color: '#CBD5E1' }]}>Full Lifetime Access</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.unlockButton}
            onPress={() =>
              router.push({
                pathname: '/student/course-details',
                params: { id: courseId },
              })
            }
            activeOpacity={0.88}
          >
            <Ionicons name="cart" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.unlockButtonText}>View Course Details &amp; Enroll</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B1120' }]} edges={['top', 'bottom']}>
      {/* 1. TOP NAVIGATION BAR */}
      <View style={[styles.topHeader, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1E293B' }]}>
        <View style={styles.topHeaderBarRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleNavigateBack}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={isDarkMode ? '#E2E8F0' : '#0F172A'} />
            <Text style={[styles.backButtonText, isDarkMode && { color: '#E2E8F0' }]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.topNextButton,
              isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
            ]}
            onPress={handleNextLesson}
            activeOpacity={0.75}
          >
            <Text style={[styles.topNextButtonText, isDarkMode && { color: '#E2E8F0' }]}>Continue</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={isDarkMode ? '#A5B4FC' : '#4F46E5'}
              style={{ marginLeft: 3 }}
            />
          </TouchableOpacity>
        </View>

        {/* Scrollable Editorial Underline Tabs [ Lessons | Exams | Assignments | Course Overview ] */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.headerTabsContainer}
        >
          <TouchableOpacity
            style={[
              styles.headerTabPill,
              activeHeaderTab === 'lessons' && [
                styles.headerTabPillActive,
                isDarkMode && { borderBottomColor: '#818CF8' },
              ],
            ]}
            onPress={() => handleHeaderTabPress('lessons')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.headerTabText,
                isDarkMode && { color: '#94A3B8' },
                activeHeaderTab === 'lessons' && [
                  styles.headerTabTextActive,
                  isDarkMode && { color: '#F8FAFC' },
                ],
              ]}
            >
              Lessons
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerTabPill,
              activeHeaderTab === 'exams' && [
                styles.headerTabPillActive,
                isDarkMode && { borderBottomColor: '#818CF8' },
              ],
            ]}
            onPress={() => handleHeaderTabPress('exams')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.headerTabText,
                isDarkMode && { color: '#94A3B8' },
                activeHeaderTab === 'exams' && [
                  styles.headerTabTextActive,
                  isDarkMode && { color: '#F8FAFC' },
                ],
              ]}
            >
              Exams
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerTabPill,
              activeHeaderTab === 'assignments' && [
                styles.headerTabPillActive,
                isDarkMode && { borderBottomColor: '#818CF8' },
              ],
            ]}
            onPress={() => handleHeaderTabPress('assignments')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.headerTabText,
                isDarkMode && { color: '#94A3B8' },
                activeHeaderTab === 'assignments' && [
                  styles.headerTabTextActive,
                  isDarkMode && { color: '#F8FAFC' },
                ],
              ]}
            >
              Assignments
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerTabPill,
              activeHeaderTab === 'overview' && [
                styles.headerTabPillActive,
                isDarkMode && { borderBottomColor: '#818CF8' },
              ],
            ]}
            onPress={() => handleHeaderTabPress('overview')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.headerTabText,
                isDarkMode && { color: '#94A3B8' },
                activeHeaderTab === 'overview' && [
                  styles.headerTabTextActive,
                  isDarkMode && { color: '#F8FAFC' },
                ],
              ]}
            >
              Course Overview
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Learning Scroll Content */}
      <ScrollView
        nestedScrollEnabled={true}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              initializeCourse();
            }}
            colors={['#4F46E5']}
            tintColor="#4F46E5"
          />
        }
      >
        {/* 1. COURSE TITLE AND OVERALL PROGRESS */}
        <View
          style={[
            styles.courseHeaderStrip,
            isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1E293B' },
          ]}
        >
          <View style={styles.courseHeaderLeft}>
            <Text style={[styles.courseHeaderTitle, isDarkMode && { color: '#F8FAFC' }]}>
              {courseTitle}
            </Text>
            <View style={styles.titleProgressHeader}>
              <Text style={[styles.titleProgressText, isDarkMode && { color: '#A5B4FC' }]}>
                {progressPercentage}% complete
              </Text>
              <Text style={[styles.titleProgressMeta, isDarkMode && { color: '#94A3B8' }]}>
                {completedLessonsCount} / {allLessons.length} lectures completed
              </Text>
            </View>
            <View style={[styles.titleProgressTrack, isDarkMode && { backgroundColor: '#1E293B' }]}>
              <View
                style={[
                  styles.titleProgressFill,
                  { width: `${progressPercentage > 0 ? Math.max(2, progressPercentage) : 0}%` },
                  progressPercentage >= 100 && { backgroundColor: '#10B981' },
                ]}
              />
            </View>
          </View>
        </View>

        {/* 2. SELECTED LESSON VIDEO PLAYER CONTAINER or Empty State */}
        {modules.length === 0 ? (
          <View style={[styles.lockedBodyContainer, { paddingVertical: 48 }]}>
            <Ionicons name="film-outline" size={54} color="#94A3B8" />
            <Text style={[styles.lockedHeading, isDarkMode && { color: '#F8FAFC' }]}>
              No Published Lectures Found
            </Text>
            <Text style={[styles.lockedSubheading, isDarkMode && { color: '#94A3B8' }]}>
              {`Lectures and curriculum modules for "${courseTitle}" have not been uploaded by the academic department yet.`}
            </Text>
            <TouchableOpacity style={[styles.unlockButton, { backgroundColor: '#6366F1', marginTop: 18 }]} onPress={() => router.back()}>
              <Text style={styles.unlockButtonText}>Back to Curriculum</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.learningWorkspace, isWideLayout && styles.learningWorkspaceWide]}>
            {/* LEFT / MAIN SECTION: VIDEO PLAYER */}
            <View style={[styles.videoPrimaryCol, isWideLayout && styles.videoPrimaryColWide]}>
              <View
                style={[
                  styles.playerWrapper,
                  isDarkMode && { backgroundColor: '#161F30', borderColor: '#1F2937' },
                ]}
              >
                <View style={styles.videoStreamContainer}>
                  {/* Dark Video Canvas with Real Video Playback & One-Time Viewing Enforcement */}
                  <View style={[styles.videoCanvas, isWideLayout && { height: 300 }]}>
                    {isVerifyingWatchStatus ? (
                      <View style={styles.videoLoadingOverlay}>
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={styles.videoLoadingText}>Checking backend watch status...</Text>
                      </View>
                    ) : isCurrentLessonRestricted ? (
                      <View style={styles.restrictedVideoOverlay}>
                        <View style={styles.restrictedIconCircle}>
                          <Ionicons name="lock-closed" size={26} color="#F59E0B" />
                        </View>
                        <Text style={styles.noVideoTitle}>One-Time Viewing Completed</Text>
                        <Text style={styles.restrictedVideoMessage}>
                          {currentRestrictionMessage}
                        </Text>
                        {currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1 && (
                          <TouchableOpacity
                            style={styles.restrictedNextBtn}
                            onPress={handleNextLesson}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.restrictedNextBtnText}>Continue to Next Lesson</Text>
                            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : videoSource.type !== 'none' ? (
                      <View style={styles.videoPlayerContainer}>
                        {Platform.OS === 'web' ? (
                          videoSource.type === 'direct' ? (
                            <video
                              ref={webVideoRef}
                              src={videoSource.embedUrl}
                              controls
                              autoPlay
                              playsInline
                              controlsList="nodownload noplaybackrate"
                              disablePictureInPicture
                              onContextMenu={(e) => e.preventDefault()}
                              style={{ width: '100%', height: '100%', backgroundColor: '#000000' } as any}
                              onLoadedMetadata={(e) => {
                                const el = e.currentTarget;
                                if (initialResumeSec > 0 && el.duration > 0 && initialResumeSec < el.duration - 2) {
                                  el.currentTime = initialResumeSec;
                                }
                                handlePlayerTelemetry({
                                  source: 'lms-player',
                                  type: 'duration',
                                  duration: el.duration || 0,
                                  currentTime: el.currentTime || 0,
                                });
                              }}
                              onPlay={(e) =>
                                handlePlayerTelemetry({
                                  source: 'lms-player',
                                  type: 'play',
                                  currentTime: e.currentTarget.currentTime || 0,
                                  duration: e.currentTarget.duration || 0,
                                })
                              }
                              onPlaying={(e) =>
                                handlePlayerTelemetry({
                                  source: 'lms-player',
                                  type: 'play',
                                  currentTime: e.currentTarget.currentTime || 0,
                                  duration: e.currentTarget.duration || 0,
                                })
                              }
                              onPause={(e) =>
                                handlePlayerTelemetry({
                                  source: 'lms-player',
                                  type: 'pause',
                                  currentTime: e.currentTarget.currentTime || 0,
                                  duration: e.currentTarget.duration || 0,
                                })
                              }
                              onWaiting={(e) =>
                                handlePlayerTelemetry({
                                  source: 'lms-player',
                                  type: 'buffering',
                                  currentTime: e.currentTarget.currentTime || 0,
                                  duration: e.currentTarget.duration || 0,
                                })
                              }
                              onTimeUpdate={(e) =>
                                handlePlayerTelemetry({
                                  source: 'lms-player',
                                  type: 'timeupdate',
                                  currentTime: e.currentTarget.currentTime || 0,
                                  duration: e.currentTarget.duration || 0,
                                })
                              }
                              onSeeked={(e) =>
                                handlePlayerTelemetry({
                                  source: 'lms-player',
                                  type: 'seeked',
                                  currentTime: e.currentTarget.currentTime || 0,
                                  duration: e.currentTarget.duration || 0,
                                })
                              }
                              onEnded={(e) =>
                                handlePlayerTelemetry({
                                  source: 'lms-player',
                                  type: 'ended',
                                  currentTime: e.currentTarget.duration || e.currentTarget.currentTime || 0,
                                  duration: e.currentTarget.duration || 0,
                                })
                              }
                            />
                          ) : (
                            <iframe
                              ref={webIframeRef}
                              src={videoSource.embedUrl}
                              onLoad={() => {
                                const win = webIframeRef.current?.contentWindow;
                                if (!win) return;
                                if (videoSource.type === 'youtube') {
                                  win.postMessage(
                                    JSON.stringify({ event: 'listening', id: 'lms_web_yt_player' }),
                                    '*'
                                  );
                                } else if (videoSource.type === 'vimeo') {
                                  ['play', 'pause', 'finish', 'ended', 'timeupdate', 'seek', 'bufferstart', 'bufferend'].forEach((ev) => {
                                    win.postMessage(
                                      JSON.stringify({ method: 'addEventListener', value: ev }),
                                      'https://player.vimeo.com'
                                    );
                                  });
                                  win.postMessage(
                                    JSON.stringify({ method: 'getDuration' }),
                                    'https://player.vimeo.com'
                                  );
                                }
                              }}
                              style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000000' } as any}
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                            />
                          )
                        ) : (
                          <WebView<WebViewProps>
                            ref={webViewRef}
                            key={`vid_${selectedLesson?.id || 'none'}_${initialResumeSec}`}
                            source={{
                              html: videoSource.html,
                              baseUrl: 'https://launchpaad.tech',
                            }}
                            style={[styles.webViewPlayer, isWideLayout && { height: 300 }]}
                            originWhitelist={['*']}
                            allowsFullscreenVideo={true}
                            mediaPlaybackRequiresUserAction={false}
                            allowsInlineMediaPlayback={true}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            mixedContentMode="always"
                            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                            startInLoadingState={true}
                            renderLoading={() => (
                              <View style={styles.videoLoadingOverlay}>
                                <ActivityIndicator size="large" color="#6366F1" />
                                <Text style={styles.videoLoadingText}>Loading lecture stream...</Text>
                              </View>
                            )}
                            onMessage={(event) => {
                              try {
                                const parsed = JSON.parse(event.nativeEvent.data);
                                if (parsed && parsed.source === 'lms-player') {
                                  handlePlayerTelemetry(parsed as PlayerTelemetryEvent);
                                }
                              } catch {
                                // Ignore non-JSON WebView messages
                              }
                            }}
                            onError={(syntheticEvent) => {
                              const { nativeEvent } = syntheticEvent;
                              console.warn('[LearnVideoDebug] WebView Error:', nativeEvent);
                            }}
                            onHttpError={(syntheticEvent) => {
                              const { nativeEvent } = syntheticEvent;
                              console.warn('[LearnVideoDebug] WebView HTTP Error:', nativeEvent.statusCode, nativeEvent.description);
                            }}
                          />
                        )}
                      </View>
                    ) : (
                      <View style={styles.noVideoPlaceholder}>
                        <Ionicons name="film-outline" size={40} color="#64748B" />
                        <Text style={styles.noVideoTitle}>Lecture Video Pending</Text>
                        <Text style={styles.noVideoSubtitle}>
                          Video stream for this lecture has not been published yet by the academic department.
                        </Text>
                      </View>
                    )}

                    {/* Dynamic Watermark Overlay matching screenshot: 🔒 Student7 (7bc839) */}
                    {!isCurrentLessonRestricted && (
                      <View style={styles.watermarkBadge} pointerEvents="none">
                        <Text style={styles.watermarkBadgeText}>{watermarkText}</Text>
                      </View>
                    )}
                  </View>

                  {/* Video Controls Bar */}
                  <View style={styles.videoControlsStrip}>
                    <View style={styles.scrubberTrack}>
                      <View
                        style={[
                          styles.scrubberFill,
                          {
                            width: `${
                              effectiveDurationSec > 0
                                ? Math.min(100, Math.max(0, (currentTimeSec / effectiveDurationSec) * 100))
                                : 0
                            }%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.controlsRow}>
                      <View style={styles.controlsLeftGroup}>
                        <TouchableOpacity
                          style={[
                            styles.playPauseControlBtn,
                            (!selectedLesson ||
                              isVerifyingWatchStatus ||
                              isCurrentLessonRestricted ||
                              videoSource.type === 'none') &&
                              styles.playPauseControlBtnDisabled,
                          ]}
                          onPress={handleTogglePlayPause}
                          disabled={
                            !selectedLesson ||
                            isVerifyingWatchStatus ||
                            isCurrentLessonRestricted ||
                            videoSource.type === 'none'
                          }
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={
                              isCurrentLessonRestricted
                                ? 'lock-closed'
                                : isPlaying
                                ? 'pause'
                                : 'play'
                            }
                            size={12}
                            color="#FFFFFF"
                          />
                          <Text style={styles.playPauseControlText}>
                            {isCurrentLessonRestricted ? 'Locked' : isPlaying ? 'Pause' : 'Play'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.timeCounterText}>
                          {formatTime(currentTimeSec)} /{' '}
                          {effectiveDurationSec > 0
                            ? formatTime(effectiveDurationSec)
                            : selectedLesson?.duration || '20:00'}
                        </Text>
                      </View>

                      <View style={styles.controlsRightGroup}>
                        <TouchableOpacity
                          style={[styles.markCompleteActionBtn, selectedLesson?.completed && styles.markCompleteActionBtnDone]}
                          onPress={handleMarkComplete}
                          disabled={!selectedLesson || selectedLesson.completed || isMarkingComplete}
                          activeOpacity={0.85}
                        >
                          {isMarkingComplete ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons
                                name={selectedLesson?.completed ? 'checkmark-circle' : 'checkmark-done'}
                                size={14}
                                color="#FFFFFF"
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.markCompleteActionBtnText}>
                                {selectedLesson?.completed ? 'Completed' : 'Mark Complete'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Current Lesson Section */}
                <View style={[styles.currentLectureBanner, isDarkMode && { backgroundColor: '#111827' }]}>
                  {activeModuleTitle ? (
                    <Text style={[styles.currentModuleSubtitle, isDarkMode && { color: '#A5B4FC' }]}>
                      {activeModuleTitle}
                    </Text>
                  ) : null}

                  <Text style={[styles.currentLectureTitle, isDarkMode && { color: '#F8FAFC' }]}>
                    {selectedLesson?.title || 'Academic Lecture Video Stream'}
                  </Text>

                  {(allLessons.length > 0 || selectedLesson?.completed || watchedSecondsDisplay > 0) && (
                    <View style={styles.currentLectureMetaRow}>
                      {allLessons.length > 0 && (
                        <Text style={[styles.currentLessonCounterText, isDarkMode && { color: '#94A3B8' }]}>
                          Lesson {currentLessonIndex >= 0 ? currentLessonIndex + 1 : 1} of {allLessons.length}
                        </Text>
                      )}
                      {watchedSecondsDisplay > 0 && (
                        <View style={styles.currentCompletedInline}>
                          <Text style={[styles.metaDotSeparator, isDarkMode && { color: '#475569' }]}>•</Text>
                          <Text style={[styles.currentLessonCounterText, isDarkMode && { color: '#94A3B8' }]}>
                            Watched {formatTime(watchedSecondsDisplay)}
                          </Text>
                        </View>
                      )}
                      {selectedLesson?.completed && (
                        <View style={styles.currentCompletedInline}>
                          <Text style={[styles.metaDotSeparator, isDarkMode && { color: '#475569' }]}>•</Text>
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color={isDarkMode ? '#34D399' : '#059669'}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.currentCompletedText, isDarkMode && { color: '#34D399' }]}>
                            Completed
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {watchSyncError ? (
                    <Text style={styles.watchSyncErrorText}>{watchSyncError}</Text>
                  ) : null}
                </View>

                {/* Quick Controls & Course Content Toggle Bar */}
                <View style={[styles.videoQuickBar, isDarkMode && { backgroundColor: '#0F172A', borderTopColor: '#1E293B' }]}>
                  {!isWideLayout ? (
                    <TouchableOpacity
                      style={[
                        styles.modulesToggleChip,
                        isDarkMode && { backgroundColor: '#151E2E', borderColor: '#334155' },
                      ]}
                      onPress={() => {
                        animateLayoutTransition();
                        setIsModulesPanelOpen((prev) => !prev);
                      }}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="layers-outline" size={14} color={isDarkMode ? '#A5B4FC' : '#4F46E5'} />
                      <Text style={[styles.modulesToggleChipText, isDarkMode && { color: '#E2E8F0' }]}>
                        {isModulesPanelOpen ? 'Hide Content' : 'Course Content'}
                      </Text>
                      <View
                        style={[
                          styles.modulesCountBadge,
                          isDarkMode && { backgroundColor: '#1E293B' },
                        ]}
                      >
                        <Text style={[styles.modulesCountBadgeText, isDarkMode && { color: '#A5B4FC' }]}>
                          {modules.length}
                        </Text>
                      </View>
                      <Ionicons
                        name={isModulesPanelOpen ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={isDarkMode ? '#94A3B8' : '#64748B'}
                      />
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.quickBarLectureCount, isDarkMode && { color: '#94A3B8' }]}>
                      {completedLessonsCount} of {allLessons.length} lessons completed
                    </Text>
                  )}

                  <View
                    style={[
                      styles.videoQuickNavGroup,
                      isDarkMode && { backgroundColor: '#151E2E', borderColor: '#334155' },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.quickNavIconBtn,
                        currentLessonIndex <= 0 && styles.quickNavIconBtnDisabled,
                      ]}
                      onPress={handlePreviousLesson}
                      disabled={currentLessonIndex <= 0}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={14}
                        color={currentLessonIndex <= 0 ? '#64748B' : isDarkMode ? '#E2E8F0' : '#334155'}
                      />
                      <Text
                        style={[
                          styles.quickNavBtnText,
                          isDarkMode && { color: '#E2E8F0' },
                          currentLessonIndex <= 0 && { color: '#64748B' },
                        ]}
                      >
                        Prev
                      </Text>
                    </TouchableOpacity>

                    <View
                      style={[
                        styles.quickNavDivider,
                        isDarkMode && { backgroundColor: '#334155' },
                      ]}
                    />

                    <TouchableOpacity
                      style={[
                        styles.quickNavIconBtn,
                        currentLessonIndex >= allLessons.length - 1 && styles.quickNavIconBtnDisabled,
                      ]}
                      onPress={handleNextLesson}
                      disabled={currentLessonIndex >= allLessons.length - 1}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.quickNavBtnText,
                          isDarkMode && { color: '#E2E8F0' },
                          currentLessonIndex >= allLessons.length - 1 && { color: '#64748B' },
                        ]}
                      >
                        Next
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={currentLessonIndex >= allLessons.length - 1 ? '#64748B' : isDarkMode ? '#E2E8F0' : '#334155'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* COURSE CONTENT: ARCHITECTURAL MODULES & FLUSH HAIRLINE LESSON LIST */}
            {(isWideLayout || isModulesPanelOpen) && (
              <View
                style={[
                  styles.modulesSidePanel,
                  isWideLayout ? styles.modulesSidePanelWide : styles.modulesSidePanelMobile,
                  isDarkMode && { backgroundColor: '#111827', borderColor: '#1E293B' },
                ]}
              >
                <View
                  style={[
                    styles.modulesPanelHeader,
                    isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1E293B' },
                  ]}
                >
                  <View style={styles.curriculumHeaderLeft}>
                    <View
                      style={[
                        styles.curriculumHeaderIconBox,
                        isDarkMode && { backgroundColor: '#1E1B4B' },
                      ]}
                    >
                      <Ionicons
                        name="layers-outline"
                        size={16}
                        color={isDarkMode ? '#A5B4FC' : '#4F46E5'}
                      />
                    </View>
                    <View style={styles.curriculumHeaderTitles}>
                      <Text style={[styles.curriculumHeadingTitle, isDarkMode && { color: '#F8FAFC' }]}>
                        Course Content
                      </Text>
                      <Text style={[styles.curriculumHeadingSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                        {modules.length} {modules.length === 1 ? 'module' : 'modules'} • {completedLessonsCount}/{allLessons.length} completed
                      </Text>
                    </View>
                  </View>

                  {modules.length > 0 && (
                    <TouchableOpacity
                      style={styles.expandAllActionBtn}
                      onPress={handleToggleAllModules}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.expandAllActionText, isDarkMode && { color: '#A5B4FC' }]}>
                        {areAllModulesExpanded ? 'Collapse All' : 'Expand All'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  ref={modulesScrollRef}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  style={[
                    isWideLayout
                      ? styles.modulesScrollWide
                      : [styles.modulesScrollMobile, { maxHeight: mobileModulesMaxHeight }],
                    isDarkMode && { backgroundColor: '#0B1120' },
                  ]}
                  contentContainerStyle={styles.modulesScrollContent}
                >
                  {modules.map((mod, modIdx) => {
                    const isExpanded = isModuleExpanded(mod.id);
                    const modLessons = mod.lessons || [];
                    const totalModLessons = modLessons.length;
                    const completedModLessons = modLessons.filter((l) => l.completed).length;
                    const modProgressPct =
                      totalModLessons > 0 ? Math.round((completedModLessons / totalModLessons) * 100) : 0;
                    const isCompletedModule = totalModLessons > 0 && completedModLessons === totalModLessons;
                    const isCurrentModule = mod.id === selectedModuleId;
                    const moduleNumberLabel = String(modIdx + 1).padStart(2, '0');

                    return (
                      <View
                        key={`module_${mod.id}_${modIdx}`}
                        onLayout={(e) => {
                          moduleOffsetsRef.current[mod.id] = e.nativeEvent.layout.y;
                        }}
                        style={[
                          styles.moduleCard,
                          isDarkMode && { backgroundColor: '#151E2E', borderColor: '#1E293B' },
                          isCurrentModule && [
                            styles.moduleCardActive,
                            isDarkMode && { borderColor: '#4338CA' },
                          ],
                        ]}
                      >
                        <TouchableOpacity
                          style={[
                            styles.moduleCardHeader,
                            isDarkMode && { backgroundColor: '#151E2E' },
                          ]}
                          onPress={() => toggleModule(mod.id)}
                          activeOpacity={0.82}
                        >
                          <View style={styles.moduleHeaderTopRow}>
                            <View
                              style={[
                                styles.moduleIndexBadge,
                                isDarkMode && { backgroundColor: '#1E293B' },
                                isCurrentModule && [
                                  styles.moduleIndexBadgeActive,
                                  isDarkMode && { backgroundColor: '#1E1B4B' },
                                ],
                                isCompletedModule && [
                                  styles.moduleIndexBadgeDone,
                                  isDarkMode && { backgroundColor: '#064E3B' },
                                ],
                              ]}
                            >
                              <Text
                                style={[
                                  styles.moduleNumberIndex,
                                  isDarkMode && { color: '#94A3B8' },
                                  isCurrentModule && { color: isDarkMode ? '#A5B4FC' : '#4F46E5' },
                                  isCompletedModule && { color: isDarkMode ? '#34D399' : '#059669' },
                                ]}
                              >
                                {moduleNumberLabel}
                              </Text>
                            </View>

                            <Text
                              style={[
                                styles.moduleCardTitle,
                                isDarkMode && { color: '#F1F5F9' },
                                isCurrentModule && { color: isDarkMode ? '#FFFFFF' : '#0F172A' },
                              ]}
                            >
                              {mod.title}
                            </Text>

                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={isCurrentModule ? (isDarkMode ? '#A5B4FC' : '#4F46E5') : isDarkMode ? '#64748B' : '#94A3B8'}
                              style={styles.moduleChevronIcon}
                            />
                          </View>

                          <View style={styles.moduleProgressBlock}>
                            <View style={styles.moduleProgressStatsRow}>
                              <View style={styles.moduleMetaInlineGroup}>
                                <Text style={[styles.moduleCardMeta, isDarkMode && { color: '#94A3B8' }]}>
                                  {completedModLessons}/{totalModLessons} {totalModLessons === 1 ? 'lesson' : 'lessons'}
                                </Text>

                                {isCompletedModule ? (
                                  <View style={styles.moduleInlineStatusRow}>
                                    <Text style={[styles.metaDotSeparator, isDarkMode && { color: '#475569' }]}>•</Text>
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={12}
                                      color={isDarkMode ? '#34D399' : '#059669'}
                                      style={{ marginRight: 3 }}
                                    />
                                    <Text style={[styles.moduleStatusDoneText, isDarkMode && { color: '#34D399' }]}>
                                      Completed
                                    </Text>
                                  </View>
                                ) : isCurrentModule ? (
                                  <View style={styles.moduleInlineStatusRow}>
                                    <Text style={[styles.metaDotSeparator, isDarkMode && { color: '#475569' }]}>•</Text>
                                    <Text style={[styles.moduleStatusActiveText, isDarkMode && { color: '#A5B4FC' }]}>
                                      Current module
                                    </Text>
                                  </View>
                                ) : completedModLessons > 0 ? (
                                  <View style={styles.moduleInlineStatusRow}>
                                    <Text style={[styles.metaDotSeparator, isDarkMode && { color: '#475569' }]}>•</Text>
                                    <Text style={[styles.moduleStatusNeutralText, isDarkMode && { color: '#94A3B8' }]}>
                                      In progress
                                    </Text>
                                  </View>
                                ) : null}
                              </View>

                              <Text
                                style={[
                                  styles.modulePercentText,
                                  isDarkMode && { color: '#CBD5E1' },
                                  isCurrentModule && { color: isDarkMode ? '#A5B4FC' : '#4F46E5' },
                                  isCompletedModule && { color: isDarkMode ? '#34D399' : '#059669' },
                                ]}
                              >
                                {modProgressPct}%
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.moduleProgressTrack,
                                isDarkMode && { backgroundColor: '#1E293B' },
                              ]}
                            >
                              <View
                                style={[
                                  styles.moduleProgressFill,
                                  { width: `${modProgressPct}%` },
                                  isDarkMode && { backgroundColor: '#818CF8' },
                                  isCompletedModule && styles.moduleProgressFillDone,
                                ]}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View
                            style={[
                              styles.moduleLessonsContainer,
                              isDarkMode && { backgroundColor: '#111827', borderTopColor: '#1E293B' },
                            ]}
                          >
                            {modLessons.length === 0 ? (
                              <View style={styles.noLessonsInModule}>
                                <Text style={[styles.noLessonsInModuleText, isDarkMode && { color: '#64748B' }]}>
                                  No lessons uploaded in this module yet.
                                </Text>
                              </View>
                            ) : (
                              modLessons.map((les, lIdx) => {
                                const isSelected = les.id === selectedLesson?.id;
                                const isLockedLesson = Boolean(
                                  (les as any)?.isLocked ||
                                    (les as any)?.locked ||
                                    (mod as any)?.isLocked ||
                                    (mod as any)?.locked ||
                                    String((les as any)?.accessStatus || '').toUpperCase() === 'LOCKED'
                                );
                                const isRowWatchRestricted = Boolean(
                                  les.completed ||
                                    les.isWatchRestricted ||
                                    restrictedLessonsById[les.id]
                                );

                                return (
                                  <TouchableOpacity
                                    key={`les_${les.id}_${lIdx}`}
                                    onLayout={(e) => {
                                      const modY = moduleOffsetsRef.current[mod.id] || 0;
                                      lessonOffsetsRef.current[les.id] = modY + e.nativeEvent.layout.y;
                                    }}
                                    style={[
                                      styles.lessonRowItem,
                                      lIdx > 0 && [
                                        styles.lessonRowHairline,
                                        isDarkMode && { borderTopColor: '#1E293B' },
                                      ],
                                      isLockedLesson && styles.lessonRowItemLocked,
                                      isSelected && [
                                        styles.lessonRowItemActive,
                                        isDarkMode && { backgroundColor: '#1A1E3A' },
                                      ],
                                    ]}
                                    onPress={() => handleSelectLesson(mod.id, les)}
                                    activeOpacity={0.75}
                                  >
                                    {isSelected && (
                                      <View
                                        style={[
                                          styles.lessonActiveStripe,
                                          isDarkMode && { backgroundColor: '#818CF8' },
                                        ]}
                                      />
                                    )}

                                    <View style={styles.lessonStatusIconWrap}>
                                      {les.completed ? (
                                        <Ionicons
                                          name="checkmark-circle"
                                          size={17}
                                          color={isDarkMode ? '#34D399' : '#059669'}
                                        />
                                      ) : isLockedLesson ? (
                                        <Ionicons
                                          name="lock-closed-outline"
                                          size={16}
                                          color={isDarkMode ? '#64748B' : '#94A3B8'}
                                        />
                                      ) : isSelected ? (
                                        <Ionicons
                                          name="play-circle"
                                          size={18}
                                          color={isDarkMode ? '#818CF8' : '#4F46E5'}
                                        />
                                      ) : (
                                        <Ionicons
                                          name="ellipse-outline"
                                          size={16}
                                          color={isDarkMode ? '#475569' : '#CBD5E1'}
                                        />
                                      )}
                                    </View>

                                    <View style={styles.lessonInfoCol}>
                                      <Text
                                        style={[
                                          styles.lessonItemTitle,
                                          isDarkMode && { color: '#E2E8F0' },
                                          isLockedLesson && { color: isDarkMode ? '#64748B' : '#64748B' },
                                          isSelected && [
                                            styles.lessonItemTitleActive,
                                            isDarkMode && { color: '#FFFFFF' },
                                          ],
                                        ]}
                                      >
                                        {les.title}
                                      </Text>

                                      <View style={styles.lessonMetaRow}>
                                        <Text
                                          style={[
                                            styles.lessonDurationText,
                                            isDarkMode && { color: '#94A3B8' },
                                            isSelected && { color: isDarkMode ? '#A5B4FC' : '#4F46E5' },
                                          ]}
                                        >
                                          {les.duration || '20:00'}
                                        </Text>
                                        {isSelected && (
                                          <>
                                            <Text style={[styles.metaDotSeparator, isDarkMode && { color: '#475569' }]}>
                                              •
                                            </Text>
                                            <Text
                                              style={[
                                                styles.lessonStatusPlayingText,
                                                isDarkMode && { color: '#A5B4FC' },
                                                isRowWatchRestricted && { color: isDarkMode ? '#FBBF24' : '#D97706' },
                                              ]}
                                            >
                                              {isRowWatchRestricted
                                                ? 'Watched (Locked)'
                                                : isPlaying
                                                ? 'Playing'
                                                : 'Paused'}
                                            </Text>
                                          </>
                                        )}
                                        {!isSelected && isLockedLesson && (
                                          <>
                                            <Text style={[styles.metaDotSeparator, isDarkMode && { color: '#475569' }]}>
                                              •
                                            </Text>
                                            <Text
                                              style={[
                                                styles.lessonStatusLockedText,
                                                isDarkMode && { color: '#94A3B8' },
                                              ]}
                                            >
                                              Locked
                                            </Text>
                                          </>
                                        )}
                                      </View>
                                    </View>

                                    <View style={styles.lessonRowAction}>
                                      <Ionicons
                                        name={
                                          isLockedLesson || isRowWatchRestricted
                                            ? 'lock-closed-outline'
                                            : isSelected
                                            ? isPlaying
                                              ? 'pause'
                                              : 'play'
                                            : 'play-outline'
                                        }
                                        size={14}
                                        color={
                                          isLockedLesson || isRowWatchRestricted
                                            ? isDarkMode
                                              ? '#64748B'
                                              : '#94A3B8'
                                            : isSelected
                                            ? isDarkMode
                                              ? '#A5B4FC'
                                              : '#4F46E5'
                                            : isDarkMode
                                            ? '#475569'
                                            : '#94A3B8'
                                        }
                                      />
                                    </View>
                                  </TouchableOpacity>
                                );
                              })
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Restrained Previous & Next Lesson Footer inside Course Content Panel */}
                <View
                  style={[
                    styles.modulesPanelFooter,
                    isDarkMode && { backgroundColor: '#111827', borderTopColor: '#1E293B' },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.bottomNavLink,
                      currentLessonIndex <= 0 && styles.bottomNavLinkDisabled,
                    ]}
                    onPress={handlePreviousLesson}
                    disabled={currentLessonIndex <= 0}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={14}
                      color={currentLessonIndex <= 0 ? '#64748B' : isDarkMode ? '#A5B4FC' : '#4F46E5'}
                    />
                    <Text
                      style={[
                        styles.bottomNavLinkText,
                        isDarkMode && { color: '#E2E8F0' },
                        currentLessonIndex <= 0 && styles.bottomNavLinkTextDisabled,
                      ]}
                    >
                      Previous Lesson
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.bottomNavLink,
                      currentLessonIndex >= allLessons.length - 1 && styles.bottomNavLinkDisabled,
                    ]}
                    onPress={handleNextLesson}
                    disabled={currentLessonIndex >= allLessons.length - 1}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.bottomNavLinkText,
                        isDarkMode && { color: '#E2E8F0' },
                        currentLessonIndex >= allLessons.length - 1 && styles.bottomNavLinkTextDisabled,
                      ]}
                    >
                      Next Lesson
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={currentLessonIndex >= allLessons.length - 1 ? '#64748B' : isDarkMode ? '#A5B4FC' : '#4F46E5'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 2. AI STUDY ASSISTANT COMPANION */}

        {/* 3. AI STUDY ASSISTANT COMPANION */}
        <View
          style={[
            styles.aiCompanionShowcase,
            isDarkMode && { backgroundColor: '#151E2E', borderColor: '#1E293B' },
          ]}
        >
          <View style={styles.aiCompanionLeft}>
            <View
              style={[
                styles.aiCompanionIconBox,
                isDarkMode && { backgroundColor: '#1E1B4B' },
              ]}
            >
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={isDarkMode ? '#A5B4FC' : '#4F46E5'}
              />
            </View>
            <View style={styles.aiCompanionInfo}>
              <Text style={[styles.aiCompanionTitle, isDarkMode && { color: '#F8FAFC' }]}>
                AI Study Assistant
              </Text>
              <Text style={[styles.aiCompanionSub, isDarkMode && { color: '#94A3B8' }]}>
                Ask questions and clarify lecture concepts
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.tapToAskButton,
              isDarkMode && { backgroundColor: '#4F46E5' },
            ]}
            onPress={() => setModalType('ask')}
            activeOpacity={0.85}
          >
            <Text style={styles.tapToAskText}>Ask Tutor</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 5 }} />
          </TouchableOpacity>
        </View>

        {/* 4. AI LEARNING MODULES FOR THIS LECTURE */}
        <View style={styles.aiSectionContainer}>
          <View style={styles.aiSectionHeader}>
            <View style={styles.aiSectionTitleRow}>
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={isDarkMode ? '#A5B4FC' : '#4F46E5'}
                style={styles.aiSectionHeaderIcon}
              />
              <Text style={[styles.aiSectionTitle, isDarkMode && { color: '#F8FAFC' }]} numberOfLines={1}>
                AI Learning Modules for this Lecture
              </Text>
            </View>

            <View style={[styles.oneTouchBadge, isDarkMode && { backgroundColor: '#1E1B4B', borderColor: '#312E81' }]}>
              <Text style={[styles.oneTouchBadgeText, isDarkMode && { color: '#A5B4FC' }]}>ONE-TOUCH ACTIVE</Text>
            </View>
          </View>

          {/* 4 Cards Grid Matching Web Reference */}
          <View style={styles.aiCardsGrid}>
            {/* Card 1: Executive Summary */}
            <TouchableOpacity
              style={[styles.aiCard, isDarkMode && { backgroundColor: '#151E2E', borderColor: '#1E293B' }]}
              onPress={() => handleOpenStudyCompanion('summary')}
              activeOpacity={0.85}
            >
              <View style={[styles.aiCardTopAccent, { backgroundColor: '#0284C7' }]} />
              <View style={styles.aiCardInner}>
                <View>
                  <View style={styles.aiCardHeaderRow}>
                    <View style={[styles.aiCardIconBox, { backgroundColor: isDarkMode ? '#0F2942' : '#EFF6FF' }]}>
                      <Ionicons name="book-outline" size={18} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
                    </View>
                    <View style={[styles.aiPillBadge, { backgroundColor: isDarkMode ? '#1E3A5F' : '#EFF6FF' }]}>
                      <Text style={[styles.aiPillBadgeText, { color: isDarkMode ? '#7DD3FC' : '#2563EB' }]}>📝 Briefing</Text>
                    </View>
                  </View>
                  <Text style={[styles.aiCardTitle, isDarkMode && { color: '#F8FAFC' }]}>Executive Summary</Text>
                  <Text style={[styles.aiCardSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                    Condensed lecture briefing &amp; concepts
                  </Text>
                </View>
                <View>
                  <View style={[styles.aiCardDivider, isDarkMode && { backgroundColor: '#1E293B' }]} />
                  <View style={styles.aiCardActionRow}>
                    <Text style={[styles.aiCardActionLink, { color: isDarkMode ? '#38BDF8' : '#2563EB' }]}>Read Summary</Text>
                    <Ionicons name="arrow-forward" size={13} color={isDarkMode ? '#38BDF8' : '#2563EB'} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Card 2: Knowledge Check */}
            <TouchableOpacity
              style={[styles.aiCard, isDarkMode && { backgroundColor: '#151E2E', borderColor: '#1E293B' }]}
              onPress={() => handleOpenStudyCompanion('quiz')}
              activeOpacity={0.85}
            >
              <View style={[styles.aiCardTopAccent, { backgroundColor: '#9333EA' }]} />
              <View style={styles.aiCardInner}>
                <View>
                  <View style={styles.aiCardHeaderRow}>
                    <View style={[styles.aiCardIconBox, { backgroundColor: isDarkMode ? '#2E1065' : '#F3E8FF' }]}>
                      <Ionicons name="flash-outline" size={18} color={isDarkMode ? '#C4B5FD' : '#7C3AED'} />
                    </View>
                    <View style={[styles.aiPillBadge, { backgroundColor: isDarkMode ? '#2E1065' : '#F3E8FF' }]}>
                      <Text style={[styles.aiPillBadgeText, { color: isDarkMode ? '#DDD6FE' : '#7C3AED' }]}>
                        🎯 5 Questions
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.aiCardTitle, isDarkMode && { color: '#F8FAFC' }]}>Knowledge Check</Text>
                  <Text style={[styles.aiCardSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                    Interactive 5-question arena
                  </Text>
                </View>
                <View>
                  <View style={[styles.aiCardDivider, isDarkMode && { backgroundColor: '#1E293B' }]} />
                  <View style={styles.aiCardActionRow}>
                    <Text style={[styles.aiCardActionLink, { color: isDarkMode ? '#C4B5FD' : '#7C3AED' }]}>Take Quiz</Text>
                    <Ionicons name="arrow-forward" size={13} color={isDarkMode ? '#C4B5FD' : '#7C3AED'} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Card 3: Key Concepts */}
            <TouchableOpacity
              style={[styles.aiCard, isDarkMode && { backgroundColor: '#151E2E', borderColor: '#1E293B' }]}
              onPress={() => handleOpenStudyCompanion('concepts')}
              activeOpacity={0.85}
            >
              <View style={[styles.aiCardTopAccent, { backgroundColor: '#10B981' }]} />
              <View style={styles.aiCardInner}>
                <View>
                  <View style={styles.aiCardHeaderRow}>
                    <View style={[styles.aiCardIconBox, { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5' }]}>
                      <MaterialCommunityIcons name="brain" size={18} color={isDarkMode ? '#34D399' : '#059669'} />
                    </View>
                    <View style={[styles.aiPillBadge, { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5' }]}>
                      <Text style={[styles.aiPillBadgeText, { color: isDarkMode ? '#6EE7B7' : '#059669' }]}>💡 Deep Dive</Text>
                    </View>
                  </View>
                  <Text style={[styles.aiCardTitle, isDarkMode && { color: '#F8FAFC' }]}>Key Concepts</Text>
                  <Text style={[styles.aiCardSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                    Core principles &amp; historical backstory
                  </Text>
                </View>
                <View>
                  <View style={[styles.aiCardDivider, isDarkMode && { backgroundColor: '#1E293B' }]} />
                  <View style={styles.aiCardActionRow}>
                    <Text style={[styles.aiCardActionLink, { color: isDarkMode ? '#34D399' : '#059669' }]}>Explore Concepts</Text>
                    <Ionicons name="arrow-forward" size={13} color={isDarkMode ? '#34D399' : '#059669'} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Card 4: Key Takeaways */}
            <TouchableOpacity
              style={[styles.aiCard, isDarkMode && { backgroundColor: '#151E2E', borderColor: '#1E293B' }]}
              onPress={() => handleOpenStudyCompanion('takeaways')}
              activeOpacity={0.85}
            >
              <View style={[styles.aiCardTopAccent, { backgroundColor: '#F59E0B' }]} />
              <View style={styles.aiCardInner}>
                <View>
                  <View style={styles.aiCardHeaderRow}>
                    <View style={[styles.aiCardIconBox, { backgroundColor: isDarkMode ? '#272013' : '#FFFBEB' }]}>
                      <MaterialCommunityIcons name="format-list-checks" size={18} color={isDarkMode ? '#FBBF24' : '#D97706'} />
                    </View>
                    <View style={[styles.aiPillBadge, { backgroundColor: isDarkMode ? '#451A03' : '#FFFBEB' }]}>
                      <Text style={[styles.aiPillBadgeText, { color: isDarkMode ? '#FCD34D' : '#D97706' }]}>🚀 Takeaways</Text>
                    </View>
                  </View>
                  <Text style={[styles.aiCardTitle, isDarkMode && { color: '#F8FAFC' }]}>Key Takeaways</Text>
                  <Text style={[styles.aiCardSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                    Actionable review checklist
                  </Text>
                </View>
                <View>
                  <View style={[styles.aiCardDivider, isDarkMode && { backgroundColor: '#1E293B' }]} />
                  <View style={styles.aiCardActionRow}>
                    <Text style={[styles.aiCardActionLink, { color: isDarkMode ? '#FBBF24' : '#D97706' }]}>View Checklist</Text>
                    <Ionicons name="arrow-forward" size={13} color={isDarkMode ? '#FBBF24' : '#D97706'} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Video Lesson Transcript Resource */}
          <TouchableOpacity
            style={[
              styles.aiTranscriptCard,
              isDarkMode && { backgroundColor: '#151E2E', borderColor: '#1E293B' },
              { marginTop: 12 },
            ]}
            onPress={() => {
              setModalType('transcript');
              if (selectedLesson?.id) loadLessonTranscript(selectedLesson.id);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.aiTranscriptLeft}>
              <View
                style={[
                  styles.aiCardIconBox,
                  { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF', marginRight: 12, width: 38, height: 38, borderRadius: 10 },
                ]}
              >
                <Ionicons name="document-text-outline" size={20} color={isDarkMode ? '#A5B4FC' : '#4F46E5'} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.aiTranscriptTitleRow}>
                  <Text style={[styles.aiCardTitle, isDarkMode && { color: '#F8FAFC' }, { marginBottom: 0 }]}>
                    Lecture Video Transcript
                  </Text>
                  <View style={[styles.aiPillBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                    <Text style={[styles.aiPillBadgeText, { color: isDarkMode ? '#A5B4FC' : '#4F46E5' }]}>
                      {transcriptData?.cues?.length ? `${transcriptData.cues.length} Cues` : 'Captions'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.aiCardSubtitle, isDarkMode && { color: '#94A3B8' }, { marginBottom: 0 }]} numberOfLines={1}>
                  Searchable speech dialogue with jump-to timestamps
                </Text>
              </View>
            </View>
            <View style={styles.aiCardActionRow}>
              <Text style={[styles.aiCardActionLink, { color: isDarkMode ? '#A5B4FC' : '#4F46E5' }]}>Read</Text>
              <Ionicons name="arrow-forward" size={14} color={isDarkMode ? '#A5B4FC' : '#4F46E5'} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer Copyright */}
        <View style={styles.footerContainer}>
          <Text style={[styles.footerText, isDarkMode && { color: '#64748B' }]}>
            © 2026 Cotr Global Online. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      {/* Sacred AI Study Companion Modal (Neural Engine Synthesis -> Final 4-Card Dashboard) */}
      <SacredAiCompanionModal
        key={companionSessionKey}
        visible={companionVisible}
        isDarkMode={isDarkMode}
        courseId={courseId}
        lessonId={activeLessonId}
        courseTitle={courseTitle}
        lessonTitle={selectedLesson?.title}
        aiData={aiData}
        isLoading={isLoadingAi}
        error={aiError}
        activeView={companionView}
        onSelectView={setCompanionView}
        onClose={handleCloseStudyCompanion}
        onRefreshAiData={() => {
          if (activeLessonId) {
            void loadLessonAiData(activeLessonId, { force: true });
          }
        }}
        onSubmitQuiz={handleCompanionQuizSubmit}
      />

      {/* Floating AI Tutor Action Button */}
      <TouchableOpacity
        style={[
          styles.floatingChatButton,
          isDarkMode && { backgroundColor: '#4F46E5', borderColor: '#6366F1' },
        ]}
        onPress={() => setModalType('ask')}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={21} color="#FFFFFF" />
      </TouchableOpacity>

      {/* MODAL 5: AI Assistant Q&A */}
      <Modal visible={modalType === 'ask'} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheetContainer, isDarkMode && { backgroundColor: '#111827', borderTopWidth: 1, borderColor: '#1F2937' }]}>
            <View style={[styles.modalHeaderRow, isDarkMode && { borderBottomColor: '#1F2937' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.aiCardIconBox, { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF', marginRight: 8 }]}>
                  <Ionicons name="sparkles-outline" size={18} color={isDarkMode ? '#A5B4FC' : '#4F46E5'} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, isDarkMode && { color: '#F8FAFC' }]}>AI Theological Tutor</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>Ask questions about this lecture</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} style={[styles.modalCloseBtn, isDarkMode && { backgroundColor: '#1E293B' }]}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#CBD5E1' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Quick Suggestion Chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
              <TouchableOpacity
                style={[styles.suggestionChip, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => handleSendAsk('Summarize the main points of this lecture')}
              >
                <Text style={[styles.suggestionChipText, isDarkMode && { color: '#E2E8F0' }]}>Summarize lecture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.suggestionChip, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => handleSendAsk('Explain key concepts & historical context')}
              >
                <Text style={[styles.suggestionChipText, isDarkMode && { color: '#E2E8F0' }]}>Key concepts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.suggestionChip, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => handleSendAsk('What are the actionable takeaways?')}
              >
                <Text style={[styles.suggestionChipText, isDarkMode && { color: '#E2E8F0' }]}>Action takeaways</Text>
              </TouchableOpacity>
            </View>

            {/* Chat Messages */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260, marginVertical: 8 }}>
              {chatMessages.map((msg, i) => (
                <View
                  key={`msg_${i}`}
                  style={[
                    styles.chatBubble,
                    msg.sender === 'user'
                      ? styles.chatBubbleUser
                      : [styles.chatBubbleAi, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }],
                  ]}
                >
                  <Text
                    style={[
                      styles.chatBubbleText,
                      msg.sender === 'user'
                        ? styles.chatBubbleTextUser
                        : [styles.chatBubbleTextAi, isDarkMode && { color: '#F8FAFC' }],
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* Input Row */}
            <View style={[styles.askInputRow, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.askTextInput, isDarkMode && { color: '#F8FAFC' }]}
                placeholder="Ask about this lecture..."
                placeholderTextColor="#94A3B8"
                value={askQuery}
                onChangeText={setAskQuery}
                onSubmitEditing={() => handleSendAsk()}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={styles.askSendButton}
                onPress={() => handleSendAsk()}
                disabled={!askQuery.trim()}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 6: Video Lesson Transcript */}
      <Modal visible={modalType === 'transcript'} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheetContainer, isDarkMode && { backgroundColor: '#111827', borderTopWidth: 1, borderColor: '#1F2937' }]}>
            <View style={[styles.modalHeaderRow, isDarkMode && { borderBottomColor: '#1F2937' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={[
                    styles.aiCardIconBox,
                    { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF', marginRight: 10, width: 38, height: 38, borderRadius: 10 },
                  ]}
                >
                  <Ionicons name="document-text" size={20} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, isDarkMode && { color: '#F8FAFC' }]} numberOfLines={1}>
                    Video Transcript
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                    {selectedLesson?.title || 'Lecture Video'} • {transcriptData?.language?.toUpperCase() || 'EN'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} style={[styles.modalCloseBtn, isDarkMode && { backgroundColor: '#1E293B' }]}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#CBD5E1' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Transcript Search Filter */}
            <View style={[styles.transcriptSearchBox, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.transcriptSearchInput, isDarkMode && { color: '#F8FAFC' }]}
                placeholder="Search within speech transcript..."
                placeholderTextColor="#94A3B8"
                value={transcriptSearch}
                onChangeText={setTranscriptSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {transcriptSearch.length > 0 && (
                <TouchableOpacity onPress={() => setTranscriptSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollBody}>
              {isLoadingTranscript ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#4F46E5" />
                  <Text style={{ marginTop: 12, fontSize: 13, color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                    Loading lecture captions...
                  </Text>
                </View>
              ) : filteredCues.length > 0 ? (
                filteredCues.map((cue, idx) => (
                  <View key={`cue_${idx}`} style={[styles.transcriptCueRow, isDarkMode && { backgroundColor: '#161F30', borderBottomColor: '#1F2937', borderColor: '#1F2937' }]}>
                    <View style={[styles.cueBadge, isDarkMode && { backgroundColor: '#312E81' }]}>
                      <Ionicons name="play" size={10} color={isDarkMode ? '#A5B4FC' : '#4F46E5'} style={{ marginRight: 3 }} />
                      <Text style={[styles.cueTimeText, isDarkMode && { color: '#C7D2FE' }]}>{formatCueTime(cue.start)}</Text>
                    </View>
                    <Text style={[styles.cueText, isDarkMode && { color: '#E2E8F0' }]}>{cue.text}</Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <Ionicons name="document-text-outline" size={38} color="#94A3B8" style={{ marginBottom: 10 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A', marginBottom: 4 }}>
                    {transcriptSearch ? 'No matching speech cues' : 'Transcripts Pending'}
                  </Text>
                  <Text style={{ fontSize: 13, color: isDarkMode ? '#94A3B8' : '#64748B', textAlign: 'center', lineHeight: 18 }}>
                    {transcriptSearch
                      ? `No speech cues found for "${transcriptSearch}". Try a different keyword.`
                      : 'Interactive captions are generated automatically from lecture audio. Transcripts will appear as soon as processing completes.'}
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: '#4F46E5' }]}
              onPress={() => setModalType(null)}
            >
              <Text style={styles.modalActionBtnText}>Done</Text>
            </TouchableOpacity>
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
  topHeader: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingRight: 8,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 2,
  },
  headerTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingRight: 8,
  },
  headerTabPill: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  headerTabPillActive: {
    borderBottomColor: '#4F46E5',
  },
  headerTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  headerTabTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  topNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topNextButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  scrollContent: {
    paddingBottom: 76,
  },
  courseHeaderStrip: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  courseHeaderLeft: {
    width: '100%',
  },
  courseHeaderTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 25,
    letterSpacing: -0.35,
  },
  titleProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 6,
  },
  titleProgressText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#4F46E5',
    fontVariant: ['tabular-nums'],
  },
  titleProgressMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  titleProgressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  titleProgressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 999,
  },
  courseProgressSectionCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabelGroup: {
    flex: 1,
    marginRight: 10,
  },
  progressSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  progressSubLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  progressBadgePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  progressTrackBar: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFillBar: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  learningWorkspace: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    gap: 18,
  },
  learningWorkspaceWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  videoPrimaryCol: {
    width: '100%',
  },
  videoPrimaryColWide: {
    flex: 1,
    minWidth: 0,
  },
  modulesSidePanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  modulesSidePanelWide: {
    width: 368,
    maxWidth: '40%',
    flexShrink: 0,
  },
  modulesSidePanelMobile: {
    width: '100%',
  },
  modulesPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  modulesScrollWide: {
    maxHeight: 480,
    backgroundColor: '#F8FAFC',
  },
  modulesScrollMobile: {
    maxHeight: 420,
    backgroundColor: '#F8FAFC',
  },
  modulesScrollContent: {
    padding: 12,
  },
  modulesPanelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  curriculumHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  curriculumHeaderIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  curriculumHeaderTitles: {
    flex: 1,
    minWidth: 0,
  },
  curriculumHeadingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  curriculumHeadingSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  expandAllActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    flexShrink: 0,
  },
  expandAllActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  moduleCardActive: {
    borderColor: '#A5B4FC',
  },
  moduleCardHeader: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  moduleHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  moduleIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moduleIndexBadgeActive: {
    backgroundColor: '#EEF2FF',
  },
  moduleIndexBadgeDone: {
    backgroundColor: '#ECFDF5',
  },
  moduleNumberIndex: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  moduleCardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 2,
  },
  moduleChevronIcon: {
    marginTop: 4,
    flexShrink: 0,
  },
  moduleProgressBlock: {
    marginTop: 10,
  },
  moduleProgressStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  moduleMetaInlineGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    minWidth: 0,
  },
  moduleInlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moduleCardMeta: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  moduleStatusDoneText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#059669',
  },
  moduleStatusActiveText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4F46E5',
  },
  moduleStatusNeutralText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
  },
  modulePercentText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  moduleProgressTrack: {
    height: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  moduleProgressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 999,
  },
  moduleProgressFillDone: {
    backgroundColor: '#10B981',
  },
  moduleLessonsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  noLessonsInModule: {
    padding: 14,
    alignItems: 'center',
  },
  noLessonsInModuleText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  lessonRowItem: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  lessonRowHairline: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  lessonRowItemLocked: {
    opacity: 0.65,
  },
  lessonRowItemActive: {
    backgroundColor: '#F5F3FF',
  },
  lessonActiveStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#4F46E5',
  },
  lessonStatusIconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    marginRight: 10,
    flexShrink: 0,
  },
  lessonInfoCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  lessonItemTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#1E293B',
    lineHeight: 19,
  },
  lessonItemTitleActive: {
    color: '#1E1B4B',
    fontWeight: '600',
  },
  lessonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 3,
  },
  lessonDurationText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  metaDotSeparator: {
    fontSize: 11.5,
    color: '#CBD5E1',
    marginHorizontal: 5,
  },
  lessonStatusPlayingText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4F46E5',
  },
  lessonStatusLockedText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
  },
  lessonRowAction: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  playerWrapper: {
    margin: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  videoQuickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  modulesToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modulesToggleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  modulesCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  modulesCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    fontVariant: ['tabular-nums'],
  },
  quickBarLectureCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  videoQuickNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  quickNavIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickNavDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
  },
  quickNavIconBtnDisabled: {
    opacity: 0.4,
  },
  quickNavBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  videoStreamContainer: {
    width: '100%',
    backgroundColor: '#0F172A',
  },
  videoCanvas: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  videoPlayerContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  webViewPlayer: {
    flex: 1,
    width: '100%',
    height: 220,
    backgroundColor: '#000000',
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLoadingText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  noVideoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noVideoTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  noVideoSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 270,
  },
  watermarkBadge: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
  },
  watermarkBadgeText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomNavLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  bottomNavLinkDisabled: {
    opacity: 0.4,
  },
  bottomNavLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginHorizontal: 4,
  },
  bottomNavLinkTextDisabled: {
    color: '#94A3B8',
  },
  centerPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  videoControlsStrip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  scrubberTrack: {
    height: 3,
    backgroundColor: '#334155',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: '#6366F1',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeCounterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  controlsRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markCompleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  markCompleteActionBtnDone: {
    backgroundColor: '#059669',
  },
  markCompleteActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  currentLectureBanner: {
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  currentModuleSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 4,
  },
  currentLectureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    letterSpacing: -0.25,
  },
  currentLectureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  currentLessonCounterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  currentCompletedInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentCompletedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  aiSectionContainer: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  aiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  aiSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  aiSectionHeaderIcon: {
    marginRight: 7,
    flexShrink: 0,
  },
  aiSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  oneTouchBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  oneTouchBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  aiCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  aiCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 152,
    overflow: 'hidden',
  },
  aiCardTopAccent: {
    height: 3.5,
    width: '100%',
  },
  aiCardInner: {
    padding: 13,
    flex: 1,
    justifyContent: 'space-between',
  },
  aiCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 9,
  },
  aiTranscriptCard: {
    width: '100%',
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  aiTranscriptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  aiTranscriptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 3,
  },
  aiCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiCardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPillBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiPillBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  aiCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  aiCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 10,
  },
  aiCardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiCardActionLink: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  bottomNextLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  bottomNextLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
    marginRight: 4,
  },
  footerContainer: {
    marginTop: 28,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  lockedHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  lockedBodyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockedIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockedHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  lockedSubheading: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  lockedCourseInfoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  lockedCourseTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  lockedCourseMeta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  lockedBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  lockedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalScrollBody: {
    marginVertical: 16,
  },
  briefingBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  briefingBoxLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  briefingBoxText: {
    fontSize: 13,
    color: '#0369A1',
    lineHeight: 19,
  },
  modalSectionSubheading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pointText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  modalActionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  quizQuestionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quizQuestionNum: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9333EA',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  quizQuestionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    lineHeight: 19,
  },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  quizOptionSelected: {
    borderColor: '#9333EA',
    backgroundColor: '#FAF5FF',
  },
  quizOptionCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  quizOptionWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  quizOptionLetter: {
    width: 22,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  quizOptionText: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  explanationBox: {
    marginTop: 6,
    backgroundColor: '#F3E8FF',
    padding: 10,
    borderRadius: 8,
  },
  explanationText: {
    fontSize: 12,
    color: '#6B21A8',
    lineHeight: 16,
  },
  scoreBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  scoreBannerText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#047857',
  },
  conceptCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  conceptTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 6,
  },
  conceptDescription: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
    marginBottom: 8,
  },
  conceptContextBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
  },
  conceptContextLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  conceptContextText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  checklistInstruction: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  takeawayCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  takeawayCheckText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '600',
  },
  takeawayCheckTextChecked: {
    textDecorationLine: 'line-through',
    color: '#78350F',
    opacity: 0.7,
  },
  aiCompanionShowcase: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  aiCompanionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  aiCompanionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    flexShrink: 0,
  },
  aiCompanionInfo: {
    flex: 1,
    minWidth: 0,
  },
  aiCompanionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.15,
  },
  aiCompanionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tapToAskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  tapToAskText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 22,
    right: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    borderWidth: 1,
    borderColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 99,
  },
  suggestionChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chatBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 2,
  },
  chatBubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 2,
  },
  chatBubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  chatBubbleTextUser: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chatBubbleTextAi: {
    color: '#0F172A',
  },
  askInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  askTextInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    marginRight: 8,
  },
  askSendButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transcriptSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  transcriptCueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
    marginTop: 2,
  },
  cueTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    fontVariant: ['tabular-nums'],
  },
  cueText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
  restrictedVideoOverlay: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  restrictedIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  restrictedVideoMessage: {
    color: '#CBD5E1',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
    marginTop: 4,
  },
  restrictedNextBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  restrictedNextBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  controlsLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playPauseControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  playPauseControlBtnDisabled: {
    opacity: 0.5,
  },
  playPauseControlText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  watchSyncErrorText: {
    marginTop: 6,
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '500',
  },

  btnDisabled: {
    opacity: 0.6,
  },

  // In-Page Section Containers
  inPagePracticeSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeadingText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  countPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  sectionLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  sectionLoadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  errorSectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 14,
  },
  errorSectionCardDark: {
    backgroundColor: '#450A0A',
    borderColor: '#7F1D1D',
  },
  errorSectionText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '500',
  },
  errorRetryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 8,
  },
  errorRetryText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptySectionBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    gap: 6,
  },
  emptySectionBoxDark: {
    backgroundColor: '#151E2E',
    borderColor: '#1E293B',
  },
  emptySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  emptySectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 280,
  },


  practiceQuizContainer: {
    gap: 12,
  },
  practiceQuizScoreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  practiceScoreTrophyWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#BBF7D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  practiceScoreTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  practiceScoreDetail: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginTop: 2,
  },
  practiceRetakeBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  practiceRetakeBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  practiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  practiceCardDark: {
    backgroundColor: '#151E2E',
    borderColor: '#1E293B',
  },
  practiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  practiceQuestionCounter: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'uppercase',
  },
  answeredDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  answeredDotText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  practiceQuestionPrompt: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 21,
    marginBottom: 14,
  },
  practiceOptionsGrid: {
    gap: 8,
    marginBottom: 14,
  },
  practiceOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  practiceOptionRowDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  practiceOptionRowSelected: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderColor: '#7C3AED',
    borderWidth: 1.5,
  },
  practiceOptionRowCorrect: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
    borderWidth: 1.5,
  },
  practiceOptionRowIncorrect: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  practiceOptionIndexCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  practiceOptionIndexCircleSelected: {
    backgroundColor: '#7C3AED',
  },
  practiceOptionIndexCircleCorrect: {
    backgroundColor: '#16A34A',
  },
  practiceOptionIndexCircleIncorrect: {
    backgroundColor: '#DC2626',
  },
  practiceOptionIndexText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  practiceOptionIndexTextSelected: {
    color: '#FFFFFF',
  },
  practiceOptionLabelText: {
    fontSize: 12.5,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  practiceOptionLabelTextSelected: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  practiceExplanationBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  practiceExplanationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  practiceExplanationTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
  practiceExplanationText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  practiceNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  practiceNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
    gap: 4,
  },
  practiceNavBtnDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.5,
  },
  practiceNavBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  practiceSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  practiceSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  practiceRetakeOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  practiceRetakeOutlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
});
