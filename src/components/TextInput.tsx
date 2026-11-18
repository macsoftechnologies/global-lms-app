import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  containerStyle,
  isPassword = false,
  leftIcon,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const { isDarkMode } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: isDarkMode ? '#161F30' : '#FFFFFF',
            borderColor: error
              ? '#EF4444'
              : isFocused
              ? isDarkMode
                ? '#818CF8'
                : '#4F46E5'
              : isDarkMode
              ? '#283548'
              : '#CBD5E1',
          },
          isFocused && styles.inputFocusedShadow,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            color={
              error
                ? '#EF4444'
                : isFocused
                ? isDarkMode
                  ? '#818CF8'
                  : '#4F46E5'
                : isDarkMode
                ? '#64748B'
                : '#94A3B8'
            }
            style={styles.leftIconStyle}
          />
        ) : null}

        <RNTextInput
          style={[
            styles.input,
            { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
            style,
          ]}
          placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword((prev) => !prev)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={isDarkMode ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color="#EF4444" style={{ marginRight: 4 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  inputFocusedShadow: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  leftIconStyle: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    marginTop: 5,
  },
});

export default TextInput;
