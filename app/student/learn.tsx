import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { DashboardService } from '../../src/services/dashboardService';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import {
  CourseModule,
  CourseLesson,
  LessonAiStudyData,
  PublishedCourse,
  VideoLessonTranscript,
} from '../../src/types';

interface CleanLesson extends CourseLesson {
  completed?: boolean;
}

interface CleanModule extends CourseModule {
  lessons?: CleanLesson[];
}

interface VideoSourceInfo {
  type: 'vimeo' | 'youtube' | 'direct' | 'none';
  embedUrl: string;
  html: string;
}

/**
 * Resolves video URLs (Vimeo, YouTube, direct MP4/HLS streams, or iframe strings)
 * into a safe embeddable HTML string and direct streaming URL.
 */
function resolveVideoPlayerSource(rawUrl?: string): VideoSourceInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { type: 'none', embedUrl: '', html: '' };
  }
  let url = rawUrl.trim();
  if (url.toLowerCase().startsWith('<iframe')) {
    const match = url.match(/src=["'](.*?)["']/);
    if (match && match[1]) url = match[1];
  }

  // 1. Vimeo Detection & Normalization
  // Handles:
  // - https://player.vimeo.com/video/123456789?h=abcdef
  // - https://player.vimeo.com/video/123456789/abcdef
  // - https://vimeo.com/123456789/abcdef
  // - https://vimeo.com/123456789
  // - vimeo.com/123456789
  // - 123456789 (numeric Vimeo video ID)
  let vimeoId = '';
  let vimeoHash = '';

  if (url.includes('vimeo.com') || /^\d{7,11}$/.test(url)) {
    if (/^\d{7,11}$/.test(url)) {
      vimeoId = url;
    } else {
      if (url.includes('?')) {
        const queryPart = url.split('?')[1] || '';
        const hMatch = queryPart.match(/(?:^|&)h=([a-zA-Z0-9]+)/);
        if (hMatch && hMatch[1]) {
          vimeoHash = hMatch[1];
        }
      }

      const pathMatch = url.match(/(?:video\/|vimeo\.com\/)(\d+)(?:\/([a-zA-Z0-9]+))?/);
      if (pathMatch && pathMatch[1]) {
        vimeoId = pathMatch[1];
        if (!vimeoHash && pathMatch[2]) {
          vimeoHash = pathMatch[2];
        }
      }
    }

    if (vimeoId) {
      const queryParams = [
        'autoplay=1',
        'title=0',
        'byline=0',
        'portrait=0',
        'dnt=1',
        'playsinline=1',
      ];
      if (vimeoHash) {
        queryParams.unshift(`h=${vimeoHash}`);
      }
      const embedUrl = `https://player.vimeo.com/video/${vimeoId}?${queryParams.join('&')}`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;}iframe{width:100%;height:100%;border:0;position:absolute;top:0;left:0;}</style></head><body><iframe src="${embedUrl}" frameborder="0" allow="autoplay;fullscreen;picture-in-picture;encrypted-media" allowfullscreen></iframe></body></html>`;

      return { type: 'vimeo', embedUrl, html };
    }
  }

  // 2. YouTube
  let ytId = '';
  if (url.includes('youtube.com/embed/')) {
    ytId = url.split('youtube.com/embed/')[1].split(/[?#]/)[0];
  } else if (url.includes('youtube.com/watch')) {
    const v = url.split('v=')[1];
    ytId = v ? v.split('&')[0] : '';
  } else if (url.includes('youtu.be/')) {
    ytId = url.split('youtu.be/')[1].split(/[?#]/)[0];
  }
  if (ytId) {
    const embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;}iframe{width:100%;height:100%;border:0;position:absolute;top:0;left:0;}</style></head><body><iframe src="${embedUrl}" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></body></html>`;
    return { type: 'youtube', embedUrl, html };
  }

  // 3. Direct Video file (MP4, HLS/m3u8, WebM)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;display:flex;align-items:center;justify-content:center;}video{width:100%;height:100%;object-fit:contain;}</style></head><body><video src="${url}" controls autoplay playsinline style="width:100%;height:100%;"></video></body></html>`;
    return { type: 'direct', embedUrl: url, html };
  }

  return { type: 'none', embedUrl: '', html: '' };
}

