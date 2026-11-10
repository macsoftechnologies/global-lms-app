import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthStorage } from '../services/authStorage';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  onFinish: () => void;
}

interface SlideData {
  id: number;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  title: string;
  description: string;
  primaryIcon: keyof typeof Ionicons.glyphMap;
  secondaryIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentColor: string;
  subAccent: string;
  featureTags: string[];
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    badge: 'ACADEMIC EXCELLENCE',
    badgeColor: '#4F46E5',
    badgeBg: '#EEF2FF',
    title: 'Welcome to Global LMS',
    description: 'Your learning journey starts here. Access accredited degree programs and seminary education built for your calling.',
    primaryIcon: 'school',
    secondaryIcon: 'book-open-page-variant',
    accentColor: '#4F46E5',
    subAccent: '#818CF8',
    featureTags: ['ATA Accredited', 'Expert Faculty', 'Curated Syllabus'],
  },
  {
    id: 2,
    badge: 'FLEXIBLE & ON-DEMAND',
    badgeColor: '#0284C7',
    badgeBg: '#E0F2FE',
    title: 'Learn Anytime, Anywhere',
    description: 'Access your courses, video lessons, and interactive checkpoints whenever you need them, across any mobile device.',
    primaryIcon: 'play-circle',
    secondaryIcon: 'laptop',
    accentColor: '#0284C7',
    subAccent: '#38BDF8',
    featureTags: ['HD Video Player', 'In-Lesson Quizzes', 'Offline Sync'],
  },
  {
    id: 3,
    badge: 'MEASURABLE SUCCESS',
    badgeColor: '#059669',
    badgeBg: '#DCFCE7',
    title: 'Grow Your Knowledge',
    description: 'Track your progress, attend live interactive classes, complete evaluations, and achieve your academic goals.',
    primaryIcon: 'trending-up',
    secondaryIcon: 'certificate',
    accentColor: '#059669',
    subAccent: '#34D399',
    featureTags: ['GPA Analytics', 'Official Certificates', 'Live Sessions'],
  },
];

export default function OnboardingScreen({ onFinish }: OnboardingScreenProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const handleNext = async () => {
    if (currentSlideIndex < SLIDES.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    } else {
      await handleComplete();
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  const handleComplete = async () => {
    try {
      await AuthStorage.setOnboardingCompleted();
    } catch (e) {
      console.warn('[Onboarding] Error saving status:', e);
    }
    onFinish();
  };

  const currentSlide = SLIDES[currentSlideIndex];
  const isLastSlide = currentSlideIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header with Skip Button */}
      <View style={styles.topHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            {currentSlideIndex + 1} of {SLIDES.length}
          </Text>
        </View>
        {!isLastSlide ? (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipButtonText}>Skip</Text>
            <Ionicons name="chevron-forward" size={14} color="#64748B" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {/* Global LMS Logo Display */}
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Education Illustration Box */}
        <View style={[styles.illustrationCard, { borderColor: `${currentSlide.accentColor}25` }]}>
          <View style={[styles.illustrationCircle, { backgroundColor: `${currentSlide.accentColor}12` }]}>
            <Ionicons name={currentSlide.primaryIcon} size={64} color={currentSlide.accentColor} />
            <View style={[styles.secondaryBadge, { backgroundColor: currentSlide.accentColor }]}>
              <MaterialCommunityIcons name={currentSlide.secondaryIcon} size={22} color="#FFFFFF" />
            </View>
          </View>

          {/* Feature Pill Tags */}
          <View style={styles.featureTagsRow}>
            {currentSlide.featureTags.map((tag, i) => (
              <View key={i} style={[styles.featureTag, { backgroundColor: currentSlide.badgeBg }]}>
                <Text style={[styles.featureTagText, { color: currentSlide.badgeColor }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Slide Copy */}
        <View style={styles.textContainer}>
          <View style={[styles.categoryPill, { backgroundColor: currentSlide.badgeBg }]}>
            <Text style={[styles.categoryPillText, { color: currentSlide.badgeColor }]}>
              {currentSlide.badge}
            </Text>
          </View>

          <Text style={styles.title}>{currentSlide.title}</Text>
          <Text style={styles.description}>{currentSlide.description}</Text>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          {SLIDES.map((slide, index) => {
            const isActive = index === currentSlideIndex;
            return (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  isActive
                    ? [styles.activeDot, { backgroundColor: currentSlide.accentColor }]
                    : styles.inactiveDot,
                ]}
              />
            );
          })}
        </View>

        {/* Action Button Row */}
        <View style={styles.buttonRow}>
          {currentSlideIndex > 0 && (
            <TouchableOpacity
              style={styles.prevButton}
              onPress={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#64748B" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: currentSlide.accentColor },
              isLastSlide && styles.getStartedButton,
            ]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons
              name={isLastSlide ? 'rocket' : 'arrow-forward'}
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'space-between',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 8,
  },
  stepBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  stepBadgeText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  skipButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 90,
    height: 90,
  },
  illustrationCard: {
    width: width - 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 24,
  },
  illustrationCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  secondaryBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  featureTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featureTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featureTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  bottomControls: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    paddingTop: 12,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 26,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#CBD5E1',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prevButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  primaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedButton: {
    shadowOpacity: 0.35,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

