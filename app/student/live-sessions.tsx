import React, { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { DashboardService } from '../../src/services/dashboardService';
import { LiveSessionItem } from '../../src/types';

type StatusTabKey = 'ALL' | 'UPCOMING' | 'ONGOING' | 'COMPLETED';

interface FilterOption {
  id: string;
  label: string;
}

function toTrimmedString(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function extractOptionFromRecord(
  record: unknown,
  idKey: string,
  nestedKey: string,
  flatLabelKey: string,
  nestedLabelKeys: string[]
): { id: string; label: string } | null {
  if (!record || typeof record !== 'object') return null;
  const rec = record as Record<string, unknown>;
  const rawIdField = rec[idKey];
  const rawNestedField = rec[nestedKey];
  const nestedObj =
    rawNestedField && typeof rawNestedField === 'object'
      ? (rawNestedField as Record<string, unknown>)
      : rawIdField && typeof rawIdField === 'object'
      ? (rawIdField as Record<string, unknown>)
      : null;

  const id =
    toTrimmedString(rawIdField) ||
    toTrimmedString(nestedObj?.id) ||
    toTrimmedString(nestedObj?._id);

  if (!id) return null;

  let label = toTrimmedString(rec[flatLabelKey]);
  if (!label && nestedObj) {
    for (const k of nestedLabelKeys) {
      label = toTrimmedString(nestedObj[k]);
      if (label) break;
    }
  }

  return label ? { id, label } : null;
}

function addFilterOption(map: Map<string, string>, opt: { id: string; label: string } | null) {
  if (opt && opt.id && opt.label && !map.has(opt.id)) {
    map.set(opt.id, opt.label);
  }
}

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'ONGOING', label: 'Ongoing' },
  { key: 'COMPLETED', label: 'Completed' },
];

function classifySessionStatus(rawStatus?: string): StatusTabKey | 'CANCELLED' | 'OTHER' {
  const status = (rawStatus || '').trim().toUpperCase();
  if (!status) return 'OTHER';
  if (['SCHEDULED', 'UPCOMING', 'PENDING'].includes(status)) return 'UPCOMING';
  if (['ONGOING', 'LIVE', 'IN_PROGRESS', 'STARTED', 'ACTIVE'].includes(status)) return 'ONGOING';
  if (['COMPLETED', 'ENDED', 'PAST', 'FINISHED'].includes(status)) return 'COMPLETED';
  if (['CANCELLED', 'CANCELED'].includes(status)) return 'CANCELLED';
  return 'OTHER';
}

function getStatusBadgeStyle(rawStatus?: string, isDarkMode?: boolean) {
  const bucket = classifySessionStatus(rawStatus);
  const label = rawStatus
    ? rawStatus
        .trim()
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  if (bucket === 'ONGOING') {
    return {
      label: label || 'Ongoing',
      bg: isDarkMode ? 'rgba(16, 185, 129, 0.22)' : '#DCFCE7',
      color: isDarkMode ? '#34D399' : '#047857',
      accent: '#10B981',
    };
  }
  if (bucket === 'UPCOMING') {
    return {
      label: label || 'Scheduled',
      bg: isDarkMode ? 'rgba(99, 102, 241, 0.22)' : '#EEF2FF',
      color: isDarkMode ? '#A5B4FC' : '#4338CA',
      accent: '#6366F1',
    };
  }
  if (bucket === 'COMPLETED') {
    return {
      label: label || 'Completed',
      bg: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : '#F1F5F9',
      color: isDarkMode ? '#CBD5E1' : '#475569',
      accent: '#64748B',
    };
  }
  if (bucket === 'CANCELLED') {
    return {
      label: label || 'Cancelled',
      bg: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
      color: isDarkMode ? '#F87171' : '#B91C1C',
      accent: '#EF4444',
    };
  }
  return {
    label,
    bg: isDarkMode ? '#1E293B' : '#F1F5F9',
    color: isDarkMode ? '#94A3B8' : '#475569',
    accent: '#6366F1',
  };
}

