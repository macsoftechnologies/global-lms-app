import React, { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
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
import { NotificationItem, NotificationsPaginationMeta } from '../../src/types';

const PAGE_LIMIT = 20;

interface NotificationVisual {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgLight: string;
  bgDark: string;
}

function getNotificationVisual(type?: string): NotificationVisual {
  const key = (type || '').toLowerCase();

  if (key.includes('live') || key.includes('session') || key.includes('class') || key.includes('meeting')) {
    return {
      icon: 'videocam',
      color: '#7C3AED',
      bgLight: '#F3E8FF',
      bgDark: 'rgba(124, 58, 237, 0.2)',
    };
  }
  if (key.includes('exam') || key.includes('quiz') || key.includes('assessment') || key.includes('assignment')) {
    return {
      icon: 'document-text',
      color: '#2563EB',
      bgLight: '#DBEAFE',
      bgDark: 'rgba(37, 99, 235, 0.2)',
    };
  }
  if (key.includes('result') || key.includes('grade') || key.includes('score') || key.includes('transcript')) {
    return {
      icon: 'analytics',
      color: '#059669',
      bgLight: '#D1FAE5',
      bgDark: 'rgba(5, 150, 105, 0.2)',
    };
  }
  if (key.includes('cert')) {
    return {
      icon: 'ribbon',
      color: '#D97706',
      bgLight: '#FEF3C7',
      bgDark: 'rgba(217, 119, 6, 0.2)',
    };
  }
  if (key.includes('pay') || key.includes('fee') || key.includes('invoice') || key.includes('order')) {
    return {
      icon: 'card',
      color: '#0891B2',
      bgLight: '#CFFAFE',
      bgDark: 'rgba(8, 145, 178, 0.2)',
    };
  }
  if (key.includes('chat') || key.includes('message') || key.includes('discussion') || key.includes('reply')) {
    return {
      icon: 'chatbubble-ellipses',
      color: '#4F46E5',
      bgLight: '#EEF2FF',
      bgDark: 'rgba(79, 70, 229, 0.2)',
    };
  }
  if (key.includes('course') || key.includes('enroll') || key.includes('program') || key.includes('module')) {
    return {
      icon: 'book',
      color: '#4338CA',
      bgLight: '#E0E7FF',
      bgDark: 'rgba(99, 102, 241, 0.2)',
    };
  }
  if (key.includes('announce') || key.includes('alert') || key.includes('system')) {
    return {
      icon: 'megaphone',
      color: '#EA580C',
      bgLight: '#FFEDD5',
      bgDark: 'rgba(234, 88, 12, 0.2)',
    };
  }

  return {
    icon: 'notifications',
    color: '#6366F1',
    bgLight: '#EEF2FF',
    bgDark: 'rgba(99, 102, 241, 0.2)',
  };
}

function formatNotificationDateTime(dateStr?: string): { date: string; time: string } | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;

  const date = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return { date, time };
}

