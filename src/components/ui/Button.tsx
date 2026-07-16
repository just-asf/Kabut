import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Radius, Spacing, Typography, Fonts } from '@/constants/theme';
import { useColorScheme } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined';
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox' | 'radio' | 'link';
  style?: any;
}

export function Button({
  label,
  onPress,
  variant = 'filled',
  loading = false,
  disabled = false,
  children,
  accessibilityLabel,
  accessibilityRole = 'button',
  style,
}: ButtonProps) {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeScheme];

  const buttonStyle = [
    styles.button,
    variant === 'filled'
      ? { backgroundColor: colors.primary }
      : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    disabled && { opacity: 0.5 },
    style,
  ];

  const textStyle = [
    styles.text,
    variant === 'filled'
      ? { color: '#ffffff' }
      : { color: colors.text },
  ];

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        buttonStyle,
        pressed && !disabled && !loading && { transform: [{ scale: 0.98 }] },
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'filled' ? '#ffffff' : colors.text} />
      ) : (
        <>
          <Text style={textStyle}>{label}</Text>
          {children}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  text: {
    fontFamily: Fonts.sans,
    fontSize: Typography.button.fontSize,
    fontWeight: Typography.button.fontWeight,
    lineHeight: Typography.button.lineHeight,
  },
});
