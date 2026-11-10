import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';
export type ButtonSize = 'medium' | 'large';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  style,
  textStyle,
  ...rest
}) => {
  const getContainerStyle = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base, styles[size]];

    switch (variant) {
      case 'secondary':
        list.push(styles.secondary);
        break;
      case 'outline':
        list.push(styles.outline);
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
        list.push(styles.secondaryText);
        break;
      case 'outline':
        list.push(styles.outlineText);
        break;
      case 'text':
        list.push(styles.textVariantText);
        break;
      case 'primary':
      default:
        list.push(styles.primaryText);
        break;
    }

    return list;
  };

  const loaderColor =
    variant === 'primary' ? '#FFFFFF' : variant === 'secondary' ? '#F8FAFC' : '#38BDF8';

  return (
    <TouchableOpacity
      style={[...getContainerStyle(), style as ViewStyle]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={loaderColor} />
      ) : (
        <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
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
    paddingHorizontal: 20,
    minHeight: 52,
  },
  primary: {
    backgroundColor: '#2563EB',
  },
  secondary: {
    backgroundColor: '#334155',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  textVariant: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    minHeight: 36,
  },
  disabled: {
    opacity: 0.5,
  },
  baseText: {
    fontWeight: '700',
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
  secondaryText: {
    color: '#F8FAFC',
  },
  outlineText: {
    color: '#38BDF8',
  },
  textVariantText: {
    color: '#38BDF8',
  },
});

export default Button;