function formatNotificationTypeLabel(type?: string): string | null {
  if (!type || !type.trim()) return null;
  return type
    .trim()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function StudentNotificationsScreen() {
  const { isDarkMode, theme } = useTheme();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<NotificationsPaginationMeta>({
    page: 1,
    limit: PAGE_LIMIT,
    totalItems: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLoadingMoreRef = useRef<boolean>(false);

  const loadNotifications = useCallback(
    async (pageToLoad: number = 1, options: { showLoader?: boolean; append?: boolean } = {}) => {
      const { showLoader = false, append = false } = options;

      if (append) {
        if (isLoadingMoreRef.current) return;
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
      } else if (showLoader) {
        setIsLoading(true);
      }

      if (!append) {
        setErrorMessage(null);
      }

      try {
        const [feedRes, countRes] = await Promise.all([
          DashboardService.getNotificationsPaginated(pageToLoad, PAGE_LIMIT),
          pageToLoad === 1
            ? DashboardService.getUnreadNotificationCountResult()
            : Promise.resolve(null),
        ]);

        if (feedRes.success && feedRes.data) {
          const incoming = feedRes.data.items || [];
          const incomingMeta = feedRes.data.meta;

          setMeta(incomingMeta);
          setNotifications((prev) => {
            if (!append) return incoming;
            const existingIds = new Set(prev.map((item) => item.id));
            const uniqueNew = incoming.filter((item) => item.id && !existingIds.has(item.id));
            return [...prev, ...uniqueNew];
          });
        } else if (!append) {
          setErrorMessage(feedRes.error || 'Unable to load notifications from the server.');
        }

        if (countRes && countRes.success && typeof countRes.data === 'number') {
          setUnreadCount(countRes.data);
        }
      } catch (err: unknown) {
        if (!append) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Network error while fetching notifications.'
          );
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadNotifications(1, { showLoader: notifications.length === 0 });
    }, [loadNotifications, notifications.length])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadNotifications(1, { append: false });
  }, [loadNotifications]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || isRefreshing || isLoadingMoreRef.current || !meta.hasMore) {
      return;
    }
    loadNotifications(meta.page + 1, { append: true });
  }, [isLoading, isRefreshing, meta.hasMore, meta.page, loadNotifications]);

  const handleMarkSingleAsRead = async (item: NotificationItem) => {
    const notifId = item.id || item._id;
    if (!notifId || item.isRead || markingId === notifId) {
      return;
    }

    const previousList = notifications;
    const previousUnread = unreadCount;

    setMarkingId(notifId);
    setNotifications((prev) =>
      prev.map((entry) =>
        (entry.id || entry._id) === notifId ? { ...entry, isRead: true } : entry
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await DashboardService.markNotificationAsRead(notifId);
      if (!res.success) {
        setNotifications(previousList);
        setUnreadCount(previousUnread);
        Alert.alert('Update Failed', res.error || 'Could not mark notification as read.');
      } else {
        const countRes = await DashboardService.getUnreadNotificationCountResult();
        if (countRes.success && typeof countRes.data === 'number') {
          setUnreadCount(countRes.data);
        }
      }
    } catch {
      setNotifications(previousList);
      setUnreadCount(previousUnread);
      Alert.alert('Update Failed', 'Network error while updating notification status.');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    const hasUnreadItems = unreadCount > 0 || notifications.some((item) => !item.isRead);
    if (!hasUnreadItems || isMarkingAll) return;

    const previousList = notifications;
    const previousUnread = unreadCount;

    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((entry) => ({ ...entry, isRead: true })));
    setUnreadCount(0);

    try {
      const res = await DashboardService.markAllNotificationsAsRead();
      if (!res.success) {
        setNotifications(previousList);
        setUnreadCount(previousUnread);
        Alert.alert('Action Failed', res.error || 'Could not mark all notifications as read.');
      } else {
        const countRes = await DashboardService.getUnreadNotificationCountResult();
        if (countRes.success && typeof countRes.data === 'number') {
          setUnreadCount(countRes.data);
        }
      }
    } catch {
      setNotifications(previousList);
      setUnreadCount(previousUnread);
      Alert.alert('Action Failed', 'Network error while marking notifications as read.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const hasAnyUnread = unreadCount > 0 || notifications.some((n) => !n.isRead);

  const renderNotificationCard = ({ item }: { item: NotificationItem }) => {
    const isUnread = !item.isRead;
    const visual = getNotificationVisual(item.type);
    const dateTime = formatNotificationDateTime(item.createdAt);
    const typeLabel = formatNotificationTypeLabel(item.type);
    const notifId = item.id || item._id || '';
    const isUpdating = markingId === notifId;

    return (
      <TouchableOpacity
        activeOpacity={isUnread ? 0.75 : 0.92}
        onPress={() => handleMarkSingleAsRead(item)}
        style={[
          styles.card,
          {
            backgroundColor: isUnread
              ? isDarkMode
                ? 'rgba(79, 70, 229, 0.12)'
                : '#F5F7FF'
              : theme.card,
            borderColor: isUnread
              ? isDarkMode
                ? 'rgba(99, 102, 241, 0.45)'
                : '#C7D2FE'
              : theme.cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.iconBox,
            { backgroundColor: isDarkMode ? visual.bgDark : visual.bgLight },
          ]}
        >
          <Ionicons name={visual.icon} size={20} color={visual.color} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleGroup}>
              {Boolean(item.title) && (
                <Text
                  style={[
                    styles.cardTitle,
                    { color: theme.textPrimary },
                    isUnread && styles.cardTitleUnread,
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              )}
              {typeLabel && (
                <View
                  style={[
                    styles.typePill,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#EEF2F6',
                    },
                  ]}
                >
                  <Text style={[styles.typePillText, { color: theme.textSecondary }]}>
                    {typeLabel}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.statusIndicatorWrap}>
              {isUpdating ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : isUnread ? (
                <View style={styles.unreadBadgeRow}>
                  <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                  <Text style={[styles.unreadTag, { color: theme.primary }]}>New</Text>
                </View>
              ) : null}
            </View>
          </View>

          {Boolean(item.message) && (
            <Text
              style={[
                styles.cardMessage,
                {
                  color: isUnread
                    ? isDarkMode
                      ? '#E2E8F0'
                      : '#1E293B'
                    : theme.textSecondary,
                },
              ]}
            >
              {item.message}
            </Text>
          )}

          {dateTime && (
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textMuted }]}>{dateTime.date}</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={13} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textMuted }]}>{dateTime.time}</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderListFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Loading more notifications...
          </Text>
        </View>
      );
    }

    if (meta.hasMore && notifications.length > 0) {
      return (
        <TouchableOpacity
          style={[
            styles.loadMoreBtn,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
          onPress={handleLoadMore}
          activeOpacity={0.75}
        >
          <Text style={[styles.loadMoreBtnText, { color: theme.primary }]}>
            Load Older Notifications
          </Text>
        </TouchableOpacity>
      );
    }

    return null;
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
          style={[
            styles.backBtn,
            { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
          ]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.headerCountPill}>
                <Text style={styles.headerCountPillText}>
                  {unreadCount > 99 ? '99+' : unreadCount} unread
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {meta.totalItems > 0
              ? `${meta.totalItems} total notification${meta.totalItems === 1 ? '' : 's'}`
              : 'Course updates & announcements'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.markAllBtn,
            {
              backgroundColor: hasAnyUnread
                ? isDarkMode
                  ? 'rgba(99, 102, 241, 0.2)'
                  : '#EEF2FF'
                : isDarkMode
                ? '#1E293B'
                : '#F1F5F9',
              opacity: hasAnyUnread ? 1 : 0.55,
            },
          ]}
          onPress={handleMarkAllAsRead}
          disabled={!hasAnyUnread || isMarkingAll}
          activeOpacity={0.75}
        >
          {isMarkingAll ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Ionicons
                name="checkmark-done-outline"
                size={16}
                color={hasAnyUnread ? theme.primary : theme.textMuted}
              />
              <Text
                style={[
                  styles.markAllBtnText,
                  { color: hasAnyUnread ? theme.primary : theme.textMuted },
                ]}
              >
                Mark all read
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.stateTitle, { color: theme.textPrimary, marginTop: 14 }]}>
            Loading notifications...
          </Text>
          <Text style={[styles.stateSubtitle, { color: theme.textSecondary }]}>
            Syncing with your student inbox.
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
            Couldn&apos;t Load Notifications
          </Text>
          <Text style={[styles.stateSubtitle, { color: theme.textSecondary }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={() => loadNotifications(1, { showLoader: true })}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, idx) => item.id || item._id || `notif-${idx}`}
          renderItem={renderNotificationCard}
          contentContainerStyle={
            notifications.length === 0 ? styles.emptyScrollContainer : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={renderListFooter}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View
                style={[
                  styles.stateIconCircle,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2FF' },
                ]}
              >
                <Ionicons name="notifications-off-outline" size={34} color={theme.primary} />
              </View>
              <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>
                No Notifications Yet
              </Text>
              <Text style={[styles.stateSubtitle, { color: theme.textSecondary }]}>
                You&apos;re all caught up. Updates about your courses, exams, live sessions, and
                certificates will appear here.
              </Text>
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
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerCountPill: {
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerCountPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  emptyScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusIndicatorWrap: {
    flexShrink: 0,
    paddingTop: 2,
  },
  unreadBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unreadTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
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
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
