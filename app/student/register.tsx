

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LmsAuthService } from '../../src/services/lmsAuthService';
import { AuthStorage } from '../../src/services/authStorage';
import { ENV } from '../../src/config/env';
import {
  DocumentItem,
  ProgramOption,
  RegionOption,
  StudentDocuments,
  StudentRegistrationPayload,
} from '../../src/types';

type DocKey =
  | 'photo'
  | 'aadhaarFront'
  | 'aadhaarBack'
  | 'tenthCert'
  | 'interCert'
  | 'degreeCert'
  | 'degreeTranscript'
  | 'referenceLetter'
  | 'otherCertificates';

interface DocFieldConfig {
  key: DocKey;
  label: string;
  required: boolean;
  hint: string;
}

const DOCUMENT_ITEMS: DocFieldConfig[] = [
  {
    key: 'photo',
    label: 'PASSPORT SIZE PHOTOGRAPH',
    required: true,
    hint: 'Recent clear portrait photo (JPG or PNG, max 5MB)',
  },
  {
    key: 'aadhaarFront',
    label: 'AADHAAR / NATIONAL ID (FRONT)',
    required: true,
    hint: 'Front side of Government photo ID (PDF/JPG)',
  },
  {
    key: 'aadhaarBack',
    label: 'AADHAAR / NATIONAL ID (BACK)',
    required: false,
    hint: 'Reverse side containing address verification',
  },
  {
    key: 'tenthCert',
    label: '10TH / SSC / SECONDARY CERTIFICATE',
    required: true,
    hint: 'Passing certificate for age and secondary education proof',
  },
  {
    key: 'interCert',
    label: '12TH / INTERMEDIATE CERTIFICATE',
    required: true,
    hint: 'Higher secondary / +2 completion certificate',
  },
  {
    key: 'degreeCert',
    label: 'DEGREE CONVOCATION CERTIFICATE',
    required: false,
    hint: 'Undergraduate convocation degree certificate',
  },
  {
    key: 'degreeTranscript',
    label: 'OFFICIAL DEGREE TRANSCRIPT',
    required: false,
    hint: 'Consolidated marks transcript from recognized university',
  },
  {
    key: 'referenceLetter',
    label: 'PASTOR / SPIRITUAL REFERENCE LETTER',
    required: true,
    hint: 'Recommendation letter from your senior pastor',
  },
];

