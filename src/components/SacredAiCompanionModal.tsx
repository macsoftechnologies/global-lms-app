import React, { ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useAnimatedValue,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  LessonAiBackstoryItem,
  LessonAiFlashcardItem,
  LessonAiLatestAttempt,
  LessonAiQuestion,
  LessonAiStudyData,
} from '../types';

export function buildFlashcardDeck(aiData: LessonAiStudyData | null): LessonAiFlashcardItem[] {
  if (!aiData) return [];
  const direct = Array.isArray(aiData.flashcards)
    ? aiData.flashcards.filter((card) => Boolean(card?.question || card?.answer))
    : [];
  if (direct.length > 0) return direct;

  const backstory = Array.isArray(aiData.backstory) ? aiData.backstory : [];
  return backstory
    .filter((item) => Boolean(item?.topic || item?.explanation))
    .map((item, idx) => ({
      id: `concept_card_${idx}`,
      question: item.topic || 'Key Concept',
      answer: item.explanation || '',
      topic: item.topic,
    }));
}

export type StudyModuleView =
  | 'summary'
  | 'quiz'
  | 'concepts'
  | 'takeaways'
  | 'attempt'
  | null;

export interface QuizSubmissionAnswer {
  questionIndex: number;
  selectedOption: number;
}

export interface QuizSubmissionResult {
  success: boolean;
  error?: string;
  latestAttempt?: LessonAiLatestAttempt | null;
}

interface SacredAiCompanionModalProps {
  visible: boolean;
  isDarkMode: boolean;
  courseId?: string;
  lessonId?: string;
  courseTitle?: string;
  lessonTitle?: string;
  aiData: LessonAiStudyData | null;
  isLoading: boolean;
  error?: string | null;
  activeView: StudyModuleView;
  onSelectView: (view: StudyModuleView) => void;
  onClose: () => void;
  onRefreshAiData: () => void;
  onSubmitQuiz: (answers: QuizSubmissionAnswer[]) => Promise<QuizSubmissionResult>;
}

interface SynthesisStepDescriptor {
  label: string;
  iconSet: 'mci' | 'ion';
  iconName: string;
}

const VIEW_HEADER_TITLES: Record<Exclude<StudyModuleView, null>, string> = {
  summary: '📖 Lesson Narrative Synthesis',
  quiz: '🎯 Knowledge Challenge (5 Random Qs)',
  concepts: '⚡ Concept & Terminology Simplified',
  takeaways: '✨ Quick Revision Anchors',
  attempt: '🏆 Latest Attempt',
};

const SYNTHESIS_STEPS: SynthesisStepDescriptor[] = [
  {
    label: 'Scanning lecture video & audio waveform patterns',
    iconSet: 'mci',
    iconName: 'brain',
  },
  {
    label: 'Synthesizing comprehensive theological narrative',
    iconSet: 'ion',
    iconName: 'book-outline',
  },
  {
    label: 'Sampling 5 randomized questions from 35-question bank',
    iconSet: 'ion',
    iconName: 'flash-outline',
  },
  {
    label: 'Formulating memory anchors & plain-language analogies',
    iconSet: 'mci',
    iconName: 'format-list-checks',
  },
];

const SYNTHESIS_STEP_INTERVAL_MS = 520;

function formatAttemptDate(rawDate?: string): string | null {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function splitSummaryParagraphs(text: string): string[] {
  const byParagraph = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byParagraph.length > 1) return byParagraph;
  const byLine = text
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
  return byLine.length > 0 ? byLine : [text.trim()];
}

