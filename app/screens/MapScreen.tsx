import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import WebSocketService from '../services/websocket';
import { fetchFireData, FirePoint } from '../services/nasa';
import { fetchWeatherData, WeatherData } from '../services/weather';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

interface LocationData {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
  };
  timestamp: number;
}

interface OtherUser {
  id: number;
  latitude: number;
  longitude: number;
  role?: string;
  email?: string;
  assigned_incident?: {
    id: number;
    title: string;
    incident_type: string;
  } | null;
  timestamp?: number;
}

// Optimized Fire Marker with delayed tracking update
const FireMarker = React.memo(({ fire, color }: { fire: FirePoint; color: string }) => {
  // Keep optimization for Fires because there are MANY
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    if (tracksViewChanges) {
      const timer = setTimeout(() => {
        setTracksViewChanges(false);
      }, 1000); // Increased timeout to be safe
      return () => clearTimeout(timer);
    }
  }, [tracksViewChanges]);

  return (
    <Marker
      coordinate={{ latitude: fire.latitude, longitude: fire.longitude }}
      zIndex={1}
      tracksViewChanges={tracksViewChanges}
    >
      <Ionicons name="flame" size={24} color={color} />
    </Marker>
  );
});

// Custom User Marker Wrapper
const UserMarker = ({ coordinate, role, isSelf = false, onPress }: any) => {
  // Icons need to always track view changes initially or they might be invisible on some Androids
  const getIcon = () => {
    // Jefe -> Fire Truck
    if (role === 'COMPANY_CHIEF') {
      return <MaterialCommunityIcons name="fire-truck" size={isSelf ? 28 : 24} color={colors.white} />;
    }
    // Comandante -> Hard Hat
    if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') {
      return <MaterialCommunityIcons name="hard-hat" size={isSelf ? 28 : 24} color={colors.white} />;
    }
    // Firefighter -> Person with Helmet (account-hard-hat)
    return <MaterialCommunityIcons name="account-hard-hat" size={isSelf ? 28 : 24} color={colors.white} />;
  };

  return (
    <Marker
      coordinate={coordinate}
      zIndex={isSelf ? 999 : 990}
      tracksViewChanges={true} // Always track for users to prevent invisible icons
      onPress={onPress}
    >
      <View style={isSelf ? styles.myLocationMarker : styles.otherUserMarker}>
        {getIcon()}
      </View>
    </Marker>
  );
};

