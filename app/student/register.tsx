import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../src/context/ThemeContext';
import { ENV } from '../../src/config/env';
import { LmsAuthService } from '../../src/services/lmsAuthService';
import { AuthStorage } from '../../src/services/authStorage';
import {
  DocumentItem,
  FormQuestion,
  OrganizationInfo,
  ProgramOption,
  PublicSubscriptionPlan,
  RegionOption,
  StudentDocuments,
} from '../../src/types';
import {
  buildStudentRegistrationPayload,
  resolveBackendMediaUrl,
  sanitizeDynamicFieldInput,
  validateAndNormalizeDateString,
} from '../../src/utils/registrationHelpers';

type SingleDocKey =
  | 'photo'
  | 'aadhaarFront'
  | 'aadhaarBack'
  | 'tenthCert'
  | 'interCert'
  | 'degreeCert'
  | 'degreeTranscript'
  | 'referenceLetter';

interface DocFieldConfig {
  key: SingleDocKey;
  label: string;
  hint: string;
  imageOnly?: boolean;
}

const REQUIRED_DOC_FIELDS: DocFieldConfig[] = [
  {
    key: 'photo',
    label: 'Passport Size Photo',
    hint: 'Clear portrait photo (.jpg, .jpeg, .png • max 5 MB)',
    imageOnly: true,
  },
  {
    key: 'aadhaarFront',
    label: 'Aadhaar Card (Front Side)',
    hint: 'Front side scan (.pdf, .jpg, .jpeg, .png)',
  },
  {
    key: 'aadhaarBack',
    label: 'Aadhaar Card (Back Side)',
    hint: 'Back side with address details (.pdf, .jpg, .jpeg, .png)',
  },
  {
    key: 'tenthCert',
    label: '10th / SSC Certificate',
    hint: 'Secondary school pass certificate (.pdf, .jpg, .jpeg, .png)',
  },
  {
    key: 'interCert',
    label: 'Intermediate / 12th Certificate',
    hint: 'Higher secondary certificate (.pdf, .jpg, .jpeg, .png)',
  },
  {
    key: 'degreeCert',
    label: 'Degree Certificate',
    hint: 'Undergraduate convocation certificate (.pdf, .jpg, .jpeg, .png)',
  },
  {
    key: 'degreeTranscript',
    label: 'Degree Academic Transcript',
    hint: 'Official consolidated marks sheet (.pdf, .jpg, .jpeg, .png)',
  },
  {
    key: 'referenceLetter',
    label: 'Reference Letter (Pastor / Elder)',
    hint: 'Signed recommendation letter (.pdf, .jpg, .jpeg, .png)',
  },
];

const TRACK_OPTIONS = [
  { value: 'ATA', label: 'ATA (Asia Theological Association)' },
  { value: 'NON_ATA', label: 'NON-ATA' },
] as const;

type ModalConfig =
  | { type: 'track'; title: string }
  | { type: 'region'; title: string }
  | { type: 'program'; title: string; key: string }
  | { type: 'dynamic'; title: string; key: string; options: string[] }
  | null;

const INITIAL_DOCUMENTS: StudentDocuments = {
  otherCertificates: [],
};

