import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { LmsAuthService } from '../../src/services/lmsAuthService';

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

interface PasswordFieldConfig {
  key: keyof FieldErrors;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  error?: string;
  helper?: string;
}

export default function StudentChangePasswordScreen() {
  const { isDarkMode, theme } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldFeedback = (field: keyof FieldErrors) => {
    setApiError(null);
    setSuccessMessage(null);
    setFieldErrors((prev) => {
      const clearNewMismatch =
        field === 'currentPassword' &&
        prev.newPassword === 'New password must be different from your current password.';
      const clearConfirmMismatch =
        field === 'newPassword' &&
        prev.confirmPassword === 'New password and confirmation do not match.';

      if (!prev[field] && !clearNewMismatch && !clearConfirmMismatch) {
        return prev;
      }

      return {
        ...prev,
        [field]: undefined,
        ...(clearNewMismatch ? { newPassword: undefined } : {}),
        ...(clearConfirmMismatch ? { confirmPassword: undefined } : {}),
      };
    });
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required.';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters.';
    } else if (currentPassword && newPassword === currentPassword) {
      errors.newPassword = 'New password must be different from your current password.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.';
    } else if (newPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = 'New password and confirmation do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setApiError(null);
    setSuccessMessage(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await LmsAuthService.changePassword({
        old_password: currentPassword,
        new_password: newPassword,
      });

      if (response.success) {
        const msg =
          response.data?.message ||
          'Your password has been updated successfully.';
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setFieldErrors({});
        setSuccessMessage(msg);

        Alert.alert(
          'Password Updated',
          `${msg} Please use your new password the next time you sign in.`,
          [
            {
              text: 'Done',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        setApiError(
          response.error || 'Could not update password. Please verify your current password.'
        );
      }
    } catch (err: unknown) {
      setApiError(
        err instanceof Error ? err.message : 'Network error while updating password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordFields: PasswordFieldConfig[] = [
    {
      key: 'currentPassword',
      label: 'Current Password',
      placeholder: 'Enter your current password',
      value: currentPassword,
      onChangeText: (text) => {
        setCurrentPassword(text);
        clearFieldFeedback('currentPassword');
      },
      visible: showCurrent,
      onToggleVisibility: () => setShowCurrent((prev) => !prev),
      error: fieldErrors.currentPassword,
    },
    {
      key: 'newPassword',
      label: 'New Password',
      placeholder: 'At least 8 characters',
      value: newPassword,
      onChangeText: (text) => {
        setNewPassword(text);
        clearFieldFeedback('newPassword');
      },
      visible: showNew,
      onToggleVisibility: () => setShowNew((prev) => !prev),
      error: fieldErrors.newPassword,
      helper: 'Use at least 8 characters and avoid reusing your current password.',
    },
    {
      key: 'confirmPassword',
      label: 'Confirm New Password',
      placeholder: 'Re-enter your new password',
      value: confirmPassword,
      onChangeText: (text) => {
        setConfirmPassword(text);
        clearFieldFeedback('confirmPassword');
      },
      visible: showConfirm,
      onToggleVisibility: () => setShowConfirm((prev) => !prev),
      error: fieldErrors.confirmPassword,
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
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
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Change Password</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Account Security
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Info Banner */}
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.14)' : '#EEF2FF',
                borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
              },
            ]}
          >
            <View
              style={[
                styles.infoIconBox,
                { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.25)' : '#E0E7FF' },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={22} color={theme.primary} />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>
                Keep Your Account Protected
              </Text>
              <Text style={[styles.infoDesc, { color: theme.textSecondary }]}>
                Enter your current password and choose a strong new password for future sign-ins.
              </Text>
            </View>
          </View>

          {/* Error Feedback Banner */}
          {apiError && (
            <View
              style={[
                styles.feedbackBanner,
                {
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
                  borderColor: isDarkMode ? 'rgba(248, 113, 113, 0.45)' : '#FECACA',
                },
              ]}
            >
              <Ionicons name="alert-circle" size={20} color={theme.statusDanger} />
              <Text style={[styles.feedbackText, { color: theme.statusDanger }]}>
                {apiError}
              </Text>
            </View>
          )}

          {/* Success Feedback Banner */}
          {successMessage && (
            <View
              style={[
                styles.feedbackBanner,
                {
                  backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
                  borderColor: isDarkMode ? 'rgba(52, 211, 153, 0.45)' : '#A7F3D0',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={20} color={theme.statusSuccess} />
              <Text style={[styles.feedbackText, { color: theme.statusSuccess }]}>
                {successMessage}
              </Text>
            </View>
          )}

          {/* Password Form Card */}
          <View
            style={[
              styles.formCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            {passwordFields.map((field) => (
              <View key={field.key} style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  {field.label} <Text style={styles.requiredMark}>*</Text>
                </Text>

                <View
                  style={[
                    styles.inputRow,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: field.error ? theme.statusDanger : theme.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={field.error ? theme.statusDanger : theme.textMuted}
                    style={styles.leadingIcon}
                  />
                  <TextInput
                    key={field.key}
                    nativeID={field.key}
                    testID={field.key}
                    style={[styles.textInput, { color: theme.textPrimary }]}
                    placeholder={field.placeholder}
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!field.visible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={field.key === 'currentPassword' ? 'current-password' : 'new-password'}
                    importantForAutofill={field.key === 'currentPassword' ? 'yes' : 'no'}
                    textContentType={field.key === 'currentPassword' ? 'password' : 'newPassword'}
                    editable={!isSubmitting}
                    value={field.value}
                    onChangeText={field.onChangeText}
                  />
                  <TouchableOpacity
                    onPress={field.onToggleVisibility}
                    style={styles.eyeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={field.visible ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {field.error ? (
                  <Text style={[styles.errorText, { color: theme.statusDanger }]}>
                    {field.error}
                  </Text>
                ) : field.helper ? (
                  <Text style={[styles.helperText, { color: theme.textMuted }]}>
                    {field.helper}
                  </Text>
                ) : null}
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.primary },
                isSubmitting && { opacity: 0.72 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Updating Password...</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Update Password</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 16,
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
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  requiredMark: {
    color: '#EF4444',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  leadingIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 11,
  },
  eyeButton: {
    paddingLeft: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