export default function MapScreen() {
  const { user } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [otherUsers, setOtherUsers] = useState<{ [key: number]: OtherUser }>({});
  const [fireData, setFireData] = useState<FirePoint[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  const [showFires, setShowFires] = useState(true);
  const [selectedItem, setSelectedItem] = useState<OtherUser | null>(null);

  const mapRef = useRef<MapView>(null);

  // --- Helpers ---

  const getFireColor = (brightness: number): string => {
    if (brightness < 320) return '#00FF00';
    if (brightness < 340) return '#FFFF00';
    if (brightness < 360) return '#FFA500';
    return '#FF0000';
  };

  const getUserLabel = (u: OtherUser) => {
    if (u.role === 'COMPANY_CHIEF') return 'Jefe de Compañía';
    if (u.role === 'SUPER_ADMIN' || u.role === 'COMPANY_ADMIN') return 'Comandante';
    return `Usuario ${u.id}`;
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500);
    }
  };

  // --- Optimization: Filter Fire Data ---
  const visibleFires = useMemo(() => {
    if (!showFires || !currentRegion || !fireData.length) return [];

    // Broad phase filter
    const latDelta = currentRegion.latitudeDelta * 2;
    const lngDelta = currentRegion.longitudeDelta * 2;
    const minLat = currentRegion.latitude - latDelta;
    const maxLat = currentRegion.latitude + latDelta;
    const minLng = currentRegion.longitude - lngDelta;
    const maxLng = currentRegion.longitude + lngDelta;

    const inViewport = fireData.filter(f =>
      f.latitude >= minLat && f.latitude <= maxLat &&
      f.longitude >= minLng && f.longitude <= maxLng
    );

    // Sort closest 60
    inViewport.sort((a, b) => {
      const distA = Math.pow(a.latitude - currentRegion.latitude, 2) + Math.pow(a.longitude - currentRegion.longitude, 2);
      const distB = Math.pow(b.latitude - currentRegion.latitude, 2) + Math.pow(b.longitude - currentRegion.longitude, 2);
      return distA - distB;
    });

    return inViewport.slice(0, 60);
  }, [fireData, currentRegion, showFires]);

  // --- Effects ---

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permiso de ubicación denegado');
        return;
      }

      WebSocketService.connect();

      const unsubscribe = WebSocketService.subscribe((data: OtherUser) => {
        if (data.id && data.id !== user?.id) {
          setOtherUsers(prev => ({ ...prev, [data.id]: data }));
        }
      });

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => {
          setLocation(loc as LocationData);
          if (isTracking && user) {
            WebSocketService.sendLocation(
              loc.coords.latitude,
              loc.coords.longitude,
              user.id,
              user.role
            );
          }
        }
      );

      return () => {
        unsubscribe();
      };
    };

    startTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [isTracking, user]);

  useEffect(() => {
    if (location) {
      if (fireData.length === 0) fetchFireData().then(setFireData);
      if (!weatherData) fetchWeatherData(location.coords.latitude, location.coords.longitude).then(setWeatherData);
    }
  }, [location]);

  useEffect(() => {
    if (location && !currentRegion) {
      setCurrentRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  }, [location]);


  // --- Render ---

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={false} // Disable System Blue Dot
        showsCompass={true}
        mapType="hybrid"
        onPress={() => setSelectedItem(null)}
        onRegionChangeComplete={setCurrentRegion}
      >
        {/* Custom User Icon (NOW this is the only indicator of self) */}
        <UserMarker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          role={user?.role}
          isSelf={true}
          onPress={() => setSelectedItem({
            id: user?.id || 0,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            role: user?.role,
            email: user?.email,
            // Self usually knows their assignment via Context or separate fetch, 
            // but purely for map info we can leave undefined or fetch.
          })}
        />

        {/* Other Users */}
        {Object.values(otherUsers).map((u) => (
          <UserMarker
            key={`user-${u.id}`}
            coordinate={{ latitude: u.latitude, longitude: u.longitude }}
            role={u.role}
            isSelf={false}
            onPress={() => setSelectedItem(u)}
          />
        ))}

        {/* Fires */}
        {visibleFires.map((fire, index) => (
          <FireMarker
            key={`fire-${index}-${fire.latitude}`}
            fire={fire}
            color={getFireColor(fire.brightness)}
          />
        ))}

      </MapView>

      {/* Status Indicators */}
      <View style={styles.statusCard}>
        <View style={[styles.statusDot, { backgroundColor: isTracking ? colors.success : colors.danger }]} />
        <Text style={styles.statusLabel}>{isTracking ? "Transmitiendo" : "Pausado"}</Text>
        {showFires && (
          <>
            <View style={styles.statusDivider} />
            <Text style={styles.statusLabel}>{visibleFires.length} Fuegos</Text>
          </>
        )}
      </View>

      {/* Info Card (Dynamic) */}
      {selectedItem && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: colors.secondary, borderRadius: 20, padding: 4 }}>
                <MaterialCommunityIcons name={
                  selectedItem.role === 'COMPANY_CHIEF' ? 'fire-truck' :
                    (selectedItem.role?.includes('ADMIN') ? 'hard-hat' : 'account-hard-hat')
                } size={20} color="white" />
              </View>
              <View>
                <Text style={styles.infoTitle}>
                  {selectedItem.role === 'COMPANY_CHIEF' ? 'Jefe de Compañía' :
                    selectedItem.role?.includes('ADMIN') ? 'Comandante' :
                      'Voluntario'}
                </Text>
                <Text style={styles.infoSubtitle}>ID: {selectedItem.id}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedItem(null)}>
              <Ionicons name="close-circle" size={24} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoGrid}>
            {/* Contextual Info based on Role */}
            {selectedItem.role === 'COMPANY_CHIEF' && (
              <View style={styles.incidentRow}>
                <Ionicons name="alert-circle" size={16} color={selectedItem.assigned_incident ? colors.danger : colors.gray[400]} />
                <Text style={[styles.incidentText, !selectedItem.assigned_incident && { color: colors.gray[400] }]}>
                  {selectedItem.assigned_incident
                    ? `Mando: ${selectedItem.assigned_incident.title}`
                    : 'Sin emergencia asignada'}
                </Text>
              </View>
            )}

            {/* Location Data */}
            <Text style={styles.coordsText}>
              Last seen: {selectedItem.latitude.toFixed(5)}, {selectedItem.longitude.toFixed(5)}
            </Text>
          </View>
        </View>
      )}

      {/* Controls: Layers, Recenter, Tracking */}
      <View style={styles.controlsContainer}>
        {/* Toggle Fire */}
        <TouchableOpacity style={[styles.fabSmall, showFires && styles.fabActive]} onPress={() => setShowFires(!showFires)}>
          <Ionicons name="flame" size={20} color={showFires ? colors.white : colors.gray[600]} />
        </TouchableOpacity>

        {/* Recenter Button (New!) */}
        <TouchableOpacity style={styles.fabSmall} onPress={centerOnUser}>
          <Ionicons name="locate" size={20} color={colors.text} />
        </TouchableOpacity>

        {/* Toggle Tracking */}
        <TouchableOpacity style={[styles.fab, { backgroundColor: isTracking ? colors.secondary : colors.success }]} onPress={() => setIsTracking(!isTracking)}>
          <Ionicons name={isTracking ? "pause" : "play"} size={28} color="white" />
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text,
  },

  // Markers
  myLocationMarker: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    borderWidth: 3, borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    ...shadows.md
  },
  otherUserMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.secondary, // Blueish typically
    borderWidth: 2, borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm
  },

  // Cards
  statusCard: {
    position: 'absolute', top: 50, left: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'white', padding: 10, borderRadius: 20,
    ...shadows.md
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 12, fontWeight: 'bold', color: colors.text },
  statusDivider: { width: 1, height: 16, backgroundColor: '#ddd', marginHorizontal: 5 },

  infoCard: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    backgroundColor: 'white', padding: 15, borderRadius: 15,
    ...shadows.lg
  },
  infoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10
  },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  infoSubtitle: { fontSize: 12, color: colors.textLight },
  infoGrid: { marginTop: 5 },
  incidentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginVertical: 4,
    backgroundColor: colors.gray[50], padding: 6, borderRadius: 6
  },
  incidentText: {
    fontSize: 13, fontWeight: '600', color: colors.text
  },
  coordsText: { fontSize: 12, fontFamily: 'monospace', color: colors.gray[500], marginTop: 4 },

  // FABs
  controlsContainer: {
    position: 'absolute', bottom: 30, right: 20,
    alignItems: 'center', gap: 15
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.lg
  },
  fabSmall: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    ...shadows.md
  },
  fabActive: {
    backgroundColor: colors.primary
  }
});
