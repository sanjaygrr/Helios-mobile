import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

interface CustomDrawerProps {
  navigation: any;
  state: any;
  descriptors: any;
}

export default function CustomDrawer(props: CustomDrawerProps) {
  const { navigation } = props;
  const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

  const menuItems = [
    { name: 'Mapa', icon: 'map', label: 'Mapa en Vivo' },
    { name: 'Unidad', icon: 'people', label: 'Mi Unidad' },
  ];

  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      {/* Header del Drawer */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIconContainer}>
            <Ionicons name="flame" size={32} color={colors.accent} />
          </View>
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoText}>Helios</Text>
            <Text style={styles.logoSubtext}>Fire Command</Text>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={colors.white} />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>Usuario Demo</Text>
            <Text style={styles.userRole}>Team Leader</Text>
          </View>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        <Text style={styles.menuSection}>NAVEGACION</Text>

        {menuItems.map((item) => {
          const isActive = props.state.routeNames[props.state.index] === item.name;

          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              onPress={() => navigation.navigate(item.name)}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={isActive ? colors.white : colors.gray[400]}
              />
              <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Additional Options */}
      <View style={styles.menuContainer}>
        <Text style={styles.menuSection}>OPCIONES</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="settings-outline" size={22} color={colors.gray[400]} />
          <Text style={styles.menuLabel}>Configuracion</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="help-circle-outline" size={22} color={colors.gray[400]} />
          <Text style={styles.menuLabel}>Ayuda</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={styles.logoutText}>Cerrar Sesion</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(239, 141, 50, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTextContainer: {
    marginLeft: spacing.md,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 2,
  },
  logoSubtext: {
    fontSize: 12,
    color: colors.gray[400],
    letterSpacing: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  userRole: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 2,
  },
  menuContainer: {
    padding: spacing.md,
  },
  menuSection: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray[500],
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    position: 'relative',
  },
  menuItemActive: {
    backgroundColor: colors.primary,
  },
  menuLabel: {
    fontSize: 15,
    color: colors.gray[300],
    marginLeft: spacing.md,
    fontWeight: '500',
  },
  menuLabelActive: {
    color: colors.white,
  },
  activeIndicator: {
    position: 'absolute',
    right: spacing.md,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: spacing.lg,
  },
  footer: {
    marginTop: 'auto',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutText: {
    fontSize: 15,
    color: colors.danger,
    marginLeft: spacing.md,
    fontWeight: '500',
  },
  version: {
    fontSize: 11,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