function formatSessionDate(session: LiveSessionItem): string | null {
  const rawDate = session.scheduledDate || session.startTime;
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeToken(raw: string): string {
  if (/^\d{1,2}:\d{2}(\s?(AM|PM))?/i.test(raw.trim())) {
    return raw.trim();
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return raw;
}

function formatSessionTimeRange(session: LiveSessionItem): string | null {
  if (session.startTime && session.endTime) {
    return `${formatTimeToken(session.startTime)} – ${formatTimeToken(session.endTime)}`;
  }
  if (session.scheduledTime && session.scheduledTime.trim()) {
    return session.scheduledTime.trim();
  }
  if (session.startTime) {
    return formatTimeToken(session.startTime);
  }
  return null;
}

export default function StudentLiveSessionsScreen() {
  const { isDarkMode, theme } = useTheme();

  const [sessions, setSessions] = useState<LiveSessionItem[]>([]);
  const [courseFilters, setCourseFilters] = useState<FilterOption[]>([]);
  const [batchFilters, setBatchFilters] = useState<FilterOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTabKey>('ALL');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(
    async (
      options: { showLoader?: boolean; courseId?: string | null; batchId?: string | null } = {}
    ) => {
      const { showLoader = false, courseId = selectedCourseId, batchId = selectedBatchId } =
        options;

      if (showLoader) setIsLoading(true);
      setErrorMessage(null);

      try {
        const hasFilters = Boolean(courseId || batchId);

        const [upcomingRes, listRes, enrollmentsRes, programsRes] = await Promise.allSettled([
          hasFilters ? Promise.resolve(null) : DashboardService.getUpcomingLiveSessions(),
          DashboardService.getLiveSessions({
            courseId: courseId || undefined,
            batchId: batchId || undefined,
          }),
          DashboardService.getStudentEnrollments('me'),
          DashboardService.getStudentPrograms(),
        ]);

        const upcomingData =
          upcomingRes.status === 'fulfilled' && upcomingRes.value?.success
            ? upcomingRes.value.data || []
            : [];
        const listSuccess = listRes.status === 'fulfilled' && listRes.value?.success;
        const listData = listSuccess ? listRes.value.data || [] : [];

        // Combine backend datasets cleanly without duplicating records by ID
        let resolvedSessions: LiveSessionItem[] = [];
        if (hasFilters) {
          if (listSuccess) {
            resolvedSessions = listData;
          } else {
            const err =
              listRes.status === 'fulfilled'
                ? listRes.value?.error
                : 'Failed to load filtered live sessions.';
            setErrorMessage(err || 'Unable to fetch filtered live sessions.');
          }
        } else {
          const mergedMap = new Map<string, LiveSessionItem>();
          upcomingData.forEach((item, index) => {
            const key = item.id || item._id || `upcoming-${index}`;
            mergedMap.set(key, item);
          });
          listData.forEach((item, index) => {
            const key = item.id || item._id || `list-${index}`;
            const existing = mergedMap.get(key);
            mergedMap.set(key, existing ? { ...item, ...existing } : item);
          });
          resolvedSessions = Array.from(mergedMap.values());

          const upcomingFailed =
            upcomingRes.status === 'rejected' ||
            (upcomingRes.status === 'fulfilled' &&
              upcomingRes.value !== null &&
              !upcomingRes.value.success);
          const listFailed =
            listRes.status === 'rejected' ||
            (listRes.status === 'fulfilled' && !listRes.value.success);

          if (upcomingFailed && listFailed) {
            const primaryError =
              (upcomingRes.status === 'fulfilled' && upcomingRes.value?.error) ||
              (listRes.status === 'fulfilled' && listRes.value?.error) ||
              'Unable to load live sessions from server.';
            setErrorMessage(primaryError);
          }
        }

        setSessions(resolvedSessions);

        // Assemble Course and Batch filter options strictly from real backend data
        const courseMap = new Map<string, string>();
        const batchMap = new Map<string, string>();

        if (enrollmentsRes.status === 'fulfilled' && enrollmentsRes.value?.success) {
          (enrollmentsRes.value.data || []).forEach((enr) => {
            addFilterOption(
              courseMap,
              extractOptionFromRecord(enr, 'courseId', 'course', 'courseTitle', ['title', 'name'])
            );
            addFilterOption(
              batchMap,
              extractOptionFromRecord(enr, 'batchId', 'batch', 'batchName', ['name', 'title'])
            );
          });
        }

        if (programsRes.status === 'fulfilled' && programsRes.value?.success) {
          (programsRes.value.data || []).forEach((prog) => {
            addFilterOption(
              batchMap,
              extractOptionFromRecord(prog, 'batchId', 'batch', 'batchName', ['name', 'title'])
            );
          });
        }

        [...upcomingData, ...listData].forEach((sess) => {
          addFilterOption(
            courseMap,
            extractOptionFromRecord(sess, 'courseId', 'course', 'courseTitle', ['title', 'name'])
          );
          addFilterOption(
            batchMap,
            extractOptionFromRecord(sess, 'batchId', 'batch', 'batchName', ['name', 'title'])
          );
        });

        setCourseFilters(
          Array.from(courseMap.entries()).map(([id, label]) => ({ id, label }))
        );
        setBatchFilters(
          Array.from(batchMap.entries()).map(([id, label]) => ({ id, label }))
        );
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Network error while fetching live sessions.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedCourseId, selectedBatchId]
  );

  useFocusEffect(
    useCallback(() => {
      loadData({ showLoader: sessions.length === 0 });
    }, [loadData, sessions.length])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData({ courseId: selectedCourseId, batchId: selectedBatchId });
  }, [loadData, selectedCourseId, selectedBatchId]);

  const handleSelectCourseFilter = (courseId: string | null) => {
    setSelectedCourseId(courseId);
    loadData({ showLoader: true, courseId, batchId: selectedBatchId });
  };

  const handleSelectBatchFilter = (batchId: string | null) => {
    setSelectedBatchId(batchId);
    loadData({ showLoader: true, courseId: selectedCourseId, batchId });
  };

  const handleClearFilters = () => {
    setSelectedCourseId(null);
    setSelectedBatchId(null);
    setActiveTab('ALL');
    loadData({ showLoader: true, courseId: null, batchId: null });
  };

  const handleJoinSession = async (session: LiveSessionItem) => {
    if (!session.meetingUrl) return;

    try {
      const supported = await Linking.canOpenURL(session.meetingUrl);
      if (!supported) {
        Alert.alert('Cannot Open Link', 'Your device cannot open this meeting URL.');
        return;
      }
      await Linking.openURL(session.meetingUrl);
    } catch {
      Alert.alert('Connection Error', 'Unable to launch the live session meeting link.');
    }
  };

  const tabCounts = useMemo(() => {
    const counts: Record<StatusTabKey, number> = {
      ALL: sessions.length,
      UPCOMING: 0,
      ONGOING: 0,
      COMPLETED: 0,
    };
    sessions.forEach((sess) => {
      const bucket = classifySessionStatus(sess.status);
      if (bucket === 'UPCOMING') counts.UPCOMING += 1;
      else if (bucket === 'ONGOING') counts.ONGOING += 1;
      else if (bucket === 'COMPLETED') counts.COMPLETED += 1;
    });
    return counts;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (activeTab === 'ALL') return sessions;
    return sessions.filter((sess) => classifySessionStatus(sess.status) === activeTab);
  }, [sessions, activeTab]);

  const hasActiveFilters = Boolean(selectedCourseId || selectedBatchId || activeTab !== 'ALL');

  const renderSessionCard = ({ item }: { item: LiveSessionItem }) => {
    const statusBucket = classifySessionStatus(item.status);
    const badge = getStatusBadgeStyle(item.status, isDarkMode);
    const dateText = formatSessionDate(item);
    const timeText = formatSessionTimeRange(item);
    const isCompletedOrCancelled = statusBucket === 'COMPLETED' || statusBucket === 'CANCELLED';
    const isJoinable =
      Boolean(item.meetingUrl) && !isCompletedOrCancelled && item.canJoin !== false;

    const sessionHeading =
      item.title ||
      (item.sessionNumber !== undefined ? `Subject Call ${item.sessionNumber}` : 'Live Session');

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
            borderLeftColor: badge.accent,
          },
        ]}
      >
        {/* Top Row: Call Number / Badges */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.badgesRow}>
            {item.sessionNumber !== undefined && (
              <View
                style={[
                  styles.callPill,
                  { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' },
                ]}
              >
                <Text style={[styles.callPillText, { color: theme.primary }]}>
                  CALL {item.sessionNumber} OF 5
                </Text>
              </View>
            )}
            {Boolean(badge.label) && (
              <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                {statusBucket === 'ONGOING' && (
                  <View style={[styles.livePulseDot, { backgroundColor: badge.color }]} />
                )}
                <Text style={[styles.statusPillText, { color: badge.color }]}>
                  {badge.label}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Session Title */}
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{sessionHeading}</Text>

        {/* Course & Batch Info */}
        <View style={styles.detailsStack}>
          {Boolean(item.courseTitle) && (
            <View style={styles.detailLine}>
              <Ionicons name="book-outline" size={15} color={theme.primary} />
              <Text style={[styles.detailTextBold, { color: theme.textPrimary }]}>
                {item.courseTitle}
              </Text>
            </View>
          )}
          {Boolean(item.batchName) && (
            <View style={styles.detailLine}>
              <Ionicons name="people-outline" size={15} color={theme.textSecondary} />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Batch: {item.batchName}
              </Text>
            </View>
          )}
          {Boolean(item.instructorName) && (
            <View style={styles.detailLine}>
              <Ionicons name="person-outline" size={15} color={theme.textSecondary} />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Instructor: {item.instructorName}
              </Text>
            </View>
          )}
        </View>

        {Boolean(item.agenda) && (
          <Text style={[styles.agendaText, { color: theme.textSecondary }]} numberOfLines={3}>
            {item.agenda}
          </Text>
        )}

        {/* Schedule Date & Time */}
        {(dateText || timeText) && (
          <View
            style={[
              styles.scheduleBox,
              {
                backgroundColor: isDarkMode ? '#111827' : '#F8FAFC',
                borderColor: theme.cardBorderSubtle,
              },
            ]}
          >
            {dateText && (
              <View style={styles.scheduleItem}>
                <Ionicons name="calendar-outline" size={15} color={theme.primary} />
                <Text style={[styles.scheduleText, { color: theme.textPrimary }]}>{dateText}</Text>
              </View>
            )}
            {timeText && (
              <View style={styles.scheduleItem}>
                <Ionicons name="time-outline" size={15} color={theme.primary} />
                <Text style={[styles.scheduleText, { color: theme.textPrimary }]}>{timeText}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer: Attendance or Join CTA */}
        <View style={styles.cardFooter}>
          {statusBucket === 'COMPLETED' && typeof item.hasAttended === 'boolean' ? (
            <View
              style={[
                styles.attendancePill,
                {
                  backgroundColor: item.hasAttended
                    ? isDarkMode
                      ? 'rgba(16, 185, 129, 0.2)'
                      : '#DCFCE7'
                    : isDarkMode
                    ? 'rgba(239, 68, 68, 0.2)'
                    : '#FEE2E2',
                },
              ]}
            >
              <Ionicons
                name={item.hasAttended ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={item.hasAttended ? theme.statusSuccess : theme.statusDanger}
              />
              <Text
                style={[
                  styles.attendanceText,
                  { color: item.hasAttended ? theme.statusSuccess : theme.statusDanger },
                ]}
              >
                {item.hasAttended ? 'Attendance: Present' : 'Attendance: Absent'}
              </Text>
            </View>
          ) : isJoinable ? (
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: theme.primary }]}
              onPress={() => handleJoinSession(item)}
              activeOpacity={0.82}
            >
              <Ionicons name="videocam" size={17} color="#FFFFFF" />
              <Text style={styles.joinBtnText}>Join Live Session</Text>
            </TouchableOpacity>
          ) : !isCompletedOrCancelled ? (
            <View
              style={[
                styles.pendingLinkBox,
                { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
              ]}
            >
              <Ionicons name="link-outline" size={15} color={theme.textMuted} />
              <Text style={[styles.pendingLinkText, { color: theme.textMuted }]}>
                Meeting link will appear when published
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* Top Bar */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.topBarBackground, borderBottomColor: theme.topBarBorder },
        ]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Live Sessions</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Scheduled virtual classrooms & attendance
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}
          onPress={handleRefresh}
          activeOpacity={0.75}
        >
          <Ionicons name="refresh" size={18} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filter & Status Controls */}
      <View
        style={[
          styles.controlsContainer,
          { backgroundColor: theme.surface, borderBottomColor: theme.divider },
        ]}
      >
        {/* Status Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.statusTab,
                  {
                    backgroundColor: isActive
                      ? theme.primary
                      : isDarkMode
                      ? '#1E293B'
                      : '#F1F5F9',
                  },
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.statusTabText,
                    { color: isActive ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  {tab.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Course Filter Chips */}
        {courseFilters.length > 0 && (
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Course:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              <TouchableOpacity
                key="all-courses"
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      selectedCourseId === null
                        ? isDarkMode
                          ? 'rgba(99, 102, 241, 0.22)'
                          : '#EEF2FF'
                        : theme.card,
                    borderColor: selectedCourseId === null ? theme.primary : theme.cardBorder,
                  },
                ]}
                onPress={() => handleSelectCourseFilter(null)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: selectedCourseId === null ? theme.primary : theme.textSecondary },
                  ]}
                >
                  All Courses
                </Text>
              </TouchableOpacity>

              {courseFilters.map((course, idx) => {
                const selected = selectedCourseId === course.id;
                return (
                  <TouchableOpacity
                    key={`course-${course.id}-${idx}`}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected
                          ? isDarkMode
                            ? 'rgba(99, 102, 241, 0.22)'
                            : '#EEF2FF'
                          : theme.card,
                        borderColor: selected ? theme.primary : theme.cardBorder,
                      },
                    ]}
                    onPress={() => handleSelectCourseFilter(selected ? null : course.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: selected ? theme.primary : theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {course.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Batch Filter Chips */}
        {batchFilters.length > 0 && (
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Batch:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              <TouchableOpacity
                key="all-batches"
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      selectedBatchId === null
                        ? isDarkMode
                          ? 'rgba(99, 102, 241, 0.22)'
                          : '#EEF2FF'
                        : theme.card,
                    borderColor: selectedBatchId === null ? theme.primary : theme.cardBorder,
                  },
                ]}
                onPress={() => handleSelectBatchFilter(null)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: selectedBatchId === null ? theme.primary : theme.textSecondary },
                  ]}
                >
                  All Batches
                </Text>
              </TouchableOpacity>

              {batchFilters.map((batch, idx) => {
                const selected = selectedBatchId === batch.id;
                return (
                  <TouchableOpacity
                    key={`batch-${batch.id}-${idx}`}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected
                          ? isDarkMode
                            ? 'rgba(99, 102, 241, 0.22)'
                            : '#EEF2FF'
                          : theme.card,
                        borderColor: selected ? theme.primary : theme.cardBorder,
                      },
                    ]}
                    onPress={() => handleSelectBatchFilter(selected ? null : batch.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: selected ? theme.primary : theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {batch.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.stateTitle, { color: theme.textPrimary, marginTop: 14 }]}>
            Loading Live Sessions...
          </Text>
          <Text style={[styles.stateSubtitle, { color: theme.textSecondary }]}>
            Checking your upcoming and scheduled virtual classes.
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <View
            style={[
              styles.stateIconCircle,
              { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2' },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={34} color={theme.statusDanger} />
          </View>
          <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>
            Unable to Load Live Sessions
          </Text>
          <Text style={[styles.stateSubtitle, { color: theme.textSecondary }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={() => loadData({ showLoader: true })}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={(item, idx) => `${item.id || item._id || 'session'}-${idx}`}
          renderItem={renderSessionCard}
          contentContainerStyle={
            filteredSessions.length === 0 ? styles.emptyScrollContainer : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View
                style={[
                  styles.stateIconCircle,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2FF' },
                ]}
              >
                <Ionicons name="videocam-off-outline" size={34} color={theme.primary} />
              </View>
              <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>
                No Live Sessions Found
              </Text>
              <Text style={[styles.stateSubtitle, { color: theme.textSecondary }]}>
                {hasActiveFilters
                  ? 'No sessions match your active status, course, or batch filter.'
                  : 'Your instructors have not scheduled any live sessions for your enrollments yet.'}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                  onPress={handleClearFilters}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.retryBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  controlsContainer: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    gap: 8,
  },
  tabsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipsRow: {
    paddingRight: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 190,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  emptyScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  callPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  callPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 8,
  },
  detailsStack: {
    gap: 5,
    marginBottom: 8,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailTextBold: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  agendaText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  scheduleBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  attendancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  attendanceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingLinkBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  pendingLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  stateIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 18,
    gap: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