export default function StudentRegistrationScreen() {
  const { isDarkMode } = useTheme();
  const params = useLocalSearchParams<{ organizationCode?: string; slug?: string }>();
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const submitLockRef = useRef(false);

  const [ataStatus, setAtaStatus] = useState('');
  const [regionId, setRegionId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');
  const [verifiedSlug, setVerifiedSlug] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [countryOfCitizenship, setCountryOfCitizenship] = useState('');
  const [countryLivingIn, setCountryLivingIn] = useState('');
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string | boolean>>({});
  const [documents, setDocuments] = useState<StudentDocuments>(INITIAL_DOCUMENTS);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);

  const [formQuestions, setFormQuestions] = useState<FormQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const [regionPlans, setRegionPlans] = useState<PublicSubscriptionPlan[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitErrorBanner, setSubmitErrorBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedState, setSubmittedState] = useState<{
    message: string;
    organizationName: string;
    trackLabel: string;
  } | null>(null);

  const [activeModal, setActiveModal] = useState<ModalConfig>(null);

  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  const clearFieldError = useCallback((fieldKey: string) => {
    setErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  const loadFormQuestions = useCallback(async (forceRefresh = false) => {
    setQuestionsLoading(true);
    setQuestionsError(null);
    const res = await LmsAuthService.getRegistrationFormQuestions({ forceRefresh });
    if (res.success && res.data) {
      setFormQuestions(res.data);
    } else {
      setFormQuestions([]);
      setQuestionsError(res.error || 'Failed to load admission form questions.');
    }
    setQuestionsLoading(false);
  }, []);

  const loadOrganizationCatalog = useCallback(
    async (slugToLoad: string, options?: { forceRefresh?: boolean; clearDependent?: boolean }) => {
      const cleanSlug = slugToLoad.trim();
      if (!cleanSlug) {
        setOrgError('Organization Code is required.');
        return;
      }

      if (options?.clearDependent) {
        setRegionId('');
        setRegionPlans([]);
        setDynamicAnswers((prev) => {
          if (!prev.interestedCourse) return prev;
          const next = { ...prev };
          delete next.interestedCourse;
          return next;
        });
      }

      setOrgLoading(true);
      setOrgError(null);
      setRegionsLoading(true);
      setRegionsError(null);
      setProgramsLoading(true);
      setProgramsError(null);

      const orgRes = await LmsAuthService.getPublicOrganization(cleanSlug, {
        forceRefresh: options?.forceRefresh,
      });

      if (!orgRes.success || !orgRes.data) {
        setOrgInfo(null);
        setVerifiedSlug('');
        setOrgError(orgRes.error || `Organization "${cleanSlug}" not found.`);
        setOrgLoading(false);
        setRegions([]);
        setRegionsError('Verify a valid organization code first.');
        setRegionsLoading(false);
        setPrograms([]);
        setProgramsError('Verify a valid organization code first.');
        setProgramsLoading(false);
        return;
      }

      const resolvedSlug = orgRes.data.slug || cleanSlug;
      setOrgInfo(orgRes.data);
      setOrganizationCode(resolvedSlug);
      setVerifiedSlug(resolvedSlug);
      setOrgLoading(false);
      clearFieldError('organizationCode');

      const [regionsRes, programsRes] = await Promise.all([
        LmsAuthService.getAvailableRegions(resolvedSlug, { forceRefresh: options?.forceRefresh }),
        LmsAuthService.getAvailablePrograms(resolvedSlug, { forceRefresh: options?.forceRefresh }),
      ]);

      if (regionsRes.success && regionsRes.data) {
        setRegions(regionsRes.data);
        setRegionsError(null);
      } else {
        setRegions([]);
        setRegionsError(regionsRes.error || 'Could not load study regions.');
      }
      setRegionsLoading(false);

      if (programsRes.success && programsRes.data) {
        setPrograms(programsRes.data);
        setProgramsError(null);
      } else {
        setPrograms([]);
        setProgramsError(programsRes.error || 'Could not load academic programs.');
      }
      setProgramsLoading(false);
    },
    [clearFieldError]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const paramSlug =
        (typeof params.organizationCode === 'string' && params.organizationCode.trim()) ||
        (typeof params.slug === 'string' && params.slug.trim()) ||
        '';
      const storedSlug = (await AuthStorage.getOrganizationCode())?.trim() || '';
      const validStored = storedSlug.toLowerCase() === 'cotr' ? '' : storedSlug;
      const initialSlug = paramSlug || validStored || ENV.DEFAULT_ORG_SLUG || 'org1';

      if (!active) return;
      setOrganizationCode(initialSlug);

      await Promise.all([
        loadOrganizationCatalog(initialSlug),
        loadFormQuestions(),
      ]);
    })();

    return () => {
      active = false;
    };
  }, [loadFormQuestions, loadOrganizationCatalog, params.organizationCode, params.slug]);

  useEffect(() => {
    if (!regionId) return;
    let active = true;
    (async () => {
      const res = await LmsAuthService.getPublicSubscriptionPlans(regionId);
      if (active && res.success && res.data) {
        setRegionPlans(res.data);
      }
    })();
    return () => {
      active = false;
    };
  }, [regionId]);

  const activeRegionPlans = regionId ? regionPlans : [];

  const dynamicSectionQuestions = useMemo(
    () =>
      formQuestions.filter(
        (q) =>
          q.key !== 'declarationAccepted' &&
          q.key !== 'countryOfCitizenship' &&
          q.key !== 'countryLivingIn'
      ),
    [formQuestions]
  );

  const selectedRegionLabel = useMemo(() => {
    const found = regions.find((r) => r.id === regionId);
    if (!found) return '';
    return found.isAta ? `${found.name} (ATA Accredited)` : found.name;
  }, [regions, regionId]);

  const selectedTrackLabel = useMemo(() => {
    return TRACK_OPTIONS.find((t) => t.value === ataStatus)?.label || '';
  }, [ataStatus]);

  const handleDynamicTextChange = useCallback(
    (question: FormQuestion, rawValue: string) => {
      const cleanValue = sanitizeDynamicFieldInput(question, rawValue);
      setDynamicAnswers((prev) => ({ ...prev, [question.key]: cleanValue }));
      clearFieldError(question.key);
    },
    [clearFieldError]
  );

  const handleDateBlur = useCallback(
    (question: FormQuestion) => {
      const current = String(dynamicAnswers[question.key] || '').trim();
      if (!current) return;
      const check = validateAndNormalizeDateString(current);
      if (check.valid && check.normalized) {
        setDynamicAnswers((prev) => ({ ...prev, [question.key]: check.normalized as string }));
        clearFieldError(question.key);
      } else if (check.error) {
        setErrors((prev) => ({ ...prev, [question.key]: check.error as string }));
      }
    },
    [clearFieldError, dynamicAnswers]
  );

  const handlePickAndUploadDocument = useCallback(
    async (docKey: SingleDocKey | 'otherCertificates', imageOnly = false) => {
      if (uploadingKey) {
        Alert.alert('Upload In Progress', 'Please wait for the active file upload to finish.');
        return;
      }

      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: imageOnly
            ? ['image/jpeg', 'image/png']
            : ['application/pdf', 'image/jpeg', 'image/png'],
          copyToCacheDirectory: true,
          multiple: false,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          return;
        }

        const asset = result.assets[0];
        setUploadingKey(docKey);
        setUploadProgress((prev) => ({ ...prev, [docKey]: 0 }));
        setUploadErrors((prev) => {
          const next = { ...prev };
          delete next[docKey];
          return next;
        });

        const uploadRes = await LmsAuthService.uploadVerificationDocument(
          {
            uri: asset.uri,
            name: asset.name || `${docKey}.jpg`,
            mimeType: asset.mimeType,
            size: asset.size,
          },
          (pct) => {
            setUploadProgress((prev) => ({ ...prev, [docKey]: pct }));
          },
          { imageOnly, folder: 'profiles' }
        );

        if (uploadRes.success && uploadRes.data?.url) {
          const uploadedItem: DocumentItem = {
            url: uploadRes.data.url,
            name: uploadRes.data.name || asset.name || 'Document',
            size: uploadRes.data.size ?? asset.size ?? 0,
          };

          if (docKey === 'otherCertificates') {
            setDocuments((prev) => ({
              ...prev,
              otherCertificates: [...(prev.otherCertificates || []), uploadedItem],
            }));
          } else {
            setDocuments((prev) => ({
              ...prev,
              [docKey]: uploadedItem,
            }));
            clearFieldError(docKey);
          }
        } else {
          const errMsg = uploadRes.error || 'Upload failed. Please check file type and size.';
          setUploadErrors((prev) => ({ ...prev, [docKey]: errMsg }));
          Alert.alert('Upload Failed', errMsg);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to access document picker.';
        setUploadErrors((prev) => ({ ...prev, [docKey]: msg }));
        Alert.alert('Upload Error', msg);
      } finally {
        setUploadingKey(null);
      }
    },
    [clearFieldError, uploadingKey]
  );

  const handleRemoveSingleDocument = useCallback((docKey: SingleDocKey) => {
    setDocuments((prev) => ({ ...prev, [docKey]: undefined }));
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
  }, []);

  const handleRemoveOtherCertificate = useCallback((index: number) => {
    setDocuments((prev) => {
      const nextList = [...(prev.otherCertificates || [])];
      nextList.splice(index, 1);
      return { ...prev, otherCertificates: nextList };
    });
  }, []);

  const handleVerifyOrganization = useCallback(async () => {
    const clean = organizationCode.trim();
    const hasChanged = clean.toLowerCase() !== verifiedSlug.toLowerCase();
    await loadOrganizationCatalog(clean, {
      forceRefresh: true,
      clearDependent: hasChanged,
    });
  }, [loadOrganizationCatalog, organizationCode, verifiedSlug]);

  const validateAllFields = useCallback((): Record<string, string> => {
    const validationErrors: Record<string, string> = {};

    if (!organizationCode.trim()) {
      validationErrors.organizationCode = 'Organization Code is required.';
    } else if (orgError || (verifiedSlug && verifiedSlug.toLowerCase() !== organizationCode.trim().toLowerCase())) {
      validationErrors.organizationCode = 'Verify a valid Organization Code before submitting.';
    }

    if (!ataStatus) {
      validationErrors.ataStatus = 'Please select ATA or Non-ATA Track.';
    }
    if (!regionId) {
      validationErrors.regionId = 'Please select a Region.';
    }
    if (!fullName.trim()) {
      validationErrors.fullName = 'Full Name is required.';
    }
    if (!email.trim()) {
      validationErrors.email = 'Email Address is required.';
    } else if (!/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(email.trim())) {
      validationErrors.email = 'Please enter a valid email address.';
    }

    if (!mobile.trim()) {
      validationErrors.mobile = 'Mobile Number is required.';
    } else if (mobile.trim().length < 8) {
      validationErrors.mobile = 'Please enter a valid mobile number (at least 8 characters).';
    }

    if (!password) {
      validationErrors.password = 'Temporary Password is required.';
    } else if (password.length < 8) {
      validationErrors.password = 'Password must be at least 8 characters long.';
    }

    dynamicSectionQuestions.forEach((q) => {
      const rawVal = dynamicAnswers[q.key];
      const strVal = typeof rawVal === 'string' ? rawVal.trim() : '';

      if (q.isRequired) {
        if (q.type === 'CHECKBOX') {
          if (!rawVal) {
            validationErrors[q.key] = `${q.label || q.key} is required.`;
          }
        } else if (!strVal) {
          validationErrors[q.key] = `${q.label || q.key} is required.`;
        }
      }

      if (q.type === 'DATE' && strVal) {
        const dateCheck = validateAndNormalizeDateString(strVal);
        if (!dateCheck.valid && dateCheck.error) {
          validationErrors[q.key] = dateCheck.error;
        }
      }
    });

    REQUIRED_DOC_FIELDS.forEach((field) => {
      if (!documents[field.key]?.url) {
        validationErrors[field.key] = `${field.label} is required.`;
      }
    });

    if (!declarationAccepted) {
      validationErrors.declarationAccepted = 'You must accept the student declaration to proceed.';
    }

    return validationErrors;
  }, [
    ataStatus,
    declarationAccepted,
    documents,
    dynamicAnswers,
    dynamicSectionQuestions,
    email,
    fullName,
    mobile,
    orgError,
    organizationCode,
    password,
    regionId,
    verifiedSlug,
  ]);

  const handleSubmitRegistration = useCallback(async () => {
    if (submitLockRef.current || isSubmitting) return;
    if (uploadingKey) {
      Alert.alert('Upload In Progress', 'Wait for file uploads to complete before submitting.');
      return;
    }

    setSubmitErrorBanner(null);
    const validationErrors = validateAllFields();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitErrorBanner('Please fix the highlighted required fields below.');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setErrors({});
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const payload = buildStudentRegistrationPayload({
        fullName,
        email,
        password,
        mobile,
        organizationCode,
        regionId,
        ataStatus,
        countryOfCitizenship,
        countryLivingIn,
        dynamicAnswers,
        formQuestions,
        documents,
        declarationAccepted,
      });

      const res = await LmsAuthService.registerStudent(payload);
      if (res.success) {
        setSubmittedState({
          message:
            res.data?.message ||
            'Your admission application has been submitted and is awaiting admin review and approval.',
          organizationName: orgInfo?.name || organizationCode.trim(),
          trackLabel:
            ataStatus === 'ATA' ? 'ATA (Asia Theological Association)' : 'NON-ATA',
        });
      } else {
        const errMsg = res.error || 'Registration failed. Please verify your details.';
        setSubmitErrorBanner(errMsg);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }, [
    ataStatus,
    countryLivingIn,
    countryOfCitizenship,
    declarationAccepted,
    documents,
    dynamicAnswers,
    email,
    formQuestions,
    fullName,
    isSubmitting,
    mobile,
    orgInfo?.name,
    organizationCode,
    password,
    regionId,
    uploadingKey,
    validateAllFields,
  ]);

  const orgLogoUri = useMemo(() => resolveBackendMediaUrl(orgInfo?.logoUrl), [orgInfo?.logoUrl]);
  const photoPreviewUri = useMemo(
    () => resolveBackendMediaUrl(documents.photo?.url),
    [documents.photo?.url]
  );

  if (submittedState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={styles.confirmationScroll}>
          <View style={styles.confirmationCard}>
            <View style={styles.confirmationIconCircle}>
              <Ionicons name="checkmark-circle" size={56} color="#059669" />
            </View>
            <Text style={styles.confirmationTitle}>Application Received!</Text>
            <Text style={styles.confirmationSubtitle}>{submittedState.organizationName}</Text>
            <Text style={styles.confirmationBody}>
              Your admission application has been registered under the{' '}
              <Text style={styles.confirmationBold}>{submittedState.trackLabel}</Text> track.
            </Text>
            <View style={styles.confirmationNoticeBox}>
              <Ionicons name="time-outline" size={20} color="#0369A1" />
              <Text style={styles.confirmationNoticeText}>
                {submittedState.message} You will be able to sign in once administration approves your application.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.submitButton}
              activeOpacity={0.85}
              onPress={() =>
                router.replace({
                  pathname: '/student/login',
                  params: { organizationCode: organizationCode.trim() },
                })
              }
            >
              <Text style={styles.submitButtonText}>Go to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Navigation & Institution Branding */}
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navBackBtn}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
            </TouchableOpacity>
            {orgLoading ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : orgInfo ? (
              <View style={styles.orgBadge}>
                {orgLogoUri ? (
                  <Image source={{ uri: orgLogoUri }} style={styles.orgLogo} resizeMode="contain" />
                ) : (
                  <Ionicons name="school" size={16} color="#2563EB" />
                )}
                <Text style={styles.orgBadgeText} numberOfLines={1}>
                  {orgInfo.name}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Student Enrollment Application</Text>
            <Text style={styles.pageSubtitle}>
              Complete all required admission fields and upload clear scanned documents.
            </Text>
          </View>

          {submitErrorBanner ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorBannerText}>{submitErrorBanner}</Text>
            </View>
          ) : null}

          <View style={styles.cardContainer}>
            {/* SECTION 1: Admission Track & Personal Details */}
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person-circle-outline" size={20} color="#4F46E5" />
              <Text style={styles.sectionTitle}>1. Admission Track & Personal Details</Text>
            </View>

            {/* Organization Code with Verify */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                Organization Code <Text style={styles.reqStar}>*</Text>
              </Text>
              <View style={styles.orgInputRow}>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.orgCodeInput,
                    (errors.organizationCode || orgError) && styles.inputErrorBorder,
                  ]}
                  value={organizationCode}
                  onChangeText={(text) => {
                    setOrganizationCode(text);
                    clearFieldError('organizationCode');
                    setOrgError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="e.g. org1"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity
                  style={styles.verifyBtn}
                  onPress={handleVerifyOrganization}
                  disabled={orgLoading}
                >
                  {orgLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifyBtnText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
              {orgError ? (
                <Text style={styles.errorText}>{orgError}</Text>
              ) : errors.organizationCode ? (
                <Text style={styles.errorText}>{errors.organizationCode}</Text>
              ) : orgInfo ? (
                <Text style={styles.helperSuccessText}>
                  Verified institution: {orgInfo.name} ({orgInfo.slug})
                </Text>
              ) : null}
            </View>

            {/* Accreditation Track */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                Accreditation / Track <Text style={styles.reqStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownInput, errors.ataStatus && styles.inputErrorBorder]}
                onPress={() => setActiveModal({ type: 'track', title: 'Select Accreditation Track' })}
              >
                <Text style={selectedTrackLabel ? styles.dropdownTextFilled : styles.dropdownPlaceholder}>
                  {selectedTrackLabel || '-- Select Track --'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
              {errors.ataStatus ? <Text style={styles.errorText}>{errors.ataStatus}</Text> : null}
            </View>

            {/* Region */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                Region <Text style={styles.reqStar}>*</Text>
              </Text>
              {regionsLoading ? (
                <View style={styles.inlineLoadingBox}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text style={styles.inlineStatusText}>Loading regions...</Text>
                </View>
              ) : regionsError ? (
                <View style={styles.inlineErrorBox}>
                  <Text style={styles.errorTextInline}>{regionsError}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      loadOrganizationCatalog(organizationCode, { forceRefresh: true })
                    }
                  >
                    <Text style={styles.retryLink}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.dropdownInput, errors.regionId && styles.inputErrorBorder]}
                  onPress={() => setActiveModal({ type: 'region', title: 'Select Study Region' })}
                  disabled={regions.length === 0}
                >
                  <Text style={selectedRegionLabel ? styles.dropdownTextFilled : styles.dropdownPlaceholder}>
                    {regions.length === 0
                      ? 'No regions configured for this organization'
                      : selectedRegionLabel || '-- Select Region --'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#64748B" />
                </TouchableOpacity>
              )}
              {errors.regionId ? <Text style={styles.errorText}>{errors.regionId}</Text> : null}
              {activeRegionPlans.length > 0 ? (
                <Text style={styles.planHintText}>
                  {activeRegionPlans.length} regional tuition/subscription plan(s) available for this region.
                </Text>
              ) : null}
            </View>

            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                Full Name <Text style={styles.reqStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.fullName && styles.inputErrorBorder]}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  clearFieldError('fullName');
                }}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94A3B8"
              />
              {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                Email Address <Text style={styles.reqStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.email && styles.inputErrorBorder]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  clearFieldError('email');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="john@example.com"
                placeholderTextColor="#94A3B8"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {/* Mobile Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                Mobile Number <Text style={styles.reqStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.mobile && styles.inputErrorBorder]}
                value={mobile}
                onChangeText={(text) => {
                  setMobile(text.replace(/[^0-9()+\- ]/g, ''));
                  clearFieldError('mobile');
                }}
                keyboardType="phone-pad"
                placeholder="+91 98765 43210"
                placeholderTextColor="#94A3B8"
              />
              {errors.mobile ? <Text style={styles.errorText}>{errors.mobile}</Text> : null}
            </View>

            {/* Temporary Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                Temporary Password <Text style={styles.reqStar}>*</Text>
              </Text>
              <View style={[styles.passwordInputWrap, errors.password && styles.inputErrorBorder]}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearFieldError('password');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {/* SECTION 2: Residence & Dynamic Background Questions */}
            <View style={[styles.sectionTitleRow, styles.sectionDividerTop]}>
              <Ionicons name="globe-outline" size={20} color="#4F46E5" />
              <Text style={styles.sectionTitle}>2. Residence & Background Details</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Country of Citizenship</Text>
              <TextInput
                style={[styles.textInput, errors.countryOfCitizenship && styles.inputErrorBorder]}
                value={countryOfCitizenship}
                onChangeText={(text) => {
                  setCountryOfCitizenship(text);
                  clearFieldError('countryOfCitizenship');
                }}
                placeholder="e.g. India"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Country Living In (Current Residence)</Text>
              <TextInput
                style={[styles.textInput, errors.countryLivingIn && styles.inputErrorBorder]}
                value={countryLivingIn}
                onChangeText={(text) => {
                  setCountryLivingIn(text);
                  clearFieldError('countryLivingIn');
                }}
                placeholder="e.g. India, UAE, USA"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {questionsLoading ? (
              <View style={styles.inlineLoadingBox}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <Text style={styles.inlineStatusText}>Loading admission form fields...</Text>
              </View>
            ) : questionsError ? (
              <View style={styles.inlineErrorBox}>
                <Text style={styles.errorTextInline}>{questionsError}</Text>
                <TouchableOpacity onPress={() => loadFormQuestions(true)}>
                  <Text style={styles.retryLink}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              dynamicSectionQuestions.map((question) => {
                const value = dynamicAnswers[question.key];
                const strValue = typeof value === 'string' ? value : '';
                const errorMsg = errors[question.key];

                if (question.key === 'interestedCourse') {
                  const selectedProg = programs.find((p) => p.id === strValue);
                  return (
                    <View key={question.id || question.key} style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>
                        {question.label}{' '}
                        {question.isRequired ? <Text style={styles.reqStar}>*</Text> : null}
                      </Text>
                      {programsLoading ? (
                        <View style={styles.inlineLoadingBox}>
                          <ActivityIndicator size="small" color="#4F46E5" />
                          <Text style={styles.inlineStatusText}>Loading programs...</Text>
                        </View>
                      ) : programsError ? (
                        <View style={styles.inlineErrorBox}>
                          <Text style={styles.errorTextInline}>{programsError}</Text>
                          <TouchableOpacity
                            onPress={() =>
                              loadOrganizationCatalog(organizationCode, { forceRefresh: true })
                            }
                          >
                            <Text style={styles.retryLink}>Retry</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.dropdownInput, errorMsg && styles.inputErrorBorder]}
                          onPress={() =>
                            setActiveModal({
                              type: 'program',
                              title: question.label || 'Select a Program',
                              key: question.key,
                            })
                          }
                          disabled={programs.length === 0}
                        >
                          <Text
                            style={
                              selectedProg ? styles.dropdownTextFilled : styles.dropdownPlaceholder
                            }
                          >
                            {programs.length === 0
                              ? 'No published programs available'
                              : selectedProg?.name || '-- Select a Program --'}
                          </Text>
                          <Ionicons name="chevron-down" size={18} color="#64748B" />
                        </TouchableOpacity>
                      )}
                      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
                    </View>
                  );
                }

                if (question.type === 'DROPDOWN') {
                  const options =
                    question.key === 'gender' || /gender/i.test(question.label || '')
                      ? ['Male', 'Female']
                      : Array.isArray(question.options)
                        ? question.options
                        : [];

                  return (
                    <View key={question.id || question.key} style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>
                        {question.label}{' '}
                        {question.isRequired ? <Text style={styles.reqStar}>*</Text> : null}
                      </Text>
                      <TouchableOpacity
                        style={[styles.dropdownInput, errorMsg && styles.inputErrorBorder]}
                        onPress={() =>
                          setActiveModal({
                            type: 'dynamic',
                            title: question.label,
                            key: question.key,
                            options,
                          })
                        }
                      >
                        <Text
                          style={strValue ? styles.dropdownTextFilled : styles.dropdownPlaceholder}
                        >
                          {strValue || '-- Select --'}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#64748B" />
                      </TouchableOpacity>
                      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
                    </View>
                  );
                }

                if (question.type === 'CHECKBOX') {
                  const checked = Boolean(value);
                  return (
                    <View key={question.id || question.key} style={styles.fieldGroup}>
                      <TouchableOpacity
                        style={styles.inlineCheckRow}
                        onPress={() => {
                          setDynamicAnswers((prev) => ({ ...prev, [question.key]: !checked }));
                          clearFieldError(question.key);
                        }}
                      >
                        <View style={[styles.checkboxSquare, checked && styles.checkboxChecked]}>
                          {checked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                        </View>
                        <Text style={styles.inlineCheckLabel}>
                          {question.label}{' '}
                          {question.isRequired ? <Text style={styles.reqStar}>*</Text> : null}
                        </Text>
                      </TouchableOpacity>
                      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
                    </View>
                  );
                }

                if (question.type === 'TEXTAREA') {
                  return (
                    <View key={question.id || question.key} style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>
                        {question.label}{' '}
                        {question.isRequired ? <Text style={styles.reqStar}>*</Text> : null}
                      </Text>
                      <TextInput
                        style={[styles.textArea, errorMsg && styles.inputErrorBorder]}
                        value={strValue}
                        onChangeText={(text) => handleDynamicTextChange(question, text)}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        placeholder={question.placeholder || `Enter ${question.label.toLowerCase()}`}
                        placeholderTextColor="#94A3B8"
                      />
                      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
                    </View>
                  );
                }

                if (question.type === 'DATE') {
                  return (
                    <View key={question.id || question.key} style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>
                        {question.label}{' '}
                        {question.isRequired ? <Text style={styles.reqStar}>*</Text> : null}
                      </Text>
                      <TextInput
                        style={[styles.textInput, errorMsg && styles.inputErrorBorder]}
                        value={strValue}
                        onChangeText={(text) => {
                          setDynamicAnswers((prev) => ({ ...prev, [question.key]: text }));
                          clearFieldError(question.key);
                        }}
                        onBlur={() => handleDateBlur(question)}
                        placeholder="YYYY-MM-DD (e.g. 1998-05-14)"
                        placeholderTextColor="#94A3B8"
                        maxLength={10}
                      />
                      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
                    </View>
                  );
                }

                const isTel =
                  question.type === 'TEL' ||
                  question.type === 'PHONE' ||
                  /phone|mobile|contact|tel/i.test(question.key || '') ||
                  /phone|mobile|contact|tel/i.test(question.label || '');
                const isNum =
                  (question.type === 'NUMBER' ||
                    /\b(pin|zip|postal|age)\b/i.test(question.key || '') ||
                    /\b(pin\s*code|zip\s*code|postal\s*code|age)\b/i.test(question.label || '')) &&
                  !/lang/i.test(question.key || '') &&
                  !/lang/i.test(question.label || '');

                return (
                  <View key={question.id || question.key} style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>
                      {question.label}{' '}
                      {question.isRequired ? <Text style={styles.reqStar}>*</Text> : null}
                    </Text>
                    <TextInput
                      style={[styles.textInput, errorMsg && styles.inputErrorBorder]}
                      value={strValue}
                      onChangeText={(text) => handleDynamicTextChange(question, text)}
                      keyboardType={isTel ? 'phone-pad' : isNum ? 'numeric' : 'default'}
                      placeholder={question.placeholder || ''}
                      placeholderTextColor="#94A3B8"
                    />
                    {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
                  </View>
                );
              })
            )}

            {/* SECTION 3: Required Certificates & Academic Transcripts */}
            <View style={[styles.sectionTitleRow, styles.sectionDividerTop]}>
              <Ionicons name="document-attach-outline" size={20} color="#4F46E5" />
              <Text style={styles.sectionTitle}>3. Required Certificates & Transcripts</Text>
            </View>
            <Text style={styles.sectionSubTitle}>
              Upload clear scanned copies (.pdf, .png, .jpg). All 8 documents below are required.
            </Text>

            {REQUIRED_DOC_FIELDS.map((doc) => {
              const uploaded = documents[doc.key];
              const isUploading = uploadingKey === doc.key;
              const pct = uploadProgress[doc.key] ?? 0;
              const upErr = uploadErrors[doc.key];
              const fieldErr = errors[doc.key];

              return (
                <View
                  key={doc.key}
                  style={[styles.docRowCard, fieldErr && styles.inputErrorBorder]}
                >
                  <View style={styles.docInfoCol}>
                    <Text style={styles.docLabel}>
                      {doc.label} <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <Text style={styles.docHintText}>{doc.hint}</Text>

                    {doc.key === 'photo' && photoPreviewUri ? (
                      <Image
                        source={{ uri: photoPreviewUri }}
                        style={styles.photoPreview}
                        resizeMode="cover"
                      />
                    ) : null}

                    {uploaded?.name ? (
                      <View style={styles.uploadedFileRow}>
                        <View style={styles.uploadedFilePill}>
                          <Ionicons name="checkmark-circle" size={14} color="#059669" />
                          <Text style={styles.uploadedFileName} numberOfLines={1}>
                            {uploaded.name}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveSingleDocument(doc.key)}
                          accessibilityLabel={`Remove ${doc.label}`}
                        >
                          <Ionicons name="close-circle" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {upErr ? <Text style={styles.errorText}>{upErr}</Text> : null}
                    {!upErr && fieldErr ? <Text style={styles.errorText}>{fieldErr}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.docUploadBtn,
                      uploaded?.url ? styles.docUploadBtnSuccess : null,
                    ]}
                    onPress={() => handlePickAndUploadDocument(doc.key, doc.imageOnly)}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <View style={styles.uploadProgressWrap}>
                        <ActivityIndicator size="small" color="#2563EB" />
                        <Text style={styles.uploadProgressText}>{pct}%</Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.docUploadBtnText,
                          uploaded?.url ? styles.docUploadBtnSuccessText : null,
                        ]}
                      >
                        {uploaded?.url ? 'Replace' : upErr ? 'Retry' : 'Upload'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Other Supporting Certificates (Multiple) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Other Supporting Certificates / Documents</Text>
              <TouchableOpacity
                style={styles.dashedUploadBox}
                onPress={() => handlePickAndUploadDocument('otherCertificates', false)}
                disabled={uploadingKey === 'otherCertificates'}
              >
                {uploadingKey === 'otherCertificates' ? (
                  <View style={styles.uploadProgressWrap}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.dashedUploadText}>
                      Uploading ({uploadProgress.otherCertificates ?? 0}%)...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.uploadProgressWrap}>
                    <Ionicons name="cloud-upload-outline" size={18} color="#0284C7" />
                    <Text style={styles.dashedUploadText}>Add Supporting Certificate (PDF / Image)</Text>
                  </View>
                )}
              </TouchableOpacity>
              {uploadErrors.otherCertificates ? (
                <Text style={styles.errorText}>{uploadErrors.otherCertificates}</Text>
              ) : null}

              {(documents.otherCertificates || []).map((cert, idx) => (
                <View key={`${cert.url}-${idx}`} style={styles.otherCertItem}>
                  <View style={styles.otherCertLeft}>
                    <Ionicons name="document-text-outline" size={16} color="#4F46E5" />
                    <Text style={styles.uploadedFileName} numberOfLines={1}>
                      {cert.name || `Certificate ${idx + 1}`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveOtherCertificate(idx)}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* SECTION 4: Declaration */}
            <View style={[styles.sectionTitleRow, styles.sectionDividerTop]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#4F46E5" />
              <Text style={styles.sectionTitle}>4. Declaration</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.declarationBox,
                errors.declarationAccepted && styles.inputErrorBorder,
              ]}
              activeOpacity={0.85}
              onPress={() => {
                setDeclarationAccepted((prev) => !prev);
                clearFieldError('declarationAccepted');
              }}
            >
              <View style={[styles.checkboxSquare, declarationAccepted && styles.checkboxChecked]}>
                {declarationAccepted ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.declarationHeading}>Student Declaration</Text>
                <Text style={styles.declarationBody}>
                  I hereby do declare that all the details and documents which are mentioned above are
                  true to best of my knowledge. I assure that, if I am admitted, I will abide by the
                  rules and regulations of the institution and administration.
                </Text>
              </View>
            </TouchableOpacity>
            {errors.declarationAccepted ? (
              <Text style={styles.errorText}>{errors.declarationAccepted}</Text>
            ) : null}

            {/* Submit Application Button */}
            <View style={styles.submitRow}>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
                onPress={handleSubmitRegistration}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Application</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.loginRedirectRow}>
              <Text style={styles.loginRedirectText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/student/login',
                    params: { organizationCode: organizationCode.trim() },
                  })
                }
              >
                <Text style={styles.loginRedirectLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SHARED SELECTION MODAL */}
      <Modal
        visible={activeModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setActiveModal(null)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeModal?.title || 'Select Option'}</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {activeModal?.type === 'track' &&
                TRACK_OPTIONS.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.modalOption,
                      ataStatus === item.value && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setAtaStatus(item.value);
                      clearFieldError('ataStatus');
                      setActiveModal(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        ataStatus === item.value && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {ataStatus === item.value ? (
                      <Ionicons name="checkmark" size={18} color="#0284C7" />
                    ) : null}
                  </TouchableOpacity>
                ))}

              {activeModal?.type === 'region' &&
                regions.map((item) => {
                  const selected = regionId === item.id;
                  const label = item.isAta ? `${item.name} (ATA Accredited)` : item.name;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.modalOption, selected && styles.modalOptionSelected]}
                      onPress={() => {
                        setRegionId(item.id);
                        clearFieldError('regionId');
                        setActiveModal(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          selected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={18} color="#0284C7" /> : null}
                    </TouchableOpacity>
                  );
                })}

              {activeModal?.type === 'program' &&
                programs.map((item) => {
                  const selected = dynamicAnswers[activeModal.key] === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.modalOption, selected && styles.modalOptionSelected]}
                      onPress={() => {
                        setDynamicAnswers((prev) => ({ ...prev, [activeModal.key]: item.id }));
                        clearFieldError(activeModal.key);
                        setActiveModal(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          selected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={18} color="#0284C7" /> : null}
                    </TouchableOpacity>
                  );
                })}

              {activeModal?.type === 'dynamic' &&
                activeModal.options.map((opt) => {
                  const selected = dynamicAnswers[activeModal.key] === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.modalOption, selected && styles.modalOptionSelected]}
                      onPress={() => {
                        setDynamicAnswers((prev) => ({ ...prev, [activeModal.key]: opt }));
                        clearFieldError(activeModal.key);
                        setActiveModal(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          selected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {opt}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={18} color="#0284C7" /> : null}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: isDark ? '#0B0F19' : '#F1F5F9',
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 48,
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    navBackBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    },
    orgBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '75%',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    orgLogo: {
      width: 20,
      height: 20,
      borderRadius: 4,
    },
    orgBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    pageHeader: {
      alignItems: 'center',
      marginBottom: 16,
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: isDark ? '#F8FAFC' : '#0F172A',
      textAlign: 'center',
    },
    pageSubtitle: {
      fontSize: 13,
      color: isDark ? '#94A3B8' : '#64748B',
      textAlign: 'center',
      marginTop: 4,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? '#450A0A' : '#FEF2F2',
      borderWidth: 1,
      borderColor: '#EF4444',
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
    },
    errorBannerText: {
      flex: 1,
      color: isDark ? '#FCA5A5' : '#B91C1C',
      fontSize: 13,
      fontWeight: '600',
    },
    cardContainer: {
      backgroundColor: isDark ? '#161F30' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? '#1F2937' : '#E2E8F0',
      padding: 18,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingBottom: 10,
      marginBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1F2937' : '#E2E8F0',
    },
    sectionDividerTop: {
      marginTop: 22,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    sectionSubTitle: {
      fontSize: 12,
      color: isDark ? '#94A3B8' : '#64748B',
      marginBottom: 12,
      marginTop: -6,
    },
    fieldGroup: {
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#CBD5E1' : '#334155',
      marginBottom: 6,
    },
    reqStar: {
      color: '#EF4444',
    },
    textInput: {
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    textArea: {
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 84,
      fontSize: 14,
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    dropdownInput: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    dropdownTextFilled: {
      fontSize: 14,
      color: isDark ? '#F8FAFC' : '#0F172A',
      flex: 1,
    },
    dropdownPlaceholder: {
      fontSize: 14,
      color: '#94A3B8',
      flex: 1,
    },
    inputErrorBorder: {
      borderColor: '#EF4444',
    },
    orgInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    orgCodeInput: {
      flex: 1,
    },
    verifyBtn: {
      backgroundColor: '#4F46E5',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 10,
      minWidth: 74,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifyBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    helperSuccessText: {
      color: '#059669',
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
    },
    planHintText: {
      color: '#0284C7',
      fontSize: 11,
      marginTop: 4,
      fontWeight: '500',
    },
    passwordInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    inlineLoadingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
    },
    inlineStatusText: {
      fontSize: 13,
      color: isDark ? '#94A3B8' : '#64748B',
    },
    inlineErrorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: 10,
      borderRadius: 8,
      backgroundColor: isDark ? '#450A0A' : '#FEF2F2',
      borderWidth: 1,
      borderColor: '#EF4444',
    },
    errorTextInline: {
      flex: 1,
      fontSize: 12,
      color: isDark ? '#FCA5A5' : '#DC2626',
    },
    retryLink: {
      fontSize: 12,
      fontWeight: '700',
      color: '#2563EB',
    },
    inlineCheckRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    inlineCheckLabel: {
      flex: 1,
      fontSize: 13,
      color: isDark ? '#CBD5E1' : '#334155',
      fontWeight: '600',
    },
    docRowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    docInfoCol: {
      flex: 1,
    },
    docLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#1E293B',
    },
    docHintText: {
      fontSize: 11,
      color: isDark ? '#94A3B8' : '#64748B',
      marginTop: 2,
    },
    photoPreview: {
      width: 64,
      height: 64,
      borderRadius: 8,
      marginTop: 8,
      borderWidth: 1,
      borderColor: '#CBD5E1',
    },
    uploadedFileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    uploadedFilePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? '#0C4A6E' : '#E0F2FE',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      maxWidth: '88%',
    },
    uploadedFileName: {
      fontSize: 12,
      color: isDark ? '#7DD3FC' : '#0369A1',
      fontWeight: '600',
      flexShrink: 1,
    },
    docUploadBtn: {
      backgroundColor: isDark ? '#0C4A6E' : '#EFF6FF',
      borderWidth: 1,
      borderColor: isDark ? '#0369A1' : '#BFDBFE',
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minWidth: 74,
      alignItems: 'center',
    },
    docUploadBtnSuccess: {
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      borderColor: '#059669',
    },
    docUploadBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#38BDF8' : '#2563EB',
    },
    docUploadBtnSuccessText: {
      color: isDark ? '#34D399' : '#059669',
    },
    uploadProgressWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    uploadProgressText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#2563EB',
    },
    dashedUploadBox: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDark ? '#0369A1' : '#93C5FD',
      backgroundColor: isDark ? '#0F2942' : '#F0F9FF',
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dashedUploadText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#38BDF8' : '#0284C7',
    },
    otherCertItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      marginTop: 8,
    },
    otherCertLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      marginRight: 8,
    },
    declarationBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      borderRadius: 12,
      padding: 14,
    },
    checkboxSquare: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: isDark ? '#475569' : '#94A3B8',
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    declarationHeading: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginBottom: 4,
    },
    declarationBody: {
      fontSize: 12,
      lineHeight: 18,
      color: isDark ? '#CBD5E1' : '#475569',
    },
    submitRow: {
      marginTop: 22,
    },
    submitButton: {
      backgroundColor: '#4F46E5',
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#4F46E5',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    submitButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    loginRedirectRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 18,
    },
    loginRedirectText: {
      fontSize: 13,
      color: isDark ? '#94A3B8' : '#64748B',
    },
    loginRedirectLink: {
      fontSize: 13,
      fontWeight: '700',
      color: '#2563EB',
    },
    errorText: {
      color: '#DC2626',
      fontSize: 11,
      marginTop: 4,
      fontWeight: '500',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: isDark ? '#111827' : '#FFFFFF',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      maxHeight: '65%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1F2937' : '#F1F5F9',
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#1E293B',
    },
    modalOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1E293B' : '#F8FAFC',
    },
    modalOptionSelected: {
      backgroundColor: isDark ? '#0C4A6E' : '#F0F9FF',
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    modalOptionText: {
      fontSize: 14,
      color: isDark ? '#E2E8F0' : '#334155',
      flex: 1,
      paddingRight: 8,
    },
    modalOptionTextSelected: {
      color: isDark ? '#38BDF8' : '#0284C7',
      fontWeight: '700',
    },
    confirmationScroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 20,
    },
    confirmationCard: {
      backgroundColor: isDark ? '#161F30' : '#FFFFFF',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? '#1F2937' : '#E2E8F0',
      padding: 24,
      alignItems: 'center',
    },
    confirmationIconCircle: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    confirmationTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginBottom: 4,
      textAlign: 'center',
    },
    confirmationSubtitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#2563EB',
      marginBottom: 12,
      textAlign: 'center',
    },
    confirmationBody: {
      fontSize: 14,
      lineHeight: 21,
      color: isDark ? '#CBD5E1' : '#475569',
      textAlign: 'center',
      marginBottom: 16,
    },
    confirmationBold: {
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    confirmationNoticeBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: isDark ? '#0C4A6E' : '#F0F9FF',
      borderWidth: 1,
      borderColor: isDark ? '#0369A1' : '#BAE6FD',
      borderRadius: 12,
      padding: 14,
      marginBottom: 22,
      width: '100%',
    },
    confirmationNoticeText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: isDark ? '#BAE6FD' : '#0369A1',
    },
  });
}
