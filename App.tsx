import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import LoginScreen from './app/screens/LoginScreen';
import MapScreen from './app/screens/MapScreen';
import UnitScreen from './app/screens/UnitScreen';
import ManageUsersScreen from './app/screens/ManageUsersScreen';
import ManageUnitsScreen from './app/screens/ManageUnitsScreen'; // Assumption
import ManageCompaniesScreen from './app/screens/ManageCompaniesScreen';
import IncidentsScreen from './app/screens/IncidentsScreen';
import TrackingHistoryScreen from './app/screens/TrackingHistoryScreen';
import CustomDrawer from './app/components/CustomDrawer';
import CustomHeader from './app/components/CustomHeader';
import TrackingService from './app/components/TrackingService';
import { colors } from './app/theme/colors';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        header: ({ navigation, route }) => (
          <CustomHeader
            navigation={navigation}
            title={route.name === 'Mapa' ? '' : route.name}
            showMenu={true}
          />
        ),
        drawerStyle: {
          backgroundColor: colors.backgroundDark,
          width: 280,
        },
        drawerActiveBackgroundColor: colors.primary,
        drawerActiveTintColor: colors.white,
        drawerInactiveTintColor: colors.gray[300],
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '500',
        },
      }}
    >
      <Drawer.Screen
        name="Mapa"
        component={MapScreen}
        options={{
          title: 'Mapa en Vivo',
        }}
      />
      <Drawer.Screen
        name="Unidad"
        component={UnitScreen}
        options={{
          title: 'Mi Unidad',
        }}
      />
      <Drawer.Screen
        name="Usuarios"
        component={ManageUsersScreen}
        options={{ title: 'Gestión Usuarios' }}
      />
      <Drawer.Screen
        name="Compania"
        component={ManageCompaniesScreen}
        options={{ title: 'Compañías' }}
      />
      <Drawer.Screen // Hidden from auto-menu but accessible if validated
        name="Emergencias"
        component={IncidentsScreen}
        options={{ title: 'Emergencias' }}
      />
      <Drawer.Screen // Hidden from auto-menu but accessible if validated
        name="TrackingHistory"
        component={TrackingHistoryScreen}
        options={{ title: 'Historial de Ruta' }}
      />
    </Drawer.Navigator>
  );
}

import { AuthProvider, useAuth } from './app/context/AuthContext';

// ... (previous imports)

function AppContent() {
  // Can use useAuth here to conditionally render Stack vs Login if desired, 
  // but existing structure uses Stack navigation. We will stick to that.
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainDrawer} />
      </Stack.Navigator>
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
