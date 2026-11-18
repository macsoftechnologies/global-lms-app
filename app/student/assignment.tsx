import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { DashboardService } from '../../src/services/dashboardService';
import { useTheme } from '../../src/context/ThemeContext';
import { CourseAssignmentItem, AssignmentSubmissionItem } from '../../src/types';

function formatDueDate(raw?: string): string {
  if (!raw) return 'No due date';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Ready to upload';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentAssignmentScreen() {
  const { isDarkMode } = useTheme();
  const params = useLocalSearchParams<{
    courseId?: string;
    title?: string;
    assignmentId?: string;
  }>();

  const courseId = params.courseId || '';
  const courseTitle = params.title || 'Course Assignments';

  const [assignments, setAssignments] = useState<CourseAssignmentItem[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, AssignmentSubmissionItem | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active assignment modal for submitting / viewing details
  const [activeAssignment, setActiveAssignment] = useState<CourseAssignmentItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Upload file state
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size?: number;
    uri: string;
    type?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessBanner, setUploadSuccessBanner] = useState<string | null>(null);

  const fetchAssignmentsAndSubmissions = useCallback(
    async (showLoadingSpinner = true) => {
      if (!courseId) {
        setIsLoading(false);
        setIsRefreshing(false);
        setError('Course identifier is missing.');
        return;
      }

      if (showLoadingSpinner) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const resp = await DashboardService.getCourseAssignments(courseId);
        if (!resp.success) {
          setError(resp.error || 'Failed to load course assignments.');
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }

        const rawList = resp.data || [];
        // Filter published assignments matching website rule
        const published = rawList.filter(
          (a) => a.isPublished !== false && a.status !== 'DRAFT'
        );
        setAssignments(published);

        // Fetch submissions per assignment in parallel
        const submissionMap: Record<string, AssignmentSubmissionItem | null> = {};
        await Promise.all(
          published.map(async (assignment) => {
            const aId = assignment._id || assignment.id;
            if (!aId) return;
            try {
              const subResp = await DashboardService.getAssignmentSubmissions(courseId, aId);
              if (subResp.success && Array.isArray(subResp.data) && subResp.data.length > 0) {
                // Latest submission is the first item
                submissionMap[aId] = subResp.data[0];
              } else {
                submissionMap[aId] = null;
              }
            } catch {
              submissionMap[aId] = null;
            }
          })
        );
        setSubmissions(submissionMap);

        // If assignmentId was passed via params, open that assignment modal directly
        if (params.assignmentId) {
          const match = published.find(
            (a) => (a._id || a.id) === params.assignmentId
          );
          if (match) {
            setActiveAssignment(match);
            setIsModalVisible(true);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Network error loading assignments.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [courseId, params.assignmentId]
  );

  useEffect(() => {
    Promise.resolve().then(() => {
      void fetchAssignmentsAndSubmissions(true);
    });
  }, [fetchAssignmentsAndSubmissions]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchAssignmentsAndSubmissions(false);
  }, [fetchAssignmentsAndSubmissions]);

  const handleOpenAssignmentModal = (assignment: CourseAssignmentItem) => {
    setActiveAssignment(assignment);
    setSelectedFile(null);
    setUploadSuccessBanner(null);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    if (isUploading) return;
    setIsModalVisible(false);
    setActiveAssignment(null);
    setSelectedFile(null);
    setUploadSuccessBanner(null);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/zip',
          'application/x-zip-compressed',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          name: file.name,
          size: file.size,
          uri: file.uri,
          type: file.mimeType,
        });
        setUploadSuccessBanner(null);
      }
    } catch {
      Alert.alert('Error', 'Unable to access document picker.');
    }
  };

  const handleSubmitFile = async () => {
    if (!activeAssignment || !courseId) return;
    if (!selectedFile) {
      Alert.alert('File Required', 'Please select a PDF, Word DOC, or ZIP file to submit.');
      return;
    }

    const aId = activeAssignment._id || activeAssignment.id;
    if (!aId) {
      Alert.alert('Error', 'Assignment identifier is missing.');
      return;
    }

    setIsUploading(true);
    setUploadSuccessBanner(null);

    try {
      const resp = await DashboardService.submitAssignmentFile(courseId, aId, selectedFile);
      if (resp.success) {
        setUploadSuccessBanner('Assignment submitted successfully!');
        setSelectedFile(null);
        // Refresh submissions in background
        void fetchAssignmentsAndSubmissions(false);
      } else {
        Alert.alert('Submission Error', resp.error || 'Failed to upload assignment file.');
      }
    } catch (err: unknown) {
      Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to submit file.');
    } finally {
      setIsUploading(false);
    }
  };

  const activeSubmission = useMemo(() => {
    if (!activeAssignment) return null;
    const aId = activeAssignment._id || activeAssignment.id;
    return aId ? submissions[aId] : null;
  }, [activeAssignment, submissions]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDarkMode ? '#090D16' : '#F8FAFC' },
      ]}
    >
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
            borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Back to course"
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDarkMode ? '#F8FAFC' : '#0F172A'}
          />
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.badge}>Course Assignments</Text>
          <Text
            style={[styles.headerTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}
            numberOfLines={1}
          >
            {courseTitle}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshIconBtn}
          onPress={handleRefresh}
          disabled={isLoading || isRefreshing}
          accessibilityLabel="Refresh assignments"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#6366F1" />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={20}
              color={isDarkMode ? '#94A3B8' : '#64748B'}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Body */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Loading assignments...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            Unable to Load Assignments
          </Text>
          <Text style={[styles.errorSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => fetchAssignmentsAndSubmissions(true)}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : assignments.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#6366F1"
            />
          }
        >
          <View
            style={[
              styles.emptyIconBox,
              { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' },
            ]}
          >
            <Ionicons name="document-text-outline" size={44} color="#6366F1" />
          </View>
          <Text style={[styles.emptyTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            No Assignments Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            There are no assignments published for this course yet.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#6366F1"
            />
          }
        >
          <Text
            style={[
              styles.sectionHeading,
              { color: isDarkMode ? '#E2E8F0' : '#1E293B' },
            ]}
          >
            Assignments ({assignments.length})
          </Text>

          {assignments.map((assignment, index) => {
            const aId = assignment._id || assignment.id;
            const sub = aId ? submissions[aId] : null;
            const isGraded = sub !== null && sub !== undefined && sub.score !== undefined;
            const isSubmitted = sub !== null && sub !== undefined;

            return (
              <View
                key={aId || `asgn_${index}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                  },
                ]}
              >
                {/* Header row with Title & Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                      ]}
                    >
                      {assignment.title}
                    </Text>
                    {assignment.dueDate ? (
                      <View style={styles.dueRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color={isDarkMode ? '#94A3B8' : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.dueText,
                            { color: isDarkMode ? '#94A3B8' : '#64748B' },
                          ]}
                        >
                          Due: {formatDueDate(assignment.dueDate)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Status Badge */}
                  {isGraded ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="checkmark-done" size={12} color="#15803D" />
                      <Text style={[styles.statusBadgeText, { color: '#15803D' }]}>
                        GRADED
                      </Text>
                    </View>
                  ) : isSubmitted ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#DBEAFE' }]}>
                      <Ionicons name="time-outline" size={12} color="#1D4ED8" />
                      <Text style={[styles.statusBadgeText, { color: '#1D4ED8' }]}>
                        SUBMITTED
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="alert-circle-outline" size={12} color="#B45309" />
                      <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>
                        PENDING
                      </Text>
                    </View>
                  )}
                </View>

                {/* Description excerpt */}
                {assignment.description ? (
                  <Text
                    style={[
                      styles.cardDescription,
                      { color: isDarkMode ? '#94A3B8' : '#475569' },
                    ]}
                    numberOfLines={3}
                  >
                    {assignment.description}
                  </Text>
                ) : null}

                {/* Meta stats: Max marks & Score */}
                <View
                  style={[
                    styles.metaBar,
                    {
                      backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                    },
                  ]}
                >
                  <View style={styles.metaStat}>
                    <Text
                      style={[
                        styles.metaLabel,
                        { color: isDarkMode ? '#64748B' : '#64748B' },
                      ]}
                    >
                      Max Score
                    </Text>
                    <Text
                      style={[
                        styles.metaValue,
                        { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                      ]}
                    >
                      {assignment.totalMarks ?? '—'}
                    </Text>
                  </View>

                  <View style={styles.metaStat}>
                    <Text
                      style={[
                        styles.metaLabel,
                        { color: isDarkMode ? '#64748B' : '#64748B' },
                      ]}
                    >
                      Your Score
                    </Text>
                    <Text
                      style={[
                        styles.metaValue,
                        {
                          color: isGraded
                            ? '#10B981'
                            : isSubmitted
                            ? '#3B82F6'
                            : isDarkMode
                            ? '#94A3B8'
                            : '#64748B',
                        },
                      ]}
                    >
                      {isGraded
                        ? `${sub.score} / ${assignment.totalMarks ?? '—'}`
                        : isSubmitted
                        ? 'Under Review'
                        : '—'}
                    </Text>
                  </View>
                </View>

                {/* Card Action Button */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    isGraded
                      ? { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5', borderWidth: 1, borderColor: '#10B981' }
                      : isSubmitted
                      ? { backgroundColor: isDarkMode ? '#1E3A5F' : '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6' }
                      : { backgroundColor: '#6366F1' },
                  ]}
                  onPress={() => handleOpenAssignmentModal(assignment)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      isGraded
                        ? { color: isDarkMode ? '#34D399' : '#059669' }
                        : isSubmitted
                        ? { color: isDarkMode ? '#60A5FA' : '#2563EB' }
                        : { color: '#FFFFFF' },
                    ]}
                  >
                    {isGraded
                      ? 'View Grade & Feedback'
                      : isSubmitted
                      ? 'Resubmit / Details'
                      : 'Submit Assignment'}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={15}
                    color={
                      isGraded
                        ? isDarkMode
                          ? '#34D399'
                          : '#059669'
                        : isSubmitted
                        ? isDarkMode
                          ? '#60A5FA'
                          : '#2563EB'
                        : '#FFFFFF'
                    }
                  />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Assignment Submit / Details Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalDialog,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
              },
            ]}
          >
            {/* Modal Header */}
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0' },
              ]}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text
                  style={[
                    styles.modalHeaderTitle,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                  numberOfLines={1}
                >
                  {activeAssignment?.title || 'Assignment Details'}
                </Text>
                <Text
                  style={[
                    styles.modalHeaderSubtitle,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Max Marks: {activeAssignment?.totalMarks ?? '—'} • Due:{' '}
                  {formatDueDate(activeAssignment?.dueDate)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={handleCloseModal}
                disabled={isUploading}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={isDarkMode ? '#94A3B8' : '#64748B'}
                />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Instructions / Description */}
              {activeAssignment?.description || activeAssignment?.instructions ? (
                <View
                  style={[
                    styles.infoBox,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoBoxTitle,
                      { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                    ]}
                  >
                    Instructions & Guidelines
                  </Text>
                  <Text
                    style={[
                      styles.infoBoxContent,
                      { color: isDarkMode ? '#CBD5E1' : '#334155' },
                    ]}
                  >
                    {activeAssignment.instructions || activeAssignment.description}
                  </Text>
                </View>
              ) : null}

              {/* Previous Submission Status */}
              {activeSubmission ? (
                <View
                  style={[
                    styles.submissionHistoryBox,
                    {
                      backgroundColor:
                        activeSubmission.score !== undefined
                          ? isDarkMode
                            ? '#064E3B'
                            : '#F0FDF4'
                          : isDarkMode
                          ? '#1E3A5F'
                          : '#EFF6FF',
                      borderColor:
                        activeSubmission.score !== undefined
                          ? '#10B981'
                          : '#3B82F6',
                    },
                  ]}
                >
                  <View style={styles.subHistoryHeader}>
                    <Ionicons
                      name={
                        activeSubmission.score !== undefined
                          ? 'ribbon-outline'
                          : 'cloud-done-outline'
                      }
                      size={20}
                      color={
                        activeSubmission.score !== undefined ? '#10B981' : '#3B82F6'
                      }
                    />
                    <Text
                      style={[
                        styles.subHistoryTitle,
                        {
                          color:
                            activeSubmission.score !== undefined
                              ? isDarkMode
                                ? '#34D399'
                                : '#15803D'
                              : isDarkMode
                              ? '#93C5FD'
                              : '#1D4ED8',
                        },
                      ]}
                    >
                      {activeSubmission.score !== undefined
                        ? `Graded: ${activeSubmission.score} / ${activeAssignment?.totalMarks ?? '—'}`
                        : 'Current Submission Under Review'}
                    </Text>
                  </View>

                  {activeSubmission.fileName ? (
                    <Text
                      style={[
                        styles.subHistoryDetail,
                        { color: isDarkMode ? '#E2E8F0' : '#1E293B' },
                      ]}
                    >
                      File: {activeSubmission.fileName}
                    </Text>
                  ) : null}

                  {activeSubmission.feedback ? (
                    <View style={styles.feedbackRow}>
                      <Text
                        style={[
                          styles.feedbackLabel,
                          { color: isDarkMode ? '#A7F3D0' : '#065F46' },
                        ]}
                      >
                        Instructor Feedback:
                      </Text>
                      <Text
                        style={[
                          styles.feedbackText,
                          { color: isDarkMode ? '#E2E8F0' : '#1E293B' },
                        ]}
                      >
                        {activeSubmission.feedback}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Upload Success Banner */}
              {uploadSuccessBanner ? (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.successBannerText}>{uploadSuccessBanner}</Text>
                </View>
              ) : null}

              {/* Document Upload Section */}
              <View
                style={[
                  styles.uploadSection,
                  {
                    backgroundColor: isDarkMode ? '#151E2E' : '#FFFFFF',
                    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.uploadSectionTitle,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {activeSubmission ? 'Upload New File to Resubmit' : 'Upload Submission Document'}
                </Text>
                <Text
                  style={[
                    styles.uploadSectionDesc,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Accepted formats: PDF, Word (DOC, DOCX), or ZIP file.
                </Text>

                {!selectedFile ? (
                  <TouchableOpacity
                    style={[
                      styles.pickZone,
                      {
                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                        borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                      },
                    ]}
                    onPress={handlePickDocument}
                    disabled={isUploading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cloud-upload-outline" size={36} color="#6366F1" />
                    <Text
                      style={[
                        styles.pickZoneTitle,
                        { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                      ]}
                    >
                      Tap to select file
                    </Text>
                    <Text
                      style={[
                        styles.pickZoneHint,
                        { color: isDarkMode ? '#64748B' : '#94A3B8' },
                      ]}
                    >
                      Choose PDF, DOCX, or ZIP from storage
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      styles.selectedBox,
                      {
                        backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF',
                        borderColor: '#6366F1',
                      },
                    ]}
                  >
                    <Ionicons name="document-text" size={28} color="#6366F1" />
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text
                        style={[
                          styles.selectedFileName,
                          { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                        ]}
                        numberOfLines={1}
                      >
                        {selectedFile.name}
                      </Text>
                      <Text
                        style={[
                          styles.selectedFileSize,
                          { color: isDarkMode ? '#94A3B8' : '#64748B' },
                        ]}
                      >
                        {formatFileSize(selectedFile.size)}
                      </Text>
                    </View>
                    {!isUploading && (
                      <TouchableOpacity onPress={() => setSelectedFile(null)}>
                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Submit Action Button */}
                <TouchableOpacity
                  style={[
                    styles.modalSubmitBtn,
                    {
                      backgroundColor:
                        !selectedFile || isUploading ? '#A5B4FC' : '#6366F1',
                    },
                  ]}
                  onPress={handleSubmitFile}
                  disabled={!selectedFile || isUploading}
                  activeOpacity={0.85}
                >
                  {isUploading ? (
                    <View style={styles.uploadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.modalSubmitBtnText}>Uploading...</Text>
                    </View>
                  ) : (
                    <View style={styles.uploadingRow}>
                      <Ionicons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.modalSubmitBtnText}>
                        {activeSubmission ? 'Submit Revised File' : 'Submit Assignment'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  titleCol: {
    flex: 1,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  refreshIconBtn: {
    padding: 6,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 18,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dueText: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  metaBar: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 12,
    justifyContent: 'space-around',
  },
  metaStat: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalDialog: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '90%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalScroll: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  infoBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoBoxContent: {
    fontSize: 13,
    lineHeight: 19,
  },
  submissionHistoryBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  subHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  subHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  subHistoryDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  feedbackRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 6,
  },
  feedbackLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackText: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  successBannerText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  uploadSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  uploadSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  uploadSectionDesc: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  pickZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickZoneTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  pickZoneHint: {
    fontSize: 11,
    marginTop: 2,
  },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  selectedFileName: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectedFileSize: {
    fontSize: 11,
    marginTop: 2,
  },
  modalSubmitBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
