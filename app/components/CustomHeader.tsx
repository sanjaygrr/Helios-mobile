import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, spacing } from '../theme/colors';

interface CustomHeaderProps {
  navigation: any;
  title?: string;
  showMenu?: boolean;
  showBack?: boolean;
}

export default function CustomHeader({
  navigation,
  title,
  showMenu = true,
  showBack = false,
}: CustomHeaderProps) {
  const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <View style={styles.content}>
        {/* Left side - Menu or Back button */}
        <View style={styles.leftSection}>
          {showMenu && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => navigation.openDrawer()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="menu" size={28} color={colors.white} />
            </TouchableOpacity>
          )}
          {showBack && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={28} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center - Logo/Title */}
        <View style={styles.centerSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="flame" size={24} color={colors.accent} />
            <Text style={styles.logoText}>Helios</Text>
          </View>
          {title ? <Text style={styles.subtitle}>{title}</Text> : null}
        </View>

        {/* Right side - placeholder for balance */}
        <View style={styles.rightSection} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    ...shadows.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacing.md,
  },
  leftSection: {
    width: 48,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSection: {
    width: 48,
  },
  menuButton: {
    padding: spacing.xs,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.gray[200],
    marginTop: 2,
  },
});
