import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';
export type ButtonSize = 'medium' | 'large';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  ...rest
}) => {
  const { isDarkMode } = useTheme();

  const getContainerStyle = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base, styles[size]];

    switch (variant) {
      case 'secondary':
        list.push(isDarkMode ? styles.secondaryDark : styles.secondaryLight);
        break;
      case 'outline':
        list.push(isDarkMode ? styles.outlineDark : styles.outlineLight);
        break;
      case 'text':
        list.push(styles.textVariant);
        break;
      case 'primary':
      default:
        list.push(styles.primary);
        break;
    }

    if (disabled || loading) {
      list.push(styles.disabled);
    }

    return list;
  };

  const getTextStyle = (): TextStyle[] => {
    const list: TextStyle[] = [styles.baseText, styles[`${size}Text`]];

    switch (variant) {
      case 'secondary':
        list.push(isDarkMode ? styles.secondaryDarkText : styles.secondaryLightText);
        break;
      case 'outline':
        list.push(isDarkMode ? styles.outlineDarkText : styles.outlineLightText);
        break;
      case 'text':
        list.push(isDarkMode ? styles.textVariantDarkText : styles.textVariantLightText);
        break;
      case 'primary':
      default:
        list.push(styles.primaryText);
        break;
    }

    return list;
  };

  const loaderColor =
    variant === 'primary'
      ? '#FFFFFF'
      : isDarkMode
      ? '#818CF8'
      : '#4F46E5';

  return (
    <TouchableOpacity
      style={[...getContainerStyle(), style as ViewStyle]}
      disabled={disabled || loading}
      activeOpacity={0.82}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={loaderColor} />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text style={[...getTextStyle(), textStyle, icon ? { marginLeft: 8 } : null]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  medium: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  large: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 52,
  },
  primary: {
    backgroundColor: '#4F46E5',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  secondaryLight: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  secondaryDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  outlineLight: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#4F46E5',
  },
  outlineDark: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#818CF8',
  },
  textVariant: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    minHeight: 36,
  },
  disabled: {
    opacity: 0.55,
    elevation: 0,
    shadowOpacity: 0,
  },
  baseText: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  mediumText: {
    fontSize: 14,
  },
  largeText: {
    fontSize: 16,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryLightText: {
    color: '#4F46E5',
  },
  secondaryDarkText: {
    color: '#F8FAFC',
  },
  outlineLightText: {
    color: '#4F46E5',
  },
  outlineDarkText: {
    color: '#818CF8',
  },
  textVariantLightText: {
    color: '#4F46E5',
  },
  textVariantDarkText: {
    color: '#818CF8',
  },
});

export default Button;
