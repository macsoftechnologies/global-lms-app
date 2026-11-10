import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { DashboardService } from '../../src/services/dashboardService';
import { AuthStorage, AuthSession } from '../../src/services/authStorage';
import {
  CertificateItem,
  StudentEnrollmentItem,
} from '../../src/types';

export default function StudentCertificatesScreen() {
  const { isDarkMode } = useTheme();
  const [currentUser, setCurrentUser] = useState<AuthSession['user'] | null>(null);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<StudentEnrollmentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal 1: Certificate Details & Verification (GET /certificates/:id)
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Modal 2: Request Certificate (POST /certificates/request)
  const [isRequestModalVisible, setIsRequestModalVisible] = useState<boolean>(false);
  const [selectedCourseForRequest, setSelectedCourseForRequest] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);

  // 1. Load Authenticated User Profile
  useEffect(() => {
    let isMounted = true;
    AuthStorage.getUser().then((user) => {
      if (isMounted && user) {
        setCurrentUser(user);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Issued Certificates from Backend (GET /certificates/my-certificates)
  const fetchCertificatesData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setErrorMessage(null);

    try {
      const [certRes, enrollRes] = await Promise.allSettled([
        DashboardService.getMyCertificates(),
        DashboardService.getStudentEnrollments('me'),
      ]);

      if (certRes.status === 'fulfilled' && certRes.value.success) {
        setCertificates(certRes.value.data || []);
      } else if (certRes.status === 'fulfilled' && !certRes.value.success) {
        setErrorMessage(
          certRes.value.error || 'Failed to retrieve certificates from backend server.'
        );
      } else if (certRes.status === 'rejected') {
        setErrorMessage('Network connection error while loading certificates.');
      }

      if (enrollRes.status === 'fulfilled' && enrollRes.value.success) {
        setEnrolledCourses(enrollRes.value.data || []);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred while loading certificates.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) fetchCertificatesData(true);
    });
    return () => {
      isMounted = false;
    };
  }, [fetchCertificatesData]);

  // Re-fetch on focus
  useFocusEffect(
    useCallback(() => {
      fetchCertificatesData(false);
    }, [fetchCertificatesData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCertificatesData(false);
  };

  // 3. Open Detailed Certificate Info (GET /certificates/:id)
  const handleViewCertificate = async (item: CertificateItem) => {
    const certId = item.id || item._id;
    if (!certId) {
      setSelectedCertificate(item);
      return;
    }

    setIsLoadingDetails(true);
    setSelectedCertificate(item);

    try {
      const res = await DashboardService.getCertificateById(certId);
      if (res.success && res.data) {
        setSelectedCertificate(res.data);
      }
    } catch {
      // Keep initial item if individual fetch fails
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // 4. Download / Open Certificate Document
  const handleDownloadCertificate = async (item: CertificateItem) => {
    const url =
      item.certificateUrl ||
      item.pdfUrl ||
      item.fileUrl ||
      item.downloadUrl;

    if (!url) {
      Alert.alert(
        'Document Unavailable',
        'The certificate PDF is currently being generated or has not been uploaded to the server yet. Please check back shortly.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url).catch(() => true);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Certificate Ready',
          `Certificate URL:\n${url}`,
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert('Download Error', 'Could not open certificate URL in browser.');
    }
  };

  // 5. Submit Certificate Request (POST /certificates/request)
  const handleSubmitCertificateRequest = async () => {
    if (!selectedCourseForRequest) {
      Alert.alert('Selection Required', 'Please select a completed course to request its certificate.');
      return;
    }

    // Check if certificate already exists for this course
    const existingCert = certificates.find((c) => {
      const cCourseId = typeof c.courseId === 'object' ? c.courseId?.id || c.courseId?._id : c.courseId;
      return cCourseId === selectedCourseForRequest;
    });

    if (existingCert) {
      Alert.alert(
        'Duplicate Request',
        `A certificate for this course is already ${existingCert.status}. Duplicate requests cannot be created.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const res = await DashboardService.requestCertificate(selectedCourseForRequest);
      if (res.success) {
        Alert.alert(
          'Request Submitted',
          res.data?.message || 'Certificate requested successfully! Your request has been queued for registrar approval.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsRequestModalVisible(false);
                setSelectedCourseForRequest(null);
                fetchCertificatesData(false);
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Request Failed',
          res.error || 'Failed to submit certificate request. Please verify course completion eligibility.'
        );
      }
    } catch (err: unknown) {
      Alert.alert(
        'Submission Error',
        err instanceof Error ? err.message : 'Network error submitting certificate request.'
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    const s = (status || 'ISSUED').toUpperCase();
    let bg = '#DCFCE7';
    let textCol = '#059669';
    let label = 'Issued';

    if (s.includes('PEND') || s === 'REQUESTED') {
      bg = '#FEF3C7';
      textCol = '#D97706';
      label = 'Pending';
    } else if (s.includes('PROCESS')) {
      bg = '#E0F2FE';
      textCol = '#0284C7';
      label = 'Processing';
    } else if (s.includes('REJECT')) {
      bg = '#FEE2E2';
      textCol = '#DC2626';
      label = 'Rejected';
    } else if (s.includes('APPROV') || s === 'ISSUED') {
      bg = '#DCFCE7';
      textCol = '#059669';
      label = 'Issued';
    } else {
      label = status;
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <View style={[styles.statusDot, { backgroundColor: textCol }]} />
        <Text style={[styles.statusBadgeText, { color: textCol }]}>{label}</Text>
      </View>
    );
  };

  // Format Date Helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Eligible Courses for Request Modal
  const eligibleCourses = useMemo(() => {
    return enrolledCourses.map((e) => {
      const courseId = e.courseId || e.course?.id || e.id;
      const title = e.course?.title || e.courseTitle || 'Academic Subject';
      const progress = e.progressPercentage ?? (e.status === 'COMPLETED' ? 100 : 0);
      const isComplete = progress >= 100 || e.status === 'COMPLETED';

      // Check if already requested / issued
      const cert = certificates.find((c) => {
        const cCourseId = typeof c.courseId === 'object' ? c.courseId?.id || c.courseId?._id : c.courseId;
        return cCourseId === courseId;
      });

      return {
        courseId,
        title,
        progress,
        isComplete,
        existingStatus: cert ? cert.status : null,
      };
    });
  }, [enrolledCourses, certificates]);

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top']}>
      {/* 1. TOP HEADER */}
      <View style={[styles.headerBar, isDarkMode && { backgroundColor: '#111827', borderBottomColor: '#1F2937' }]}>
        <TouchableOpacity
          style={[styles.backButton, isDarkMode && { backgroundColor: '#1E293B' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Text style={[styles.headerTitle, isDarkMode && { color: '#F8FAFC' }]}>My Certificates</Text>
          <Text style={[styles.headerSubtitle, isDarkMode && { color: '#94A3B8' }]}>
            View and manage your earned certificates.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.requestHeaderBtn}
          onPress={() => setIsRequestModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.requestHeaderBtnText}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* 2. BODY CONTENT */}
      <ScrollView
        style={[styles.scrollContainer, isDarkMode && { backgroundColor: '#0B0F19' }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#4F46E5" />
        }
      >
        {/* Count & Status Summary Bar */}
        <View style={[styles.summaryCard, isDarkMode && { backgroundColor: '#161F30', borderColor: '#283548' }]}>
          <View style={styles.summaryLeftCol}>
            <View style={[styles.summaryIconBox, isDarkMode && { backgroundColor: 'rgba(99, 102, 241, 0.18)' }]}>
              <Ionicons name="ribbon" size={24} color="#6366F1" />
            </View>
            <View>
              <Text style={[styles.summaryCount, isDarkMode && { color: '#F8FAFC' }]}>
                {certificates.length} {certificates.length === 1 ? 'Certificate' : 'Certificates'}
              </Text>
              <Text style={[styles.summarySub, isDarkMode && { color: '#94A3B8' }]}>
                {certificates.filter((c) => (c.status || '').toUpperCase() === 'ISSUED').length} Accredited & Issued
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.checkEligibleBtn, isDarkMode && { backgroundColor: 'rgba(99, 102, 241, 0.18)' }]}
            onPress={() => setIsRequestModalVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={[styles.checkEligibleBtnText, isDarkMode && { color: '#818CF8' }]}>Check Eligibility</Text>
            <Ionicons name="chevron-forward" size={14} color={isDarkMode ? '#818CF8' : '#4F46E5'} />
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Fetching authenticated certificate records...</Text>
          </View>
        ) : errorMessage ? (
          /* Error State */
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
            <Text style={styles.errorTitle}>Failed to Load Certificates</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchCertificatesData(true)}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        ) : certificates.length === 0 ? (
          /* Empty State (strictly matching requirements) */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="ribbon-outline" size={44} color="#7C3AED" />
            </View>
            <Text style={styles.emptyTitle}>No certificates available yet.</Text>
            <Text style={styles.emptyDescription}>
              Complete your enrolled degree courses and score passing grades on final examinations to earn accredited certificates of completion.
            </Text>

            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setIsRequestModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="school-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionBtnText}>Check Course Eligibility</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Certificates List */
          <View style={styles.cardsList}>
            {certificates.map((cert, index) => {
              const certId = cert.id || cert._id || `cert_${index}`;
              const title = cert.title || cert.courseTitle || 'Certificate of Completion';
              const courseOrProgram = cert.courseTitle || cert.programName || 'Theological Studies Program';
              const certNo = cert.certificateNumber || cert.certificateNo || cert.serialNumber || certId;
              const issueDate = formatDate(cert.issueDate || cert.issuedAt || cert.createdAt);
              const hasUrl = Boolean(cert.certificateUrl || cert.pdfUrl || cert.fileUrl || cert.downloadUrl);

              return (
                <View key={certId} style={styles.certificateCard}>
                  {/* Left Accent Bar */}
                  <View
                    style={[
                      styles.cardAccentBar,
                      {
                        backgroundColor:
                          cert.status === 'PENDING'
                            ? '#F59E0B'
                            : cert.status === 'PROCESSING'
                            ? '#0284C7'
                            : '#10B981',
                      },
                    ]}
                  />

                  <View style={styles.cardMainContent}>
                    {/* Top Row: Ribbon Icon, Title & Status */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardIconBox}>
                        <Ionicons name="ribbon" size={24} color="#D97706" />
                      </View>
                      <View style={styles.cardHeaderTitles}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {title}
                        </Text>
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                          {courseOrProgram}
                        </Text>
                      </View>
                      {renderStatusBadge(cert.status)}
                    </View>

                    {/* Metadata Row: ID & Issue Date */}
                    <View style={styles.cardMetaRow}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>CERTIFICATE NO</Text>
                        <Text style={styles.metaValue} numberOfLines={1}>
                          {certNo}
                        </Text>
                      </View>

                      <View style={styles.metaDivider} />

                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>ISSUE DATE</Text>
                        <Text style={styles.metaValue}>{issueDate}</Text>
                      </View>
                    </View>

                    {/* Bottom Actions Row */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.viewActionBtn}
                        onPress={() => handleViewCertificate(cert)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="eye-outline" size={16} color="#4F46E5" style={{ marginRight: 4 }} />
                        <Text style={styles.viewActionBtnText}>View Details</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.downloadActionBtn,
                          !hasUrl && styles.downloadActionBtnDisabled,
                        ]}
                        onPress={() => handleDownloadCertificate(cert)}
                        disabled={!hasUrl}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name="download-outline"
                          size={16}
                          color={hasUrl ? '#FFFFFF' : '#94A3B8'}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.downloadActionBtnText,

                            
                            !hasUrl && styles.downloadActionBtnTextDisabled,
                          ]}
                        >
                          Download
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Footer Copyright matching Global LMS branding */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            © 2026 Cotr Global Online. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: CERTIFICATE DETAILS & VERIFICATION (GET /certificates/:id)       */}
      {/* ========================================================================= */}
      <Modal visible={!!selectedCertificate} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.cardIconBox, { backgroundColor: '#FEF3C7', marginRight: 10 }]}>
                  <Ionicons name="ribbon" size={22} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    Certificate Details
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Official Academic Credential
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedCertificate(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isLoadingDetails ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>
                  Loading certificate verification details...
                </Text>
              </View>
            ) : selectedCertificate ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollBody}>
                {/* Certificate Banner */}
                <View style={styles.certHeroBanner}>
                  <Text style={styles.certHeroEyebrow}>COTR GLOBAL ONLINE</Text>
                  <Text style={styles.certHeroTitle}>
                    {selectedCertificate.title || selectedCertificate.courseTitle || 'Certificate of Completion'}
                  </Text>
                  <Text style={styles.certHeroSubtitle}>
                    Awarded to{' '}
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                      {selectedCertificate.studentName || currentUser?.fullName || 'Enrolled Student'}
                    </Text>
                  </Text>
                  <View style={{ marginTop: 10 }}>
                    {renderStatusBadge(selectedCertificate.status)}
                  </View>
                </View>

                {/* Detail Key-Value Rows */}
                <View style={styles.modalDetailsList}>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Certificate ID</Text>
                    <Text style={styles.modalDetailValue} selectable>
                      {selectedCertificate.certificateNumber || selectedCertificate.id}
                    </Text>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Course / Program</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedCertificate.courseTitle || selectedCertificate.programName || '—'}
                    </Text>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Issue Date</Text>
                    <Text style={styles.modalDetailValue}>
                      {formatDate(selectedCertificate.issueDate || selectedCertificate.issuedAt || selectedCertificate.createdAt)}
                    </Text>
                  </View>

                  {selectedCertificate.grade && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Final Grade</Text>
                      <Text style={[styles.modalDetailValue, { color: '#059669', fontWeight: '700' }]}>
                        {selectedCertificate.grade} {selectedCertificate.score ? `(${selectedCertificate.score}%)` : ''}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Accreditation</Text>
                    <Text style={styles.modalDetailValue}>ATA Accredited</Text>
                  </View>

                  {selectedCertificate.verificationCode && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Verification Code</Text>
                      <Text style={[styles.modalDetailValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]} selectable>
                        {selectedCertificate.verificationCode}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Document Action Button */}
                {selectedCertificate.certificateUrl ? (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: '#4F46E5' }]}
                    onPress={() => handleDownloadCertificate(selectedCertificate)}
                  >
                    <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalActionBtnText}>Download PDF Document</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pendingDocBox}>
                    <Ionicons name="time-outline" size={20} color="#64748B" style={{ marginRight: 8 }} />
                    <Text style={styles.pendingDocText}>
                      Digital PDF document is processing by the registrar.
                    </Text>
                  </View>
                )}
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={styles.modalCloseFooterBtn}
              onPress={() => setSelectedCertificate(null)}
            >
              <Text style={styles.modalCloseFooterText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: REQUEST CERTIFICATE (POST /certificates/request)                 */}
      {/* ========================================================================= */}
      <Modal visible={isRequestModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.cardIconBox, { backgroundColor: '#EEF2FF', marginRight: 10 }]}>
                  <Ionicons name="school" size={22} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Request Course Certificate</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Select an eligible completed course
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsRequestModalVisible(false);
                  setSelectedCourseForRequest(null);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollBody}>
              <Text style={styles.requestInstructions}>
                Certificates can be requested for courses that you have completed with 100% learning progress. Select a course below to submit your issuance request:
              </Text>

              {eligibleCourses.length === 0 ? (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <Ionicons name="book-outline" size={38} color="#94A3B8" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                    No Enrolled Courses Found
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    Enroll in academic courses to start earning course completion certificates.
                  </Text>
                </View>
              ) : (
                eligibleCourses.map((c) => {
                  const isSelected = selectedCourseForRequest === c.courseId;
                  const alreadyRequested = Boolean(c.existingStatus);

                  return (
                    <TouchableOpacity
                      key={c.courseId}
                      style={[
                        styles.courseSelectCard,
                        isSelected && styles.courseSelectCardActive,
                        alreadyRequested && styles.courseSelectCardDisabled,
                      ]}
                      onPress={() => {
                        if (!alreadyRequested) {
                          setSelectedCourseForRequest(c.courseId);
                        }
                      }}
                      disabled={alreadyRequested}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
                        <Ionicons
                          name={
                            alreadyRequested
                              ? 'checkmark-done-circle'
                              : isSelected
                              ? 'radio-button-on'
                              : 'radio-button-off'
                          }
                          size={20}
                          color={
                            alreadyRequested
                              ? '#10B981'
                              : isSelected
                              ? '#4F46E5'
                              : '#94A3B8'
                          }
                          style={{ marginRight: 10, marginTop: 2 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.courseSelectTitle}>{c.title}</Text>
                          <Text style={styles.courseSelectMeta}>
                            Progress: {c.progress}% • {c.isComplete ? 'Ready for Certificate' : 'Incomplete'}
                          </Text>
                        </View>
                      </View>

                      {alreadyRequested ? (
                        <View style={[styles.statusBadge, { backgroundColor: '#EEF2FF' }]}>
                          <Text style={[styles.statusBadgeText, { color: '#4F46E5' }]}>
                            {c.existingStatus}
                          </Text>
                        </View>
                      ) : !c.isComplete ? (
                        <View style={[styles.statusBadge, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.statusBadgeText, { color: '#64748B' }]}>In Progress</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Submit Request Button */}
            <TouchableOpacity
              style={[
                styles.modalActionBtn,
                { backgroundColor: '#4F46E5' },
                (!selectedCourseForRequest || isSubmittingRequest) && styles.modalActionBtnDisabled,
              ]}
              onPress={handleSubmitCertificateRequest}
              disabled={!selectedCourseForRequest || isSubmittingRequest}
            >
              {isSubmittingRequest ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.modalActionBtnText}>Submit Certificate Request</Text>
                </>
              )}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  requestHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  requestHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  summarySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkEligibleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  checkEligibleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    marginRight: 2,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginVertical: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991B1B',
    marginTop: 8,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardsList: {
    gap: 14,
  },
  certificateCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardAccentBar: {
    width: 5,
  },
  cardMainContent: {
    flex: 1,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeaderTitles: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  viewActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  downloadActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
  },
  downloadActionBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  downloadActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  downloadActionBtnTextDisabled: {
    color: '#94A3B8',
  },
  footerContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  // MODAL STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollBody: {
    marginBottom: 14,
  },
  certHeroBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  certHeroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  certHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  certHeroSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  modalDetailsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  modalDetailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  modalDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    marginVertical: 4,
  },
  modalActionBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pendingDocBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  pendingDocText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 17,
  },
  modalCloseFooterBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  modalCloseFooterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  // Request Modal Specific Styles
  requestInstructions: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 14,
  },
  courseSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  courseSelectCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  courseSelectCardDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.75,
  },
  courseSelectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  courseSelectMeta: {
    fontSize: 11,
    color: '#64748B',
  },
});
