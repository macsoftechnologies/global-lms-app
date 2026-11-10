import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { DashboardService } from '../../src/services/dashboardService';
import { PaymentRecord, CoursePaginationMeta } from '../../src/types';
import { useTheme } from '../../src/context/ThemeContext';

export default function StudentPaymentsScreen() {
  const { isDarkMode } = useTheme();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [meta, setMeta] = useState<CoursePaginationMeta>({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 1,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);

  // Fetch actual payment history from backend
  const fetchPaymentHistory = useCallback(async (page: number = 1, showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await DashboardService.getMyPayments(page, 10);
      if (response.success && Array.isArray(response.data)) {
        setPayments(response.data);
        if (response.meta) {
          setMeta(response.meta);
        }
      } else {
        setErrorMessage(response.error || 'Failed to retrieve payment history from backend server.');
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Network error while loading payment history.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchPaymentHistory(currentPage, true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentPage, fetchPaymentHistory]);

  // Re-fetch on screen focus (e.g., returning from course purchase flow)
  useFocusEffect(
    useCallback(() => {
      fetchPaymentHistory(currentPage, false);
    }, [currentPage, fetchPaymentHistory])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPaymentHistory(currentPage, false);
  };

  // Generate / Download Invoice Handler
  const handleGenerateInvoice = async (payment: PaymentRecord) => {
    const paymentId = payment.id || (payment as any)._id;
    if (!paymentId) {
      Alert.alert(
        'Invalid Payment ID',
        'Cannot generate invoice: missing backend payment ID for this record.'
      );
      return;
    }

    setGeneratingInvoiceId(paymentId);
    try {
      const response = await DashboardService.generateInvoice(paymentId);
      if (response.success && response.data) {
        const url = response.data.invoiceUrl;
        if (url) {
          const supported = await Linking.canOpenURL(url).catch(() => true);
          if (supported) {
            await Linking.openURL(url);
          } else {
            Alert.alert(
              'Invoice Ready',
              `Invoice generated successfully.\n\nURL: ${url}`,
              [{ text: 'OK' }]
            );
          }
        } else {
          Alert.alert(
            'Invoice Generated',
            response.data.invoicePath
              ? `Invoice generated at path: ${response.data.invoicePath}`
              : 'Invoice generated successfully.'
          );
        }
      } else {
        Alert.alert(
          'Invoice Generation Failed',
          response.error || 'The server could not generate an invoice for this payment ID.'
        );
      }
    } catch (err: unknown) {
      Alert.alert(
        'Invoice Error',
        err instanceof Error ? err.message : 'An error occurred while generating the invoice.'
      );
    } finally {
      setGeneratingInvoiceId(null);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'PAID' || s === 'COMPLETED' || s === 'SUCCESS') {
      return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: '#10B981' };
    }
    if (s === 'PENDING' || s === 'PROCESSING') {
      return { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: '#F59E0B' };
    }
    return { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: '#EF4444' };
  };

  const formatDate = (rawDate?: string) => {
    if (!rawDate) return '—';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return rawDate;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, !isDarkMode && { backgroundColor: '#F8FAFC' }]} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={[styles.header, !isDarkMode && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>BILLING & FINANCE</Text>
          <Text style={[styles.headerTitle, !isDarkMode && { color: '#0F172A' }]}>My Payments</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshIconBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="reload" size={18} color="#38BDF8" />
        </TouchableOpacity>
      </View>

      {/* Content Body */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Fetching payment history from Global LMS server...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <View style={styles.errorIconBox}>
            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Failed to Load Payments</Text>
          <Text style={styles.errorSubtitle}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => fetchPaymentHistory(currentPage, true)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : payments.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="receipt-outline" size={48} color="#64748B" />
          </View>
          <Text style={[styles.emptyTitle, !isDarkMode && { color: '#0F172A' }]}>No Payments Yet</Text>
          <Text style={styles.emptySubtitle}>Your course purchase and fee history will appear here.</Text>
          <TouchableOpacity
            style={styles.browseCoursesBtn}
            onPress={() => router.push('/(student-tabs)/courses')}
            activeOpacity={0.88}
          >
            <Ionicons name="book-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.browseCoursesBtnText}>Browse Available Courses</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
          <Text style={styles.sectionSubtitle}>
            Showing {payments.length} payment {payments.length === 1 ? 'record' : 'records'} from backend
          </Text>

          {/* Payment Cards */}
          {payments.map((item, idx) => {
            const badge = getStatusBadgeStyle(item.status);
            const isGenerating = generatingInvoiceId === (item.id || item._id);
            const courseOrProg =
              item.courseTitle ||
              item.course?.title ||
              item.programName ||
              item.program?.name ||
              item.description ||
              'Academic Tuition';

            return (
              <View
                key={item.id || item._id || `pay_${idx}`}
                style={[
                  styles.paymentCard,
                  !isDarkMode && {
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 1,
                  },
                ]}
              >
                {/* Card Top Row: Invoice No & Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.invoiceNumberPill, !isDarkMode && { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="document-text-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={[styles.invoiceNumberText, !isDarkMode && { color: '#475569' }]}>
                      {item.invoiceNumber || 'INVOICE'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {item.status || 'PAID'}
                    </Text>
                  </View>
                </View>

                {/* Course / Program Title */}
                <Text style={[styles.courseTitle, !isDarkMode && { color: '#0F172A' }]} numberOfLines={2}>
                  {courseOrProg}
                </Text>

                {/* Amount Row */}
                <View style={styles.amountRow}>
                  <Text style={styles.currencyPrefix}>{item.currency || 'INR'}</Text>
                  <Text style={[styles.amountValue, !isDarkMode && { color: '#0F172A' }]}>
                    {Number(item.amount || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>

                {/* Payment Metadata Grid */}
                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color="#64748B" style={{ marginRight: 5 }} />
                    <Text style={styles.metaLabel}>Date:</Text>
                    <Text style={[styles.metaValue, !isDarkMode && { color: '#334155' }]}>
                      {formatDate(item.createdAt || item.paymentDate)}
                    </Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Ionicons name="card-outline" size={14} color="#64748B" style={{ marginRight: 5 }} />
                    <Text style={styles.metaLabel}>Method:</Text>
                    <Text style={[styles.metaValue, !isDarkMode && { color: '#334155' }]}>
                      {item.paymentMethod || 'Online'}
                    </Text>
                  </View>
                </View>

                {/* Payment ID Footer */}
                {item.id ? (
                  <View style={styles.idRow}>
                    <Text style={styles.idLabel}>Payment ID:</Text>
                    <Text style={[styles.idValue, !isDarkMode && { color: '#64748B' }]} numberOfLines={1}>
                      {item.id}
                    </Text>
                  </View>
                ) : null}

                {/* Invoice Action Button */}
                <View style={styles.cardActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.invoiceBtn,
                      !isDarkMode && { backgroundColor: '#F0F9FF' },
                      isGenerating && styles.invoiceBtnDisabled,
                    ]}
                    onPress={() => handleGenerateInvoice(item)}
                    disabled={isGenerating}
                    activeOpacity={0.8}
                  >
                    {isGenerating ? (
                      <>
                        <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 6 }} />
                        <Text style={styles.invoiceBtnText}>Generating Invoice...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={16} color="#38BDF8" style={{ marginRight: 6 }} />
                        <Text style={styles.invoiceBtnText}>Download Invoice</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Pagination Controls */}
          {meta.totalPages && meta.totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
                onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={16} color={currentPage <= 1 ? '#64748B' : '#FFFFFF'} />
                <Text style={[styles.pageBtnText, currentPage <= 1 && styles.pageBtnTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>

              <Text style={styles.pageIndicatorText}>
                Page {currentPage} of {meta.totalPages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageBtn,
                  currentPage >= (meta.totalPages || 1) && styles.pageBtnDisabled,
                ]}
                onPress={() => setCurrentPage((p) => Math.min(meta.totalPages || 1, p + 1))}
                disabled={currentPage >= (meta.totalPages || 1)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.pageBtnText,
                    currentPage >= (meta.totalPages || 1) && styles.pageBtnTextDisabled,
                  ]}
                >
                  Next
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={currentPage >= (meta.totalPages || 1) ? '#64748B' : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backButton: {
    padding: 6,
    marginRight: 12,
  },
  headerEyebrow: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  refreshIconBtn: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 16,
  },
  paymentCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  invoiceNumberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  invoiceNumberText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  courseTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  currencyPrefix: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  amountValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 12,
    marginRight: 4,
  },
  metaValue: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  idLabel: {
    color: '#475569',
    fontSize: 11,
    marginRight: 6,
  },
  idValue: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  cardActionRow: {
    marginTop: 6,
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 10,
  },
  invoiceBtnDisabled: {
    opacity: 0.6,
  },
  invoiceBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pageBtnDisabled: {
    opacity: 0.4,
    borderColor: '#1E293B',
  },
  pageBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  pageBtnTextDisabled: {
    color: '#64748B',
  },
  pageIndicatorText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  errorIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  browseCoursesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browseCoursesBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