export function SacredAiCompanionModal({
  visible,
  isDarkMode,
  courseId,
  lessonId,
  courseTitle,
  lessonTitle,
  aiData,
  isLoading,
  error,
  activeView,
  onSelectView,
  onClose,
  onRefreshAiData,
  onSubmitQuiz,
}: SacredAiCompanionModalProps) {
  const { width } = useWindowDimensions();
  const isCompactWidth = width < 540;
  const styles = useMemo(() => createStyles(isDarkMode, isCompactWidth), [isDarkMode, isCompactWidth]);

  const brainPulse = useAnimatedValue(1);
  const ringSpin = useAnimatedValue(0);
  const glowPulse = useAnimatedValue(0.35);
  const contentOpacity = useAnimatedValue(1);
  const searchInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Controlled UI synthesis sequence (strictly separated from real backend fetch state `isLoading`)
  const [synthesisRunId, setSynthesisRunId] = useState(0);
  const [synthesisStepIndex, setSynthesisStepIndex] = useState(0);
  const [synthesisComplete, setSynthesisComplete] = useState(false);

  // Mini swirl loader transition between Hub and Module
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitioningView, setTransitioningView] = useState<StudyModuleView>(null);

  // Scoped interactive states
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [isSpeakingSummary, setIsSpeakingSummary] = useState(false);
  const [conceptSearch, setConceptSearch] = useState('');
  const [expandedConcepts, setExpandedConcepts] = useState<Record<number, boolean>>({ 0: true });
  const [conceptsTab, setConceptsTab] = useState<'flashcards' | 'list'>('flashcards');
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [checkedTakeaways, setCheckedTakeaways] = useState<Record<number, boolean>>({});

  // Practice Quiz state keyed by question `id`
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizSubmitError, setQuizSubmitError] = useState<string | null>(null);
  const [submittedAttemptSnapshot, setSubmittedAttemptSnapshot] = useState<LessonAiLatestAttempt | null>(null);

  const scopeKey = `${courseId || ''}_${lessonId || ''}`;
  const prevScopeRef = useRef(scopeKey);
  const prevVisibleRef = useRef(visible);

  const stopWebSpeech = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech synthesis cancellation errors
      }
    }
    setIsSpeakingSummary(false);
  }, []);

  // Trigger a fresh controlled synthesis animation pass each time the modal opens
  useEffect(() => {
    const justOpened = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (justOpened) {
      Promise.resolve().then(() => {
        setSynthesisStepIndex(0);
        setSynthesisComplete(false);
        setSynthesisRunId((prev) => prev + 1);
      });
    } else if (!visible) {
      Promise.resolve().then(() => {
        stopWebSpeech();
        setSynthesisStepIndex(0);
        setSynthesisComplete(false);
      });
    }
  }, [visible, stopWebSpeech]);

  // Reset per-lesson UI state cleanly whenever course/lesson changes
  useEffect(() => {
    if (prevScopeRef.current !== scopeKey) {
      prevScopeRef.current = scopeKey;
      Promise.resolve().then(() => {
        stopWebSpeech();
        setCopiedLabel(null);
        setSummaryExpanded(false);
        setConceptSearch('');
        setExpandedConcepts({ 0: true });
        setConceptsTab('flashcards');
        setFlashcardIndex(0);
        setFlashcardFlipped(false);
        setCheckedTakeaways({});
        setQuizIndex(0);
        setSelectedAnswers({});
        setQuizSubmitting(false);
        setQuizSubmitted(false);
        setQuizSubmitError(null);
        setSubmittedAttemptSnapshot(null);
      });
    }
  }, [scopeKey, stopWebSpeech]);

  // Blur search input before modal/concepts teardown for Android Fabric TextLayoutManager safety
  useEffect(() => {
    if (!visible || activeView !== 'concepts' || conceptsTab !== 'list') {
      searchInputRef.current?.blur();
    }
  }, [visible, activeView, conceptsTab]);

  // Cleanup copy indicator timeout and speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
      stopWebSpeech();
    };
  }, [stopWebSpeech]);

  const showSynthesisStage = visible && (!synthesisComplete || isLoading);

  // Controlled sequential progress animation + pulsing orbital rings during Neural Engine Synthesis
  useEffect(() => {
    if (!visible || !showSynthesisStage) {
      brainPulse.setValue(1);
      ringSpin.setValue(0);
      glowPulse.setValue(0.35);
      return;
    }

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(brainPulse, {
          toValue: 1.09,
          duration: 680,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(brainPulse, {
          toValue: 0.96,
          duration: 680,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.72,
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.3,
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const spinAnim = Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        duration: 4600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseAnim.start();
    glowAnim.start();
    spinAnim.start();

    return () => {
      pulseAnim.stop();
      glowAnim.stop();
      spinAnim.stop();
    };
  }, [visible, showSynthesisStage, brainPulse, glowPulse, ringSpin]);

  // Controlled simulated loading sequence timer (runs Steps 1 -> 4 -> done cleanly)
  useEffect(() => {
    if (!visible || synthesisComplete) return;

    const totalSteps = SYNTHESIS_STEPS.length;
    const stepTimer = setTimeout(() => {
      if (synthesisStepIndex < totalSteps - 1) {
        setSynthesisStepIndex((prev) => prev + 1);
      } else {
        setSynthesisStepIndex(totalSteps);
        setSynthesisComplete(true);
      }
    }, SYNTHESIS_STEP_INTERVAL_MS);

    return () => clearTimeout(stepTimer);
  }, [visible, synthesisComplete, synthesisStepIndex, synthesisRunId]);

  // Subtle fade transition when transitioning from Synthesis -> Final Dashboard -> Detail views
  useEffect(() => {
    if (!visible || showSynthesisStage) return;
    contentOpacity.setValue(0.6);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, showSynthesisStage, activeView, contentOpacity]);

  const summaryText = typeof aiData?.summary === 'string' ? aiData.summary : '';
  const hasSummaryContent = summaryText.trim().length > 0;
  const quizQuestions = useMemo(() => aiData?.quiz_pool || [], [aiData?.quiz_pool]);
  const totalPoolCount =
    typeof aiData?.total_pool_count === 'number' ? aiData.total_pool_count : undefined;
  const backstoryList = useMemo(() => aiData?.backstory || [], [aiData?.backstory]);
  const flashcardDeck = useMemo(() => buildFlashcardDeck(aiData), [aiData]);
  const takeawaysList = useMemo(() => aiData?.key_takeaways || [], [aiData?.key_takeaways]);
  const latestAttempt = submittedAttemptSnapshot || aiData?.latest_attempt || null;

  const isUnavailable =
    !showSynthesisStage &&
    !isLoading &&
    !error &&
    (!aiData ||
      (!hasSummaryContent &&
        quizQuestions.length === 0 &&
        backstoryList.length === 0 &&
        flashcardDeck.length === 0 &&
        takeawaysList.length === 0));

  const filteredBackstory = useMemo(() => {
    const q = conceptSearch.trim().toLowerCase();
    if (!q) return backstoryList;
    return backstoryList.filter((item) => {
      const topic = (item.topic || '').toLowerCase();
      const explanation = (item.explanation || '').toLowerCase();
      return topic.includes(q) || explanation.includes(q);
    });
  }, [backstoryList, conceptSearch]);

  const revisedCount = useMemo(
    () => takeawaysList.filter((_, idx) => Boolean(checkedTakeaways[idx])).length,
    [takeawaysList, checkedTakeaways]
  );

  const handleCloseModal = useCallback(() => {
    searchInputRef.current?.blur();
    stopWebSpeech();
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setIsTransitioning(false);
    setTransitioningView(null);
    onClose();
  }, [onClose, stopWebSpeech]);


  const handleResetQuiz = useCallback(() => {
    setQuizIndex(0);
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setQuizSubmitError(null);
    setSubmittedAttemptSnapshot(null);
  }, []);

  const handleSelectSection = useCallback(
    (view: StudyModuleView) => {
      searchInputRef.current?.blur();
      stopWebSpeech();
      if (!view) {
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        setIsTransitioning(false);
        setTransitioningView(null);
        onSelectView(null);
        return;
      }
      if (view === 'quiz') {
        handleResetQuiz();
      }
      if (view === 'concepts') {
        setFlashcardFlipped(false);
      }
      setIsTransitioning(true);
      setTransitioningView(view);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => {
        onSelectView(view);
        setIsTransitioning(false);
        setTransitioningView(null);
      }, 750);
    },
    [onSelectView, stopWebSpeech, handleResetQuiz]
  );

  const handleRetrySynthesis = useCallback(() => {
    stopWebSpeech();
    setSynthesisStepIndex(0);
    setSynthesisComplete(false);
    setSynthesisRunId((prev) => prev + 1);
    onRefreshAiData();
  }, [onRefreshAiData, stopWebSpeech]);

  const canSpeakSummary =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const handleToggleSpeakSummary = useCallback(() => {
    if (!canSpeakSummary || !hasSummaryContent) return;
    try {
      if (isSpeakingSummary) {
        window.speechSynthesis.cancel();
        setIsSpeakingSummary(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(summaryText);
      utterance.onend = () => setIsSpeakingSummary(false);
      utterance.onerror = () => setIsSpeakingSummary(false);
      setIsSpeakingSummary(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeakingSummary(false);
    }
  }, [canSpeakSummary, hasSummaryContent, isSpeakingSummary, summaryText]);

  const handleCopyOrShareText = useCallback(async (tag: string, text: string) => {
    if (!text.trim()) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await Share.share({ message: text });
      }
      setCopiedLabel(tag);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedLabel(null), 2000);
    } catch {
      // Ignore user cancellation
    }
  }, []);

  const handlePickQuizOption = useCallback(
    (questionId: string, optionIdx: number) => {
      if (quizSubmitted || quizSubmitting) return;
      if (selectedAnswers[questionId] !== undefined) return;
      setSelectedAnswers((prev) => ({
        ...prev,
        [questionId]: optionIdx,
      }));
      setQuizSubmitError(null);
    },
    [quizSubmitted, quizSubmitting, selectedAnswers]
  );


  const handleSubmitQuiz = useCallback(async () => {
    if (quizQuestions.length === 0 || quizSubmitting) return;

    const answersPayload: QuizSubmissionAnswer[] = quizQuestions
      .map<QuizSubmissionAnswer | null>((q, idx) => {
        const picked = selectedAnswers[q.id];
        if (typeof picked !== 'number') return null;
        return {
          questionIndex: idx,
          selectedOption: picked,
        };
      })
      .filter((item): item is QuizSubmissionAnswer => item !== null);

    if (answersPayload.length === 0) return;

    setQuizSubmitting(true);
    setQuizSubmitError(null);
    try {
      const result = await onSubmitQuiz(answersPayload);
      if (result.success) {
        if (result.latestAttempt) {
          setSubmittedAttemptSnapshot(result.latestAttempt);
        }
        setQuizSubmitted(true);
      } else {
        setQuizSubmitError(result.error || 'Could not save quiz attempt. Please try again.');
      }
    } catch (err: unknown) {
      setQuizSubmitError(
        err instanceof Error ? err.message : 'Network error while submitting quiz attempt.'
      );
    } finally {
      setQuizSubmitting(false);
    }
  }, [quizQuestions, quizSubmitting, selectedAnswers, onSubmitQuiz]);

  const isStage3 = Boolean(activeView && !showSynthesisStage && !isTransitioning && !isLoading && !error && !isUnavailable);
  const headerTitle =
    isStage3 && activeView ? VIEW_HEADER_TITLES[activeView] : 'Sacred AI Study Companion';
  const cleanLessonName = lessonTitle?.trim() || 'Academic Video Intelligence';
  const dynamicContextSubtitle = cleanLessonName.toUpperCase();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleCloseModal}>
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {isStage3 ? (
                <TouchableOpacity
                  style={styles.headerBackBtn}
                  onPress={() => handleSelectSection(null)}
                  accessibilityLabel="Back to AI Study Companion Dashboard"
                >
                  <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                  <Text style={styles.headerBackText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.sparkleBadge}>
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                </View>
              )}

              <View style={styles.headerTitleWrap}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {headerTitle}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>LIVE AI</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle} numberOfLines={2}>
                  {dynamicContextSubtitle}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleCloseModal}
              accessibilityLabel="Close AI Study Companion"
            >
              <Ionicons name="close" size={18} color="#E2E8F0" />
            </TouchableOpacity>
          </View>

          {/* Modal Body */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {showSynthesisStage ? (
              <AiLoadingStage
                stepIndex={synthesisStepIndex}
                totalPoolCount={totalPoolCount}
                brainPulse={brainPulse}
                glowPulse={glowPulse}
                ringSpin={ringSpin}
                isDarkMode={isDarkMode}
                styles={styles}
              />
            ) : isTransitioning ? (
              <AiMiniSwirlLoader
                transitioningView={transitioningView}
                isDarkMode={isDarkMode}
                styles={styles}
              />
            ) : error ? (
              <AiErrorState
                message={error}
                isDarkMode={isDarkMode}
                styles={styles}
                onRetry={handleRetrySynthesis}
              />
            ) : isUnavailable ? (
              <View style={styles.emptyWrap}>
                <EmptyModuleState
                  icon="sparkles-outline"
                  color="#6366F1"
                  title="AI Study Content Unavailable"
                  subtitle="AI study materials have not been added for this lesson yet."
                  isDarkMode={isDarkMode}
                />
                <TouchableOpacity
                  style={styles.retryOutlineBtn}
                  onPress={handleRetrySynthesis}
                >
                  <Ionicons name="refresh" size={15} color="#4F46E5" />
                  <Text style={styles.retryOutlineBtnText}>Check Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={{ opacity: contentOpacity }}>
                {!activeView ? (
                  <AiHubOverview
                    summaryText={summaryText}
                    hasSummaryContent={hasSummaryContent}
                    quizCount={quizQuestions.length}
                    totalPoolCount={totalPoolCount}
                    backstoryCount={backstoryList.length}
                    flashcardCount={flashcardDeck.length}
                    takeawaysCount={takeawaysList.length}
                    latestAttempt={latestAttempt}
                    onSelectView={handleSelectSection}
                    styles={styles}
                    isDarkMode={isDarkMode}
                  />
                ) : activeView === 'summary' ? (
                  <AiSummaryView
                    summaryText={summaryText}
                    hasSummaryContent={hasSummaryContent}
                    expanded={summaryExpanded}
                    onToggleExpand={() => setSummaryExpanded((prev) => !prev)}
                    canSpeak={canSpeakSummary}
                    isSpeaking={isSpeakingSummary}
                    onToggleSpeak={handleToggleSpeakSummary}
                    copied={copiedLabel === 'summary'}
                    onCopyOrShare={() => handleCopyOrShareText('summary', summaryText)}
                    onRefresh={() => onRefreshAiData()}
                    isDarkMode={isDarkMode}
                    styles={styles}
                  />
                ) : activeView === 'quiz' ? (
                  <AiQuizView
                    quizQuestions={quizQuestions}
                    totalPoolCount={totalPoolCount}
                    quizIndex={quizIndex}
                    selectedAnswers={selectedAnswers}
                    quizSubmitting={quizSubmitting}
                    quizSubmitted={quizSubmitted}
                    quizSubmitError={quizSubmitError}
                    latestAttempt={latestAttempt}
                    onSelectQuestionIndex={setQuizIndex}
                    onPickOption={handlePickQuizOption}
                    onSubmitQuiz={handleSubmitQuiz}
                    onRetakeQuiz={handleResetQuiz}
                    onViewAttempt={() => handleSelectSection('attempt')}
                    onBackToHub={() => handleSelectSection(null)}
                    isDarkMode={isDarkMode}
                    styles={styles}
                  />
                ) : activeView === 'concepts' ? (
                  <AiConceptsView
                    backstoryList={backstoryList}
                    filteredBackstory={filteredBackstory}
                    flashcardDeck={flashcardDeck}
                    conceptsTab={conceptsTab}
                    onSelectTab={(tab) => {
                      if (tab !== 'list') searchInputRef.current?.blur();
                      setConceptsTab(tab);
                    }}
                    flashcardIndex={flashcardIndex}
                    flashcardFlipped={flashcardFlipped}
                    onSelectFlashcardIndex={(idx) => {
                      setFlashcardIndex(idx);
                      setFlashcardFlipped(false);
                    }}
                    onToggleFlip={() => setFlashcardFlipped((prev) => !prev)}
                    searchQuery={conceptSearch}
                    onChangeSearch={setConceptSearch}
                    searchInputRef={searchInputRef}
                    expandedTopics={expandedConcepts}
                    onToggleTopic={(idx) =>
                      setExpandedConcepts((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    onSetAllExpanded={(expandAll) => {
                      const next: Record<number, boolean> = {};
                      if (expandAll) {
                        filteredBackstory.forEach((_, idx) => {
                          next[idx] = true;
                        });
                      }
                      setExpandedConcepts(next);
                    }}
                    isDarkMode={isDarkMode}
                    styles={styles}
                  />
                ) : activeView === 'takeaways' ? (
                  <AiTakeawaysView
                    takeawaysList={takeawaysList}
                    checkedTakeaways={checkedTakeaways}
                    revisedCount={revisedCount}
                    copied={copiedLabel === 'takeaways'}
                    onToggleTakeaway={(idx) =>
                      setCheckedTakeaways((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    onCopyOrShare={() =>
                      handleCopyOrShareText(
                        'takeaways',
                        takeawaysList.map((t, i) => `${i + 1}. ${t}`).join('\n')
                      )
                    }
                    isDarkMode={isDarkMode}
                    styles={styles}
                  />
                ) : (
                  <AiPreviousAttemptView
                    latestAttempt={latestAttempt}
                    hasQuiz={quizQuestions.length > 0}
                    onStartQuiz={() => {
                      handleResetQuiz();
                      handleSelectSection('quiz');
                    }}
                    styles={styles}
                    isDarkMode={isDarkMode}
                  />
                )}
              </Animated.View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AiLoadingStage({
  stepIndex,
  totalPoolCount,
  brainPulse,
  glowPulse,
  ringSpin,
  isDarkMode,
  styles,
}: {
  stepIndex: number;
  totalPoolCount?: number;
  brainPulse: Animated.Value;
  glowPulse: Animated.Value;
  ringSpin: Animated.Value;
  isDarkMode: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const spinDeg = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const counterSpinDeg = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  return (
    <View style={styles.loadingStageWrap}>
      {/* Animated Purple Brain + Glowing Halo + Concentric Dashed Orbital Rings */}
      <View style={styles.loadingOrbWrap}>
        <Animated.View
          style={[
            styles.loadingGlowHalo,
            {
              opacity: glowPulse,
              transform: [{ scale: brainPulse }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.loadingOuterDashedRing,
            { transform: [{ rotate: counterSpinDeg }] },
          ]}
        />
        <Animated.View
          style={[
            styles.loadingDashedRing,
            { transform: [{ rotate: spinDeg }] },
          ]}
        />
        <Animated.View
          style={[
            styles.loadingBrainCore,
            { transform: [{ scale: brainPulse }] },
          ]}
        >
          <MaterialCommunityIcons name="brain" size={28} color="#FFFFFF" />
        </Animated.View>
      </View>

      <Text style={styles.loadingHeading}>Neural Engine Synthesizing Lecture...</Text>
      <Text style={styles.loadingSubheading}>
        Scanning video audio tracks, theological transcripts &amp; generating study package
      </Text>

      <View style={styles.loadingStepsList}>
        {SYNTHESIS_STEPS.map((step, idx) => {
          const isDone = idx < stepIndex;
          const isActive = idx === stepIndex;

          const stepLabel =
            idx === 2
              ? `Sampling 5 randomized questions from ${totalPoolCount || 35}-question bank`
              : step.label;

          const iconColor = isDone
            ? '#16A34A'
            : isActive
            ? isDarkMode
              ? '#C4B5FD'
              : '#6D28D9'
            : '#94A3B8';

          return (
            <View
              key={step.label}
              style={[
                styles.loadingStepRow,
                isDone && styles.loadingStepRowDone,
                isActive && styles.loadingStepRowActive,
              ]}
            >
              <View
                style={[
                  styles.loadingStepDot,
                  isDone && styles.loadingStepDotDone,
                  isActive && styles.loadingStepDotActive,
                ]}
              />
              {step.iconSet === 'mci' ? (
                <MaterialCommunityIcons
                  name={step.iconName as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={16}
                  color={iconColor}
                />
              ) : (
                <Ionicons
                  name={step.iconName as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={iconColor}
                />
              )}
              <Text
                style={[
                  styles.loadingStepText,
                  isDone && styles.loadingStepTextDone,
                  isActive && styles.loadingStepTextActive,
                ]}
              >
                {stepLabel}
              </Text>
              {isDone ? (
                <Ionicons name="checkmark" size={16} color="#16A34A" />
              ) : isActive ? (
                <ActivityIndicator size="small" color={isDarkMode ? '#C4B5FD' : '#7C3AED'} />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AiErrorState({
  message,
  isDarkMode,
  styles,
  onRetry,
}: {
  message: string;
  isDarkMode: boolean;
  styles: ReturnType<typeof createStyles>;
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorCard}>
      <View style={styles.errorIconWrap}>
        <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
      </View>
      <Text style={[styles.errorTitle, isDarkMode && { color: '#F8FAFC' }]}>
        Unable to Load Lesson AI Content
      </Text>
      <Text style={[styles.errorMessage, isDarkMode && { color: '#CBD5E1' }]}>{message}</Text>
      <TouchableOpacity style={styles.primaryModalBtn} onPress={onRetry}>
        <Ionicons name="refresh" size={16} color="#FFFFFF" />
        <Text style={styles.primaryModalBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function AiMiniSwirlLoader({
  transitioningView,
  isDarkMode,
  styles,
}: {
  transitioningView: StudyModuleView;
  isDarkMode: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const spinVal = useAnimatedValue(0);
  const pulseVal = useAnimatedValue(1);

  useEffect(() => {
    const spinAnim = Animated.loop(
      Animated.timing(spinVal, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseVal, {
          toValue: 1.15,
          duration: 375,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseVal, {
          toValue: 0.95,
          duration: 375,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    spinAnim.start();
    pulseAnim.start();
    return () => {
      spinAnim.stop();
      pulseAnim.stop();
    };
  }, [spinVal, pulseVal]);

  const spinDeg = spinVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const counterSpinDeg = spinVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const swirlTitle =
    transitioningView === 'summary'
      ? 'Synthesizing Narrative & Audio Streams...'
      : transitioningView === 'quiz'
      ? 'Compiling 5 Randomized Challenge Questions...'
      : transitioningView === 'concepts'
      ? 'Unpacking Theological Concepts & Analogies...'
      : transitioningView === 'takeaways'
      ? 'Constructing High-Yield Revision Anchors...'
      : 'Synthesizing Learning Module...';

  return (
    <View style={styles.swirlBox}>
      <View style={styles.swirlLoaderWrap}>
        <Animated.View
          style={[styles.swirlVortexOuter, { transform: [{ rotate: counterSpinDeg }] }]}
        />
        <Animated.View
          style={[styles.swirlVortexInner, { transform: [{ rotate: spinDeg }] }]}
        />
        <Animated.View
          style={[styles.swirlCore, { transform: [{ scale: pulseVal }] }]}
        >
          <Ionicons name="sparkles" size={26} color={isDarkMode ? '#C4B5FD' : '#7C3AED'} />
        </Animated.View>
      </View>
      <Text style={styles.swirlTitle}>{swirlTitle}</Text>
      <Text style={styles.swirlSub}>One-Touch AI formatting intelligence for this lecture</Text>
    </View>
  );
}

function AiHubOverview({
  summaryText,
  hasSummaryContent,
  quizCount,
  totalPoolCount,
  backstoryCount,
  flashcardCount,
  takeawaysCount,
  latestAttempt,
  onSelectView,
  styles,
  isDarkMode,
}: {
  summaryText: string;
  hasSummaryContent: boolean;
  quizCount: number;
  totalPoolCount?: number;
  backstoryCount: number;
  flashcardCount: number;
  takeawaysCount: number;
  latestAttempt: LessonAiLatestAttempt | null;
  onSelectView: (view: StudyModuleView) => void;
  styles: ReturnType<typeof createStyles>;
  isDarkMode: boolean;
}) {
  const attemptDateStr = formatAttemptDate(latestAttempt?.completedAt);
  const displayPoolCount =
    typeof totalPoolCount === 'number' && totalPoolCount > 0 ? totalPoolCount : undefined;
  const displayConceptsCount = backstoryCount > 0 ? backstoryCount : (flashcardCount > 0 ? flashcardCount : 15);
  const displayTakeawaysCount = takeawaysCount > 0 ? takeawaysCount : 8;
  const summarySnippet = hasSummaryContent
    ? summaryText.trim()
    : 'This lecture introduces the foundational concepts of missiology, the academic study of Christian mission.';

  return (
    <View style={styles.hubContainer}>
      {/* Four Responsive Dashboard Cards Matching Reference Screenshot */}
      <View style={styles.hubGrid}>
        {/* CARD 1: Lesson Summary */}
        <TouchableOpacity
          style={styles.hubCard}
          onPress={() => onSelectView('summary')}
          activeOpacity={0.85}
        >
          <View style={styles.hubCardInner}>
            <View>
              <View style={styles.hubCardTop}>
                <View style={[styles.hubIconBox, { backgroundColor: '#7C3AED' }]}>
                  <Ionicons name="book-outline" size={18} color="#FFFFFF" />
                </View>
                <View style={[styles.hubPill, { backgroundColor: isDarkMode ? '#2E1065' : '#F3E8FF' }]}>
                  <Text style={[styles.hubPillText, { color: isDarkMode ? '#DDD6FE' : '#7C3AED' }]}>
                    Full Synthesis
                  </Text>
                </View>
              </View>
              <Text style={styles.hubCardTitle}>Lesson Summary</Text>
              <Text style={styles.hubCardSnippet} numberOfLines={2}>
                {summarySnippet}
              </Text>
            </View>
            <View style={styles.hubCardActionRow}>
              <Text style={[styles.hubCardCta, { color: isDarkMode ? '#C4B5FD' : '#7C3AED' }]}>
                View Summary &amp; Listen
              </Text>
              <Ionicons name="arrow-forward" size={14} color={isDarkMode ? '#C4B5FD' : '#7C3AED'} />
            </View>
          </View>
        </TouchableOpacity>

        {/* CARD 2: Knowledge Challenge */}
        <TouchableOpacity
          style={styles.hubCard}
          onPress={() => onSelectView('quiz')}
          activeOpacity={0.85}
        >
          <View style={styles.hubCardInner}>
            <View>
              <View style={styles.hubCardTop}>
                <View style={[styles.hubIconBox, { backgroundColor: '#3B82F6' }]}>
                  <Ionicons name="list" size={18} color="#FFFFFF" />
                </View>
                <View style={[styles.hubPill, { backgroundColor: isDarkMode ? '#1E3A5F' : '#EFF6FF' }]}>
                  <Text style={[styles.hubPillText, { color: isDarkMode ? '#93C5FD' : '#2563EB' }]}>
                    5 Random Qs
                  </Text>
                </View>
              </View>
              <Text style={styles.hubCardTitle}>Knowledge Challenge</Text>
              <Text style={styles.hubCardSnippet} numberOfLines={2}>
                {`5 questions randomly sampled from the ${displayPoolCount || 35}-question bank. Live scoring & explanations.`}
              </Text>
            </View>
            <View style={styles.hubCardActionRow}>
              <Text style={[styles.hubCardCta, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>
                Take 5-Q Challenge
              </Text>
              <Ionicons name="arrow-forward" size={14} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
            </View>
          </View>
        </TouchableOpacity>

        {/* CARD 3: Simplify Topics */}
        <TouchableOpacity
          style={styles.hubCard}
          onPress={() => onSelectView('concepts')}
          activeOpacity={0.85}
        >
          <View style={styles.hubCardInner}>
            <View>
              <View style={styles.hubCardTop}>
                <View style={[styles.hubIconBox, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="flash" size={18} color="#FFFFFF" />
                </View>
                <View style={[styles.hubPill, { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5' }]}>
                  <Text style={[styles.hubPillText, { color: isDarkMode ? '#6EE7B7' : '#059669' }]}>
                    {displayConceptsCount} Concepts
                  </Text>
                </View>
              </View>
              <Text style={styles.hubCardTitle}>Simplify Topics</Text>
              <Text style={styles.hubCardSnippet} numberOfLines={2}>
                Complex theological terms and Greek roots explained with plain-language analogies.
              </Text>
            </View>
            <View style={styles.hubCardActionRow}>
              <Text style={[styles.hubCardCta, { color: isDarkMode ? '#34D399' : '#059669' }]}>
                Explore Concepts
              </Text>
              <Ionicons name="arrow-forward" size={14} color={isDarkMode ? '#34D399' : '#059669'} />
            </View>
          </View>
        </TouchableOpacity>

        {/* CARD 4: Quick Revision */}
        <TouchableOpacity
          style={styles.hubCard}
          onPress={() => onSelectView('takeaways')}
          activeOpacity={0.85}
        >
          <View style={styles.hubCardInner}>
            <View>
              <View style={styles.hubCardTop}>
                <View style={[styles.hubIconBox, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                </View>
                <View style={[styles.hubPill, { backgroundColor: isDarkMode ? '#451A03' : '#FFFBEB' }]}>
                  <Text style={[styles.hubPillText, { color: isDarkMode ? '#FCD34D' : '#D97706' }]}>
                    {displayTakeawaysCount} Key Points
                  </Text>
                </View>
              </View>
              <Text style={styles.hubCardTitle}>Quick Revision</Text>
              <Text style={styles.hubCardSnippet} numberOfLines={2}>
                High-yield revision checklist and memory anchors to tick off before exams.
              </Text>
            </View>
            <View style={styles.hubCardActionRow}>
              <Text style={[styles.hubCardCta, { color: isDarkMode ? '#FBBF24' : '#D97706' }]}>
                Open Checklist
              </Text>
              <Ionicons name="arrow-forward" size={14} color={isDarkMode ? '#FBBF24' : '#D97706'} />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Latest Attempt Summary Strip */}
      {latestAttempt ? (
        <TouchableOpacity
          style={styles.attemptBanner}
          onPress={() => onSelectView('attempt')}
          activeOpacity={0.85}
        >
          <View style={styles.attemptLeft}>
            <View style={styles.trophyBadge}>
              <Ionicons name="trophy" size={16} color="#15803D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attemptLabel}>Your Previous Quiz Score:</Text>
              <Text style={styles.attemptScore}>
                {latestAttempt.score} / {latestAttempt.totalQuestions}
                {typeof latestAttempt.percentage === 'number'
                  ? ` (${Math.round(latestAttempt.percentage)}%)`
                  : ''}
              </Text>
            </View>
          </View>
          {attemptDateStr ? (
            <Text style={styles.attemptDate}>Saved on {attemptDateStr}</Text>
          ) : (
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function AiSummaryView({
  summaryText,
  hasSummaryContent,
  expanded,
  onToggleExpand,
  canSpeak,
  isSpeaking,
  onToggleSpeak,
  copied,
  onCopyOrShare,
  onRefresh,
  isDarkMode,
  styles,
}: {
  summaryText: string;
  hasSummaryContent: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  canSpeak: boolean;
  isSpeaking: boolean;
  onToggleSpeak: () => void;
  copied: boolean;
  onCopyOrShare: () => void;
  onRefresh: () => void;
  isDarkMode: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const paragraphs = useMemo(() => splitSummaryParagraphs(summaryText), [summaryText]);
  const isLongSummary = summaryText.length > 320 || paragraphs.length > 2;
  const visibleParagraphs = expanded || !isLongSummary ? paragraphs : paragraphs.slice(0, 2);

  return (
    <View style={styles.viewContainer}>
      <View style={styles.toolbar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {hasSummaryContent && canSpeak ? (
            <TouchableOpacity style={styles.toolBtn} onPress={onToggleSpeak}>
              <Ionicons
                name={isSpeaking ? 'stop-circle-outline' : 'volume-high-outline'}
                size={15}
                color={isSpeaking ? '#DC2626' : '#7C3AED'}
              />
              <Text style={styles.toolBtnText}>
                {isSpeaking ? 'Stop Audio' : 'Listen'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {hasSummaryContent ? (
            <TouchableOpacity style={styles.toolBtn} onPress={onCopyOrShare}>
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={15}
                color={copied ? '#059669' : '#4F46E5'}
              />
              <Text style={styles.toolBtnText}>
                {copied
                  ? 'Copied'
                  : Platform.OS === 'web'
                  ? 'Copy Summary'
                  : 'Copy / Share Summary'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.toolBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={15} color="#4F46E5" />
          <Text style={styles.toolBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {hasSummaryContent ? (
        <View style={styles.narrativeCard}>
          <Text style={styles.narrativeEyebrow}>EXECUTIVE SUMMARY</Text>
          <View style={styles.paragraphsStack}>
            {visibleParagraphs.map((para, idx) => (
              <Text
                key={`sum_p_${idx}`}
                style={styles.narrativeText}
                numberOfLines={!expanded && isLongSummary && idx === visibleParagraphs.length - 1 ? 4 : undefined}
              >
                {para}
              </Text>
            ))}
          </View>
          {isLongSummary ? (
            <TouchableOpacity
              style={styles.expandSummaryBtn}
              onPress={onToggleExpand}
              activeOpacity={0.75}
            >
              <Text style={styles.expandSummaryText}>
                {expanded ? 'Collapse Summary' : 'Expand Full Summary'}
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={15}
                color="#2563EB"
              />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <EmptyModuleState
          icon="book-outline"
          color="#2563EB"
          title="No AI Summary Available"
          subtitle="A lesson summary has not been returned for this lesson yet."
          isDarkMode={isDarkMode}
        />
      )}
    </View>
  );
}

function AiQuizView({
  quizQuestions,
  totalPoolCount,
  quizIndex,
  selectedAnswers,
  quizSubmitting,
  quizSubmitted,
  quizSubmitError,
  latestAttempt,
  onSelectQuestionIndex,
  onPickOption,
  onSubmitQuiz,
  onRetakeQuiz,
  onViewAttempt,
  onBackToHub,
  isDarkMode,
  styles,
}: {
  quizQuestions: LessonAiQuestion[];
  totalPoolCount?: number;
  quizIndex: number;
  selectedAnswers: Record<string, number>;
  quizSubmitting: boolean;
  quizSubmitted: boolean;
  quizSubmitError: string | null;
  latestAttempt: LessonAiLatestAttempt | null;
  onSelectQuestionIndex: (idx: number) => void;
  onPickOption: (questionId: string, optIdx: number) => void;
  onSubmitQuiz: () => void;
  onRetakeQuiz: () => void;
  onViewAttempt: () => void;
  onBackToHub: () => void;
  isDarkMode: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  if (quizQuestions.length === 0) {
    return (
      <EmptyModuleState
        icon="flash-outline"
        color="#7C3AED"
        title="No Practice Questions Available"
        subtitle="No practice quiz questions were returned for this lesson."
        isDarkMode={isDarkMode}
      />
    );
  }

  const answeredCount = quizQuestions.filter(
    (q) => typeof selectedAnswers[q.id] === 'number'
  ).length;
  const evaluatedCorrectCount = quizQuestions.reduce((acc, q) => {
    const picked = selectedAnswers[q.id];
    if (
      typeof picked === 'number' &&
      typeof q.correct_index === 'number' &&
      picked === q.correct_index
    ) {
      return acc + 1;
    }
    return acc;
  }, 0);

  if (quizSubmitted) {
    const displayScore =
      typeof latestAttempt?.score === 'number' ? latestAttempt.score : evaluatedCorrectCount;
    const displayTotal =
      typeof latestAttempt?.totalQuestions === 'number' && latestAttempt.totalQuestions > 0
        ? latestAttempt.totalQuestions
        : quizQuestions.length;
    const displayPct =
      typeof latestAttempt?.percentage === 'number'
        ? Math.round(latestAttempt.percentage)
        : undefined;

    return (
      <View style={styles.quizFinishCard}>
        <View style={styles.finishTrophyCircle}>
          <Ionicons name="trophy" size={38} color="#16A34A" />
        </View>
        <Text style={styles.finishTitle}>Knowledge Check Submitted</Text>
        <Text style={styles.finishScoreText}>
          Score:{' '}
          <Text style={{ color: '#16A34A', fontWeight: '800' }}>{displayScore}</Text> out of{' '}
          <Text style={{ fontWeight: '800' }}>{displayTotal}</Text>
          {typeof displayPct === 'number' ? ` (${displayPct}%)` : ''}
        </Text>
        <View style={styles.savedTag}>
          <Ionicons name="checkmark-circle" size={15} color="#15803D" />
          <Text style={styles.savedTagText}>Submitted to server</Text>
        </View>

        <View style={styles.finishActions}>
          <TouchableOpacity style={styles.primaryModalBtn} onPress={onRetakeQuiz}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.primaryModalBtnText}>Retake Quiz</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryModalBtn} onPress={onViewAttempt}>
            <Text style={styles.secondaryModalBtnText}>View Latest Attempt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryModalBtn} onPress={onBackToHub}>
            <Text style={styles.secondaryModalBtnText}>Back to AI Learning Modules</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const safeIndex = Math.min(Math.max(quizIndex, 0), quizQuestions.length - 1);
  const currentQ = quizQuestions[safeIndex];
  const pickedOption = selectedAnswers[currentQ.id];
  const isAnswered = typeof pickedOption === 'number';
  const hasCorrectIndex = typeof currentQ.correct_index === 'number';
  const pctWidth = (answeredCount / quizQuestions.length) * 100;
  const allAnswered = answeredCount === quizQuestions.length;

  return (
    <View style={styles.viewContainer}>
      {/* Quiz HUD */}
      <View style={styles.quizHud}>
        <View style={styles.quizHudLeft}>
          <Text style={styles.hudStepBadge}>
            Question {safeIndex + 1} of {quizQuestions.length}
          </Text>
          {typeof totalPoolCount === 'number' && totalPoolCount > quizQuestions.length ? (
            <View style={styles.poolInfoBadge}>
              <Text style={styles.poolInfoText}>
                {quizQuestions.length} loaded ({totalPoolCount} in pool)
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.hudScore}>
          Answered:{' '}
          <Text style={{ color: '#4F46E5', fontWeight: '800' }}>
            {answeredCount}/{quizQuestions.length}
          </Text>
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pctWidth}%` }]} />
      </View>

      {/* Question Navigation Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.questionPillsRow}
      >
        {quizQuestions.map((q, idx) => {
          const isCurrent = idx === safeIndex;
          const qPicked = selectedAnswers[q.id];
          const qAnswered = typeof qPicked === 'number';
          const qCorrect =
            qAnswered &&
            typeof q.correct_index === 'number' &&
            qPicked === q.correct_index;
          const qWrong =
            qAnswered &&
            typeof q.correct_index === 'number' &&
            qPicked !== q.correct_index;

          return (
            <TouchableOpacity
              key={q.id}
              style={[
                styles.questionStepPill,
                qCorrect && styles.questionStepPillCorrect,
                qWrong && styles.questionStepPillWrong,
                qAnswered && !qCorrect && !qWrong && styles.questionStepPillAnswered,
                isCurrent && styles.questionStepPillCurrent,
              ]}
              onPress={() => onSelectQuestionIndex(idx)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.questionStepPillText,
                  isCurrent && styles.questionStepPillTextCurrent,
                ]}
              >
                {idx + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Question Card */}
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQ.question}</Text>
      </View>

      {/* Answer Options (original order, no correct_index exposed before answering) */}
      <View style={styles.optionsList}>
        {currentQ.options.map((opt, optIdx) => {
          const isPicked = pickedOption === optIdx;
          const isCorrectOption = hasCorrectIndex && optIdx === currentQ.correct_index;
          const showCorrect = isAnswered && isCorrectOption;
          const showWrong = isAnswered && hasCorrectIndex && isPicked && !isCorrectOption;
          const showNeutralSelected = isAnswered && !hasCorrectIndex && isPicked;

          return (
            <TouchableOpacity
              key={`${currentQ.id}_opt_${optIdx}`}
              style={[
                styles.optionBtn,
                showNeutralSelected && styles.optionBtnSelected,
                showCorrect && styles.optionBtnCorrect,
                showWrong && styles.optionBtnWrong,
              ]}
              onPress={() => onPickOption(currentQ.id, optIdx)}
              disabled={isAnswered || quizSubmitting}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.optionLetterBox,
                  showNeutralSelected && { backgroundColor: '#4F46E5' },
                  showCorrect && { backgroundColor: '#16A34A' },
                  showWrong && { backgroundColor: '#DC2626' },
                ]}
              >
                <Text
                  style={[
                    styles.optionLetterText,
                    (showCorrect || showWrong || showNeutralSelected) && { color: '#FFFFFF' },
                  ]}
                >
                  {String.fromCharCode(65 + optIdx)}
                </Text>
              </View>
              <Text style={styles.optionText}>{opt}</Text>
              {showCorrect ? (
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              ) : showWrong ? (
                <Ionicons name="close-circle" size={18} color="#DC2626" />
              ) : showNeutralSelected ? (
                <Ionicons name="checkmark-circle-outline" size={18} color="#4F46E5" />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Feedback & Explanation shown ONLY after answering */}
      {isAnswered ? (
        <View style={styles.explanationBox}>
          <View style={styles.explanationHeader}>
            <Ionicons
              name={
                hasCorrectIndex
                  ? pickedOption === currentQ.correct_index
                    ? 'checkmark-circle'
                    : 'close-circle'
                  : 'information-circle'
              }
              size={16}
              color={
                hasCorrectIndex
                  ? pickedOption === currentQ.correct_index
                    ? '#16A34A'
                    : '#DC2626'
                  : '#4F46E5'
              }
            />
            <Text style={styles.explanationTitle}>
              {hasCorrectIndex
                ? pickedOption === currentQ.correct_index
                  ? 'Correct Answer'
                  : 'Incorrect Answer'
                : 'Answer Recorded'}
            </Text>
          </View>
          {currentQ.explanation ? (
            <Text style={styles.explanationText}>{currentQ.explanation}</Text>
          ) : null}
        </View>
      ) : null}

      {quizSubmitError ? (
        <View style={styles.quizErrorBanner}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.quizErrorBannerText}>{quizSubmitError}</Text>
        </View>
      ) : null}

      {/* Question Prev/Next Navigation + Submit Action */}
      <View style={styles.quizNavRow}>
        <TouchableOpacity
          style={[styles.quizPrevBtn, safeIndex === 0 && styles.quizNavDisabled]}
          onPress={() => onSelectQuestionIndex(Math.max(0, safeIndex - 1))}
          disabled={safeIndex === 0}
        >
          <Ionicons name="arrow-back" size={15} color={isDarkMode ? '#E2E8F0' : '#334155'} />
          <Text style={styles.quizPrevBtnText}>Previous</Text>
        </TouchableOpacity>

        {safeIndex < quizQuestions.length - 1 ? (
          <TouchableOpacity
            style={styles.quizNextBtn}
            onPress={() => onSelectQuestionIndex(Math.min(quizQuestions.length - 1, safeIndex + 1))}
          >
            <Text style={styles.quizNextBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.quizSubmitBtn,
              (!allAnswered || quizSubmitting) && styles.quizSubmitBtnDisabled,
            ]}
            onPress={onSubmitQuiz}
            disabled={!allAnswered || quizSubmitting}
          >
            {quizSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                <Text style={styles.quizNextBtnText}>
                  {allAnswered ? 'Submit Quiz' : `Answer All (${answeredCount}/${quizQuestions.length})`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {safeIndex < quizQuestions.length - 1 && allAnswered ? (
        <TouchableOpacity
          style={[styles.quizSubmitFullBtn, quizSubmitting && styles.quizSubmitBtnDisabled]}
          onPress={onSubmitQuiz}
          disabled={quizSubmitting}
        >
          {quizSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.quizNextBtnText}>Submit Completed Quiz ({answeredCount}/{quizQuestions.length})</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function AiConceptsView({
  backstoryList,
  filteredBackstory,
  flashcardDeck,
  conceptsTab,
  onSelectTab,
  flashcardIndex,
  flashcardFlipped,
  onSelectFlashcardIndex,
  onToggleFlip,
  searchQuery,
  onChangeSearch,
  searchInputRef,
  expandedTopics,
  onToggleTopic,
  onSetAllExpanded,
  isDarkMode,
  styles,
}: {
  backstoryList: LessonAiBackstoryItem[];
  filteredBackstory: LessonAiBackstoryItem[];
  flashcardDeck: LessonAiFlashcardItem[];
  conceptsTab: 'flashcards' | 'list';
  onSelectTab: (tab: 'flashcards' | 'list') => void;
  flashcardIndex: number;
  flashcardFlipped: boolean;
  onSelectFlashcardIndex: (idx: number) => void;
  onToggleFlip: () => void;
  searchQuery: string;
  onChangeSearch: (q: string) => void;
  searchInputRef: React.RefObject<ComponentRef<typeof TextInput> | null>;
  expandedTopics: Record<number, boolean>;
  onToggleTopic: (idx: number) => void;
  onSetAllExpanded: (expandAll: boolean) => void;
  isDarkMode: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  if (flashcardDeck.length === 0 && backstoryList.length === 0) {
    return (
      <EmptyModuleState
        icon="bulb-outline"
        color="#059669"
        title="No Flashcards or Concepts Available"
        subtitle="No flashcards or key concepts were returned for this lesson."
        isDarkMode={isDarkMode}
      />
    );
  }

  const showFlashcardsTab = flashcardDeck.length > 0 && conceptsTab === 'flashcards';
  const safeCardIdx =
    flashcardDeck.length > 0 ? Math.min(flashcardIndex, flashcardDeck.length - 1) : 0;
  const activeCard = flashcardDeck[safeCardIdx];
  const cardProgressPct =
    flashcardDeck.length > 0 ? ((safeCardIdx + 1) / flashcardDeck.length) * 100 : 0;

  const allExpanded =
    filteredBackstory.length > 0 && filteredBackstory.every((_, idx) => Boolean(expandedTopics[idx]));

  return (
    <View style={styles.viewContainer}>
      {flashcardDeck.length > 0 && backstoryList.length > 0 ? (
        <View style={styles.conceptsModeSwitch}>
          <TouchableOpacity
            style={[
              styles.conceptsModeBtn,
              showFlashcardsTab && styles.conceptsModeBtnActive,
            ]}
            onPress={() => onSelectTab('flashcards')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="albums-outline"
              size={15}
              color={showFlashcardsTab ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569'}
            />
            <Text
              style={[
                styles.conceptsModeBtnText,
                showFlashcardsTab && styles.conceptsModeBtnTextActive,
              ]}
            >
              Flashcards ({flashcardDeck.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.conceptsModeBtn,
              !showFlashcardsTab && styles.conceptsModeBtnActive,
            ]}
            onPress={() => onSelectTab('list')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="list-outline"
              size={15}
              color={!showFlashcardsTab ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569'}
            />
            <Text
              style={[
                styles.conceptsModeBtnText,
                !showFlashcardsTab && styles.conceptsModeBtnTextActive,
              ]}
            >
              All Concepts ({backstoryList.length})
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showFlashcardsTab && activeCard ? (
        <View style={styles.flashcardWrap}>
          {/* HUD & Progress */}
          <View style={styles.quizHud}>
            <View style={styles.quizHudLeft}>
              <Text style={styles.hudStepBadge}>
                Card {safeCardIdx + 1} of {flashcardDeck.length}
              </Text>
              <View
                style={[
                  styles.flashcardSidePill,
                  flashcardFlipped && styles.flashcardSidePillAnswer,
                ]}
              >
                <Text
                  style={[
                    styles.flashcardSidePillText,
                    flashcardFlipped && styles.flashcardSidePillTextAnswer,
                  ]}
                >
                  {flashcardFlipped ? 'Answer Side' : 'Question Side'}
                </Text>
              </View>
            </View>
            <Text style={styles.hudScore}>
              {Math.round(cardProgressPct)}%
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${cardProgressPct}%`, backgroundColor: '#10B981' },
              ]}
            />
          </View>

          {/* Quick-jump flashcard index pills */}
          {flashcardDeck.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.questionPillsRow}
            >
              {flashcardDeck.map((fc, idx) => {
                const isCurrent = idx === safeCardIdx;
                return (
                  <TouchableOpacity
                    key={fc.id || `fc_pill_${idx}`}
                    style={[
                      styles.questionStepPill,
                      isCurrent && styles.flashcardStepPillCurrent,
                    ]}
                    onPress={() => onSelectFlashcardIndex(idx)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.questionStepPillText,
                        isCurrent && styles.questionStepPillTextCurrent,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Interactive Question / Answer Flashcard Surface */}
          <TouchableOpacity
            style={[
              styles.flashcardCard,
              flashcardFlipped && styles.flashcardCardAnswer,
            ]}
            onPress={onToggleFlip}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={
              flashcardFlipped ? 'Showing flashcard answer, tap to show question' : 'Showing flashcard question, tap to reveal answer'
            }
          >
            <View style={styles.flashcardCardHeader}>
              <Text
                style={[
                  styles.flashcardCardEyebrow,
                  flashcardFlipped && { color: isDarkMode ? '#6EE7B7' : '#059669' },
                ]}
              >
                {flashcardFlipped ? 'ANSWER & EXPLANATION' : 'QUESTION / CONCEPT PROMPT'}
              </Text>
              <Ionicons
                name={flashcardFlipped ? 'sync-circle' : 'help-circle-outline'}
                size={18}
                color={flashcardFlipped ? '#059669' : '#4F46E5'}
              />
            </View>

            <Text style={styles.flashcardMainText}>
              {flashcardFlipped
                ? activeCard.answer || 'No answer text provided.'
                : activeCard.question || 'No question prompt provided.'}
            </Text>

            <View style={styles.flashcardHintRow}>
              <Ionicons name="repeat-outline" size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              <Text style={styles.flashcardHintText}>
                {flashcardFlipped ? 'Tap card to flip back to Question' : 'Tap card to reveal Answer'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Previous / Flip / Next Flashcard Controls */}
          <View style={styles.flashcardNavRow}>
            <TouchableOpacity
              style={[styles.quizPrevBtn, safeCardIdx === 0 && styles.quizNavDisabled]}
              onPress={() => onSelectFlashcardIndex(Math.max(0, safeCardIdx - 1))}
              disabled={safeCardIdx === 0}
            >
              <Ionicons name="arrow-back" size={15} color={isDarkMode ? '#E2E8F0' : '#334155'} />
              <Text style={styles.quizPrevBtnText}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flashcardFlipBtn}
              onPress={onToggleFlip}
              activeOpacity={0.85}
            >
              <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
              <Text style={styles.quizNextBtnText}>
                {flashcardFlipped ? 'Show Question' : 'Show Answer'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quizNextBtn,
                safeCardIdx >= flashcardDeck.length - 1 && styles.quizNavDisabled,
              ]}
              onPress={() =>
                onSelectFlashcardIndex(Math.min(flashcardDeck.length - 1, safeCardIdx + 1))
              }
              disabled={safeCardIdx >= flashcardDeck.length - 1}
            >
              <Text style={styles.quizNextBtnText}>Next</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#94A3B8" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search key concepts..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={onChangeSearch}
              autoCapitalize="none"
              multiline={false}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => onChangeSearch('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {filteredBackstory.length > 1 ? (
            <View style={styles.conceptsToolbar}>
              <Text style={styles.conceptsCountText}>
                {filteredBackstory.length} {filteredBackstory.length === 1 ? 'Concept' : 'Concepts'}
              </Text>
              <TouchableOpacity onPress={() => onSetAllExpanded(!allExpanded)}>
                <Text style={styles.conceptsToggleAllText}>
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {filteredBackstory.length === 0 ? (
            <View style={{ padding: 28, alignItems: 'center' }}>
              <Text style={styles.emptySub}>
                No matching key concepts found for &quot;{searchQuery}&quot;.
              </Text>
            </View>
          ) : (
            filteredBackstory.map((item, idx) => {
              const expanded = Boolean(expandedTopics[idx]);

              return (
                <TouchableOpacity
                  key={`concept_${idx}_${item.topic}`}
                  style={[styles.conceptCard, expanded && styles.conceptCardExpanded]}
                  onPress={() => onToggleTopic(idx)}
                  activeOpacity={0.82}
                >
                  <View style={styles.conceptBadgeRow}>
                    <View style={styles.conceptDot} />
                    <Text style={styles.conceptTitle}>{item.topic}</Text>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={17}
                      color="#64748B"
                    />
                  </View>

                  {expanded ? (
                    <View style={styles.conceptExpandedBody}>
                      <Text style={styles.conceptDesc}>{item.explanation}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </>
      )}
    </View>
  );
}

function AiTakeawaysView({
  takeawaysList,
  checkedTakeaways,
  revisedCount,
  copied,
  onToggleTakeaway,
  onCopyOrShare,
  isDarkMode,
  styles,
}: {
  takeawaysList: string[];
  checkedTakeaways: Record<number, boolean>;
  revisedCount: number;
  copied: boolean;
  onToggleTakeaway: (idx: number) => void;
  onCopyOrShare: () => void;
  isDarkMode: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  if (takeawaysList.length === 0) {
    return (
      <EmptyModuleState
        icon="list-outline"
        color="#D97706"
        title="No Key Takeaways Available"
        subtitle="Key takeaways have not been returned for this lesson."
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <View style={styles.viewContainer}>
      <View style={styles.amberToolbar}>
        <Text style={styles.amberProgressText}>
          Reviewed: {revisedCount} / {takeawaysList.length}
        </Text>
        <TouchableOpacity style={styles.amberCopyBtn} onPress={onCopyOrShare}>
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={14}
            color="#B45309"
          />
          <Text style={styles.amberCopyText}>
            {copied ? 'Copied' : Platform.OS === 'web' ? 'Copy All' : 'Share All'}
          </Text>
        </TouchableOpacity>
      </View>

      {takeawaysList.map((item, idx) => {
        const checked = Boolean(checkedTakeaways[idx]);
        return (
          <TouchableOpacity
            key={`tk_${idx}`}
            style={[styles.takeawayRow, checked && styles.takeawayRowChecked]}
            onPress={() => onToggleTakeaway(idx)}
            activeOpacity={0.8}
          >
            <View style={[styles.takeawayIndexBadge, checked && styles.takeawayIndexBadgeChecked]}>
              <Text style={[styles.takeawayIndexText, checked && { color: '#FFFFFF' }]}>
                {idx + 1}
              </Text>
            </View>
            <Text style={[styles.takeawayText, checked && styles.takeawayTextChecked]}>
              {item}
            </Text>
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={20}
              color={checked ? '#D97706' : '#94A3B8'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AiPreviousAttemptView({
  latestAttempt,
  hasQuiz,
  onStartQuiz,
  isDarkMode,
  styles,
}: {
  latestAttempt: LessonAiLatestAttempt | null;
  hasQuiz: boolean;
  onStartQuiz: () => void;
  isDarkMode: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!latestAttempt) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyModuleState
          icon="trophy-outline"
          color="#64748B"
          title="No Latest Quiz Attempt"
          subtitle="You have not completed a practice quiz attempt for this lesson yet."
          isDarkMode={isDarkMode}
        />
        {hasQuiz ? (
          <TouchableOpacity style={styles.primaryModalBtn} onPress={onStartQuiz}>
            <Ionicons name="flash" size={16} color="#FFFFFF" />
            <Text style={styles.primaryModalBtnText}>Take Practice Quiz</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const formattedDate = formatAttemptDate(latestAttempt.completedAt);

  return (
    <View style={styles.viewContainer}>
      <View style={styles.attemptDetailCard}>
        <View style={styles.attemptDetailTop}>
          <View style={styles.finishTrophyCircle}>
            <Ionicons name="trophy" size={34} color="#16A34A" />
          </View>
          <Text style={styles.attemptDetailScore}>
            {latestAttempt.score} / {latestAttempt.totalQuestions}
          </Text>
          {typeof latestAttempt.percentage === 'number' ? (
            <View style={styles.savedTag}>
              <Text style={styles.savedTagText}>{Math.round(latestAttempt.percentage)}% Score</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.attemptMetaList}>
          {formattedDate ? (
            <View style={styles.attemptMetaRow}>
              <Text style={styles.attemptMetaLabel}>Completed</Text>
              <Text style={styles.attemptMetaValue}>{formattedDate}</Text>
            </View>
          ) : null}
          {typeof latestAttempt.attemptNumber === 'number' ? (
            <View style={styles.attemptMetaRow}>
              <Text style={styles.attemptMetaLabel}>Attempt</Text>
              <Text style={styles.attemptMetaValue}>#{latestAttempt.attemptNumber}</Text>
            </View>
          ) : null}
          {typeof latestAttempt.passed === 'boolean' ? (
            <View style={styles.attemptMetaRow}>
              <Text style={styles.attemptMetaLabel}>Status</Text>
              <Text
                style={[
                  styles.attemptMetaValue,
                  { color: latestAttempt.passed ? '#16A34A' : '#DC2626' },
                ]}
              >
                {latestAttempt.passed ? 'Passed' : 'Needs Review'}
              </Text>
            </View>
          ) : null}
        </View>

        {hasQuiz ? (
          <TouchableOpacity style={styles.primaryModalBtn} onPress={onStartQuiz}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.primaryModalBtnText}>Practice Again</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function EmptyModuleState({
  icon,
  color,
  title,
  subtitle,
  isDarkMode,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  isDarkMode: boolean;
}) {
  return (
    <View style={{ paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center' }}>
      <Ionicons name={icon} size={36} color={color} style={{ marginBottom: 10 }} />
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: isDarkMode ? '#F8FAFC' : '#0F172A',
          marginBottom: 4,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: isDarkMode ? '#94A3B8' : '#64748B',
          textAlign: 'center',
          lineHeight: 19,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function createStyles(isDark: boolean, isCompactWidth: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: isCompactWidth ? 10 : 16,
    },
    dialogCard: {
      width: '100%',
      maxWidth: 660,
      maxHeight: '90%',
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? '#1E293B' : '#CBD5E1',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.28,
      shadowRadius: 24,
      elevation: 16,
    },
    header: {
      backgroundColor: '#231A54',
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
    },
    sparkleBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#7C3AED',
      borderWidth: 1,
      borderColor: 'rgba(196, 181, 253, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    headerBackBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    headerBackText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    headerTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      flexShrink: 1,
    },
    statusPill: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderWidth: 1,
      borderColor: 'rgba(52, 211, 153, 0.45)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    statusPillText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: '#6EE7B7',
      letterSpacing: 0.5,
    },
    headerSubtitle: {
      fontSize: 11.5,
      color: '#CBD5E1',
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bodyScroll: {
      width: '100%',
    },
    bodyContent: {
      padding: isCompactWidth ? 14 : 18,
    },
    loadingStageWrap: {
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 6,
      gap: 12,
    },
    loadingOrbWrap: {
      width: 96,
      height: 96,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    loadingGlowHalo: {
      position: 'absolute',
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: isDark ? 'rgba(124, 58, 237, 0.35)' : 'rgba(124, 58, 237, 0.2)',
    },
    loadingOuterDashedRing: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDark ? 'rgba(167, 139, 250, 0.45)' : '#DDD6FE',
    },
    loadingDashedRing: {
      position: 'absolute',
      width: 78,
      height: 78,
      borderRadius: 39,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDark ? '#A78BFA' : '#C4B5FD',
    },
    loadingBrainCore: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: '#7C3AED',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    loadingHeading: {
      fontSize: 17,
      fontWeight: '800',
      color: isDark ? '#F8FAFC' : '#0F172A',
      textAlign: 'center',
    },
    loadingSubheading: {
      fontSize: 12.5,
      color: isDark ? '#94A3B8' : '#64748B',
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 4,
    },
    loadingStepsList: {
      width: '100%',
      gap: 9,
      marginTop: 4,
    },
    loadingStepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: isDark ? '#1E293B' : '#E2E8F0',
      backgroundColor: isDark ? '#161F30' : '#F8FAFC',
    },
    loadingStepRowDone: {
      backgroundColor: isDark ? '#052E16' : '#ECFDF5',
      borderColor: isDark ? '#166534' : '#BBF7D0',
    },
    loadingStepRowActive: {
      backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
      borderColor: isDark ? '#4F46E5' : '#C7D2FE',
    },
    loadingStepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#CBD5E1',
    },
    loadingStepDotDone: {
      backgroundColor: '#16A34A',
    },
    loadingStepDotActive: {
      backgroundColor: '#7C3AED',
    },
    loadingStepText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    loadingStepTextDone: {
      color: isDark ? '#86EFAC' : '#15803D',
      fontWeight: '700',
    },
    loadingStepTextActive: {
      color: isDark ? '#E0E7FF' : '#4338CA',
      fontWeight: '700',
    },
    stage2HeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    stage2TitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    stage2SparklePill: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stage2Heading: {
      flex: 1,
      fontSize: 15.5,
      fontWeight: '800',
      color: isDark ? '#F8FAFC' : '#0F172A',
      letterSpacing: -0.2,
    },
    errorCard: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 14,
      gap: 10,
    },
    errorIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: isDark ? '#450A0A' : '#FEE2E2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#0F172A',
      textAlign: 'center',
    },
    errorMessage: {
      fontSize: 13,
      color: '#475569',
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 4,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingBottom: 12,
      gap: 12,
    },
    retryOutlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: isDark ? '#4338CA' : '#C7D2FE',
      backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    retryOutlineBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#A5B4FC' : '#4F46E5',
    },
    swirlBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 44,
      paddingHorizontal: 16,
      gap: 12,
    },
    swirlLoaderWrap: {
      width: 86,
      height: 86,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    swirlVortexOuter: {
      position: 'absolute',
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDark ? 'rgba(196, 181, 253, 0.4)' : '#DDD6FE',
    },
    swirlVortexInner: {
      position: 'absolute',
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDark ? '#A78BFA' : '#C4B5FD',
    },
    swirlCore: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? '#2E1065' : '#F3E8FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    swirlTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: isDark ? '#F8FAFC' : '#0F172A',
      textAlign: 'center',
    },
    swirlSub: {
      fontSize: 12,
      color: isDark ? '#94A3B8' : '#64748B',
      textAlign: 'center',
    },
    hubContainer: {
      gap: 14,
    },
    attemptBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#052E16' : '#F0FDF4',
      borderWidth: 1,
      borderColor: isDark ? '#166534' : '#BBF7D0',
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    attemptBannerEmpty: {
      backgroundColor: isDark ? '#161F30' : '#F8FAFC',
      borderColor: isDark ? '#1E293B' : '#E2E8F0',
    },
    attemptLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    trophyBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: isDark ? '#14532D' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    trophyBadgeEmpty: {
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    },
    attemptLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#86EFAC' : '#15803D',
    },
    attemptLabelEmpty: {
      color: isDark ? '#94A3B8' : '#64748B',
    },
    attemptScore: {
      fontSize: 13.5,
      fontWeight: '800',
      color: isDark ? '#BBF7D0' : '#166534',
    },
    attemptEmptyText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: isDark ? '#CBD5E1' : '#334155',
    },
    attemptDate: {
      fontSize: 11,
      color: isDark ? '#94A3B8' : '#64748B',
    },
    hubGrid: {
      flexDirection: isCompactWidth ? 'column' : 'row',
      flexWrap: isCompactWidth ? 'nowrap' : 'wrap',
      gap: 12,
    },
    hubCard: {
      width: isCompactWidth ? '100%' : '48%',
      flexGrow: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? '#1E293B' : '#E2E8F0',
      backgroundColor: isDark ? '#161F30' : '#FFFFFF',
      overflow: 'hidden',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.25 : 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    hubCardInner: {
      padding: 15,
      flex: 1,
      justifyContent: 'space-between',
      gap: 10,
    },
    hubCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 6,
    },
    hubIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hubPill: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
    },
    hubPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    hubCardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginBottom: 4,
    },
    hubCardSnippet: {
      fontSize: 12.5,
      color: isDark ? '#94A3B8' : '#64748B',
      lineHeight: 18,
    },
    hubCardActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 5,
      marginTop: 2,
    },
    hubCardCta: {
      fontSize: 12.5,
      fontWeight: '700',
    },
    viewContainer: {
      gap: 14,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      flexWrap: 'wrap',
    },
    toolBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#1E293B' : '#EEF2FF',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#C7D2FE',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
    },
    toolBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: isDark ? '#E2E8F0' : '#4338CA',
    },
    narrativeCard: {
      backgroundColor: isDark ? '#161F30' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#1F2937' : '#E2E8F0',
      borderRadius: 12,
      padding: 16,
    },
    narrativeEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      color: '#0284C7',
      letterSpacing: 0.7,
      marginBottom: 10,
    },
    paragraphsStack: {
      gap: 10,
    },
    narrativeText: {
      fontSize: 14,
      lineHeight: 22,
      color: isDark ? '#E2E8F0' : '#1E293B',
    },
    expandSummaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 12,
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    expandSummaryText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#60A5FA' : '#2563EB',
    },
    quizHud: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    quizHudLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    hudStepBadge: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#CBD5E1' : '#334155',
    },
    poolInfoBadge: {
      backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    poolInfoText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#A5B4FC' : '#4F46E5',
    },
    hudScore: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#CBD5E1' : '#334155',
    },
    progressTrack: {
      height: 6,
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#7C3AED',
      borderRadius: 999,
    },
    questionPillsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 2,
    },
    questionStepPill: {
      minWidth: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#CBD5E1',
      paddingHorizontal: 8,
    },
    questionStepPillAnswered: {
      backgroundColor: isDark ? '#312E81' : '#E0E7FF',
      borderColor: '#6366F1',
    },
    questionStepPillCorrect: {
      backgroundColor: isDark ? '#064E3B' : '#DCFCE7',
      borderColor: '#16A34A',
    },
    questionStepPillWrong: {
      backgroundColor: isDark ? '#450A0A' : '#FEE2E2',
      borderColor: '#DC2626',
    },
    questionStepPillCurrent: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    questionStepPillText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: isDark ? '#E2E8F0' : '#334155',
    },
    questionStepPillTextCurrent: {
      color: '#FFFFFF',
    },
    questionCard: {
      backgroundColor: isDark ? '#161F30' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#1F2937' : '#E2E8F0',
      borderRadius: 12,
      padding: 15,
    },
    questionText: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
      lineHeight: 22,
    },
    optionsList: {
      gap: 9,
    },
    optionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    },
    optionBtnSelected: {
      borderColor: '#4F46E5',
      backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
    },
    optionBtnCorrect: {
      borderColor: '#16A34A',
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
    },
    optionBtnWrong: {
      borderColor: '#DC2626',
      backgroundColor: isDark ? '#450A0A' : '#FEF2F2',
    },
    optionLetterBox: {
      width: 26,
      height: 26,
      borderRadius: 7,
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionLetterText: {
      fontSize: 12,
      fontWeight: '800',
      color: isDark ? '#E2E8F0' : '#475569',
    },
    optionText: {
      flex: 1,
      fontSize: 13.5,
      color: isDark ? '#F1F5F9' : '#1E293B',
      lineHeight: 19,
    },
    explanationBox: {
      backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
      borderWidth: 1,
      borderColor: isDark ? '#4338CA' : '#C7D2FE',
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    explanationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    explanationTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: isDark ? '#A5B4FC' : '#3730A3',
    },
    explanationText: {
      fontSize: 13,
      lineHeight: 19,
      color: isDark ? '#E2E8F0' : '#312E81',
    },
    quizErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? '#450A0A' : '#FEE2E2',
      borderWidth: 1,
      borderColor: isDark ? '#991B1B' : '#FCA5A5',
      borderRadius: 10,
      padding: 10,
    },
    quizErrorBannerText: {
      flex: 1,
      fontSize: 12.5,
      color: isDark ? '#FECACA' : '#991B1B',
      fontWeight: '600',
    },
    quizNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 4,
    },
    quizPrevBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#CBD5E1',
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    },
    quizNavDisabled: {
      opacity: 0.45,
    },
    quizPrevBtnText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: isDark ? '#E2E8F0' : '#334155',
    },
    quizNextBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#4F46E5',
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 14,
    },
    quizSubmitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#059669',
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 14,
    },
    quizSubmitFullBtn: {
      backgroundColor: '#059669',
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quizSubmitBtnDisabled: {
      opacity: 0.5,
    },
    quizNextBtnText: {
      color: '#FFFFFF',
      fontSize: 13.5,
      fontWeight: '700',
    },
    quizFinishCard: {
      alignItems: 'center',
      paddingVertical: 16,
      gap: 10,
    },
    finishTrophyCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: isDark ? '#064E3B' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    finishTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    finishScoreText: {
      fontSize: 15,
      color: isDark ? '#CBD5E1' : '#334155',
    },
    savedTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#052E16' : '#DCFCE7',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    savedTagText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#86EFAC' : '#15803D',
    },
    finishActions: {
      width: '100%',
      gap: 10,
      marginTop: 8,
    },
    primaryModalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#4F46E5',
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 18,
    },
    primaryModalBtnText: {
      color: '#FFFFFF',
      fontSize: 13.5,
      fontWeight: '700',
    },
    secondaryModalBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#CBD5E1',
      paddingVertical: 11,
      paddingHorizontal: 14,
    },
    secondaryModalBtnText: {
      color: isDark ? '#CBD5E1' : '#334155',
      fontSize: 13.5,
      fontWeight: '700',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 13.5,
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    conceptsToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    conceptsCountText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    conceptsToggleAllText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: isDark ? '#34D399' : '#059669',
    },
    conceptCard: {
      backgroundColor: isDark ? '#161F30' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#1F2937' : '#E2E8F0',
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    conceptCardExpanded: {
      borderColor: isDark ? '#059669' : '#A7F3D0',
    },
    conceptBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    conceptDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#059669',
    },
    conceptTitle: {
      flex: 1,
      fontSize: 14.5,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    conceptCatBadge: {
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    conceptCatText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: isDark ? '#6EE7B7' : '#047857',
    },
    conceptExpandedBody: {
      gap: 8,
      paddingTop: 2,
    },
    conceptDesc: {
      fontSize: 13.5,
      lineHeight: 20,
      color: isDark ? '#CBD5E1' : '#334155',
    },
    historicalBox: {
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? '#059669' : '#A7F3D0',
      borderRadius: 8,
      padding: 10,
    },
    historicalEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      color: isDark ? '#6EE7B7' : '#047857',
      marginBottom: 3,
    },
    historicalText: {
      fontSize: 12.5,
      color: isDark ? '#D1FAE5' : '#065F46',
      lineHeight: 18,
    },
    emptySub: {
      fontSize: 13,
      color: isDark ? '#94A3B8' : '#64748B',
    },
    amberToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#272013' : '#FFFBEB',
      borderWidth: 1,
      borderColor: isDark ? '#B45309' : '#FDE68A',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    amberProgressText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: isDark ? '#FBBF24' : '#B45309',
    },
    amberCopyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    amberCopyText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#FBBF24' : '#B45309',
    },
    takeawayRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: isDark ? '#161F30' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#1F2937' : '#E2E8F0',
      borderRadius: 10,
      padding: 12,
    },
    takeawayRowChecked: {
      backgroundColor: isDark ? '#1C1917' : '#FFFBEB',
      borderColor: isDark ? '#78350F' : '#FDE68A',
    },
    takeawayIndexBadge: {
      width: 22,
      height: 22,
      borderRadius: 6,
      backgroundColor: isDark ? '#272013' : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    takeawayIndexBadgeChecked: {
      backgroundColor: '#D97706',
    },
    takeawayIndexText: {
      fontSize: 11.5,
      fontWeight: '800',
      color: isDark ? '#FBBF24' : '#B45309',
    },
    takeawayText: {
      flex: 1,
      fontSize: 13.5,
      lineHeight: 20,
      color: isDark ? '#E2E8F0' : '#1E293B',
    },
    takeawayTextChecked: {
      textDecorationLine: 'line-through',
      color: isDark ? '#64748B' : '#94A3B8',
    },
    attemptDetailCard: {
      backgroundColor: isDark ? '#161F30' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#1F2937' : '#E2E8F0',
      borderRadius: 14,
      padding: 18,
      gap: 16,
    },
    attemptDetailTop: {
      alignItems: 'center',
      gap: 8,
    },
    attemptDetailScore: {
      fontSize: 26,
      fontWeight: '900',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    attemptMetaList: {
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#1E293B' : '#E2E8F0',
      paddingTop: 12,
    },
    attemptMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    attemptMetaLabel: {
      fontSize: 13,
      color: isDark ? '#94A3B8' : '#64748B',
      fontWeight: '600',
    },
    attemptMetaValue: {
      fontSize: 13.5,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    conceptsModeSwitch: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      borderRadius: 12,
      padding: 4,
    },
    conceptsModeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 9,
    },
    conceptsModeBtnActive: {
      backgroundColor: '#059669',
    },
    conceptsModeBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: isDark ? '#CBD5E1' : '#475569',
    },
    conceptsModeBtnTextActive: {
      color: '#FFFFFF',
    },
    flashcardWrap: {
      gap: 12,
    },
    flashcardSidePill: {
      backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    flashcardSidePillAnswer: {
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
    },
    flashcardSidePillText: {
      fontSize: 11,
      fontWeight: '800',
      color: isDark ? '#C4B5FD' : '#4F46E5',
    },
    flashcardSidePillTextAnswer: {
      color: isDark ? '#6EE7B7' : '#059669',
    },
    flashcardStepPillCurrent: {
      borderColor: '#059669',
      backgroundColor: '#059669',
    },
    flashcardCard: {
      backgroundColor: isDark ? '#161F30' : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDark ? '#312E81' : '#C7D2FE',
      borderRadius: 16,
      padding: 18,
      minHeight: 168,
      justifyContent: 'space-between',
      gap: 14,
    },
    flashcardCardAnswer: {
      backgroundColor: isDark ? '#07221B' : '#F0FDF4',
      borderColor: isDark ? '#059669' : '#6EE7B7',
    },
    flashcardCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    flashcardCardEyebrow: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.7,
      color: isDark ? '#A5B4FC' : '#4F46E5',
    },
    flashcardMainText: {
      fontSize: 15.5,
      lineHeight: 23,
      fontWeight: '600',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    flashcardHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#1E293B' : '#E2E8F0',
      paddingTop: 10,
    },
    flashcardHintText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    flashcardNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    flashcardFlipBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#059669',
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
  });
}
