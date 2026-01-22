import React, { useState, createContext, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, Platform, StatusBar as RNStatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './app/screens/LoginScreen';
import MapScreen from './app/screens/MapScreen';
import UnitScreen from './app/screens/UnitScreen';
import ManageUsersScreen from './app/screens/ManageUsersScreen';
import ManageUnitsScreen from './app/screens/ManageUnitsScreen';
import ManageCompaniesScreen from './app/screens/ManageCompaniesScreen';
import IncidentsScreen from './app/screens/IncidentsScreen';
import TrackingHistoryScreen from './app/screens/TrackingHistoryScreen';
import CustomHeader from './app/components/CustomHeader';
import TrackingService from './app/components/TrackingService';
import { colors, spacing, borderRadius } from './app/theme/colors';
import { AuthProvider, useAuth } from './app/context/AuthContext';

const Stack = createStackNavigator();

// Menu Context
const MenuContext = createContext<{
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}>({
  isMenuOpen: false,
  openMenu: () => {},
  closeMenu: () => {},
});

export const useMenu = () => useContext(MenuContext);

// Menu Modal Component
function MenuModal({ navigation }: { navigation: any }) {
  const { isMenuOpen, closeMenu } = useMenu();
  const { user, role, logout } = useAuth();
  const statusBarHeight = Platform.OS === 'ios' ? 44 : RNStatusBar.currentHeight || 24;

  const getRoleLabel = (r: string | null) => {
    switch (r) {
      case 'SUPER_ADMIN': return 'Administrador Total';
      case 'COMPANY_ADMIN': return 'Comandante';
      case 'COMPANY_CHIEF': return 'Jefe de Compania';
      case 'FIREFIGHTER': return 'Bombero';
      default: return 'Usuario';
    }
  };

  const menuItems = [
    { name: 'Mapa', icon: 'map', label: 'Mapa en Vivo', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_CHIEF', 'FIREFIGHTER'] },
    { name: 'Unidad', icon: 'car', label: 'Mi Unidad', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_CHIEF'] },
    { name: 'Usuarios', icon: 'people', label: 'Gestion Usuarios', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
    { name: 'Compania', icon: 'business', label: 'Companias', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
    { name: 'Emergencias', icon: 'flame', label: 'Emergencias', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_CHIEF'] },
    { name: 'TrackingHistory', icon: 'trail-sign', label: 'Historial Ruta', roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_CHIEF'] },
  ];

  const filteredItems = menuItems.filter(item =>
    !item.roles || (role && item.roles.includes(role))
  );

  const handleNavigate = (screenName: string) => {
    closeMenu();
    navigation.navigate(screenName);
  };

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <Modal
      visible={isMenuOpen}
      transparent
      animationType="fade"
      onRequestClose={closeMenu}
    >
      <TouchableWithoutFeedback onPress={closeMenu}>
        <View style={menuStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[menuStyles.container, { paddingTop: statusBarHeight + 10 }]}>
              {/* Header */}
              <View style={menuStyles.header}>
                <View style={menuStyles.logoContainer}>
                  <Ionicons name="flame" size={28} color={colors.accent} />
                  <Text style={menuStyles.logoText}>Helios</Text>
                </View>
                <TouchableOpacity onPress={closeMenu} style={menuStyles.closeButton}>
                  <Ionicons name="close" size={28} color={colors.white} />
                </TouchableOpacity>
              </View>

              {/* User Info */}
              <View style={menuStyles.userInfo}>
                <View style={menuStyles.avatar}>
                  <Ionicons name="person" size={20} color={colors.white} />
                </View>
                <View style={menuStyles.userDetails}>
                  <Text style={menuStyles.userName}>{user?.email?.split('@')[0] || 'Usuario'}</Text>
                  <Text style={menuStyles.userRole}>{getRoleLabel(role)}</Text>
                </View>
              </View>

              {/* Menu Items */}
              <View style={menuStyles.menuContainer}>
                {filteredItems.map((item) => (
                  <TouchableOpacity
                    key={item.name}
                    style={menuStyles.menuItem}
                    onPress={() => handleNavigate(item.name)}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={22}
                      color={colors.gray[300]}
                    />
                    <Text style={menuStyles.menuLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Logout */}
              <View style={menuStyles.footer}>
                <TouchableOpacity style={menuStyles.logoutButton} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                  <Text style={menuStyles.logoutText}>Cerrar Sesion</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const menuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    width: 280,
    height: '100%',
    backgroundColor: colors.backgroundDark,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    marginLeft: spacing.sm,
    letterSpacing: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  userRole: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 2,
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  menuLabel: {
    fontSize: 15,
    color: colors.gray[300],
    marginLeft: spacing.md,
    fontWeight: '500',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: spacing.md,
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
});

// Menu Provider Component
function MenuProvider({ children, navigation }: { children: React.ReactNode; navigation: any }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <MenuContext.Provider value={{
      isMenuOpen,
      openMenu: () => setIsMenuOpen(true),
      closeMenu: () => setIsMenuOpen(false),
    }}>
      {children}
      <MenuModal navigation={navigation} />
    </MenuContext.Provider>
  );
}

// Main Navigator with screens
function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        header: ({ navigation, route }) => (
          <CustomHeader
            navigation={navigation}
            title={route.name === 'Mapa' ? '' : route.name}
            showMenu={true}
          />
        ),
      }}
    >
      <Stack.Screen name="Mapa" component={MapScreen} />
      <Stack.Screen name="Unidad" component={UnitScreen} />
      <Stack.Screen name="Unidades" component={ManageUnitsScreen} />
      <Stack.Screen name="Usuarios" component={ManageUsersScreen} />
      <Stack.Screen name="Compania" component={ManageCompaniesScreen} />
      <Stack.Screen name="Emergencias" component={IncidentsScreen} />
      <Stack.Screen name="TrackingHistory" component={TrackingHistoryScreen} />
    </Stack.Navigator>
  );
}

function AppContent() {
  const navigationRef = React.useRef<any>(null);
  const [navReady, setNavReady] = useState(false);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => setNavReady(true)}
    >
      <StatusBar style="light" />
      {navReady && navigationRef.current && (
        <MenuProvider navigation={navigationRef.current}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Main" component={MainNavigator} />
          </Stack.Navigator>
        </MenuProvider>
      )}
      {!navReady && (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main" component={MainNavigator} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <AuthProvider>
        <TrackingService />
        <AppContent />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
