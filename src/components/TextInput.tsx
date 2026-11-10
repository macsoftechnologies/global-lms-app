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

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  containerStyle,
  isPassword = false,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
        ]}
      >
        <RNTextInput
          style={[styles.input, style]}
          placeholderTextColor="#64748B"
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
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
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
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    height: 48,
    color: '#F8FAFC',
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  eyeText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
});

export default TextInput;