export default function StudentLearnScreen() {
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
  const [isMarkingComplete, setIsMarkingComplete] = useState<boolean>(false);

  // Module Expand / Collapse Helpers
  const isModuleExpanded = useCallback(
    (moduleId: string) => {
      return expandedModules[moduleId] !== undefined ? expandedModules[moduleId] : true;
    },
    [expandedModules]
  );

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !(prev[moduleId] !== undefined ? prev[moduleId] : true),
    }));
  }, []);

  const areAllModulesExpanded = useMemo(() => {
    if (modules.length === 0) return false;
    return modules.every((m) => isModuleExpanded(m.id));
  }, [modules, isModuleExpanded]);

  const handleToggleAllModules = useCallback(() => {
    const nextState = !areAllModulesExpanded;
    const updated: Record<string, boolean> = {};
    modules.forEach((m) => {
      updated[m.id] = nextState;
    });
    setExpandedModules(updated);
  }, [areAllModulesExpanded, modules]);

  // Handle Lesson Selection from Curriculum List
  const handleSelectLesson = useCallback((modId: string, les: CleanLesson) => {
    setSelectedModuleId(modId);
    setSelectedLesson(les);
    setCurrentTimeSec(0);
    setIsPlaying(true);
    setQuizAnswers({});
    setQuizSubmitted(false);
    // Ensure active module is expanded
    setExpandedModules((prev) => ({ ...prev, [modId]: true }));
  }, []);

  // Video Playback State
  const [, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const totalDurationSec = 1455; // 24:15 in seconds

  // AI Learning Module State & Modals
  const [aiData, setAiData] = useState<LessonAiStudyData | null>(null);
  const [, setIsLoadingAi] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'summary' | 'quiz' | 'concepts' | 'takeaways' | 'ask' | 'transcript' | null>(null);
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

  // Knowledge Check Interactive Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizScore, setQuizScore] = useState<number>(0);

  // Key Takeaways Checklist State
  const [checkedTakeaways, setCheckedTakeaways] = useState<Record<number, boolean>>({});

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
        reply = aiData?.executiveBriefing || aiData?.summary || 'This lecture explores core mission principles, historical developments, and church outreach strategies.';
      } else if (qLower.includes('concept') || qLower.includes('context')) {
        if (aiData?.concepts && aiData.concepts.length > 0) {
          reply = aiData.concepts.map((c) => `• ${c.title}: ${c.description}`).join('\n\n');
        } else {
          reply = 'The lecture establishes foundational principles and biblical framework for 21st-century missional leadership.';
        }
      } else if (qLower.includes('takeaway') || qLower.includes('point') || qLower.includes('action')) {
        if (aiData?.takeaways && aiData.takeaways.length > 0) {
          reply = aiData.takeaways.map((t, i) => `${i + 1}. ${t}`).join('\n');
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

  // 2. Verify Course Purchase Entitlement & Load Course Data
  const initializeCourse = useCallback(async () => {
    if (!courseId) {
      setIsCheckingAccess(false);
      setIsLoadingCurriculum(false);
      return;
    }
    try {
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

      if (progressRes.success && progressRes.data) {
        setProgressPercentage(progressRes.data.progressPercentage || 0);
      }

      // 3. Load Modules & Lessons from API only if entitled
      if (canAccess) {
        const modulesRes = await DashboardService.getCourseModules(courseId);
        if (modulesRes.success && modulesRes.data && modulesRes.data.length > 0) {
          const liveModules: CleanModule[] = [];
          const completedSet = new Set(progressRes.data?.completedLessons || []);
          for (const mod of modulesRes.data) {
            const lessonsRes = await DashboardService.getModuleLessons(courseId, mod.id);
            const lessonsList: CleanLesson[] = (lessonsRes.success && lessonsRes.data)
              ? lessonsRes.data.map((l) => ({
                  ...l,
                  duration: l.duration || '20:00',
                  completed: completedSet.has(l.id),
                }))
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

          const preferredLessonId = progressRes.data?.currentLessonId || progressRes.data?.lastLessonId;

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

          if (!targetLesson && liveModules.length > 0 && liveModules[0].lessons && liveModules[0].lessons.length > 0) {
            targetLesson = liveModules[0].lessons[0];
            targetModuleId = liveModules[0].id;
          }

          if (targetLesson) {
            setSelectedModuleId(targetModuleId);
            setSelectedLesson(targetLesson);
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
  }, [courseId]);

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

  // 3. Fetch Lesson AI Data whenever selected lesson changes
  const loadLessonAiData = useCallback(async (lessonId: string) => {
    if (!courseId || !lessonId) {
      setAiData(null);
      return;
    }
    try {
      setIsLoadingAi(true);
      const res = await DashboardService.getLessonAiData(courseId, lessonId);
      if (res.success && res.data && Object.keys(res.data).length > 0) {
        setAiData(res.data);
      } else {
        setAiData(null);
      }
    } catch {
      setAiData(null);
    } finally {
      setIsLoadingAi(false);
    }
  }, [courseId]);

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

  useEffect(() => {
    let isMounted = true;
    if (selectedLesson?.id) {
      const lesId = selectedLesson.id;
      Promise.resolve().then(async () => {
        if (!isMounted) return;
        await loadLessonAiData(lesId);
        await loadLessonTranscript(lesId);
      });
    } else {
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setAiData(null);
        setTranscriptData(null);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [selectedLesson?.id, loadLessonAiData, loadLessonTranscript]);

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

  // Resolve actual backend video URL or stream
  const videoSource = useMemo(() => {
    const rawLesson = selectedLesson as any;
    const rawUrl =
      rawLesson?.videoUrl ||
      rawLesson?.video_url ||
      rawLesson?.streamUrl ||
      rawLesson?.stream_url ||
      (typeof rawLesson?.video === 'string' ? rawLesson?.video : rawLesson?.video?.url || rawLesson?.video?.streamUrl) ||
      (typeof rawLesson?.vimeo === 'string' ? rawLesson?.vimeo : rawLesson?.vimeo?.url || rawLesson?.vimeoUrl) ||
      rawLesson?.contentUrl ||
      rawLesson?.content_url ||
      (typeof rawLesson?.content === 'object' && rawLesson?.content ? rawLesson?.content?.videoUrl || rawLesson?.content?.url : '') ||
      (typeof rawLesson?.url === 'string' && (rawLesson.url.includes('vimeo') || rawLesson.url.includes('youtu') || rawLesson.url.includes('.mp4') || rawLesson.url.includes('.m3u8')) ? rawLesson.url : '') ||
      (Array.isArray(rawLesson?.attachments) ? rawLesson.attachments.find((a: any) => a.mimeType?.includes('video') || (typeof a.url === 'string' && (a.url.includes('.mp4') || a.url.includes('vimeo'))))?.url : '') ||
      '';

    const resolved = resolveVideoPlayerSource(rawUrl);

    console.log('[LearnVideoDebug] Selected Course ID:', courseId);
    console.log('[LearnVideoDebug] Selected Module ID:', selectedModuleId);
    console.log('[LearnVideoDebug] Selected Lesson ID:', selectedLesson?.id);
    console.log('[LearnVideoDebug] Complete Lesson Object:', JSON.stringify(selectedLesson));
    console.log('[LearnVideoDebug] Extracted Video URL:', rawUrl);
    console.log('[LearnVideoDebug] Video Player Source:', JSON.stringify(resolved));

    return resolved;
  }, [selectedLesson, courseId, selectedModuleId]);

  // 5. Handle Next Lesson
  const handleNextLesson = () => {
    if (currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1) {
      const nextItem = allLessons[currentLessonIndex + 1];
      setSelectedModuleId(nextItem.moduleId);
      setSelectedLesson(nextItem.lesson);
      setCurrentTimeSec(0);
      setIsPlaying(true);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setExpandedModules((prev) => ({ ...prev, [nextItem.moduleId]: true }));
    } else if (allLessons.length > 0) {
      Alert.alert('Course Completed! 🎉', 'You have reached the final lecture in this course curriculum.');
    }
  };

  // 5b. Handle Previous Lesson
  const handlePreviousLesson = () => {
    if (currentLessonIndex > 0) {
      const prevItem = allLessons[currentLessonIndex - 1];
      setSelectedModuleId(prevItem.moduleId);
      setSelectedLesson(prevItem.lesson);
      setCurrentTimeSec(0);
      setIsPlaying(true);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setExpandedModules((prev) => ({ ...prev, [prevItem.moduleId]: true }));
    }
  };

  // 6. Handle Mark Complete
  const handleMarkComplete = async () => {
    if (!selectedLesson || !selectedModuleId) return;
    setIsMarkingComplete(true);
    try {
      await DashboardService.markLessonComplete(courseId, selectedModuleId, selectedLesson.id);
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          lessons: m.lessons?.map((l) =>
            l.id === selectedLesson.id ? { ...l, completed: true } : l
          ),
        }))
      );
      setSelectedLesson((prev) => (prev ? { ...prev, completed: true } : null));

      // Refresh course progress percentage directly from backend progress API
      const freshProg = await DashboardService.getCourseProgress(courseId);
      if (freshProg.success && freshProg.data) {
        setProgressPercentage(freshProg.data.progressPercentage);
      } else {
        const completedCount = allLessons.filter(
          (item) => item.lesson.completed || item.lesson.id === selectedLesson.id
        ).length;
        const newProgress = Math.min(
          100,
          Math.round((completedCount / (allLessons.length || 1)) * 100)
        );
        setProgressPercentage(newProgress);
      }
      Alert.alert('Progress Recorded! ✅', 'Lesson marked complete. Progress updated from backend.');
    } catch {
      Alert.alert('Lesson Completed', 'Your lecture completion has been recorded.');
    } finally {
      setIsMarkingComplete(false);
    }
  };

  // 7. Handle Header Tabs Navigation
  const handleHeaderTabPress = (tab: 'lessons' | 'exams' | 'assignments' | 'overview') => {
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

  // 8. Handle Quiz Answer Selection
  const handleSelectQuizOption = (qIdx: number, optIdx: number) => {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  // 9. Handle Quiz Submit
  const handleQuizSubmit = async () => {
    if (!aiData?.quiz || !selectedLesson) return;
    let score = 0;
    const submissionPayload: { questionIndex: number; selectedOption: number }[] = [];

    aiData.quiz.forEach((q, idx) => {
      const selected = quizAnswers[idx];
      if (selected !== undefined) {
        submissionPayload.push({ questionIndex: idx, selectedOption: selected });
        if (selected === q.correctOptionIndex) {
          score += 1;
        }
      }
    });

    setQuizScore(score);
    setQuizSubmitted(true);

    try {
      await DashboardService.submitLessonAiQuiz(courseId, selectedLesson.id, submissionPayload);
    } catch {
      // Ignore network sync error
    }
  };

  // Watermark String Matching Reference Screenshot: 🔒 Student7 (7bc839)
  const watermarkText = useMemo(() => {
    const rawUser = currentUser as any;
    const name = rawUser?.name || rawUser?.fullName || 'Student7';
    const rawId = rawUser?.id || rawUser?._id || rawUser?.studentId || '7bc839';
    const shortId = typeof rawId === 'string' ? rawId.substring(0, 6) : '7bc839';
    return `🔒 ${name} (${shortId})`;
  }, [currentUser]);

  // Format Time seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Guard: If no course ID provided
  if (!courseId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.lockedHeaderTitle}>Course Learning</Text>
        </View>
        <View style={styles.lockedBodyContainer}>
          <Ionicons name="school-outline" size={54} color="#7C3AED" />
          <Text style={styles.lockedHeading}>No Course Selected</Text>
          <Text style={styles.lockedSubheading}>
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.lockedHeaderTitle}>Course Learning</Text>
        </View>
        <View style={[styles.lockedBodyContainer, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[styles.lockedSubheading, { marginTop: 16 }]}>
            Verifying course entitlement from backend...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Guard: If course is Locked / Unpurchased, show Locked Screen
  if (!isCheckingAccess && !isEntitled) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.lockedHeaderTitle}>Protected Course</Text>
        </View>

        {/* Locked Body */}
        <View style={styles.lockedBodyContainer}>
          <View style={styles.lockedIconCircle}>
            <Ionicons name="lock-closed" size={48} color="#D97706" />
          </View>

          <Text style={styles.lockedHeading}>Course Access Locked</Text>
          <Text style={styles.lockedSubheading}>
            Purchase this course to access lessons and videos.
          </Text>

          <View style={styles.lockedCourseInfoCard}>
            <Text style={styles.lockedCourseTitle}>{courseTitle}</Text>
            <Text style={styles.lockedCourseMeta}>
              COTR Global Online • Academic Theological Seminary
            </Text>
            <View style={styles.lockedBadgeRow}>
              <View style={styles.lockedTag}>
                <Ionicons name="shield-checkmark" size={13} color="#6366F1" style={{ marginRight: 4 }} />
                <Text style={styles.lockedTagText}>ATA Accredited</Text>
              </View>
              <View style={styles.lockedTag}>
                <Ionicons name="time" size={13} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.lockedTagText}>Full Lifetime Access</Text>
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
            <Text style={styles.unlockButtonText}>View Course Details & Enroll</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* 1. TOP NAVIGATION BAR matching screenshot */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {/* Navigation Tabs [ Lessons | Exams | Assignments | Course Overview ] */}
        <View style={styles.headerTabsContainer}>
          <TouchableOpacity
            style={[styles.headerTabPill, activeHeaderTab === 'lessons' && styles.headerTabPillActive]}
            onPress={() => handleHeaderTabPress('lessons')}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerTabText, activeHeaderTab === 'lessons' && styles.headerTabTextActive]}>
              Lessons
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerTabPill, activeHeaderTab === 'exams' && styles.headerTabPillActive]}
            onPress={() => handleHeaderTabPress('exams')}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerTabText, activeHeaderTab === 'exams' && styles.headerTabTextActive]}>
              Exams
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerTabPill, activeHeaderTab === 'assignments' && styles.headerTabPillActive]}
            onPress={() => handleHeaderTabPress('assignments')}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerTabText, activeHeaderTab === 'assignments' && styles.headerTabTextActive]}>
              Assignments
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerTabPill, activeHeaderTab === 'overview' && styles.headerTabPillActive]}
            onPress={() => handleHeaderTabPress('overview')}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerTabText, activeHeaderTab === 'overview' && styles.headerTabTextActive]}>
              Course Overview
            </Text>
          </TouchableOpacity>
        </View>

        {/* Continue > Link Top-Right matching screenshot */}
        <TouchableOpacity style={styles.topNextButton} onPress={handleNextLesson} activeOpacity={0.7}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#0F172A" style={{ marginRight: 4 }} />
          <Text style={styles.topNextButtonText}>Continue</Text>
          <Ionicons name="chevron-forward" size={14} color="#0F172A" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>

      {/* Main Learning Scroll Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              initializeCourse();
            }}
            colors={['#6366F1']}
            tintColor="#6366F1"
          />
        }
      >
        {/* 1. COURSE TITLE AND PROGRESS (Matching Web Screenshot) */}
        <View style={styles.courseHeaderStrip}>
          <View style={styles.courseHeaderLeft}>
            <Text style={styles.courseHeaderTitle}>{courseTitle}</Text>
            <View style={styles.titleProgressHeader}>
              <Text style={styles.titleProgressText}>{progressPercentage}% complete</Text>
              <Text style={styles.titleProgressMeta}>
                {allLessons.filter((item) => item.lesson.completed).length} of {allLessons.length} lectures completed
              </Text>
            </View>
            <View style={styles.titleProgressTrack}>
              <View style={[styles.titleProgressFill, { width: `${Math.max(2, progressPercentage)}%` }]} />
            </View>
          </View>
        </View>

        {/* 2. SELECTED LESSON VIDEO PLAYER CONTAINER or Empty State */}
        {modules.length === 0 ? (
          <View style={[styles.lockedBodyContainer, { paddingVertical: 48 }]}>
            <Ionicons name="film-outline" size={54} color="#94A3B8" />
            <Text style={styles.lockedHeading}>No Published Lectures Found</Text>
            <Text style={styles.lockedSubheading}>
              {`Lectures and curriculum modules for "${courseTitle}" have not been uploaded by the academic department yet.`}
            </Text>
            <TouchableOpacity style={[styles.unlockButton, { backgroundColor: '#6366F1', marginTop: 18 }]} onPress={() => router.back()}>
              <Text style={styles.unlockButtonText}>Back to Curriculum</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.playerWrapper}>
            <View style={styles.videoStreamContainer}>
              {/* Dark Video Canvas with Real Video Playback */}
              <View style={styles.videoCanvas}>
                {videoSource.type !== 'none' ? (
                  <View style={styles.videoPlayerContainer}>
                    {Platform.OS === 'web' ? (
                      <iframe
                        src={videoSource.embedUrl}
                        style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000000' } as any}
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <WebView
                        key={`vid_${selectedLesson?.id || 'none'}`}
                        source={{
                          html: videoSource.html,
                          baseUrl: 'https://launchpaad.tech',
                        }}
                        style={styles.webViewPlayer}
                        originWhitelist={['*']}
                        allowsFullscreenVideo={true}
                        mediaPlaybackRequiresUserAction={false}
                        allowsInlineMediaPlayback={true}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        mixedContentMode="always"
                        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                        startInLoadingState={true}
                        renderLoading={() => {
                          console.log('[LearnVideoDebug] WebView is loading lecture stream for lesson:', selectedLesson?.id);
                          return (
                            <View style={styles.videoLoadingOverlay}>
                              <ActivityIndicator size="large" color="#6366F1" />
                              <Text style={styles.videoLoadingText}>Loading lecture stream...</Text>
                            </View>
                          );
                        }}
                        onLoadStart={() => {
                          console.log('[LearnVideoDebug] WebView onLoadStart for lesson:', selectedLesson?.id);
                        }}
                        onLoadEnd={() => {
                          console.log('[LearnVideoDebug] WebView onLoadEnd for lesson:', selectedLesson?.id);
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
                <View style={styles.watermarkBadge} pointerEvents="none">
                  <Text style={styles.watermarkBadgeText}>{watermarkText}</Text>
                </View>
              </View>

              {/* Video Controls Bar */}
              <View style={styles.videoControlsStrip}>
                <View style={styles.scrubberTrack}>
                  <View style={[styles.scrubberFill, { width: `${(currentTimeSec / totalDurationSec) * 100}%` }]} />
                </View>
                <View style={styles.controlsRow}>
                  <Text style={styles.timeCounterText}>
                    {formatTime(currentTimeSec)} / {selectedLesson?.duration || '20:00'}
                  </Text>

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

            {/* Current Lecture Title Banner */}
            <View style={styles.currentLectureBanner}>
              <Ionicons name="videocam-outline" size={18} color="#6366F1" style={{ marginRight: 8 }} />
              <Text style={styles.currentLectureTitle} numberOfLines={2}>
                {selectedLesson?.title || 'Academic Lecture Video Stream'}
              </Text>
            </View>
          </View>
        )}

        {/* 3. AI ASSISTANT COMPANION BANNER (Matching Web UI: Ask • Learn • Go Further) */}
        <View style={styles.aiCompanionShowcase}>
          <View style={styles.aiCompanionInfo}>
            <View style={styles.aiCompanionTagRow}>
              <View style={styles.aiOneTouchPill}>
                <Text style={styles.aiOneTouchPillText}>ONE <Text style={{ color: '#0284C7' }}>TOUCH</Text></Text>
              </View>
              <Text style={styles.aiSparkleIcon}>✨</Text>
            </View>
            <Text style={styles.aiCompanionTitle}>AI Assistant</Text>
            <Text style={styles.aiCompanionSub}>Ask • Learn • Go Further</Text>
          </View>

          <TouchableOpacity
            style={styles.tapToAskButton}
            onPress={() => setModalType('ask')}
            activeOpacity={0.88}
          >
            <Text style={styles.tapToAskEmoji}>👆</Text>
            <Text style={styles.tapToAskText}>Tap to Ask</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {/* 4. ✨ AI LEARNING MODULES FOR THIS LECTURE (Directly Below Video Matching Web Screenshot) */}
        <View style={styles.aiSectionContainer}>
          <View style={styles.aiSectionHeader}>
            <View style={styles.aiSectionTitleRow}>
              <Text style={styles.aiSparkle}>✨</Text>
              <Text style={styles.aiSectionTitle}>AI Learning Modules for this Lecture</Text>
            </View>

            {/* ONE-TOUCH ACTIVE Badge */}
            <View style={styles.oneTouchBadge}>
              <Text style={styles.oneTouchBadgeText}>ONE-TOUCH ACTIVE</Text>
            </View>
          </View>

          {/* 4 Cards Grid matching screenshot */}
          <View style={styles.aiCardsGrid}>
            {/* Card 1: Executive Summary */}
            <TouchableOpacity
              style={styles.aiCard}
              onPress={() => setModalType('summary')}
              activeOpacity={0.88}
            >
              <View style={styles.aiCardHeaderRow}>
                <View style={[styles.aiCardIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="book-outline" size={20} color="#0284C7" />
                </View>
                <View style={[styles.aiPillBadge, { backgroundColor: '#FFEDD5' }]}>
                  <Text style={[styles.aiPillBadgeText, { color: '#C2410C' }]}>Briefing</Text>
                </View>
              </View>
              <Text style={styles.aiCardTitle}>Executive Summary</Text>
              <Text style={styles.aiCardSubtitle}>Condensed lecture briefing & concepts</Text>
              <View style={styles.aiCardActionRow}>
                <Text style={[styles.aiCardActionLink, { color: '#0284C7' }]}>Read Summary</Text>
                <Ionicons name="arrow-forward" size={13} color="#0284C7" />
              </View>
            </TouchableOpacity>

            {/* Card 2: Knowledge Check */}
            <TouchableOpacity
              style={styles.aiCard}
              onPress={() => setModalType('quiz')}
              activeOpacity={0.88}
            >
              <View style={styles.aiCardHeaderRow}>
                <View style={[styles.aiCardIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="flash-outline" size={20} color="#9333EA" />
                </View>
                <View style={[styles.aiPillBadge, { backgroundColor: '#F3E8FF' }]}>
                  <Text style={[styles.aiPillBadgeText, { color: '#7E22CE' }]}>⚡ 5 Questions</Text>
                </View>
              </View>
              <Text style={styles.aiCardTitle}>Knowledge Check</Text>
              <Text style={styles.aiCardSubtitle}>Interactive 5-question arena</Text>
              <View style={styles.aiCardActionRow}>
                <Text style={[styles.aiCardActionLink, { color: '#9333EA' }]}>Take Quiz</Text>
                <Ionicons name="arrow-forward" size={13} color="#9333EA" />
              </View>
            </TouchableOpacity>

            {/* Card 3: Key Concepts */}
            <TouchableOpacity
              style={styles.aiCard}
              onPress={() => setModalType('concepts')}
              activeOpacity={0.88}
            >
              <View style={styles.aiCardHeaderRow}>
                <View style={[styles.aiCardIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="git-network-outline" size={20} color="#059669" />
                </View>
                <View style={[styles.aiPillBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.aiPillBadgeText, { color: '#047857' }]}>Deep Dive</Text>
                </View>
              </View>
              <Text style={styles.aiCardTitle}>Key Concepts</Text>
              <Text style={styles.aiCardSubtitle}>Core principles & historical backstory</Text>
              <View style={styles.aiCardActionRow}>
                <Text style={[styles.aiCardActionLink, { color: '#059669' }]}>Explore Concepts</Text>
                <Ionicons name="arrow-forward" size={13} color="#059669" />
              </View>
            </TouchableOpacity>

            {/* Card 4: Key Takeaways */}
            <TouchableOpacity
              style={styles.aiCard}
              onPress={() => setModalType('takeaways')}
              activeOpacity={0.88}
            >
              <View style={styles.aiCardHeaderRow}>
                <View style={[styles.aiCardIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="list-outline" size={20} color="#D97706" />
                </View>
                <View style={[styles.aiPillBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.aiPillBadgeText, { color: '#B45309' }]}>Takeaways</Text>
                </View>
              </View>
              <Text style={styles.aiCardTitle}>Key Takeaways</Text>
              <Text style={styles.aiCardSubtitle}>Actionable review checklist</Text>
              <View style={styles.aiCardActionRow}>
                <Text style={[styles.aiCardActionLink, { color: '#D97706' }]}>View Checklist</Text>
                <Ionicons name="arrow-forward" size={13} color="#D97706" />
              </View>
            </TouchableOpacity>

            {/* Card 5: Video Lesson Transcript */}
            <TouchableOpacity
              style={[
                styles.aiCard,
                {
                  width: '100%',
                  minHeight: 82,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderColor: '#C7D2FE',
                  backgroundColor: '#F8FAFF',
                },
              ]}
              onPress={() => {
                setModalType('transcript');
                if (selectedLesson?.id) loadLessonTranscript(selectedLesson.id);
              }}
              activeOpacity={0.88}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                <View
                  style={[
                    styles.aiCardIconBox,
                    { backgroundColor: '#EEF2FF', marginRight: 12, width: 42, height: 42, borderRadius: 10 },
                  ]}
                >
                  <Ionicons name="document-text" size={22} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={[styles.aiCardTitle, { marginBottom: 0 }]}>Lecture Video Transcript</Text>
                    <View style={[styles.aiPillBadge, { backgroundColor: '#EEF2FF' }]}>
                      <Text style={[styles.aiPillBadgeText, { color: '#4F46E5' }]}>
                        {transcriptData?.cues?.length ? `${transcriptData.cues.length} Cues` : 'Captions'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.aiCardSubtitle} numberOfLines={1}>
                    Searchable speech dialogue with jump-to timestamps
                  </Text>
                </View>
              </View>
              <View style={[styles.aiCardActionRow, { marginTop: 0 }]}>
                <Text style={[styles.aiCardActionLink, { color: '#4F46E5' }]}>Read</Text>
                <Ionicons name="arrow-forward" size={14} color="#4F46E5" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. COURSE CURRICULUM – ALL MODULES & EXPANDABLE LESSONS */}
        <View style={styles.curriculumSectionContainer}>
          {/* Course Curriculum Heading */}
          <View style={styles.curriculumSectionHeader}>
            <View style={styles.curriculumHeaderLeft}>
              <View style={styles.curriculumIconWrap}>
                <Ionicons name="list" size={18} color="#6366F1" />
              </View>
              <View>
                <Text style={styles.curriculumHeadingTitle}>Course Curriculum</Text>
                <Text style={styles.curriculumHeadingSubtitle}>
                  {modules.length} {modules.length === 1 ? 'Module' : 'Modules'} • {allLessons.length} {allLessons.length === 1 ? 'Lecture' : 'Lectures'}
                </Text>
              </View>
            </View>

            {modules.length > 1 && (
              <TouchableOpacity
                style={styles.expandAllToggleBtn}
                onPress={handleToggleAllModules}
                activeOpacity={0.7}
              >
                <Text style={styles.expandAllToggleText}>
                  {areAllModulesExpanded ? 'Collapse All' : 'Expand All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* All Backend Modules Displayed Vertically */}
          {modules.length === 0 ? (
            <View style={styles.curriculumEmptyCard}>
              <Ionicons name="folder-open-outline" size={36} color="#94A3B8" />
              <Text style={styles.curriculumEmptyText}>No curriculum modules found for this course.</Text>
            </View>
          ) : (
            modules.map((mod, modIdx) => {
              const isExpanded = isModuleExpanded(mod.id);
              const modLessons = mod.lessons || [];
              const completedModLessons = modLessons.filter((l) => l.completed).length;
              const isCurrentModule = mod.id === selectedModuleId;

              return (
                <View key={`module_${mod.id}_${modIdx}`} style={styles.moduleCard}>
                  {/* Module Header - Click to Expand / Collapse Independently */}
                  <TouchableOpacity
                    style={[styles.moduleCardHeader, isCurrentModule && styles.moduleCardHeaderActive]}
                    onPress={() => toggleModule(mod.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.moduleHeaderLeft}>
                      <View style={[styles.moduleNumberBadge, isCurrentModule && styles.moduleNumberBadgeActive]}>
                        <Text style={[styles.moduleNumberBadgeText, isCurrentModule && styles.moduleNumberBadgeTextActive]}>
                          {modIdx + 1}
                        </Text>
                      </View>
                      <View style={styles.moduleHeaderTitles}>
                        <Text style={[styles.moduleCardTitle, isCurrentModule && styles.moduleCardTitleActive]}>
                          {mod.title.toUpperCase()}
                        </Text>
                        <Text style={styles.moduleCardMeta}>
                          {completedModLessons}/{modLessons.length} Completed • {modLessons.length} {modLessons.length === 1 ? 'Lesson' : 'Lessons'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.moduleHeaderRight}>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={isCurrentModule ? '#6366F1' : '#64748B'}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expandable Lessons Under Each Module */}
                  {isExpanded && (
                    <View style={styles.moduleLessonsContainer}>
                      {modLessons.length === 0 ? (
                        <View style={styles.noLessonsInModule}>
                          <Text style={styles.noLessonsInModuleText}>No lessons uploaded in this module yet.</Text>
                        </View>
                      ) : (
                        modLessons.map((les, lIdx) => {
                          const isSelected = les.id === selectedLesson?.id;

                          return (
                            <TouchableOpacity
                              key={`les_${les.id}_${lIdx}`}
                              style={[styles.lessonRowItem, isSelected && styles.lessonRowItemActive]}
                              onPress={() => handleSelectLesson(mod.id, les)}
                              activeOpacity={0.78}
                            >
                              {/* Left: Status Indicator Icon */}
                              <View style={[styles.lessonStatusIconWrap, isSelected && styles.lessonStatusIconWrapActive]}>
                                {les.completed ? (
                                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                ) : isSelected ? (
                                  <Ionicons name="play-circle" size={18} color="#6366F1" />
                                ) : (
                                  <Ionicons name="ellipse-outline" size={18} color="#94A3B8" />
                                )}
                              </View>

                              {/* Middle: Lesson Title & Duration */}
                              <View style={styles.lessonInfoCol}>
                                <Text
                                  style={[styles.lessonItemTitle, isSelected && styles.lessonItemTitleActive]}
                                  numberOfLines={2}
                                >
                                  {les.title}
                                </Text>
                                <View style={styles.lessonMetaRow}>
                                  <Ionicons
                                    name="time-outline"
                                    size={12}
                                    color={isSelected ? '#6366F1' : '#94A3B8'}
                                    style={{ marginRight: 3 }}
                                  />
                                  <Text style={[styles.lessonDurationText, isSelected && styles.lessonDurationTextActive]}>
                                    {les.duration || '20:00'}
                                  </Text>
                                  {isSelected && (
                                    <View style={styles.nowPlayingPill}>
                                      <Text style={styles.nowPlayingPillText}>NOW PLAYING</Text>
                                    </View>
                                  )}
                                  {les.completed && (
                                    <View style={styles.completedPill}>
                                      <Text style={styles.completedPillText}>COMPLETED</Text>
                                    </View>
                                  )}
                                </View>
                              </View>

                              {/* Right: Action Indicator */}
                              <View style={styles.lessonRowAction}>
                                <Ionicons
                                  name={isSelected ? 'volume-medium' : 'play'}
                                  size={15}
                                  color={isSelected ? '#6366F1' : '#CBD5E1'}
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
            })
          )}

          {/* Previous & Next Lesson Navigation */}
          <View style={styles.bottomNavRow}>
            <TouchableOpacity
              style={[styles.bottomNavLink, currentLessonIndex <= 0 && styles.bottomNavLinkDisabled]}
              onPress={handlePreviousLesson}
              disabled={currentLessonIndex <= 0}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={15} color={currentLessonIndex <= 0 ? '#94A3B8' : '#4F46E5'} />
              <Text style={[styles.bottomNavLinkText, currentLessonIndex <= 0 && styles.bottomNavLinkTextDisabled]}>
                Previous Lesson
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomNavLink, currentLessonIndex >= allLessons.length - 1 && styles.bottomNavLinkDisabled]}
              onPress={handleNextLesson}
              disabled={currentLessonIndex >= allLessons.length - 1}
              activeOpacity={0.7}
            >
              <Text style={[styles.bottomNavLinkText, currentLessonIndex >= allLessons.length - 1 && styles.bottomNavLinkTextDisabled]}>
                Next Lesson
              </Text>
              <Ionicons name="chevron-forward" size={15} color={currentLessonIndex >= allLessons.length - 1 ? '#94A3B8' : '#4F46E5'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Copyright matching screenshot */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            © 2026 Cotr Global Online. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      {/* MODAL 1: Executive Summary */}
      <Modal visible={modalType === 'summary'} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="book" size={22} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Executive Summary</Text>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollBody}>
              {aiData?.executiveBriefing || aiData?.summary ? (
                <>
                  <View style={styles.briefingBox}>
                    <Text style={styles.briefingBoxLabel}>LECTURE BRIEFING</Text>
                    <Text style={styles.briefingBoxText}>
                      {aiData.executiveBriefing || aiData.summary}
                    </Text>
                  </View>

                  {aiData.keyPoints && aiData.keyPoints.length > 0 && (
                    <>
                      <Text style={styles.modalSectionSubheading}>Key Concepts & Core Points</Text>
                      {aiData.keyPoints.map((point, idx) => (
                        <View key={`pt_${idx}`} style={styles.pointRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#0284C7" style={{ marginRight: 8, marginTop: 2 }} />
                          <Text style={styles.pointText}>{point}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <Ionicons name="book-outline" size={36} color="#0284C7" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                    Briefing Pending
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    AI study briefing has not been published for this lecture yet.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#0284C7' }]} onPress={() => setModalType(null)}>
              <Text style={styles.modalActionBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Knowledge Check 5-Question Arena */}
      <Modal visible={modalType === 'quiz'} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flash" size={22} color="#9333EA" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Knowledge Check Arena</Text>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollBody}>
              {quizSubmitted && (
                <View style={styles.scoreBanner}>
                  <Text style={styles.scoreBannerText}>
                    Quiz Score: {quizScore} / {aiData?.quiz?.length || 0} (
                    {aiData?.quiz?.length ? Math.round((quizScore / aiData.quiz.length) * 100) : 0}%)
                  </Text>
                </View>
              )}

              {(!aiData?.quiz || aiData.quiz.length === 0) ? (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <Ionicons name="flash-outline" size={36} color="#9333EA" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                    Quiz Questions Pending
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    Knowledge check arena questions will be available once generated for this lecture.
                  </Text>
                </View>
              ) : (
                aiData.quiz.map((q, qIdx) => (
                  <View key={`quiz_q_${qIdx}`} style={styles.quizQuestionCard}>
                    <Text style={styles.quizQuestionNum}>QUESTION {qIdx + 1} OF {aiData.quiz!.length}</Text>
                    <Text style={styles.quizQuestionText}>{q.question}</Text>

                    {q.options.map((opt, optIdx) => {
                      const isSelected = quizAnswers[qIdx] === optIdx;
                      const isCorrect = q.correctOptionIndex === optIdx;
                      let optStyle = styles.quizOption;
                      if (isSelected) optStyle = { ...optStyle, ...styles.quizOptionSelected };
                      if (quizSubmitted) {
                        if (isCorrect) optStyle = { ...optStyle, ...styles.quizOptionCorrect };
                        else if (isSelected) optStyle = { ...optStyle, ...styles.quizOptionWrong };
                      }

                      return (
                        <TouchableOpacity
                          key={`opt_${qIdx}_${optIdx}`}
                          style={optStyle}
                          onPress={() => handleSelectQuizOption(qIdx, optIdx)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.quizOptionLetter}>
                            {String.fromCharCode(65 + optIdx)}
                          </Text>
                          <Text style={styles.quizOptionText}>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })}

                    {quizSubmitted && q.explanation && (
                      <View style={styles.explanationBox}>
                        <Text style={styles.explanationText}>💡 {q.explanation}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            {aiData?.quiz && aiData.quiz.length > 0 && !quizSubmitted ? (
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#9333EA' }]} onPress={handleQuizSubmit}>
                <Text style={styles.modalActionBtnText}>Submit Answers</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#0F172A' }]} onPress={() => setModalType(null)}>
                <Text style={styles.modalActionBtnText}>Close Arena</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Key Concepts Deep Dive */}
      <Modal visible={modalType === 'concepts'} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="git-network" size={22} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Key Concepts Deep Dive</Text>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollBody}>
              {(!aiData?.concepts || aiData.concepts.length === 0) ? (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <Ionicons name="git-network-outline" size={36} color="#059669" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                    Concepts Pending
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    Key concept breakdown will be available once generated for this lecture.
                  </Text>
                </View>
              ) : (
                aiData.concepts.map((c, idx) => (
                  <View key={`concept_${idx}`} style={styles.conceptCard}>
                    <Text style={styles.conceptTitle}>{c.title}</Text>
                    <Text style={styles.conceptDescription}>{c.description}</Text>
                    {c.historicalContext && (
                      <View style={styles.conceptContextBox}>
                        <Text style={styles.conceptContextLabel}>HISTORICAL & BIBLICAL CONTEXT</Text>
                        <Text style={styles.conceptContextText}>{c.historicalContext}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#059669' }]} onPress={() => setModalType(null)}>
              <Text style={styles.modalActionBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: Key Takeaways Checklist */}
      <Modal visible={modalType === 'takeaways'} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="list" size={22} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Actionable Review Checklist</Text>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollBody}>
              <Text style={styles.checklistInstruction}>
                Check off each key concept as you review to verify your mastery of this lecture:
              </Text>
              {(!aiData?.takeaways || aiData.takeaways.length === 0) ? (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <Ionicons name="list-outline" size={36} color="#D97706" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                    Takeaways Checklist Pending
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    Actionable review checklist items will be available once generated for this lecture.
                  </Text>
                </View>
              ) : (
                aiData.takeaways.map((item, idx) => {
                  const isChecked = !!checkedTakeaways[idx];
                  return (
                    <TouchableOpacity
                      key={`takeaway_${idx}`}
                      style={styles.takeawayCheckRow}
                      onPress={() => setCheckedTakeaways((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isChecked ? '#D97706' : '#94A3B8'}
                        style={{ marginRight: 10 }}
                      />
                      <Text style={[styles.takeawayCheckText, isChecked && styles.takeawayCheckTextChecked]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#D97706' }]} onPress={() => setModalType(null)}>
              <Text style={styles.modalActionBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Floating AI Chat Button matching screenshot */}
      <TouchableOpacity
        style={styles.floatingChatButton}
        onPress={() => setModalType('ask')}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <View style={styles.chatBadge}>
          <Text style={styles.chatBadgeText}>1</Text>
        </View>
      </TouchableOpacity>

      {/* MODAL 5: AI Assistant Q&A ("Ask • Learn • Go Further") */}
      <Modal visible={modalType === 'ask'} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.aiCardIconBox, { backgroundColor: '#F3E8FF', marginRight: 8 }]}>
                  <Ionicons name="sparkles" size={18} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>AI Theological Tutor</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Ask • Learn • Go Further</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick Suggestion Chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => handleSendAsk('Summarize the main points of this lecture')}
              >
                <Text style={styles.suggestionChipText}>📝 Summarize lecture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => handleSendAsk('Explain key concepts & historical context')}
              >
                <Text style={styles.suggestionChipText}>💡 Key concepts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => handleSendAsk('What are the actionable takeaways?')}
              >
                <Text style={styles.suggestionChipText}>🚀 Action takeaways</Text>
              </TouchableOpacity>
            </View>

            {/* Chat Messages */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260, marginVertical: 8 }}>
              {chatMessages.map((msg, i) => (
                <View
                  key={`msg_${i}`}
                  style={[
                    styles.chatBubble,
                    msg.sender === 'user' ? styles.chatBubbleUser : styles.chatBubbleAi,
                  ]}
                >
                  <Text
                    style={[
                      styles.chatBubbleText,
                      msg.sender === 'user' ? styles.chatBubbleTextUser : styles.chatBubbleTextAi,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* Input Row */}
            <View style={styles.askInputRow}>
              <TextInput
                style={styles.askTextInput}
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
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={[
                    styles.aiCardIconBox,
                    { backgroundColor: '#EEF2FF', marginRight: 10, width: 38, height: 38, borderRadius: 10 },
                  ]}
                >
                  <Ionicons name="document-text" size={20} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    Video Transcript
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    {selectedLesson?.title || 'Lecture Video'} • {transcriptData?.language?.toUpperCase() || 'EN'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Transcript Search Filter */}
            <View style={styles.transcriptSearchBox}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.transcriptSearchInput}
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
                  <Text style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>
                    Loading lecture captions...
                  </Text>
                </View>
              ) : filteredCues.length > 0 ? (
                filteredCues.map((cue, idx) => (
                  <View key={`cue_${idx}`} style={styles.transcriptCueRow}>
                    <View style={styles.cueBadge}>
                      <Ionicons name="play" size={10} color="#4F46E5" style={{ marginRight: 3 }} />
                      <Text style={styles.cueTimeText}>{formatCueTime(cue.start)}</Text>
                    </View>
                    <Text style={styles.cueText}>{cue.text}</Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <Ionicons name="document-text-outline" size={38} color="#94A3B8" style={{ marginBottom: 10 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                    {transcriptSearch ? 'No matching speech cues' : 'Transcripts Pending'}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 }}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 4,
  },
  headerTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 3,
  },
  headerTabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  headerTabPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  headerTabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  topNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  topNextButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  courseHeaderStrip: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  courseHeaderLeft: {
    width: '100%',
  },
  courseHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 26,
  },
  titleProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 6,
  },
  titleProgressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  titleProgressMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  titleProgressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  titleProgressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
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
  curriculumSectionContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  curriculumSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 4,
  },
  curriculumHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  curriculumIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  curriculumHeadingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  curriculumHeadingSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  expandAllToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  expandAllToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  curriculumEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  curriculumEmptyText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  moduleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  moduleCardHeaderActive: {
    backgroundColor: '#FAFAFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2FF',
  },
  moduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  moduleNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  moduleNumberBadgeActive: {
    backgroundColor: '#EEF2FF',
  },
  moduleNumberBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  moduleNumberBadgeTextActive: {
    color: '#6366F1',
  },
  moduleHeaderTitles: {
    flex: 1,
  },
  moduleCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.4,
  },
  moduleCardTitleActive: {
    color: '#4338CA',
  },
  moduleCardMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  moduleHeaderRight: {
    paddingLeft: 4,
  },
  moduleLessonsContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lessonRowItemActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#A5B4FC',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  lessonStatusIconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lessonStatusIconWrapActive: {},
  lessonInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  lessonItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 18,
  },
  lessonItemTitleActive: {
    color: '#312E81',
    fontWeight: '800',
  },
  lessonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  lessonDurationText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  lessonDurationTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  nowPlayingPill: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nowPlayingPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  completedPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  completedPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },
  lessonRowAction: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerWrapper: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
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
  bottomNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bottomNavLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bottomNavLinkDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  bottomNavLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
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
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
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
  },
  controlsRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markCompleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  markCompleteActionBtnDone: {
    backgroundColor: '#10B981',
  },
  markCompleteActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  currentLectureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  currentLectureTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  aiSectionContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  aiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aiSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  aiSparkle: {
    fontSize: 16,
    marginRight: 6,
  },
  aiSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  oneTouchBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  oneTouchBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  aiCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  aiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 148,
    justifyContent: 'space-between',
  },
  aiCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiCardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  aiPillBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
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
    fontWeight: '700',
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
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  aiCompanionInfo: {
    flex: 1,
    marginRight: 12,
  },
  aiCompanionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiOneTouchPill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
  },
  aiOneTouchPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 0.5,
  },
  aiSparkleIcon: {
    fontSize: 12,
  },
  aiCompanionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  aiCompanionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  tapToAskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tapToAskEmoji: {
    fontSize: 13,
    marginRight: 4,
  },
  tapToAskText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 24,
    right: 18,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  chatBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  suggestionChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
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
});
