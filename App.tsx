import React, { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator from './app/navigation/AppNavigator';
import TrackingService from './app/components/TrackingService';
import { AuthProvider } from './app/context/AuthContext';

// CustomHeader todavía importa este hook. La navegación nueva ya no abre un
// menú lateral, pero mantenemos el contrato hasta retirar ese componente.
const LegacyMenuContext = createContext({
  isMenuOpen: false,
  openMenu: () => undefined,
  closeMenu: () => undefined,
});

export const useMenu = () => useContext(LegacyMenuContext);

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <AuthProvider>
        <TrackingService />
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
