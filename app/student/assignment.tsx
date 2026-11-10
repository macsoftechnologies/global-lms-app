import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LmsAuthService } from '../../src/services/lmsAuthService';

export default function StudentAssignmentScreen() {
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size?: number;
    uri: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          name: file.name,
          size: file.size,
          uri: file.uri,
        });
      }
    } catch {
      Alert.alert('Error', 'Unable to access document picker.');
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedFile) {
      Alert.alert('File Required', 'Please select your assignment file to submit.');
      return;
    }

    setIsUploading(true);
    try {
      const response = await LmsAuthService.uploadAuthenticatedFile(
        {
          uri: selectedFile.uri,
          name: selectedFile.name,
          size: selectedFile.size,
        },
        'submissions'
      );

      if (response.success) {
        setIsSubmitted(true);
        Alert.alert('Submitted!', 'Your assignment document was successfully submitted to faculty.');
      } else {
        Alert.alert('Submission Error', response.error || 'Failed to submit document.');
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.badge}>Course Assignment</Text>
          <Text style={styles.headerTitle}>Hermeneutical Exegesis Paper</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Guidelines Card */}
        <View style={styles.guidelineCard}>
          <Text style={styles.sectionTitle}>Assignment Guidelines</Text>
          <Text style={styles.guidelineDesc}>
            Submit a 1,500-word exegesis paper analyzing the textual variants in Romans 8:28-30.
            Adhere strictly to Turabian citation format.
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="pie-chart-outline" size={16} color="#A855F7" />
              <Text style={styles.metaText}>Weightage: 30%</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color="#38BDF8" />
              <Text style={styles.metaText}>Due: In 5 Days</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="document-attach-outline" size={16} color="#10B981" />
              <Text style={styles.metaText}>PDF or DOCX</Text>
            </View>
          </View>
        </View>

        {/* Upload Container */}
        <View style={styles.uploadCard}>
          <Text style={styles.uploadCardTitle}>Submit Your Document</Text>
          <Text style={styles.uploadCardSubtitle}>
            Files up to 25MB accepted (PDF, DOCX, DOC)
          </Text>

          {!selectedFile ? (
            <TouchableOpacity style={styles.dropZone} onPress={handlePickDocument}>
              <Ionicons name="cloud-upload-outline" size={48} color="#38BDF8" />
              <Text style={styles.dropZoneTitle}>Tap to select document</Text>
              <Text style={styles.dropZoneHint}>Browse files from your phone</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.selectedFileBox}>
              <Ionicons name="document-text" size={32} color="#38BDF8" />
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <Text style={styles.fileSize}>
                  {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Ready to upload'}
                </Text>
              </View>
              {!isSubmitted && (
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {selectedFile && !isSubmitted && (
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmitAssignment}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Submit Assignment</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isSubmitted && (
            <View style={styles.submittedBanner}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.submittedText}>Assignment successfully submitted for faculty evaluation!</Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  guidelineCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#A855F7',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  guidelineDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  metaText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  uploadCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
  },
  uploadCardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  uploadCardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 16,
  },
  dropZone: {
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.03)',
  },
  dropZoneTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  dropZoneHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  selectedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
    gap: 12,
    marginBottom: 16,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  submittedText: {
    flex: 1,
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
});

