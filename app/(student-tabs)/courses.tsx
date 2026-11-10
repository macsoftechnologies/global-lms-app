import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ListRenderItemInfo,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { DashboardService } from '../../src/services/dashboardService';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import { ENV } from '../../src/config/env';
import { PublishedCourse, CoursePaginationMeta } from '../../src/types';

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
 * Formats pricing based on user region, pricing object or direct price
 */
function formatCoursePrice(course: PublishedCourse, userRegionId?: string): string {
  if (userRegionId && Array.isArray(course.regionalPrices) && course.regionalPrices.length > 0) {
    const reg = course.regionalPrices.find(
      (r) =>
        r.regionId === userRegionId ||
        (r as unknown as { regionId?: { _id?: string } }).regionId?._id === userRegionId
    );
    if (reg && reg.price !== undefined && reg.price !== null) {
      if (reg.price === 0) return 'Free';
      const cur = reg.currency || 'USD';
      return `${cur} ${Number(reg.price).toFixed(2)}`;
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

/**
 * Resolves total video or lesson count
 */
function getVideoCount(course: PublishedCourse): number {
  if (typeof course.videoCount === 'number') return course.videoCount;
  if (typeof course.totalVideos === 'number') return course.totalVideos;
  if (typeof course.lessonCount === 'number') return course.lessonCount;
  if (typeof course.totalLessons === 'number') return course.totalLessons;
  if (Array.isArray(course.modules)) {
    return course.modules.reduce(
      (sum, m) => sum + (Array.isArray(m.lessons) ? m.lessons.length : 0),
      0
    );
  }
  return 0;
}

const PAGE_LIMIT = 20;

export default function StudentCoursesScreen() {
  const [courses, setCourses] = useState<PublishedCourse[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<CoursePaginationMeta>({
    currentPage: 1,
    itemsPerPage: PAGE_LIMIT,
    totalPages: 1,
    totalItems: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Enrollment tracking: tracks course IDs the student is entitled to
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());

  // Screen States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<AuthSession['user'] | null>(null);

  // Purchase Modal States
  const [purchasingCourse, setPurchasingCourse] = useState<PublishedCourse | null>(null);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  // Load user profile for regional pricing
  useEffect(() => {
    AuthStorage.getUser().then((user) => {
      if (user) setUserProfile(user);
    });
  }, []);

  // Fetch Published Courses and Student Enrollments in parallel
  const loadCoursesData = useCallback(async () => {
    try {
      setErrorMessage(null);

      const [coursesRes, enrollmentsRes, programsRes] = await Promise.all([
        DashboardService.getPublishedCourses(currentPage, PAGE_LIMIT, activeSearch),
        DashboardService.getStudentEnrollments('me'),
        DashboardService.getStudentPrograms('me'),
      ]);

      if (coursesRes.success && coursesRes.data) {
        setCourses(coursesRes.data.courses);
        setPaginationMeta(coursesRes.data.meta);
      } else {
        setErrorMessage(coursesRes.error || 'Failed to load published courses.');
        setCourses([]);
      }

      // Build Set of enrolled/purchased course IDs strictly from backend data
      const enrolledSet = new Set<string>();

      // 1. Direct course enrollments
      const directEnrollments = enrollmentsRes.data || [];
      directEnrollments.forEach((e) => {
        const rawStatus = String(e.status || '').toUpperCase().trim();
        const isAccessible = ['ENROLLED', 'ACTIVE', 'COMPLETED', 'IN_PROGRESS', 'APPROVED', 'PAID'].includes(rawStatus);
        if (isAccessible) {
          if (e.courseId) enrolledSet.add(e.courseId);
          if (e.course?.id) enrolledSet.add(e.course.id);
          if ((e.course as any)?._id) enrolledSet.add((e.course as any)._id);
          if ((e as any)._id) enrolledSet.add((e as any)._id);
        }
      });

      // 2. Program enrolled courses
      const myPrograms = programsRes.data || [];
      for (const prog of myPrograms) {
        const progStatus = String(prog.status || '').toUpperCase().trim();
        const isProgActive = ['ENROLLED', 'ACTIVE', 'APPROVED', 'PAID'].includes(progStatus);
        const progId = prog.programId || prog.id || (prog as any)._id;
        if (progId && isProgActive) {
          try {
            const progCoursesRes = await DashboardService.getCoursesForProgram(progId);
            const progCourses = progCoursesRes.data || [];
            progCourses.forEach((c: any) => {
              const cid = c.courseId || c.course?.id || c.course?._id || c.id || c._id;
              if (cid) enrolledSet.add(cid);
            });
          } catch {
            // Ignore program courses error
          }
        }
      }

      setEnrolledCourseIds(enrolledSet);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error while loading courses');
      setCourses([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, activeSearch]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (!isMounted) return;
      setIsLoading(true);
      return loadCoursesData();
    });
    return () => {
      isMounted = false;
    };
  }, [loadCoursesData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCoursesData();
  };

  const handlePageChange = (newPage: number) => {
    setIsLoading(true);
    setErrorMessage(null);
    setCurrentPage(newPage);
  };

  const handleSearchSubmit = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setCurrentPage(1);
    setActiveSearch(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSearchQuery('');
    setActiveSearch('');
    setCurrentPage(1);
  };

  // Navigates to Course Details screen using dynamic course ID
  const handleSelectCourseDetails = useCallback(
    (courseId: string) => {
      if (!courseId) return;
      const isEnrolled = enrolledCourseIds.has(courseId);
      router.push({
        pathname: '/student/course-details' as any,
        params: {
          courseId,
          id: courseId,
          isEnrolled: isEnrolled ? 'true' : 'false',
          isLocked: isEnrolled ? 'false' : 'true',
        },
      });
    },
    [enrolledCourseIds]
  );

  // Navigates to Course Learning player directly for enrolled courses
  const handleContinueLearning = (courseId: string, courseTitle: string) => {
    if (!courseId) return;
    router.push({
      pathname: '/student/learn',
      params: { id: courseId, courseId, title: courseTitle },
    });
  };

  // Opens Purchase / Checkout Flow for Non-Enrolled Courses
  const handleOpenPurchaseModal = (course: PublishedCourse) => {
    setPurchasingCourse(course);
    setIsConfirmModalVisible(true);
  };

  // Confirms Course Purchase / Enrollment via Live Backend API
  const handleConfirmPurchase = async () => {
    if (!purchasingCourse || isSubmittingPurchase) return;
    const targetCourseId = purchasingCourse.id || purchasingCourse._id || '';
    if (!targetCourseId) return;

    setIsSubmittingPurchase(true);
    try {
      const response = await DashboardService.enrollInCourse(targetCourseId);

      if (response.success) {
        // Immediately mark course as enrolled in state
        setEnrolledCourseIds((prev) => new Set([...prev, targetCourseId]));
        setIsConfirmModalVisible(false);

        Alert.alert(
          'Enrolled Successfully! 🎉',
          `You now have full academic access to "${purchasingCourse.title}".`,
          [
            {
              text: 'Start Learning Now',
              onPress: () => {
                router.push({
                  pathname: '/student/learn',
                  params: {
                    id: targetCourseId,
                    courseId: targetCourseId,
                    title: purchasingCourse.title,
                  },
                });
              },
            },
            {
              text: 'OK',
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
      setIsSubmittingPurchase(false);
    }
  };

  const totalPages = paginationMeta.totalPages || Math.max(1, Math.ceil((paginationMeta.totalItems || 0) / PAGE_LIMIT));
  const totalItems = paginationMeta.totalItems || courses.length;

  const userRegId =
    (typeof userProfile?.regionId === 'string' && userProfile.regionId) ||
    (typeof (userProfile as { region?: { id?: string } })?.region?.id === 'string' &&
      (userProfile as { region?: { id?: string } }).region?.id) ||
    undefined;

  // Render Item for FlatList
  const renderCourseItem = useCallback(
    ({ item: course }: ListRenderItemInfo<PublishedCourse>) => {
      const courseId = course.id || course._id || '';
      const thumbUrl = resolveThumbnailUrl(course.thumbnailUrl || course.thumbnail);
      const priceDisplay = formatCoursePrice(course, userRegId);
      const isFree = priceDisplay.toLowerCase() === 'free';
      const videoCount = getVideoCount(course);
      const credits = course.credits || course.creditHours || 0;
      const statusText = (course.status || 'PUBLISHED').toUpperCase();
      const isPublished = statusText === 'PUBLISHED';

      // Check if student is already enrolled in this course
      const isEnrolled = enrolledCourseIds.has(courseId);

      return (
        <View style={styles.courseCard}>
          {/* Card Header Tap Area -> Course Details */}
          <TouchableOpacity
            onPress={() => handleSelectCourseDetails(courseId)}
            activeOpacity={0.88}
          >
            {/* Thumbnail Banner */}
            <View style={styles.thumbnailContainer}>
              {thumbUrl ? (
                <Image
                  source={{ uri: thumbUrl }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.thumbnailFallback}>
                  <Ionicons name="book-outline" size={40} color="#818CF8" />
                </View>
              )}

              {/* Price Pill Floating on Thumbnail */}
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

              {/* Enrollment Status Ribbon on Thumbnail */}
              {isEnrolled && (
                <View style={styles.enrolledRibbon}>
                  <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text style={styles.enrolledRibbonText}>ENROLLED</Text>
                </View>
              )}
            </View>

            {/* Body Content */}
            <View style={styles.cardBody}>
              <View style={styles.metaRow}>
                {/* Published Status Badge */}
                <View style={[styles.statusBadge, !isPublished && styles.statusBadgeUnpub]}>
                  <View style={[styles.statusDot, !isPublished && styles.statusDotUnpub]} />
                  <Text style={[styles.statusBadgeText, !isPublished && styles.statusBadgeTextUnpub]}>
                    {statusText}
                  </Text>
                </View>

                {course.code ? (
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{course.code}</Text>
                  </View>
                ) : null}

                <View style={styles.creditsBadge}>
                  <Ionicons name="ribbon-outline" size={12} color="#10B981" />
                  <Text style={styles.creditsText}>{credits} Credits</Text>
                </View>

                <View style={styles.videoBadge}>
                  <Ionicons name="play-circle-outline" size={12} color="#38BDF8" />
                  <Text style={styles.videoBadgeText}>{videoCount} Videos</Text>
                </View>
              </View>

              {/* Course Title */}
              <Text style={styles.courseTitle} numberOfLines={2}>
                {course.title}
              </Text>

              {/* Course Description */}
              {course.description ? (
                <Text style={styles.courseDescription} numberOfLines={2}>
                  {course.description}
                </Text>
              ) : null}

              {/* Instructor */}
              <View style={styles.instructorContainer}>
                <Ionicons name="person-circle-outline" size={15} color="#94A3B8" />
                <Text style={styles.instructorText} numberOfLines={1}>
                  {course.instructor || course.faculty || 'Faculty Professor'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* DYNAMIC ACTION BUTTON BAR (Strictly Enforces User Conditions) */}
          <View style={styles.cardActionBar}>
            <TouchableOpacity
              style={styles.detailsLinkBtn}
              onPress={() => handleSelectCourseDetails(courseId)}
              activeOpacity={0.75}
            >
              <Text style={styles.detailsLinkText}>View Details</Text>
              <Ionicons name="arrow-forward" size={13} color="#94A3B8" />
            </TouchableOpacity>

            {/* Condition: Course unavailable or unpublished → Do not allow purchase */}
            {!isPublished ? (
              <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
                <Ionicons name="ban-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnDisabledText}>UNAVAILABLE</Text>
              </View>
            ) : isEnrolled ? (
              /* Condition: Course already enrolled / purchased → Display CONTINUE LEARNING */
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnContinue]}
                onPress={() => handleContinueLearning(courseId, course.title)}
                activeOpacity={0.85}
              >
                <Ionicons name="play-circle" size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.actionBtnText}>CONTINUE LEARNING</Text>
              </TouchableOpacity>
            ) : isFree ? (
              /* Condition: Free course → Display ENROLL NOW */
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnEnroll]}
                onPress={() => handleOpenPurchaseModal(course)}
                activeOpacity={0.85}
              >
                <Ionicons name="flash" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.actionBtnText}>ENROLL NOW</Text>
              </TouchableOpacity>
            ) : (
              /* Condition: Course not enrolled & paid → Display BUY NOW */
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnBuyNow]}
                onPress={() => handleOpenPurchaseModal(course)}
                activeOpacity={0.85}
              >
                <Ionicons name="cart" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.actionBtnText}>BUY NOW • {priceDisplay}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [enrolledCourseIds, userRegId, handleSelectCourseDetails]
  );

  // List Header Component
  const renderListHeader = () => (
    <View style={styles.header}>
      {/* Eyebrow & Org */}
      <View style={styles.badgeRow}>
        <View style={styles.eyebrowBadge}>
          <Text style={styles.eyebrowText}>CATALOG</Text>
        </View>
        <View style={styles.orgBadge}>
          <Text style={styles.orgBadgeText}>Cotr Global Online</Text>
        </View>
      </View>
      <Text style={styles.title}>Browse Courses</Text>
      <Text style={styles.subtitle}>
        Explore published theological courses, scripture exegesis, and ministry tracks.
      </Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search published courses..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleSearchSubmit} activeOpacity={0.8}>
          <Text style={styles.searchSubmitText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results Info Count Row */}
      {!isLoading && !errorMessage && courses.length > 0 && (
        <View style={styles.resultsInfoRow}>
          <Text style={styles.resultsCountText}>
            Showing {(currentPage - 1) * PAGE_LIMIT + 1}–
            {Math.min(currentPage * PAGE_LIMIT, totalItems)} of {totalItems} Courses
          </Text>
          <Text style={styles.pageCountText}>
            Page {currentPage} of {totalPages}
          </Text>
        </View>
      )}
    </View>
  );

  // List Empty Component (Loading, Error, or Empty state)
  const renderListEmpty = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Loading published courses...</Text>
        </View>
      );
    }

    if (!isLoading && errorMessage) {
      return (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={38} color="#EF4444" />
          <Text style={styles.errorTitle}>Unable to load courses</Text>
          <Text style={styles.errorSubtitle}>{errorMessage}</Text>
          <View style={styles.errorBtnRow}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRefresh}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.loginFallbackBtn}
              onPress={() => router.push('/student/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.loginFallbackText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (!isLoading && !errorMessage && courses.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="school-outline" size={42} color="#818CF8" />
          </View>
          <Text style={styles.emptyTitle}>No courses found</Text>
          <Text style={styles.emptySubtitle}>
            {activeSearch
              ? `No courses matching "${activeSearch}". Try another keyword or clear the search.`
              : 'There are currently no published courses available in the catalog.'}
          </Text>
          {activeSearch ? (
            <TouchableOpacity style={styles.clearFilterBtn} onPress={handleClearSearch} activeOpacity={0.8}>
              <Text style={styles.clearFilterText}>Clear Search Filter</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={handleRefresh}
              activeOpacity={0.8}
            >
              <Text style={styles.clearFilterText}>Refresh Catalog</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return null;
  };

  // List Footer Component (Pagination Controls)
  const renderListFooter = () => {
    if (totalPages <= 1 || isLoading || courses.length === 0) {
      return null;
    }

    return (
      <View style={styles.paginationContainer}>
        {/* Previous Button */}
        <TouchableOpacity
          style={[
            styles.pageNavButton,
            currentPage <= 1 && styles.pageNavButtonDisabled,
          ]}
          disabled={currentPage <= 1}
          onPress={() => handlePageChange(Math.max(1, currentPage - 1))}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={currentPage <= 1 ? '#475569' : '#FFFFFF'}
          />
          <Text
            style={[
              styles.pageNavText,
              currentPage <= 1 && styles.pageNavTextDisabled,
            ]}
          >
            Previous
          </Text>
        </TouchableOpacity>

        {/* Page Number Pills */}
        <View style={styles.pagePillsRow}>
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => {
            const isActive = pg === currentPage;
            return (
              <TouchableOpacity
                key={pg}
                style={[styles.pagePill, isActive && styles.pagePillActive]}
                onPress={() => handlePageChange(pg)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pagePillNumber, isActive && styles.pagePillNumberActive]}>
                  {pg}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.pageNavButton,
            currentPage >= totalPages && styles.pageNavButtonDisabled,
          ]}
          disabled={currentPage >= totalPages}
          onPress={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.pageNavText,
              currentPage >= totalPages && styles.pageNavTextDisabled,
            ]}
          >
            Next
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={currentPage >= totalPages ? '#475569' : '#FFFFFF'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const purchasePriceDisplay = purchasingCourse
    ? formatCoursePrice(purchasingCourse, userRegId)
    : 'Free';
  const isPurchasingFree = purchasePriceDisplay.toLowerCase() === 'free';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FlatList<PublishedCourse>
        data={courses}
        keyExtractor={(item, index) => item.id || item._id || `course_${index}`}
        renderItem={renderCourseItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={renderListFooter}
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
      />

      {/* CONFIRM PURCHASE / CHECKOUT MODAL FROM COURSE LISTING */}
      <Modal
        visible={isConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmittingPurchase) setIsConfirmModalVisible(false);
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
              {!isSubmittingPurchase && (
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
              You are about to purchase the course{' '}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>{purchasingCourse?.title}</Text>.
            </Text>

            {/* Price Breakdown Card */}
            <View style={styles.orderSummaryCard}>
              <View style={styles.orderSummaryRow}>
                <Text style={styles.orderSummaryLabel}>Course Price:</Text>
                <Text style={styles.orderSummaryValue}>{purchasePriceDisplay}</Text>
              </View>

              <View style={[styles.orderSummaryRow, { borderBottomWidth: 0, paddingTop: 10, marginTop: 4 }]}>
                <Text style={[styles.orderSummaryLabel, { fontWeight: '700', color: '#0F172A' }]}>Total:</Text>
                <Text style={[styles.orderSummaryValue, { fontWeight: '800', color: '#4F46E5', fontSize: 16 }]}>
                  {purchasePriceDisplay}
                </Text>
              </View>
            </View>

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
                disabled={isSubmittingPurchase}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmPurchaseButton, isSubmittingPurchase && styles.confirmPurchaseButtonDisabled]}
                onPress={handleConfirmPurchase}
                disabled={isSubmittingPurchase}
                activeOpacity={0.85}
              >
                {isSubmittingPurchase ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmPurchaseButtonText}>Processing...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmPurchaseButtonText}>
                    {isPurchasingFree ? 'Confirm Enrollment' : 'Confirm Purchase'}
                  </Text>
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
    backgroundColor: '#090D16',
  },
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  eyebrowBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  eyebrowText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  orgBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  orgBadgeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    paddingVertical: 6,
  },
  clearSearchBtn: {
    padding: 4,
    marginRight: 4,
  },
  searchSubmitBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchSubmitText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 12,
  },
  resultsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 6,
  },
  resultsCountText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  pageCountText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  errorCard: {
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginVertical: 20,
  },
  errorTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  errorBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 13,
  },
  loginFallbackBtn: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loginFallbackText: {
    color: '#CBD5E1',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 16,
  },
  clearFilterBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearFilterText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  courseCard: {
    backgroundColor: '#131B2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  thumbnailContainer: {
    height: 140,
    width: '100%',
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161F37',
  },
  pricePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pricePillFree: {
    backgroundColor: '#10B981',
  },
  pricePillPaid: {
    backgroundColor: '#4F46E5',
  },
  pricePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pricePillTextFree: {
    color: '#FFFFFF',
  },
  pricePillTextPaid: {
    color: '#FFFFFF',
  },
  enrolledRibbon: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  enrolledRibbonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusBadgeUnpub: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusDotUnpub: {
    backgroundColor: '#EF4444',
  },
  statusBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadgeTextUnpub: {
    color: '#EF4444',
  },
  codeBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  creditsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  creditsText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  videoBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
    lineHeight: 22,
  },
  courseDescription: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    marginBottom: 10,
  },
  instructorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  instructorText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  cardActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  detailsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  detailsLinkText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnContinue: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  actionBtnBuyNow: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
  },
  actionBtnEnroll: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
  },
  actionBtnDisabled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  actionBtnDisabledText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    padding: 8,
    marginTop: 10,
  },
  pageNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  pageNavButtonDisabled: {
    opacity: 0.4,
  },
  pageNavText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pageNavTextDisabled: {
    color: '#64748B',
  },
  pagePillsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pagePill: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagePillActive: {
    backgroundColor: '#38BDF8',
  },
  pagePillNumber: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  pagePillNumberActive: {
    color: '#090D16',
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
});
