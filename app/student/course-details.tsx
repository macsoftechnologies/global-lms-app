import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DashboardService } from '../../src/services/dashboardService';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import { ENV } from '../../src/config/env';
import { PublishedCourse, CourseRegionalPrice, CourseModule } from '../../src/types';

/**
 * Resolves full thumbnail URL with backend server domain if relative
 */
function resolveThumbnailUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = ENV.API_URL.replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendBase}${cleanPath}`;
}

/**
 * Formats pricing based on user region or base pricing object
 */
function formatCoursePrice(course: PublishedCourse, userRegionId?: string): string {
  if (Array.isArray(course.regionalPrices) && course.regionalPrices.length > 0) {
    if (userRegionId) {
      const reg = course.regionalPrices.find(
        (r) =>
          r.regionId === userRegionId ||
          (typeof r.regionId === 'object' && (r.regionId as { _id?: string; id?: string })?._id === userRegionId) ||
          (typeof r.regionId === 'object' && (r.regionId as { _id?: string; id?: string })?.id === userRegionId)
      );
      if (reg && reg.price !== undefined && reg.price !== null) {
        if (reg.price === 0) return 'Free';
        const cur = reg.currency || 'USD';
        return `${cur} ${Number(reg.price).toFixed(2)}`;
      }
    }

    // Default to first configured regional price if user region not explicitly matched
    const firstReg = course.regionalPrices[0];
    if (firstReg && firstReg.price !== undefined && firstReg.price !== null) {
      if (firstReg.price === 0) return 'Free';
      const cur = firstReg.currency || 'USD';
      return `${cur} ${Number(firstReg.price).toFixed(2)}`;
    }
  }

  if (course.pricing) {
    if (typeof course.pricing === 'object' && course.pricing !== null) {
      if (course.pricing.isPaid && course.pricing.amount !== undefined && course.pricing.amount > 0) {
        const cur = course.pricing.currency || 'USD';
        return `${cur} ${Number(course.pricing.amount).toFixed(2)}`;
      }
      if (course.pricing.isPaid === false || course.pricing.amount === 0) {
        return 'Free';
      }
    } else if (typeof course.pricing === 'number') {
      if (course.pricing === 0) return 'Free';
      return `$${Number(course.pricing).toFixed(2)}`;
    }
  }

  if (course.price !== undefined && course.price !== null) {
    if (course.price === 0) return 'Free';
    return `$${Number(course.price).toFixed(2)}`;
  }

  return 'Free';
}

export default function CourseDetailsScreen() {
  const params = useLocalSearchParams<{
    courseId?: string;
    id?: string;
    title?: string;
    isEnrolled?: string;
    isLocked?: string;
    enrollmentStatus?: string;
    programId?: string;
  }>();
  const activeCourseId = params.courseId || params.id || '';
  const isNavigatedFromLocked = params.isLocked === 'true' || params.isEnrolled === 'false';

  // Core Course & UI States
  const [course, setCourse] = useState<PublishedCourse | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(activeCourseId));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    activeCourseId ? null : 'No course ID was provided.'
  );
  const [userProfile, setUserProfile] = useState<AuthSession['user'] | null>(null);
  const [regionMap, setRegionMap] = useState<Record<string, string>>({});

  // Entitlement / Purchase States (defaults to false for locked courses)
  const [isEntitled, setIsEntitled] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(true);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState<boolean>(false);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);

  // Load user profile for region determination
  useEffect(() => {
    let active = true;
    AuthStorage.getUser().then((user) => {
      if (active && user) setUserProfile(user);
    });
    return () => {
      active = false;
    };
  }, []);

  // Fetch course details, entitlement, and modules on mount or when activeCourseId changes
  useEffect(() => {
    let isMounted = true;
    if (!activeCourseId) {
      return;
    }

    Promise.all([
      AuthStorage.getUser(),
      DashboardService.getCourseById(activeCourseId),
      DashboardService.getCourseModules(activeCourseId),
      DashboardService.getRegions(),
    ])
      .then(async ([user, courseRes, modulesRes, regionsRes]) => {
        if (!isMounted) return;
        const studentId = user?.id || 'me';
        const accessRes = await DashboardService.verifyCourseAccess(activeCourseId, studentId);

        if (!isMounted) return;

        if (regionsRes.success && Array.isArray(regionsRes.data)) {
          const map: Record<string, string> = {};
          for (const r of regionsRes.data) {
            const rid = String(r.id || r._id || '');
            if (rid && r.name) map[rid] = r.name;
          }
          setRegionMap(map);
        }

        if (courseRes.success && courseRes.data) {
          setCourse(courseRes.data);
          setErrorMessage(null);
        } else {
          setErrorMessage(courseRes.error || 'Unable to retrieve course details from the server.');
        }

        // If explicitly opened as a locked non-enrolled course, ensure it requires verified purchase or active enrollment ID
        const resolvedEntitlement = isNavigatedFromLocked
          ? Boolean(accessRes.isPurchased || (accessRes.canAccess && accessRes.enrollmentId && accessRes.isEnrolled))
          : Boolean(accessRes.canAccess);
        setIsEntitled(resolvedEntitlement);

        if (modulesRes.success && Array.isArray(modulesRes.data)) {
          setModules(modulesRes.data);
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setErrorMessage(
          err instanceof Error ? err.message : 'Network error while fetching course details'
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
          setIsCheckingAccess(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeCourseId, isNavigatedFromLocked]);

  const handleRefresh = async () => {
    if (!activeCourseId) return;
    setIsRefreshing(true);
    try {
      const user = await AuthStorage.getUser();
      const studentId = user?.id || 'me';
      const [courseRes, accessRes, modulesRes, regionsRes] = await Promise.all([
        DashboardService.getCourseById(activeCourseId),
        DashboardService.verifyCourseAccess(activeCourseId, studentId),
        DashboardService.getCourseModules(activeCourseId),
        DashboardService.getRegions(),
      ]);

      if (regionsRes.success && Array.isArray(regionsRes.data)) {
        const map: Record<string, string> = {};
        for (const r of regionsRes.data) {
          const rid = String(r.id || r._id || '');
          if (rid && r.name) map[rid] = r.name;
        }
        setRegionMap(map);
      }

      if (courseRes.success && courseRes.data) {
        setCourse(courseRes.data);
        setErrorMessage(null);
      } else {
        setErrorMessage(courseRes.error || 'Unable to retrieve course details from the server.');
      }

      setIsEntitled(Boolean(accessRes.canAccess));

      if (modulesRes.success && Array.isArray(modulesRes.data)) {
        setModules(modulesRes.data);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Network error while refreshing course details'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetry = () => {
    if (!activeCourseId) return;
    setIsLoading(true);
    setIsCheckingAccess(true);
    setErrorMessage(null);

    Promise.all([
      AuthStorage.getUser(),
      DashboardService.getCourseById(activeCourseId),
      DashboardService.getCourseModules(activeCourseId),
      DashboardService.getRegions(),
    ])
      .then(async ([user, courseRes, modulesRes, regionsRes]) => {
        const studentId = user?.id || 'me';
        const accessRes = await DashboardService.verifyCourseAccess(activeCourseId, studentId);

        if (regionsRes.success && Array.isArray(regionsRes.data)) {
          const map: Record<string, string> = {};
          for (const r of regionsRes.data) {
            const rid = String(r.id || r._id || '');
            if (rid && r.name) map[rid] = r.name;
          }
          setRegionMap(map);
        }

        if (courseRes.success && courseRes.data) {
          setCourse(courseRes.data);
          setErrorMessage(null);
        } else {
          setErrorMessage(courseRes.error || 'Unable to retrieve course details from the server.');
        }

        // If explicitly opened as a locked non-enrolled course, ensure it requires verified purchase or active enrollment ID
        const resolvedEntitlement = isNavigatedFromLocked
          ? Boolean(accessRes.isPurchased || (accessRes.canAccess && accessRes.enrollmentId && accessRes.isEnrolled))
          : Boolean(accessRes.canAccess);
        setIsEntitled(resolvedEntitlement);

        if (modulesRes.success && Array.isArray(modulesRes.data)) {
          setModules(modulesRes.data);
        }
      })
      .catch((err: unknown) => {
        setErrorMessage(
          err instanceof Error ? err.message : 'Network error while fetching course details'
        );
      })
      .finally(() => {
        setIsLoading(false);
        setIsCheckingAccess(false);
      });
  };

  // Continue Learning Navigation
  const handleContinueLearning = () => {
    if (!course) return;
    const cid = course.id || course._id || activeCourseId;
    const ctitle = course.title || params.title || 'Course';
    router.push({
      pathname: '/student/learn',
      params: { id: cid, title: ctitle },
    });
  };

  // Verify Payment Status with Backend
  const handleVerifyPaymentStatus = async () => {
    if (!activeCourseId || isPurchasing) return;
    setIsPurchasing(true);

    try {
      const user = await AuthStorage.getUser();
      const studentId = user?.id || 'me';
      const [accessRes, paymentsRes] = await Promise.all([
        DashboardService.verifyCourseAccess(activeCourseId, studentId),
        DashboardService.getMyPayments(1, 50),
      ]);

      if (accessRes.canAccess || accessRes.isPurchased) {
        setIsEntitled(true);
        setIsConfirmModalVisible(false);
        Alert.alert(
          'Payment Verified! 🎉',
          `Payment verified successfully from backend. You now have full access to "${course?.title || 'this course'}".`,
          [
            {
              text: 'Start Learning Now',
              onPress: () => {
                const cid = course?.id || course?._id || activeCourseId;
                const ctitle = course?.title || params.title || 'Course';
                router.push({
                  pathname: '/student/learn',
                  params: { id: cid, title: ctitle },
                });
              },
            },
          ]
        );
      } else {
        const payments = paymentsRes.data || [];
        const foundPay = payments.find(
          (p) =>
            p.status === 'PAID' &&
            (p.courseId === activeCourseId ||
              p.course?.id === activeCourseId ||
              p.description?.toLowerCase().includes((course?.title || '').toLowerCase()) ||
              (p as any).id === activeCourseId)
        );

        if (foundPay) {
          setIsEntitled(true);
          setIsConfirmModalVisible(false);
          Alert.alert(
            'Payment Verified! 🎉',
            `Receipt ${foundPay.invoiceNumber || foundPay.id} confirmed. Course unlocked!`,
            [
              {
                text: 'Start Learning Now',
                onPress: () => {
                  const cid = course?.id || course?._id || activeCourseId;
                  const ctitle = course?.title || params.title || 'Course';
                  router.push({
                    pathname: '/student/learn',
                    params: { id: cid, title: ctitle },
                  });
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Payment Not Yet Confirmed',
            `We verified your account on the backend, but no confirmed payment was found for "${course?.title}".\n\nTuition Amount: ${priceDisplay}\n\nIf you have already paid, receipts may take a moment to reflect in Payment History.`,
            [
              {
                text: 'View Payment History',
                onPress: () => {
                  setIsConfirmModalVisible(false);
                  router.push('/student/payments');
                },
              },
              { text: 'OK', style: 'cancel' },
            ]
          );
        }
      }
    } catch (err: unknown) {
      Alert.alert(
        'Verification Error',
        err instanceof Error ? err.message : 'Unable to verify payment status with backend server.'
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  // Standalone Free Course Enrollment Handler (Only for zero-cost courses)
  const handleConfirmFreeEnrollment = async () => {
    if (!activeCourseId || isPurchasing) return;
    setIsPurchasing(true);

    try {
      const response = await DashboardService.enrollInCourse(activeCourseId);

      if (response.success) {
        setIsEntitled(true);
        setIsConfirmModalVisible(false);

        // Re-verify course access from backend
        try {
          const user = await AuthStorage.getUser();
          const studentId = user?.id || 'me';
          const freshAccess = await DashboardService.verifyCourseAccess(activeCourseId, studentId);
          setIsEntitled(Boolean(freshAccess.canAccess));
        } catch {
          // Keep true if enroll was successful
        }

        Alert.alert(
          'Enrolled Successfully! 🎉',
          `You now have full academic access to "${course?.title || 'this course'}".`,
          [
            {
              text: 'Start Learning Now',
              onPress: () => {
                const cid = course?.id || course?._id || activeCourseId;
                const ctitle = course?.title || params.title || 'Course';
                router.push({
                  pathname: '/student/learn',
                  params: { id: cid, title: ctitle },
                });
              },
            },
            {
              text: 'View Curriculum',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert(
          'Enrollment Failed',
          response.error || 'The server could not complete course enrollment. Please try again.'
        );
      }
    } catch (err: unknown) {
      Alert.alert(
        'Transaction Error',
        err instanceof Error ? err.message : 'An error occurred during enrollment.'
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  const userRegionId =
    (typeof userProfile?.regionId === 'string' && userProfile.regionId) ||
    undefined;

  const resolvedThumb = resolveThumbnailUrl(course?.thumbnailUrl || course?.thumbnail);
  const priceDisplay = course ? formatCoursePrice(course, userRegionId) : 'Free';
  const isFree = priceDisplay.toLowerCase() === 'free';
  const isPublished = (course?.status || 'PUBLISHED').toUpperCase() === 'PUBLISHED';

  // Total lessons across modules
  const totalLessonsCount = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header / Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle} numberOfLines={1}>
          {course?.title || params.title || 'Course Details'}
        </Text>

        <View style={styles.topBarRightPlaceholder} />
      </View>

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Fetching course details from Global LMS server...</Text>
        </View>
      ) : errorMessage ? (
        /* Error State */
        <View style={styles.centerContainer}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={42} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Failed to Load Course</Text>
          <Text style={styles.errorSubtitle}>{errorMessage}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.browseBackButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.browseBackText}>Back to Courses</Text>
          </TouchableOpacity>
        </View>
      ) : !course ? (
        /* Empty State */
        <View style={styles.centerContainer}>
          <Ionicons name="folder-open-outline" size={48} color="#64748B" />
          <Text style={styles.emptyTitle}>Course Not Found</Text>
          <Text style={styles.emptySubtitle}>The requested course is not available.</Text>
          <TouchableOpacity
            style={styles.browseBackButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.browseBackText}>Back to Courses</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Course Details Content */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#38BDF8"
              colors={['#38BDF8']}
            />
          }
        >
          {/* Hero Thumbnail Banner */}
          <View style={styles.heroThumbnailContainer}>
            {resolvedThumb ? (
              <Image
                source={{ uri: resolvedThumb }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.heroFallback}>
                <Ionicons name="school" size={64} color="#6366F1" />
              </View>
            )}

            {/* Status & Price Badges floating on thumbnail */}
            <View style={styles.floatingBadgesRow}>
              {course.status ? (
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusBadgeText}>{course.status.toUpperCase()}</Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.pricePill,
                  isFree ? styles.pricePillFree : styles.pricePillPaid,
                ]}
              >
                <Text
                  style={[
                    styles.pricePillText,
                    isFree ? styles.pricePillTextFree : styles.pricePillTextPaid,
                  ]}
                >
                  {priceDisplay}
                </Text>
              </View>
            </View>
          </View>

          {/* Title & Slug */}
          <View style={styles.titleSection}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            {course.slug ? (
              <View style={styles.slugContainer}>
                <Ionicons name="link-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.slugText}>{course.slug}</Text>
              </View>
            ) : null}
          </View>

          {/* Key Course Metrics Row (Credits, Validity, Modules, Lessons) */}
          <View style={styles.metricsGrid}>
            {/* Metric 1: Credits */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="ribbon-outline" size={18} color="#10B981" />
              </View>
              <Text style={styles.metricValue}>
                {course.credits ?? course.creditHours ?? 0}
              </Text>
              <Text style={styles.metricLabel}>Credits</Text>
            </View>

            {/* Metric 2: Validity */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Ionicons name="calendar-outline" size={18} color="#38BDF8" />
              </View>
              <Text style={styles.metricValue}>
                {course.validityDays ? `${course.validityDays}d` : 'Lifetime'}
              </Text>
              <Text style={styles.metricLabel}>Validity</Text>
            </View>

            {/* Metric 3: Modules */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="layers-outline" size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.metricValue}>
                {modules.length}
              </Text>
              <Text style={styles.metricLabel}>Modules</Text>
            </View>

            {/* Metric 4: Lessons / Lectures */}
            <View style={styles.metricCard}>
              <View style={[styles.metricIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="play-circle-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.metricValue}>
                {totalLessonsCount > 0 ? totalLessonsCount : course.enrolledCount ?? 0}
              </Text>
              <Text style={styles.metricLabel}>
                {totalLessonsCount > 0 ? 'Lectures' : 'Enrolled'}
              </Text>
            </View>
          </View>

          {/* Description Section */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionHeading}>Course Description</Text>
            <Text style={styles.descriptionText}>
              {course.description ||
                'Comprehensive academic subject curriculum prepared for Global LMS students.'}
            </Text>
          </View>

          {/* Curriculum Preview Section */}
          {modules.length > 0 && (
            <View style={styles.cardSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionHeading}>Course Curriculum ({modules.length} Modules)</Text>
                <View style={styles.syllabusBadge}>
                  <Text style={styles.syllabusBadgeText}>Syllabus Preview</Text>
                </View>
              </View>

              {modules.map((m, idx) => (
                <View key={`mod_prev_${m.id || idx}`} style={styles.curriculumPreviewItem}>
                  <View style={styles.modNumBadge}>
                    <Text style={styles.modNumBadgeText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.curriculumPreviewTitle} numberOfLines={1}>
                      {m.title}
                    </Text>
                    <Text style={styles.curriculumPreviewMeta}>
                      {m.lessons?.length || 0} {m.lessons?.length === 1 ? 'Lecture' : 'Lectures'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Academic Affiliation Details (Program, Semester, Instructors) */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionHeading}>Academic Information</Text>

            {course.programId ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Program ID:</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{course.programId}</Text>
              </View>
            ) : null}

            {course.semesterId ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Semester ID:</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{course.semesterId}</Text>
              </View>
            ) : null}

            {Array.isArray(course.instructorIds) && course.instructorIds.length > 0 ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Instructors ({course.instructorIds.length}):</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {course.instructorIds.join(', ')}
                </Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Course ID:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{course.id || activeCourseId}</Text>
            </View>

            {course.credits !== undefined && course.credits !== null ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Credits:</Text>
                <Text style={styles.infoValue}>{String(course.credits)}</Text>
              </View>
            ) : null}

            {((course as any).examsCount !== undefined || (course as any).totalExams !== undefined) ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Exams:</Text>
                <Text style={styles.infoValue}>
                  {String((course as any).examsCount ?? (course as any).totalExams ?? 0)}
                </Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Access Entitlement:</Text>
              <Text style={[styles.infoValue, { color: isEntitled ? '#10B981' : '#F59E0B' }]}>
                {isEntitled ? 'Enrolled (Full Access)' : 'Not Enrolled'}
              </Text>
            </View>
          </View>

          {/* Regional Pricing Breakdown (if configured) */}
          {Array.isArray(course.regionalPrices) && course.regionalPrices.length > 0 ? (
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>Regional Pricing</Text>
              {course.regionalPrices.map((rp: CourseRegionalPrice, idx: number) => {
                const rawId = typeof rp.regionId === 'string' ? rp.regionId : (rp.regionId as any)?.id || (rp.regionId as any)?._id || '';
                const regName =
                  rp.regionName ||
                  (typeof rp.regionId === 'object' && (rp.regionId as { name?: string })?.name) ||
                  regionMap[rawId] ||
                  (rp.currency === 'INR' ? 'India' : rawId ? `Region (${rp.currency || 'Standard'})` : `Region ${idx + 1}`);
                const cur = rp.currency || 'USD';
                return (
                  <View key={`reg_${idx}`} style={styles.regionalPriceRow}>
                    <Text style={styles.regionalPriceName}>{regName}</Text>
                    <Text style={styles.regionalPriceAmount}>
                      {rp.price === 0 ? 'Free' : `${cur} ${Number(rp.price).toFixed(2)}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* ACTION BUTTON SECTION - Strictly adheres to Required Conditions */}
          <View style={styles.actionContainer}>
            {isCheckingAccess ? (
              <View style={styles.primaryActionButton}>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionButtonText}>Checking Access...</Text>
              </View>
            ) : !isPublished ? (
              /* Condition: Course unavailable or unpublished → Do not allow purchase */
              <View style={[styles.primaryActionButton, styles.disabledButton]}>
                <Ionicons name="ban-outline" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                <Text style={[styles.primaryActionButtonText, { color: '#94A3B8' }]}>
                  Course Currently Unavailable
                </Text>
              </View>
            ) : isEntitled ? (
              /* Condition: Course already enrolled / purchased → Display CONTINUE LEARNING */
              <TouchableOpacity
                style={[styles.primaryActionButton, styles.continueLearningButton]}
                onPress={handleContinueLearning}
                activeOpacity={0.88}
              >
                <Ionicons name="play-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionButtonText}>CONTINUE LEARNING</Text>
              </TouchableOpacity>
            ) : isFree ? (
              /* Condition: Free course → Display ENROLL NOW */
              <TouchableOpacity
                style={[styles.primaryActionButton, styles.enrollNowButton]}
                onPress={() => setIsConfirmModalVisible(true)}
                activeOpacity={0.88}
              >
                <Ionicons name="flash" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionButtonText}>ENROLL NOW</Text>
              </TouchableOpacity>
            ) : (
              /* Condition: Course not enrolled & paid → Display BUY NOW */
              <TouchableOpacity
                style={[styles.primaryActionButton, styles.buyNowButton]}
                onPress={() => setIsConfirmModalVisible(true)}
                activeOpacity={0.88}
              >
                <Ionicons name="cart" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionButtonText}>BUY NOW – {priceDisplay}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* CONFIRM PURCHASE / CHECKOUT MODAL (Matching Web LMS Modal index-B-vMsWQS.js:1812068) */}
      <Modal
        visible={isConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isPurchasing) setIsConfirmModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentBox}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="shield-checkmark" size={20} color="#4F46E5" style={{ marginRight: 8 }} />
                <Text style={styles.modalHeaderTitle}>Confirm Purchase</Text>
              </View>
              {!isPurchasing && (
                <TouchableOpacity
                  onPress={() => setIsConfirmModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Modal Body */}
            <Text style={styles.modalNoticeText}>
              {isFree
                ? `You are about to enroll in the free course `
                : `Tuition settlement details for `}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>{course?.title}</Text>.
            </Text>

            {/* Price Breakdown Card */}
            <View style={styles.orderSummaryCard}>
              <View style={styles.orderSummaryRow}>
                <Text style={styles.orderSummaryLabel}>Course Price:</Text>
                <Text style={styles.orderSummaryValue}>{priceDisplay}</Text>
              </View>

              <View style={[styles.orderSummaryRow, { borderBottomWidth: 0, paddingTop: 10, marginTop: 4 }]}>
                <Text style={[styles.orderSummaryLabel, { fontWeight: '700', color: '#0F172A' }]}>Total:</Text>
                <Text style={[styles.orderSummaryValue, { fontWeight: '800', color: '#4F46E5', fontSize: 16 }]}>
                  {priceDisplay}
                </Text>
              </View>
            </View>

            {/* Payment Notice Box for Paid Courses */}
            {!isFree && (
              <View style={styles.paymentNoticeBox}>
                <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentNoticeTitle}>Payment Verification Required</Text>
                  <Text style={styles.paymentNoticeDesc}>
                    Online payment gateway checkout requires backend order endpoints. Once your payment is recorded in the system, tap &quot;Verify Payment Status&quot; below to unlock full course access.
                  </Text>
                </View>
              </View>
            )}

            {/* Features check list */}
            <View style={styles.orderFeaturesList}>
              <View style={styles.featureItemRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.featureItemText}>Full Lifetime Access to all video lectures</Text>
              </View>
              <View style={styles.featureItemRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.featureItemText}>ATA Theological Seminary Accredited</Text>
              </View>
              <View style={styles.featureItemRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.featureItemText}>Instant Access to Interactive AI Study Modules</Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setIsConfirmModalVisible(false)}
                disabled={isPurchasing}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              {isFree ? (
                <TouchableOpacity
                  style={[styles.confirmPurchaseButton, isPurchasing && styles.confirmPurchaseButtonDisabled]}
                  onPress={handleConfirmFreeEnrollment}
                  disabled={isPurchasing}
                  activeOpacity={0.85}
                >
                  {isPurchasing ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmPurchaseButtonText}>Enrolling...</Text>
                    </View>
                  ) : (
                    <Text style={styles.confirmPurchaseButtonText}>Confirm Free Enrollment</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.confirmPurchaseButton, isPurchasing && styles.confirmPurchaseButtonDisabled]}
                  onPress={handleVerifyPaymentStatus}
                  disabled={isPurchasing}
                  activeOpacity={0.85}
                >
                  {isPurchasing ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmPurchaseButtonText}>Verifying...</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="shield-checkmark" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.confirmPurchaseButtonText}>Verify Payment Status</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {!isFree && (
              <TouchableOpacity
                style={styles.viewPaymentHistoryBtn}
                onPress={() => {
                  setIsConfirmModalVisible(false);
                  router.push('/student/payments');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="receipt-outline" size={15} color="#4F46E5" style={{ marginRight: 6 }} />
                <Text style={styles.viewPaymentHistoryBtnText}>View My Payments & Invoices</Text>
              </TouchableOpacity>
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
    backgroundColor: '#0A0F1D',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0A0F1D',
  },
  backButton: {
    padding: 4,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  topBarRightPlaceholder: {
    width: 30,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 20,
  },
  browseBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  browseBackText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroThumbnailContainer: {
    width: '100%',
    height: 210,
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  floatingBadgesRow: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusBadgeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pricePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  pricePillFree: {
    backgroundColor: '#10B981',
  },
  pricePillPaid: {
    backgroundColor: '#4F46E5',
  },
  pricePillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pricePillTextFree: {
    color: '#FFFFFF',
  },
  pricePillTextPaid: {
    color: '#FFFFFF',
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  courseTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
  },
  slugContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  slugText: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  metricsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  cardSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionHeading: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  descriptionText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 22,
  },
  syllabusBadge: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  syllabusBadgeText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '600',
  },
  curriculumPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modNumBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  curriculumPreviewTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  curriculumPreviewMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  regionalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  regionalPriceName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
  regionalPriceAmount: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueLearningButton: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  buyNowButton: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
  },
  enrollNowButton: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
  },
  disabledButton: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalNoticeText: {
    fontSize: 14,
    color: '#475569',
    marginTop: 14,
    lineHeight: 20,
  },
  orderSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  orderSummaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  orderSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  orderFeaturesList: {
    marginTop: 14,
    gap: 6,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureItemText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  cancelModalButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmPurchaseButton: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPurchaseButtonDisabled: {
    opacity: 0.7,
  },
  confirmPurchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  paymentNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  paymentNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  paymentNoticeDesc: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 17,
  },
  viewPaymentHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  viewPaymentHistoryBtnText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '700',
  },
});
