import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native';

interface NotificationBadgeProps {
  count?: number;
  maxCount?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  showZero?: boolean;
  variant?: 'pill' | 'dot';
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count = 0,
  maxCount = 99,
  style,
  textStyle,
  showZero = false,
  variant = 'pill',
}) => {
  if (count <= 0 && !showZero) {
    return null;
  }

  if (variant === 'dot') {
    return <View style={[styles.dotBadge, style]} />;
  }

  const displayText = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <View style={[styles.badgeContainer, style]}>
      <Text style={[styles.badgeText, textStyle]}>{displayText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dotBadge: {
    backgroundColor: '#EF4444',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 12,
  },
});

export default NotificationBadge;

