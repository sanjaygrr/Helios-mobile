import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle; iconColor: string } => {
    const variants = {
      primary: {
        container: {
          backgroundColor: colors.primary,
          borderColor: colors.accent,
        },
        text: { color: colors.textOnPrimary },
        iconColor: colors.white,
      },
      secondary: {
        container: {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.secondary,
        },
        text: { color: colors.white },
        iconColor: colors.white,
      },
      outline: {
        container: {
          backgroundColor: 'transparent',
          borderColor: colors.accent,
          borderWidth: 2,
        },
        text: { color: colors.accent },
        iconColor: colors.primary,
      },
      ghost: {
        container: {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        },
        text: { color: colors.accent },
        iconColor: colors.primary,
      },
      danger: {
        container: {
          backgroundColor: colors.danger,
          borderColor: colors.danger,
        },
        text: { color: colors.white },
        iconColor: colors.white,
      },
    };
    return variants[variant];
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle; iconSize: number } => {
    const sizes = {
      sm: {
        container: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.md,
        },
        text: { fontSize: 14 },
        iconSize: 16,
      },
      md: {
        container: {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: borderRadius.lg,
        },
        text: { fontSize: 16 },
        iconSize: 20,
      },
      lg: {
        container: {
          paddingVertical: spacing.md + 4,
          paddingHorizontal: spacing.xl,
          borderRadius: borderRadius.lg,
        },
        text: { fontSize: 18 },
        iconSize: 24,
      },
    };
    return sizes[size];
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        sizeStyles.container,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.iconColor}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={sizeStyles.iconSize}
              color={variantStyles.iconColor}
              style={styles.iconLeft}
            />
          )}
          <Text
            style={[
              styles.text,
              sizeStyles.text,
              variantStyles.text,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={sizeStyles.iconSize}
              color={variantStyles.iconColor}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...shadows.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});
