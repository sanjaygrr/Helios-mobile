import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
}

export default function Card({
  children,
  title,
  icon,
  iconColor = colors.primary,
  style,
  variant = 'default',
}: CardProps) {
  const getVariantStyles = (): ViewStyle => {
    const variants = {
      default: {
        backgroundColor: colors.surface,
        ...shadows.sm,
      },
      elevated: {
        backgroundColor: colors.surface,
        ...shadows.lg,
      },
      outlined: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.gray[200],
      },
    };
    return variants[variant];
  };

  return (
    <View style={[styles.container, getVariantStyles(), style]}>
      {(title || icon) && (
        <View style={styles.header}>
          {icon && (
            <Ionicons name={icon} size={20} color={iconColor} />
          )}
          {title && <Text style={styles.title}>{title}</Text>}
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
});
