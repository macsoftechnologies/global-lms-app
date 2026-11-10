import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

const EXAM_QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'What is the primary linguistic significance of the Septuagint (LXX) in New Testament exegesis?',
    options: [
      'It provides Greek terminology used by apostolic authors for Hebrew concepts.',
      'It contains the earliest known Latin translations of Old Testament narratives.',
      'It was composed exclusively in Aramaic during the post-exilic restoration.',
      'It replaced the Masoretic text entirely in first-century rabbinic traditions.',
    ],
    correctIndex: 0,
  },
  {
    id: 'q2',
    text: 'In textual criticism, the principle "lectio difficilior potior" indicates:',
    options: [
      'The shortest reading is always inferior.',
      'The more difficult reading is generally preferred as more authentic.',
      'The reading with the most Byzantine witnesses is accepted unconditionally.',
      'Modern translations must avoid poetic forms.',
    ],
    correctIndex: 1,
  },
  {
    id: 'q3',
    text: 'Under the ATA standard formula, what percentage weightage is assigned to the Final Proctored Exam?',
    options: ['30%', '50%', '65%', '75%'],
    correctIndex: 2,
  },
];

export default function StudentExamScreen() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const handleSubmitExam = useCallback(() => {
    let correctCount = 0;
    EXAM_QUESTIONS.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });
    const percentage = Math.round((correctCount / EXAM_QUESTIONS.length) * 100);
    setScore(percentage);
    setIsSubmitted(true);
  }, [selectedAnswers]);

  useEffect(() => {
    if (isSubmitted || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted, timeLeft, handleSubmitExam]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionIndex,
    }));
  };

  const currentQ = EXAM_QUESTIONS[currentQuestionIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.examBadge}>Timed Examination</Text>
          <Text style={styles.examTitle}>Hermeneutics Assessment</Text>
        </View>
        <View style={styles.timerBadge}>
          <Ionicons name="time-outline" size={16} color="#F59E0B" />
          <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
        </View>
      </View>

      {!isSubmitted ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Progress tracker */}
          <View style={styles.trackerRow}>
            {EXAM_QUESTIONS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.trackerDot,
                  i === currentQuestionIndex && styles.trackerDotActive,
                  selectedAnswers[i] !== undefined && styles.trackerDotAnswered,
                ]}
              />
            ))}
          </View>
          <Text style={styles.questionNumber}>
            Question {currentQuestionIndex + 1} of {EXAM_QUESTIONS.length}
          </Text>

          {/* Question Text */}
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{currentQ.text}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedAnswers[currentQuestionIndex] === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => handleSelectOption(idx)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Navigation Controls */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.navBtn, currentQuestionIndex === 0 && styles.navBtnDisabled]}
              onPress={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
            >
              <Ionicons name="arrow-back" size={18} color={currentQuestionIndex === 0 ? '#475569' : '#FFFFFF'} />
              <Text style={[styles.navBtnText, currentQuestionIndex === 0 && { color: '#475569' }]}>Previous</Text>
            </TouchableOpacity>

            {currentQuestionIndex < EXAM_QUESTIONS.length - 1 ? (
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => setCurrentQuestionIndex((prev) => prev + 1)}
              >
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#090D16" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitExam}>
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Submit Assessment</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        /* Results View */
        <View style={styles.resultContainer}>
          <View style={styles.resultCard}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{score}%</Text>
              <Text style={styles.scoreLabel}>Final Score</Text>
            </View>
            <Text style={styles.resultTitle}>
              {score && score >= 60 ? 'Assessment Passed!' : 'Requires Review'}
            </Text>
            <Text style={styles.resultDesc}>
              Your attempt has been safely submitted and recorded to your official transcript.
            </Text>
            <TouchableOpacity
              style={styles.returnBtn}
              onPress={() => router.replace('/(student-tabs)/dashboard')}
            >
              <Text style={styles.returnBtnText}>Return to Academic Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  titleCol: {
    flex: 1,
  },
  examBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    textTransform: 'uppercase',
  },
  examTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  timerText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  trackerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  trackerDot: {
    flex: 1,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
  },
  trackerDotActive: {
    backgroundColor: '#38BDF8',
  },
  trackerDotAnswered: {
    backgroundColor: '#10B981',
  },
  questionNumber: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  questionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  questionText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  optionCardSelected: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioSelected: {
    borderColor: '#38BDF8',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8',
  },
  optionLabel: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  optionLabelSelected: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  navBtnDisabled: {
    backgroundColor: '#1E293B',
  },
  navBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  nextBtnText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 13,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  resultContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  resultCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 4,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  scoreNumber: {
    color: '#38BDF8',
    fontSize: 32,
    fontWeight: '800',
  },
  scoreLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  resultTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  resultDesc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  returnBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  returnBtnText: {
    color: '#090D16',
    fontSize: 14,
    fontWeight: '700',
  },
});
