import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import WebSocketService from '../services/websocket';
import { fetchFireData, FirePoint } from '../services/nasa';
import { fetchWeatherData, WeatherData } from '../services/weather';
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

export default function MapScreen() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // New State for Fire & Weather
  const [fireData, setFireData] = useState<FirePoint[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [showFires, setShowFires] = useState(true);
  const [showWind, setShowWind] = useState(true);

  // Helper function to get color based on fire brightness (heat map)
  const getFireColor = (brightness: number): string => {
    // Typical brightness ranges: 300-400+ Kelvin
    // Map to heat map colors: green → yellow → orange → red
    if (brightness < 320) return '#00FF00'; // Green (low)
    if (brightness < 340) return '#FFFF00'; // Yellow (medium-low)
    if (brightness < 360) return '#FFA500'; // Orange (medium-high)
    return '#FF0000'; // Red (high)
  };

  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation for location marker
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permiso de ubicacion denegado');
        return;
      }

      // Connect WebSocket
      setConnectionStatus('connecting');
      try {
        WebSocketService.connect();
        setConnectionStatus('connected');
      } catch (error) {
        setConnectionStatus('disconnected');
      }

      // Start watching position
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => {
          setLocation(loc as LocationData);
          if (isTracking) {
            WebSocketService.sendLocation(
              loc.coords.latitude,
              loc.coords.longitude
            );
          }
        }
      );
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };

  }, [isTracking]);

  // Fetch Fire & Weather Data when location changes (throttled in real app)
  useEffect(() => {
    if (location) {
      const { latitude, longitude } = location.coords;

      // Fetch Fire Data (National - Chile)
      fetchFireData().then(data => {
        setFireData(data);
      });

      // Fetch Weather Data
      fetchWeatherData(latitude, longitude).then(data => {
        setWeatherData(data);
      });
    }
  }, [location]);

  const centerOnLocation = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
  };

  if (errorMsg) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={64} color={colors.gray[400]} />
        <Text style={styles.errorTitle}>Ubicacion no disponible</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Obteniendo ubicacion...</Text>
          <Text style={styles.loadingSubtext}>
            Asegurate de tener el GPS activado
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        mapType="hybrid"
      >
        {/* Custom Location Marker */}
        <Marker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.markerContainer}>
            <Animated.View
              style={[
                styles.markerPulse,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={styles.markerOuter}>
              <View style={styles.markerInner}>
                <Ionicons name="navigate" size={16} color={colors.white} />
              </View>
            </View>
          </View>
        </Marker>

        {/* Fire Markers Overlay */}
        {showFires && fireData.map((fire, index) => (
          <Marker
            key={`fire-${index}`}
            coordinate={{
              latitude: fire.latitude,
              longitude: fire.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[
              styles.fireMarkerContainer,
              { backgroundColor: getFireColor(fire.brightness) }
            ]} />
          </Marker>
        ))}
      </MapView>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View style={[
              styles.statusDot,
              {
                backgroundColor: connectionStatus === 'connected' ? colors.success :
                  connectionStatus === 'connecting' ? colors.warning : colors.danger
              }
            ]} />
            <Text style={styles.statusLabel}>
              {connectionStatus === 'connected' ? 'Conectado' :
                connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
            </Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Ionicons
              name={isTracking ? "radio" : "radio-outline"}
              size={16}
              color={isTracking ? colors.success : colors.gray[400]}
            />
            <Text style={styles.statusLabel}>
              {isTracking ? 'Transmitiendo' : 'Pausado'}
            </Text>
          </View>
        </View>
      </View>

      {/* Wind Overlay (Top Right) */}
      {
        showWind && weatherData && (
          <View style={styles.windCard}>
            <View style={styles.windHeader}>
              <Ionicons name="speedometer-outline" size={16} color={colors.textLight} />
              <Text style={styles.windTitle}>Viento</Text>
            </View>
            <View style={styles.windContent}>
              <View style={[styles.windIconContainer, { transform: [{ rotate: `${weatherData.wind.deg}deg` }] }]}>
                <Ionicons name="arrow-up" size={24} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.windValue}>{(weatherData.wind.speed * 3.6).toFixed(1)} km/h</Text>
                <Text style={styles.windLabel}>Dirección</Text>
              </View>
            </View>
          </View>
        )
      }

      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="car" size={20} color={colors.primary} />
          <Text style={styles.infoTitle}>Carro Forestal 1</Text>
        </View>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Latitud</Text>
            <Text style={styles.infoValue}>
              {location.coords.latitude.toFixed(6)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Longitud</Text>
            <Text style={styles.infoValue}>
              {location.coords.longitude.toFixed(6)}
            </Text>
          </View>
          {location.coords.speed !== null && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Velocidad</Text>
              <Text style={styles.infoValue}>
                {(location.coords.speed * 3.6).toFixed(1)} km/h
              </Text>
            </View>
          )}
          {location.coords.accuracy !== null && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Precision</Text>
              <Text style={styles.infoValue}>
                {location.coords.accuracy.toFixed(0)} m
              </Text>
            </View>
          )}
        </View>
      </View>



      {/* Layer Toggles (Left Side) */}
      < View style={styles.layersContainer} >
        <TouchableOpacity
          style={[styles.layerButton, showFires && styles.layerButtonActive]}
          onPress={() => setShowFires(!showFires)}
        >
          <Ionicons name="flame" size={20} color={showFires ? colors.white : colors.danger} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.layerButton, showWind && styles.layerButtonActive]}
          onPress={() => setShowWind(!showWind)}
        >
          <Ionicons name="speedometer" size={20} color={showWind ? colors.white : colors.primary} />
        </TouchableOpacity>
      </View >

      {/* Floating Action Buttons */}
      < View style={styles.fabContainer} >
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={toggleTracking}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isTracking ? "pause" : "play"}
            size={24}
            color={colors.white}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.fabPrimary]}
          onPress={centerOnLocation}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={24} color={colors.white} />
        </TouchableOpacity>
      </View >
    </View >
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
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
  },
  loadingSubtext: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  // Marker styles
  markerContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    opacity: 0.3,
  },
  markerOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  markerInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Status Card
  statusCard: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '500',
  },
  statusDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.lg,
  },
  // Info Card
  infoCard: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.md,
    right: 80,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.md,
    gap: spacing.sm,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  fabPrimary: {
    backgroundColor: colors.primary,
  },
  fabSecondary: {
    backgroundColor: colors.secondary,
  },
  // Fire Marker (Heat Map style - color set dynamically)
  fireMarkerContainer: {
    width: 8,
    height: 8,
    backgroundColor: 'red', // Default, overridden by inline style
    borderWidth: 0,
    borderRadius: 4, // Slightly rounded for better visibility
  },
  // Wind Card
  windCard: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Slightly transparent
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.md,
    minWidth: 120,
  },
  windHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  windTitle: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '600',
  },
  windContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  windIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
  },
  windValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  windLabel: {
    fontSize: 10,
    color: colors.textLight,
  },
  // Layer Toggles
  layersContainer: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.xl + 80, // Above FABs
    gap: spacing.sm,
  },
  layerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  layerButtonActive: {
    backgroundColor: colors.text, // Dark mode style for active
  },
});
