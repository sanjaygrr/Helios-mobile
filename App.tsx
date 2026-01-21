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
import CustomDrawer from './app/components/CustomDrawer';
import CustomHeader from './app/components/CustomHeader';
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
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
