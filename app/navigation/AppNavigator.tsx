import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CommonActions,
  NavigationContainer,
  useNavigation,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createStackNavigator,
  type StackNavigationProp,
} from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import MapScreen from '../screens/MapScreen';
import UnitScreen from '../screens/UnitScreen';
import ManageUnitsScreen from '../screens/ManageUnitsScreen';
import ManageCarsScreen from '../screens/ManageCarsScreen';
import ManageUsersScreen from '../screens/ManageUsersScreen';
import ManageCompaniesScreen from '../screens/ManageCompaniesScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MiDespachoScreen from '../screens/MiDespachoScreen';
import MiEstadoScreen from '../screens/MiEstadoScreen';
import DespachoScreen from '../screens/DespachoScreen';
import EmergenciaVivaScreen from '../screens/EmergenciaVivaScreen';
import EstadoVacio from '../components/EstadoVacio';
import { useAuth } from '../context/AuthContext';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  touch,
} from '../theme/colors';
import api from '../services/api';
import type {
  BomberoStackParamList,
  GestionStackParamList,
  MandoRole,
  MandoTabParamList,
  RecursosStackParamList,
  RootStackParamList,
} from './types';

const RootStack = createStackNavigator<RootStackParamList>();
const MandoTabs = createBottomTabNavigator<MandoTabParamList>();
const RecursosStack = createStackNavigator<RecursosStackParamList>();
const GestionStack = createStackNavigator<GestionStackParamList>();
const BomberoStack = createStackNavigator<BomberoStackParamList>();

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type HubItem = {
  key: string;
  title: string;
  description: string;
  icon: IconName;
  onPress: () => void;
  metrica?: number | string;
  metricaEtiqueta?: string;
};

const mandoRoles: MandoRole[] = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'COMPANY_CHIEF',
];

function isMandoRole(role: string | null): role is MandoRole {
  return role !== null && mandoRoles.includes(role as MandoRole);
}

function canAdministrate(role: string | null) {
  return role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN';
}

function ProfileButton() {
  const navigation = useNavigation();

  return (
    <Pressable
      accessibilityLabel="Abrir ajustes"
      accessibilityRole="button"
      hitSlop={spacing.sm}
      onPress={() => navigation.dispatch(CommonActions.navigate('Ajustes'))}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && styles.headerButtonPressed,
      ]}
    >
      <Ionicons name="person-circle-outline" size={spacing.xl} color={colors.white} />
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Volver"
      accessibilityRole="button"
      hitSlop={spacing.sm}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && styles.headerButtonPressed,
      ]}
    >
      <Ionicons name="arrow-back" size={spacing.xl} color={colors.white} />
    </Pressable>
  );
}

function LogoutButton() {
  const { logout } = useAuth();

  return (
    <Pressable
      accessibilityLabel="Cerrar sesión"
      accessibilityRole="button"
      hitSlop={spacing.sm}
      onPress={() => {
        logout().catch(() => undefined);
      }}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && styles.headerButtonPressed,
      ]}
    >
      <Ionicons name="log-out-outline" size={spacing.xl} color={colors.white} />
    </Pressable>
  );
}

// Se evalua al llamarla, no al definirla, asi que `styles` ya existe.
function getSharedHeaderOptions() {
  return {
    headerStyle: styles.header,
    headerTintColor: colors.white,
    headerRight: () => <ProfileButton />,
    headerRightContainerStyle: styles.headerRight,
  };
}

function getDetailHeaderOptions(navigation: { goBack: () => void }) {
  return {
    headerLeft: () => <BackButton onPress={() => navigation.goBack()} />,
    headerLeftContainerStyle: styles.headerLeft,
  };
}