export default function StudentRegisterScreen() {
  // Helper Dropdown APIs
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);

  // Modal Selector State
  const [modalType, setModalType] = useState<
    'track' | 'region' | 'gender' | 'marital' | 'program' | null
  >(null);

  // SECTION 1: Admission Track & Personal Details
  const [ataStatus, setAtaStatus] = useState<string>('');
  const [regionId, setRegionId] = useState<string>('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [organizationCode, setOrganizationCode] = useState(ENV.DEFAULT_ORG_SLUG || 'org1');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // SECTION 2: Residence & Background Details
  const [countryOfCitizenship, setCountryOfCitizenship] = useState('India');
  const [countryLivingIn, setCountryLivingIn] = useState('India');
  const [gender, setGender] = useState<string>('');
  const [maritalStatus, setMaritalStatus] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [motherTongue, setMotherTongue] = useState('');
  const [otherLanguages, setOtherLanguages] = useState('');
  const [bornAgainDate, setBornAgainDate] = useState('');
  const [churchDenomination, setChurchDenomination] = useState('');
  const [localChurch, setLocalChurch] = useState('');
  const [churchDetails, setChurchDetails] = useState('');
  const [referenceProvider, setReferenceProvider] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [specialHonors, setSpecialHonors] = useState('');

  // Address Details
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode] = useState('');
  const [currentProfession] = useState('');

  // SECTION 3: Academic Qualifications & Documents
  const [highestEducation, setHighestEducation] = useState('');
  const [theologicalQualifications, setTheologicalQualifications] = useState('');
  const [interestedCourse, setInterestedCourse] = useState<string>('');
  const [uploadedDocs, setUploadedDocs] = useState<Record<DocKey, DocumentItem | undefined>>({
    photo: undefined,
    aadhaarFront: undefined,
    aadhaarBack: undefined,
    tenthCert: undefined,
    interCert: undefined,
    degreeCert: undefined,
    degreeTranscript: undefined,
    referenceLetter: undefined,
    otherCertificates: undefined,
  });
  const [uploadingDocKey, setUploadingDocKey] = useState<DocKey | null>(null);

  // SECTION 4: Declaration
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track options
  const trackOptions = [
    { label: 'ATA Accredited', value: 'ATA' },
    { label: 'Non-ATA / Direct Track', value: 'NON_ATA' },
  ];

  const genderOptions = ['Male', 'Female', 'Other'];
  const maritalOptions = ['Single', 'Married', 'Widowed', 'Other'];

  // Load helper APIs for regions and programs
  useEffect(() => {
    let isMounted = true;
    async function fetchHelpers() {
      setIsLoadingDropdowns(true);
      try {
        const [orgRes, regRes, progRes] = await Promise.all([
          LmsAuthService.getPublicOrganization(),
          LmsAuthService.getAvailableRegions(),
          LmsAuthService.getAvailablePrograms(),
        ]);

        if (isMounted) {
          if (orgRes.success && orgRes.data?.slug) {
            setOrganizationCode(orgRes.data.slug);
          }
          if (regRes.success && regRes.data && regRes.data.length > 0) {
            setRegions(regRes.data);
            setRegionId(regRes.data[0].id);
          }
          if (progRes.success && progRes.data && progRes.data.length > 0) {
            setPrograms(progRes.data);
            setInterestedCourse(progRes.data[0].id);
          }
        }
      } catch (err) {
        console.warn('[StudentRegister] Dropdown loading warning:', err);
      } finally {
        if (isMounted) setIsLoadingDropdowns(false);
      }
    }

    fetchHelpers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Pick Document and upload via POST /upload/public?folder=profiles
  const handlePickDocument = async (key: DocKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      // File size limit: 5MB
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size && file.size > MAX_SIZE) {
        Alert.alert(
          'File Limit Exceeded',
          `The selected file is ${(file.size / (1024 * 1024)).toFixed(2)} MB. The maximum allowed size is 5MB.`
        );
        return;
      }

      setUploadingDocKey(key);

      const res = await LmsAuthService.uploadVerificationDocument({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
      });

      if (res.success && res.data) {
        setUploadedDocs((prev) => ({
          ...prev,
          [key]: res.data,
        }));
      } else {
        Alert.alert('Upload Failed', res.error || 'Unable to upload file.');
      }
    } catch (err: unknown) {
      Alert.alert('Picker Error', err instanceof Error ? err.message : 'Error picking document');
    } finally {
      setUploadingDocKey(null);
    }
  };

  const handleRemoveDoc = (key: DocKey) => {
    setUploadedDocs((prev) => ({
      ...prev,
      [key]: undefined,
    }));
  };

  // Validation
  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!ataStatus) errs.ataStatus = 'Accreditation / Track is required';
    if (!regionId) errs.regionId = 'Region is required';
    if (!fullName.trim()) errs.fullName = 'Full Name is required';
    if (!email.trim()) {
      errs.email = 'Email Address is required';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!mobile.trim()) {
      errs.mobile = 'Mobile Number is required';
    } else if (!/^\+?[0-9]{10,14}$/.test(mobile.replace(/[\s-]/g, ''))) {
      errs.mobile = 'Enter a valid mobile number';
    }

    if (!password) {
      errs.password = 'Temporary password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (!gender) errs.gender = 'Gender is required';
    if (!maritalStatus) errs.maritalStatus = 'Marital Status is required';
    if (!dateOfBirth.trim()) errs.dateOfBirth = 'Date of birth is required';
    if (!motherTongue.trim()) errs.motherTongue = 'Mother tongue is required';
    if (!bornAgainDate.trim()) errs.bornAgainDate = 'Born again date is required';
    if (!churchDenomination.trim()) errs.churchDenomination = 'Church denomination is required';
    if (!localChurch.trim()) errs.localChurch = 'Local church/assembly is required';
    if (!churchDetails.trim()) errs.churchDetails = 'Local church details with pastor contact required';
    if (!referenceProvider.trim()) errs.referenceProvider = 'Reference provider is required';
    if (!parentName.trim()) errs.parentName = "Parent's name is required";
    if (!parentPhone.trim()) errs.parentPhone = "Parent's phone is required";

    if (!highestEducation.trim()) errs.highestEducation = 'Highest education is required';
    if (!interestedCourse) errs.interestedCourse = 'Interested program is required';

    // Required Documents
    if (!uploadedDocs.photo) errs.photo = 'Passport photograph is required';
    if (!uploadedDocs.aadhaarFront) errs.aadhaarFront = 'National ID / Aadhaar front is required';
    if (!uploadedDocs.tenthCert) errs.tenthCert = '10th / SSC certificate is required';
    if (!uploadedDocs.interCert) errs.interCert = '12th / Intermediate certificate is required';
    if (!uploadedDocs.referenceLetter) errs.referenceLetter = 'Pastor reference letter is required';

    if (!declarationAccepted) {
      errs.declaration = 'You must agree to the Student Declaration to proceed.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) {
      Alert.alert(
        'Incomplete Application',
        'Please review the highlighted fields and ensure required documents are attached.'
      );
      return;
    }

    setIsSubmitting(true);

    const documentsPayload: StudentDocuments = {
      photo: uploadedDocs.photo,
      aadhaarFront: uploadedDocs.aadhaarFront,
      aadhaarBack: uploadedDocs.aadhaarBack,
      tenthCert: uploadedDocs.tenthCert,
      interCert: uploadedDocs.interCert,
      degreeCert: uploadedDocs.degreeCert,
      degreeTranscript: uploadedDocs.degreeTranscript,
      referenceLetter: uploadedDocs.referenceLetter,
      otherCertificates: uploadedDocs.otherCertificates ? [uploadedDocs.otherCertificates] : [],
    };

    const payload: StudentRegistrationPayload = {
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      mobile: mobile.trim(),
      organizationCode: organizationCode.trim(),
      regionId,
      ataStatus: ataStatus || 'ATA',
      customProfile: {
        ataStatus: ataStatus || 'ATA',
        countryOfCitizenship: countryOfCitizenship.trim() || 'India',
        countryLivingIn: countryLivingIn.trim() || 'India',
        gender,
        dateOfBirth: dateOfBirth.trim(),
        maritalStatus,
        motherTongue: motherTongue.trim(),
        otherLanguages: otherLanguages.trim() || undefined,
        address: address.trim() || 'Address as per ID',
        city: city.trim() || 'City',
        state: stateName.trim() || 'State',
        pincode: pincode.trim() || undefined,
        currentProfession: currentProfession.trim() || undefined,
        highestEducation: highestEducation.trim(),
        theologicalQualifications: theologicalQualifications.trim() || undefined,
        interestedCourse,
        bornAgainDate: bornAgainDate.trim(),
        denomination: churchDenomination.trim(),
        localChurch: localChurch.trim(),
        churchDetails: churchDetails.trim(),
        pastorName: churchDetails.trim(),
        pastorContact: churchDetails.trim(),
        referenceProvider: referenceProvider.trim(),
        parentName: parentName.trim(),
        parentPhone: parentPhone.trim(),
        specialHonors: specialHonors.trim() || undefined,
        documents: documentsPayload,
        declarationAccepted: true,
      },
    };

    try {
      const response = await LmsAuthService.registerStudent(payload);

      if (response.success) {
        const assignedOrgCode = response.data?.organizationCode || organizationCode || 'org1';
        await AuthStorage.setOrganizationCode(assignedOrgCode);

        // Pre-save basic applicant session
        await AuthStorage.saveSession({
          accessToken: 'student_token_' + Date.now(),
          role: 'student',
          user: {
            id: 'student_' + Date.now(),
            fullName: fullName.trim() || 'Student',
            email: email.trim(),
            mobile: mobile.trim(),
            role: 'STUDENT',
          },
        });

        Alert.alert(
          'Registration Successful! 🎉',
          `Your enrollment application has been submitted to Cotr Global Online.\n\nOrganization Code: ${assignedOrgCode}\nRegistered Email: ${email.trim()}\n\nPlease sign in using this Organization Code and your password.`,
          [
            {
              text: 'Go to Sign In',
              onPress: () =>
                router.replace({
                  pathname: '/student/login',
                  params: { organizationCode: assignedOrgCode, email: email.trim() },
                }),
            },
            {
              text: 'Open Dashboard',
              onPress: () => router.replace('/(student-tabs)/dashboard'),
            },
          ]
        );
      } else {
        Alert.alert('Registration Error', response.error || 'Server rejected registration request.');
      }
    } catch (err: unknown) {
      Alert.alert('Network Error', err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRegionName =
    regions.find((r) => r.id === regionId)?.name || '-- Select Region --';

  const selectedProgramName =
    programs.find((p) => p.id === interestedCourse)?.name || '-- Select Program --';

  const selectedTrackName =
    trackOptions.find((t) => t.value === ataStatus)?.label || '-- Select Track --';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Navigation Bar */}
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navBackBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color="#1E293B" />
            </TouchableOpacity>
          </View>

          {/* Form Page Header */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Student Enrollment Application</Text>
            <Text style={styles.pageSubtitle}>
              Fill in all required details below to complete your admission registration.
            </Text>
          </View>

          {/* SECTION 1: Admission Track & Personal Details */}
          <View style={styles.cardContainer}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#0284C7" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>1. Admission Track & Personal Details</Text>
            </View>

            {/* ACCREDITATION / TRACK */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                ACCREDITATION / TRACK <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownInput, Boolean(errors.ataStatus) && styles.inputErrorBorder]}
                onPress={() => setModalType('track')}
              >
                <Text style={ataStatus ? styles.dropdownTextFilled : styles.dropdownTextPlaceholder}>
                  {selectedTrackName}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
              {errors.ataStatus ? <Text style={styles.errorText}>{errors.ataStatus}</Text> : null}
            </View>

            {/* REGION */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                REGION <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownInput, Boolean(errors.regionId) && styles.inputErrorBorder]}
                onPress={() => setModalType('region')}
              >
                <Text
                  style={regionId ? styles.dropdownTextFilled : styles.dropdownTextPlaceholder}
                  numberOfLines={1}
                >
                  {isLoadingDropdowns ? 'Loading regions...' : selectedRegionName}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
              {errors.regionId ? <Text style={styles.errorText}>{errors.regionId}</Text> : null}
            </View>

            {/* FULL NAME */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                FULL NAME <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.fullName) && styles.inputErrorBorder]}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
              />
              {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
            </View>

            {/* EMAIL ADDRESS */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                EMAIL ADDRESS <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.email) && styles.inputErrorBorder]}
                placeholder="john@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {/* MOBILE NUMBER */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                MOBILE NUMBER <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.mobile) && styles.inputErrorBorder]}
                placeholder="+91 98765 43210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={setMobile}
              />
              {errors.mobile ? <Text style={styles.errorText}>{errors.mobile}</Text> : null}
            </View>

            {/* ORGANIZATION CODE */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                ORGANIZATION CODE <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, styles.readOnlyInput]}
                value={organizationCode}
                editable={false}
              />
            </View>

            {/* TEMPORARY PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                TEMPORARY PASSWORD <Text style={styles.asterisk}>*</Text>
              </Text>
              <View
                style={[
                  styles.passwordInputWrap,
                  Boolean(errors.password) && styles.inputErrorBorder,
                ]}
              >
                <RNTextInput
                  style={styles.passwordInput}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>
          </View>

          {/* SECTION 2: Residence & Background Details */}
          <View style={styles.cardContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>2. Residence & Background Details</Text>
            </View>

            {/* COUNTRY OF CITIZENSHIP */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>COUNTRY OF CITIZENSHIP</Text>
              <RNTextInput
                style={styles.textInput}
                placeholder="e.g. India"
                placeholderTextColor="#94A3B8"
                value={countryOfCitizenship}
                onChangeText={setCountryOfCitizenship}
              />
            </View>

            {/* COUNTRY LIVING IN (CURRENT RESIDENCE) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>COUNTRY LIVING IN (CURRENT RESIDENCE)</Text>
              <RNTextInput
                style={styles.textInput}
                placeholder="e.g. India, UAE, USA"
                placeholderTextColor="#94A3B8"
                value={countryLivingIn}
                onChangeText={setCountryLivingIn}
              />
            </View>

            {/* GENDER */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                GENDER <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownInput, Boolean(errors.gender) && styles.inputErrorBorder]}
                onPress={() => setModalType('gender')}
              >
                <Text style={gender ? styles.dropdownTextFilled : styles.dropdownTextPlaceholder}>
                  {gender || 'Select'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
              {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
            </View>

            {/* MARITAL STATUS */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                MARITAL STATUS <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownInput, Boolean(errors.maritalStatus) && styles.inputErrorBorder]}
                onPress={() => setModalType('marital')}
              >
                <Text style={maritalStatus ? styles.dropdownTextFilled : styles.dropdownTextPlaceholder}>
                  {maritalStatus || 'Select'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
              {errors.maritalStatus ? <Text style={styles.errorText}>{errors.maritalStatus}</Text> : null}
            </View>

            {/* DATE OF BIRTH */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                DATE OF BIRTH <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.dateOfBirth) && styles.inputErrorBorder]}
                placeholder="dd-mm-yyyy"
                placeholderTextColor="#94A3B8"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
              />
              {errors.dateOfBirth ? <Text style={styles.errorText}>{errors.dateOfBirth}</Text> : null}
            </View>

            {/* MOTHER TONGUE */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                MOTHER TONGUE <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.motherTongue) && styles.inputErrorBorder]}
                placeholder=""
                placeholderTextColor="#94A3B8"
                value={motherTongue}
                onChangeText={setMotherTongue}
              />
              {errors.motherTongue ? <Text style={styles.errorText}>{errors.motherTongue}</Text> : null}
            </View>

            {/* OTHER LANGUAGES */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>OTHER LANGUAGES</Text>
              <RNTextInput
                style={styles.textInput}
                placeholder=""
                placeholderTextColor="#94A3B8"
                value={otherLanguages}
                onChangeText={setOtherLanguages}
              />
            </View>

            {/* WHEN DID YOU BECOME A BORN-AGAIN CHRISTIAN? */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                WHEN DID YOU BECOME A BORN-AGAIN CHRISTIAN? <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.bornAgainDate) && styles.inputErrorBorder]}
                placeholder="dd-mm-yyyy"
                placeholderTextColor="#94A3B8"
                value={bornAgainDate}
                onChangeText={setBornAgainDate}
              />
              {errors.bornAgainDate ? <Text style={styles.errorText}>{errors.bornAgainDate}</Text> : null}
            </View>

            {/* CHURCH DENOMINATION */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                CHURCH DENOMINATION <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.churchDenomination) && styles.inputErrorBorder]}
                placeholder=""
                placeholderTextColor="#94A3B8"
                value={churchDenomination}
                onChangeText={setChurchDenomination}
              />
              {errors.churchDenomination ? (
                <Text style={styles.errorText}>{errors.churchDenomination}</Text>
              ) : null}
            </View>

            {/* LOCAL CHURCH/ASSEMBLY */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                LOCAL CHURCH/ASSEMBLY <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.localChurch) && styles.inputErrorBorder]}
                placeholder=""
                placeholderTextColor="#94A3B8"
                value={localChurch}
                onChangeText={setLocalChurch}
              />
              {errors.localChurch ? <Text style={styles.errorText}>{errors.localChurch}</Text> : null}
            </View>

            {/* LOCAL CHURCH DETAILS (WITH PASTOR CONTACT) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                LOCAL CHURCH DETAILS (WITH PASTOR CONTACT) <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textArea, Boolean(errors.churchDetails) && styles.inputErrorBorder]}
                placeholder=""
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={churchDetails}
                onChangeText={setChurchDetails}
              />
              {errors.churchDetails ? <Text style={styles.errorText}>{errors.churchDetails}</Text> : null}
            </View>

            {/* REFERENCE PROVIDER */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                REFERENCE PROVIDER <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.referenceProvider) && styles.inputErrorBorder]}
                placeholder=""
                placeholderTextColor="#94A3B8"
                value={referenceProvider}
                onChangeText={setReferenceProvider}
              />
              {errors.referenceProvider ? (
                <Text style={styles.errorText}>{errors.referenceProvider}</Text>
              ) : null}
            </View>

            {/* PARENT'S NAME */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                PARENT&apos;S NAME <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.parentName) && styles.inputErrorBorder]}
                placeholder=""
                placeholderTextColor="#94A3B8"
                value={parentName}
                onChangeText={setParentName}
              />
              {errors.parentName ? <Text style={styles.errorText}>{errors.parentName}</Text> : null}
            </View>

            {/* PARENT'S PHONE */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                PARENT&apos;S PHONE <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.parentPhone) && styles.inputErrorBorder]}
                placeholder=""
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={parentPhone}
                onChangeText={setParentPhone}
              />
              {errors.parentPhone ? <Text style={styles.errorText}>{errors.parentPhone}</Text> : null}
            </View>

            {/* SPECIAL HONORS CONFERRED */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>SPECIAL HONORS CONFERRED</Text>
              <RNTextInput
                style={styles.textArea}
                placeholder=""
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={specialHonors}
                onChangeText={setSpecialHonors}
              />
            </View>

            {/* PERMANENT ADDRESS */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>PERMANENT RESIDENTIAL ADDRESS</Text>
              <RNTextInput
                style={styles.textArea}
                placeholder="Door No, Street Name, Landmark"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.col, { marginRight: 10 }]}>
                <Text style={styles.inputLabel}>CITY</Text>
                <RNTextInput
                  style={styles.textInput}
                  placeholder="City"
                  placeholderTextColor="#94A3B8"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.inputLabel}>STATE</Text>
                <RNTextInput
                  style={styles.textInput}
                  placeholder="State"
                  placeholderTextColor="#94A3B8"
                  value={stateName}
                  onChangeText={setStateName}
                />
              </View>
            </View>
          </View>

          {/* SECTION 3: Academic Qualifications & Required Documents */}
          <View style={styles.cardContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>3. Academic Qualifications & Required Documents</Text>
            </View>

            {/* HIGHEST SECULAR EDUCATION */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                HIGHEST SECULAR EDUCATION <Text style={styles.asterisk}>*</Text>
              </Text>
              <RNTextInput
                style={[styles.textInput, Boolean(errors.highestEducation) && styles.inputErrorBorder]}
                placeholder="e.g. Bachelor of Science (B.Sc)"
                placeholderTextColor="#94A3B8"
                value={highestEducation}
                onChangeText={setHighestEducation}
              />
              {errors.highestEducation ? (
                <Text style={styles.errorText}>{errors.highestEducation}</Text>
              ) : null}
            </View>

            {/* THEOLOGICAL QUALIFICATIONS */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>THEOLOGICAL QUALIFICATIONS</Text>
              <RNTextInput
                style={styles.textInput}
                placeholder="e.g. Diploma in Theology (Dip.Th)"
                placeholderTextColor="#94A3B8"
                value={theologicalQualifications}
                onChangeText={setTheologicalQualifications}
              />
            </View>

            {/* INTERESTED PROGRAM / COURSE */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                INTERESTED PROGRAM / COURSE <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownInput, Boolean(errors.interestedCourse) && styles.inputErrorBorder]}
                onPress={() => setModalType('program')}
              >
                <Text
                  style={interestedCourse ? styles.dropdownTextFilled : styles.dropdownTextPlaceholder}
                  numberOfLines={1}
                >
                  {isLoadingDropdowns ? 'Loading programs...' : selectedProgramName}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
              {errors.interestedCourse ? (
                <Text style={styles.errorText}>{errors.interestedCourse}</Text>
              ) : null}
            </View>

            {/* Upload fields */}
            <Text style={[styles.sectionSubTitle, { marginTop: 12, marginBottom: 12 }]}>
              DOCUMENT ATTACHMENTS (MAX 5MB EACH)
            </Text>

            {DOCUMENT_ITEMS.map((item) => {
              const currentDoc = uploadedDocs[item.key];
              const isUploading = uploadingDocKey === item.key;
              const hasError = Boolean(errors[item.key]);

              return (
                <View key={item.key} style={styles.docRowCard}>
                  <View style={styles.docRowInfo}>
                    <Text style={styles.inputLabel}>
                      {item.label} {item.required ? <Text style={styles.asterisk}>*</Text> : null}
                    </Text>
                    <Text style={styles.docHintText}>{item.hint}</Text>

                    {currentDoc ? (
                      <View style={styles.uploadedFilePill}>
                        <Ionicons name="document-text-outline" size={14} color="#0284C7" />
                        <Text style={styles.uploadedFileName} numberOfLines={1}>
                          {currentDoc.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveDoc(item.key)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={16} color="#EF4444" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {hasError ? <Text style={styles.errorText}>{errors[item.key]}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.docUploadBtn,
                      currentDoc && styles.docUploadBtnSuccess,
                      isUploading && { opacity: 0.6 },
                    ]}
                    onPress={() => handlePickDocument(item.key)}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#0284C7" />
                    ) : currentDoc ? (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 4 }} />
                        <Text style={styles.docUploadBtnSuccessText}>Re-upload</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={16} color="#0284C7" style={{ marginRight: 4 }} />
                        <Text style={styles.docUploadBtnText}>Choose File</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* OTHER SUPPORTING CERTIFICATES / DOCUMENTS */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.inputLabel}>OTHER SUPPORTING CERTIFICATES / DOCUMENTS</Text>
              <TouchableOpacity
                style={styles.dashedUploadBox}
                onPress={() => handlePickDocument('otherCertificates')}
              >
                <Ionicons name="cloud-upload-outline" size={28} color="#0284C7" style={{ marginBottom: 6 }} />
                <Text style={styles.dashedUploadText}>
                  {uploadedDocs.otherCertificates
                    ? `Uploaded: ${uploadedDocs.otherCertificates.name}`
                    : 'Upload Additional Certificate'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 4: Declaration */}
          <View style={styles.cardContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>4. Declaration</Text>
            </View>

            <View style={styles.declarationBox}>
              <View style={styles.declarationHeaderRow}>
                <TouchableOpacity
                  style={[styles.checkboxSquare, declarationAccepted && styles.checkboxSquareChecked]}
                  onPress={() => setDeclarationAccepted(!declarationAccepted)}
                  activeOpacity={0.8}
                >
                  {declarationAccepted ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={styles.declarationHeading}>Student Declaration:</Text>
                  <Text style={styles.declarationBody}>
                    I hereby do declare that all the details and documents which are mentioned above are
                    true to best of my knowledge. I assure that, if I am admitted, I will abide by the
                    rules and regulations of COTRTS-GO. I submit to the right of the Seminary administration
                    to take any appropriate disciplinary action against me, if, in their judgment, my
                    behavior or character is contrary to the emphasis of the seminary.
                  </Text>
                </View>
              </View>

              {errors.declaration ? <Text style={styles.errorText}>{errors.declaration}</Text> : null}
            </View>

            {/* Submit Application Button */}
            <View style={styles.submitRow}>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
                onPress={handleRegister}
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
              <TouchableOpacity onPress={() => router.push('/student/login')}>
                <Text style={styles.loginRedirectLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* DROPDOWN SELECTION MODAL */}
      <Modal
        visible={modalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalType(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setModalType(null)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === 'track'
                  ? 'Select Accreditation / Track'
                  : modalType === 'region'
                    ? 'Select Study Region'
                    : modalType === 'gender'
                      ? 'Select Gender'
                      : modalType === 'marital'
                        ? 'Select Marital Status'
                        : 'Select Program / Course'}
              </Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {modalType === 'track' &&
                trackOptions.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.modalOption,
                      ataStatus === item.value && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setAtaStatus(item.value);
                      setModalType(null);
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

              {modalType === 'region' &&
                regions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.modalOption,
                      regionId === item.id && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setRegionId(item.id);
                      setModalType(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        regionId === item.id && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {regionId === item.id ? (
                      <Ionicons name="checkmark" size={18} color="#0284C7" />
                    ) : null}
                  </TouchableOpacity>
                ))}

              {modalType === 'gender' &&
                genderOptions.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.modalOption,
                      gender === item && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setGender(item);
                      setModalType(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        gender === item && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {gender === item ? (
                      <Ionicons name="checkmark" size={18} color="#0284C7" />
                    ) : null}
                  </TouchableOpacity>
                ))}

              {modalType === 'marital' &&
                maritalOptions.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.modalOption,
                      maritalStatus === item && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setMaritalStatus(item);
                      setModalType(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        maritalStatus === item && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {maritalStatus === item ? (
                      <Ionicons name="checkmark" size={18} color="#0284C7" />
                    ) : null}
                  </TouchableOpacity>
                ))}

              {modalType === 'program' &&
                programs.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.modalOption,
                      interestedCourse === item.id && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setInterestedCourse(item.id);
                      setModalType(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        interestedCourse === item.id && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {interestedCourse === item.id ? (
                      <Ionicons name="checkmark" size={18} color="#0284C7" />
                    ) : null}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9', // Clean light canvas matching user screenshot
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
    marginBottom: 8,
  },
  navBackBtn: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  pageHeader: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 18,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    // Subtle shadow
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionSubTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.8,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  asterisk: {
    color: '#DC2626',
    fontWeight: '800',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  readOnlyInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    color: '#64748B',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: 64,
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownTextPlaceholder: {
    fontSize: 14,
    color: '#94A3B8',
  },
  dropdownTextFilled: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    flex: 1,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
  },
  row: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
  },
  docRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  docRowInfo: {
    flex: 1,
    marginRight: 10,
  },
  docHintText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  uploadedFilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
    maxWidth: 220,
  },
  uploadedFileName: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
    marginLeft: 4,
    flexShrink: 1,
  },
  docUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  docUploadBtnSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  docUploadBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  docUploadBtnSuccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  dashedUploadBox: {
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  dashedUploadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  declarationBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  declarationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxSquareChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  declarationHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  declarationBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  submitRow: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 170,
  },
  submitButtonText: {
    fontSize: 14,
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
    color: '#64748B',
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
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  modalOptionSelected: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  modalOptionText: {
    fontSize: 14,
    color: '#334155',
  },
  modalOptionTextSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
});