function NavigationHub({
  title,
  description,
  items,
  variante = 'operacion',
}: {
  title: string;
  description: string;
  items: HubItem[];
  variante?: 'operacion' | 'administracion';
}) {
  // Recursos y Gestion usaban el mismo componente con el mismo aspecto, asi que
  // parecian la misma pantalla. Operacion muestra cifras en vivo; administracion
  // es una lista de ajustes, deliberadamente mas callada.
  const esOperacion = variante === 'operacion';
  return (
    <ScrollView
      style={styles.hub}
      contentContainerStyle={styles.hubContent}
      showsVerticalScrollIndicator={false}
    >
      <Text accessibilityRole="header" style={styles.hubTitle}>
        {title}
      </Text>
      <Text style={styles.hubDescription}>{description}</Text>

      <View style={styles.cardList}>
        {items.map((item) => (
          <Pressable
            accessibilityHint={item.description}
            accessibilityRole="button"
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={[styles.cardIcon, !esOperacion && styles.cardIconQuieto]}>
              <Ionicons
                name={item.icon}
                size={spacing.lg}
                color={esOperacion ? colors.primary : colors.textMuted}
              />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
            </View>
            {esOperacion && item.metrica !== undefined && (
              <View style={styles.metrica}>
                <Text style={styles.metricaNumero}>{item.metrica}</Text>
                {!!item.metricaEtiqueta && (
                  <Text style={styles.metricaEtiqueta}>{item.metricaEtiqueta}</Text>
                )}
              </View>
            )}
            <Ionicons
              name="chevron-forward"
              size={spacing.lg}
              color={colors.textMuted}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function RecursosHubScreen() {
  const navigation = useNavigation<
    StackNavigationProp<RecursosStackParamList, 'RecursosInicio'>
  >();
  const { role } = useAuth();

  // Recursos es un tablero, no un menu: muestra cuanto hay de cada cosa.
  const [cifras, setCifras] = React.useState<{ carros?: number; libres?: number }>({});
  React.useEffect(() => {
    let vivo = true;
    api.get('/units/')
      .then(r => {
        if (!vivo) return;
        const lista = Array.isArray(r.data) ? r.data : (r.data?.results ?? []);
        setCifras({
          carros: lista.length,
          libres: lista.filter((u: any) => u.status === 'AVAILABLE').length,
        });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const items: HubItem[] = [
    {
      key: 'unidad',
      title: 'Unidad activa',
      description: 'Revisa la dotación y el estado operativo.',
      icon: 'people-outline',
      onPress: () => navigation.navigate('Unidad'),
    },
  ];

  items.push({
    key: 'carros',
    title: 'Carros',
    description: cifras.libres !== undefined
      ? `${cifras.libres} disponibles para despachar.`
      : 'Los carros y la compañía de cada uno.',
    icon: 'bus-outline',
    metrica: cifras.carros,
    metricaEtiqueta: 'total',
    onPress: () => navigation.navigate('Carros'),
  });
  if (canAdministrate(role)) {
    items.push({
      key: 'unidades',
      title: 'Unidades',
      description: 'La dotación que sale en cada carro.',
      icon: 'albums-outline',
      onPress: () => navigation.navigate('Unidades'),
    });
  }

  return (
    <NavigationHub
      title="Recursos"
      description="Personas y carros disponibles para la operación."
      items={items}
    />
  );
}

function GestionHubScreen() {
  const navigation = useNavigation<
    StackNavigationProp<GestionStackParamList, 'GestionInicio'>
  >();
  const { role } = useAuth();
  const items: HubItem[] = [
    {
      key: 'crear',
      title: 'Crear emergencia',
      description: 'Abre el formulario: clave, dirección, carros y quién va.',
      icon: 'add-circle',
      onPress: () => navigation.navigate('Emergencias', { crear: true }),
    },
    {
      key: 'emergencias',
      title: 'Emergencias',
      description: 'Las que ya están abiertas.',
      icon: 'flame-outline',
      onPress: () => navigation.navigate('Emergencias'),
    },
    {
      key: 'usuarios',
      title: 'Usuarios',
      description: 'Bomberos, capitanes y mandos.',
      icon: 'people-outline',
      onPress: () => navigation.navigate('Usuarios'),
    },
    {
      key: 'companias',
      title: 'Compañías',
      description: 'Los cuarteles y las compañías del cuerpo.',
      icon: 'business-outline',
      onPress: () => navigation.navigate('Companias'),
    },
  ];

  return (
    <NavigationHub
      variante="administracion"
      title="Gestión"
      description="Herramientas operativas según tu responsabilidad."
      items={items}
    />
  );
}

function RecursosNavigator() {
  const { role } = useAuth();
  const showAdministrativeRoutes = canAdministrate(role);

  return (
    <RecursosStack.Navigator screenOptions={getSharedHeaderOptions()}>
      <RecursosStack.Screen
        name="RecursosInicio"
        component={RecursosHubScreen}
        options={{ title: 'Recursos' }}
      />
      <RecursosStack.Screen
        name="Unidad"
        component={UnitScreen}
        options={({ navigation }) => ({
          title: 'Unidad activa',
          ...getDetailHeaderOptions(navigation),
        })}
      />
      <RecursosStack.Screen
        name="Carros"
        component={ManageCarsScreen}
        options={({ navigation }) => ({
          title: 'Carros',
          ...getDetailHeaderOptions(navigation),
        })}
      />
      {showAdministrativeRoutes && (
        <RecursosStack.Screen
          name="Unidades"
          component={ManageUnitsScreen}
          options={({ navigation }) => ({
            title: 'Unidades',
            ...getDetailHeaderOptions(navigation),
          })}
        />
      )}
    </RecursosStack.Navigator>
  );
}

function GestionNavigator() {
  return (
    <GestionStack.Navigator screenOptions={getSharedHeaderOptions()}>
      <GestionStack.Screen
        name="GestionInicio"
        component={GestionHubScreen}
        options={{ title: 'Gestión' }}
      />
      <GestionStack.Screen
        name="Usuarios"
        component={ManageUsersScreen}
        options={({ navigation }) => ({
          title: 'Usuarios',
          ...getDetailHeaderOptions(navigation),
        })}
      />
      <GestionStack.Screen
        name="Companias"
        component={ManageCompaniesScreen}
        options={({ navigation }) => ({
          title: 'Compañías',
          ...getDetailHeaderOptions(navigation),
        })}
      />
      <GestionStack.Screen
        name="Emergencias"
        component={IncidentsScreen}
        options={({ navigation }) => ({
          title: 'Emergencias',
          ...getDetailHeaderOptions(navigation),
        })}
      />
    </GestionStack.Navigator>
  );
}

function getTabIcon(routeName: keyof MandoTabParamList, focused: boolean): IconName {
  switch (routeName) {
    case 'Mapa':
      return focused ? 'map' : 'map-outline';
    case 'Recursos':
      return focused ? 'people' : 'people-outline';
    case 'Gestion':
      return focused ? 'construct' : 'construct-outline';
  }
}

function MandoTabsNavigator() {
  return (
    <MandoTabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: styles.header,
        headerTintColor: colors.white,
        headerRight: () => <ProfileButton />,
        headerRightContainerStyle: styles.headerRight,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons name={getTabIcon(route.name, focused)} size={size} color={color} />
        ),
      })}
    >
      <MandoTabs.Screen
        name="Mapa"
        component={MapScreen}
        options={{ title: 'Mapa' }}
      />
      <MandoTabs.Screen
        name="Recursos"
        component={RecursosNavigator}
        options={{ headerShown: false, title: 'Recursos' }}
      />
      <MandoTabs.Screen
        name="Gestion"
        component={GestionNavigator}
        options={{ headerShown: false, title: 'Gestión' }}
      />
    </MandoTabs.Navigator>
  );
}

function BomberoNavigator() {
  // Abre en Mi despacho: cuando a un bombero lo mandan a una emergencia, eso es
  // lo unico que tiene que ver al desbloquear el telefono.
  return (
    <BomberoStack.Navigator screenOptions={getSharedHeaderOptions()}>
      <BomberoStack.Screen
        name="MiDespacho"
        component={MiDespachoScreen}
        options={{ title: 'Mi despacho' }}
      />
      <BomberoStack.Screen
        name="MiEstado"
        component={MiEstadoScreen}
        options={{ title: 'Mi estado' }}
      />
    </BomberoStack.Navigator>
  );
}

function RoleNavigator() {
  const { role, logout } = useAuth();

  if (role === 'FIREFIGHTER') {
    return <BomberoNavigator />;
  }

  if (isMandoRole(role)) {
    return <MandoTabsNavigator />;
  }

  return (
    <EstadoVacio
      icono="alert-circle-outline"
      titulo="Perfil sin acceso"
      texto="No pudimos determinar qué navegación corresponde a tu cuenta."
      botonTexto="Cerrar sesión"
      onPressBoton={() => {
        logout().catch(() => undefined);
      }}
    />
  );
}

function RootNavigator() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando tu cuenta…</Text>
      </View>
    );
  }

  return (
    <RootStack.Navigator
      key={user ? 'authenticated' : 'anonymous'}
      initialRouteName={user ? 'Main' : 'Login'}
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="Main" component={RoleNavigator} />
      {isMandoRole(role) ? (
        <>
          <RootStack.Screen name="Despacho" component={DespachoScreen} />
          <RootStack.Screen name="EmergenciaViva" component={EmergenciaVivaScreen} />
        </>
      ) : null}
      <RootStack.Screen
        name="Ajustes"
        component={SettingsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerStyle: styles.header,
          headerTintColor: colors.white,
          title: 'Ajustes',
          headerLeft: () => <BackButton onPress={() => navigation.goBack()} />,
          headerLeftContainerStyle: styles.headerLeft,
          headerRight: () => <LogoutButton />,
          headerRightContainerStyle: styles.headerRight,
        })}
      />
    </RootStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: borderRadius.md,
    height: touch,
    justifyContent: 'center',
    width: touch,
  },
  headerButtonPressed: {
    backgroundColor: colors.pressOverlay,
  },
  headerRight: {
    paddingRight: spacing.sm,
  },
  headerLeft: {
    paddingLeft: spacing.sm,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    minHeight: touch,
  },
  tabBarItem: {
    minHeight: touch,
  },
  hub: {
    backgroundColor: colors.background,
    flex: 1,
  },
  hubContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  hubTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  hubDescription: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  cardList: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: touch,
    padding: spacing.md,
    ...shadows.sm,
  },
  metrica: { alignItems: 'flex-end', minWidth: 54 },
  metricaNumero: {
    fontSize: 26, fontWeight: '700', color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  metricaEtiqueta: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    textTransform: 'uppercase', color: colors.textMuted, marginTop: 1,
  },
  cardIconQuieto: { backgroundColor: colors.surfaceRaised },
  cardPressed: {
    backgroundColor: colors.pressOverlay,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    height: touch,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: touch,
  },
  cardText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  cardDescription: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
