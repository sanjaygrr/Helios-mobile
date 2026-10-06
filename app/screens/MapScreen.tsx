import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchWeatherData, WeatherData } from '../services/weather';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { isLocationSharingEnabled, setLocationSharingEnabled } from '../services/locationSharing';
import { getDeviceId } from '../services/deviceIdentity';
import { resumeBackgroundTracking, stopBackgroundTracking } from '../services/backgroundTracking';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

// New MapWidget import
import MapWidget from '../components/MapWidget';
import { MapWidgetHandle, MapUser, FirePoint } from '../components/MapWidget/types';

interface LocationData {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
  };
  timestamp: number;
}

// Re-using the OtherUser interface but aliasing or mapping to MapUser if needed.
// Actually MapUser in types.ts is identical to OtherUser here.
interface OtherUser {
  id: number;
  device_id?: string;
  latitude: number;
  longitude: number;
  role?: string;
  email?: string;
  user_first_name?: string;
  user_last_name?: string;
  rut?: string;
  assigned_vehicle?: string;
  companions?: string[];
  assigned_incident?: {
    id: number;
    title: string;
    incident_type: string;
  } | null;
  timestamp?: number;
}

export default function MapScreen() {
  const { user } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(true);

  const [currentRegion, setCurrentRegion] = useState<any>(null); // Type 'any' for Region compat
  const [otherUsers, setOtherUsers] = useState<{ [key: string]: OtherUser }>({});
  const [fireData, setFireData] = useState<FirePoint[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  const [showFires, setShowFires] = useState(true);
  const [selectedItem, setSelectedItem] = useState<OtherUser | FirePoint | any>(null);

  const mapRef = useRef<MapWidgetHandle>(null);

  // --- Helpers ---

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

    // Sort closest
    inViewport.sort((a, b) => {
      const distA = Math.pow(a.latitude - currentRegion.latitude, 2) + Math.pow(a.longitude - currentRegion.longitude, 2);
      const distB = Math.pow(b.latitude - currentRegion.latitude, 2) + Math.pow(b.longitude - currentRegion.longitude, 2);
      return distA - distB;
    });

    return inViewport.slice(0, 60);
  }, [fireData, currentRegion, showFires]);

  // --- Effects ---

  useEffect(() => {
    isLocationSharingEnabled().then(setIsTracking).catch(() => {});
  }, []);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permiso de ubicación denegado');
          return;
        }
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
          loc => setLocation(loc as LocationData)
        );
        if (cancelled) locationSubscription.remove();
      } catch {
        if (!cancelled) setErrorMsg('No se pudo obtener la ubicación');
      }
    };

    startTracking();

    return () => {
      cancelled = true;
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshPeople = async () => {
      try {
        const ownDeviceId = await getDeviceId();
        const res = await api.get('/tracking/history/live/');
        if (cancelled || !Array.isArray(res.data)) return;
        const mapped: { [key: string]: OtherUser } = {};
        res.data.forEach((pos: any) => {
          const uid = pos.user_id;
          if (!uid || (uid === user?.id && pos.device_id === ownDeviceId)) return;
          mapped[`${uid}:${pos.device_id || 'legacy'}`] = {
            id: uid,
            device_id: pos.device_id,
            latitude: pos.latitude,
            longitude: pos.longitude,
            role: pos.user_role,
            email: pos.user_email,
            user_first_name: pos.user_first_name,
            user_last_name: pos.user_last_name,
            timestamp: new Date(pos.timestamp).getTime(),
          };
        });
        setOtherUsers(mapped);
      } catch (error) {
        if (__DEV__) console.warn('No se pudieron actualizar las posiciones', error);
      }
    };
    refreshPeople();
    const interval = setInterval(refreshPeople, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id]);

  useEffect(() => {
    if (location) {
      if (fireData.length === 0) {
        api.get('/incidents/', { params: { is_active: true } })
          .then(res => {
            if (Array.isArray(res.data)) {
              const points: FirePoint[] = res.data.map((i: any) => ({
                latitude: i.latitude,
                longitude: i.longitude,
                brightness: i.severity === 'high' ? 360 : 330,
                acq_date: (i.reported_at || '').slice(0, 10) || 'backend',
                acq_time: '0000'
              }));
              setFireData(points);
            }
          })
          .catch(() => { });
      }
      if (!weatherData) fetchWeatherData(location.coords.latitude, location.coords.longitude).then(setWeatherData);
    }
  }, [location]);

  useEffect(() => {
    const interval = setInterval(() => {
      api.get('/incidents/', { params: { is_active: true } })
        .then(res => {
          if (Array.isArray(res.data)) {
            const points: FirePoint[] = res.data.map((i: any) => ({
              latitude: i.latitude,
              longitude: i.longitude,
              brightness: i.severity === 'high' ? 360 : 330,
              acq_date: (i.reported_at || '').slice(0, 10) || 'backend',
              acq_time: '0000'
            }));
            setFireData(points);
          }
        })
        .catch(() => { });
    }, 120000);
    return () => clearInterval(interval);
  }, []);

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

  const mapCenter = location?.coords || Object.values(otherUsers)[0] || fireData[0] || { latitude: -41.4693, longitude: -72.9424 };

  return (
    <View style={styles.container}>
      <MapWidget
        ref={mapRef}
        style={styles.map}
        currentLocation={mapCenter}
        selfUser={location ? user : null}
        otherUsers={Object.values(otherUsers)}
        fires={visibleFires}
        showFires={showFires}
        onSelectMarker={setSelectedItem}
        onMapPress={() => setSelectedItem(null)}
        onRegionChange={setCurrentRegion}
      />

      {!location && <View style={styles.locationNotice}>
        {!errorMsg && <ActivityIndicator size="small" color={colors.primary} />}
        <Text style={styles.locationNoticeText}>{errorMsg || 'Obteniendo tu ubicación...'}</Text>
      </View>}

      {/* Status Indicators */}
      <View style={styles.statusCard}>
        <View style={[styles.statusDot, { backgroundColor: isTracking ? colors.success : colors.danger }]} />
        <Text style={styles.statusLabel}>{isTracking ? 'Ubicación activada' : 'Ubicación pausada'}</Text>
        <View style={styles.statusDivider} />
        <Text style={styles.statusLabel}>{Object.keys(otherUsers).length} en mapa</Text>
        {showFires && (
          <>
            <View style={styles.statusDivider} />
            <Text style={styles.statusLabel}>{visibleFires.length} Fuegos</Text>
          </>
        )}
      </View>

      {/* Wind Info Widget (Top-Right) */}
      {weatherData && (
        <View style={styles.windWidget}>
          <View style={{ position: 'relative', alignItems: 'center', marginBottom: 4 }}>
            <MaterialCommunityIcons name="compass-rose" size={24} color={colors.white} style={{ opacity: 0.35 }} />
            <Ionicons name="navigate" size={18} color={colors.white} style={{ position: 'absolute', transform: [{ rotate: `${weatherData.wind.deg || 0}deg` }] }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.windText}>{Math.round(weatherData.wind.speed * 3.6)} km/h</Text>
          </View>
          <Text style={styles.windSubtext}>{Math.round(weatherData.main.temp)}°C</Text>
        </View>
      )}

      {/* Info Card (Dynamic) */}
      {selectedItem && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: colors.secondary, borderRadius: 20, padding: 4 }}>
                <MaterialCommunityIcons name={
                  selectedItem.role === 'COMPANY_CHIEF' ? 'fire-truck' :
                    (selectedItem.brightness ? 'fire' :  // Handle Fire Item
                      (selectedItem.role?.includes('ADMIN') ? 'hard-hat' : 'account-hard-hat'))
                } size={20} color="white" />
              </View>
              <View>
                <Text style={styles.infoTitle}>
                  {selectedItem.brightness ? 'Foco de Incendio' :
                    (selectedItem.role === 'COMPANY_CHIEF' || selectedItem.role?.includes('ADMIN') ? 'Jefe de Compañía' : 'Voluntario')}
                </Text>
                <Text style={styles.infoSubtitle}>
                  {selectedItem.brightness
                    ? `Intensidad: ${selectedItem.brightness}`
                    : (selectedItem.user_first_name || selectedItem.user_last_name
                      ? `${selectedItem.user_first_name || ''} ${selectedItem.user_last_name || ''}`.trim()
                      : (selectedItem.email ? (selectedItem.email.split('@')[0]) : `ID: ${selectedItem.id}`))}
                </Text>
                {selectedItem.rut && <Text style={styles.infoSubtitle}>{selectedItem.rut}</Text>}
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedItem(null)}>
              <Ionicons name="close-circle" size={24} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.infoGrid} showsVerticalScrollIndicator={false}>
            {/* Fire Data */}
            {selectedItem.brightness && (
              <View style={styles.incidentRow}>
                <Ionicons name="flame" size={16} color={colors.danger} />
                <Text style={styles.incidentText}>
                  Detectado: {selectedItem.acq_date || 'N/A'} {selectedItem.acq_time || ''}
                </Text>
              </View>
            )}

            {/* Last confirmed position */}
            {!selectedItem.brightness && selectedItem.timestamp && (
              <View style={[styles.incidentRow, { backgroundColor: colors.gray[200] }]}>
                <Ionicons name="time-outline" size={16} color={colors.gray[600]} />
                <Text style={[styles.incidentText, { color: colors.gray[600] }]}>Última señal: {new Date(selectedItem.timestamp).toLocaleTimeString()}</Text>
              </View>
            )}

            {/* Incident Info (User only) */}
            {selectedItem.assigned_incident && (
              <View style={styles.incidentRow}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.incidentText}>
                  Mando: {selectedItem.assigned_incident.title}
                </Text>
              </View>
            )}

            {/* Vehicle for Chief */}
            {selectedItem.role === 'COMPANY_CHIEF' && selectedItem.assigned_vehicle && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="fire-truck" size={16} color={colors.primary} />
                <Text style={styles.detailText}>Carro: {selectedItem.assigned_vehicle}</Text>
              </View>
            )}

            {/* Companions for Chief */}
            {selectedItem.role === 'COMPANY_CHIEF' && selectedItem.companions && selectedItem.companions.length > 0 && (
              <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                <MaterialCommunityIcons name="account-group" size={16} color={colors.text} style={{ marginTop: 2 }} />
                <View>
                  <Text style={[styles.detailText, { fontWeight: 'bold' }]}>Tripulación:</Text>
                  {selectedItem.companions.map((companion: string, idx: number) => (
                    <Text key={idx} style={styles.detailSubText}>• {companion}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Location Data */}
            <Text style={styles.coordsText}>
              Loc: {selectedItem.latitude.toFixed(5)}, {selectedItem.longitude.toFixed(5)}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Controls: Layers, Recenter, Tracking */}
      <View style={styles.controlsContainer}>
        {/* Toggle Fire */}
        <TouchableOpacity style={[styles.fabSmall, showFires && styles.fabActive]} onPress={() => setShowFires(!showFires)}>
          <Ionicons name="flame" size={20} color={showFires ? colors.white : colors.gray[600]} />
        </TouchableOpacity>

        {/* Recenter Button */}
        <TouchableOpacity style={styles.fabSmall} onPress={centerOnUser}>
          <Ionicons name="locate" size={20} color={colors.text} />
        </TouchableOpacity>

        {/* Toggle Tracking */}
        <TouchableOpacity style={[styles.fab, { backgroundColor: isTracking ? colors.secondary : colors.success }]} onPress={async () => {
          const next = !isTracking;
          await setLocationSharingEnabled(next);
          setIsTracking(next);
          if (next) resumeBackgroundTracking().catch(() => {});
          else stopBackgroundTracking().catch(() => {});
        }}>
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
  locationNotice: {
    position: 'absolute', top: 72, left: 16, right: 16,
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    ...shadows.md,
  },
  locationNoticeText: { color: colors.text, fontWeight: '600' },
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
    maxHeight: 250,
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
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: 2, paddingHorizontal: 4
  },
  detailText: { fontSize: 13, color: colors.text },
  detailSubText: { fontSize: 12, color: colors.textLight, marginLeft: 0 },
  coordsText: { fontSize: 12, fontFamily: 'monospace', color: colors.gray[500], marginTop: 8 },

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
  },

  // Wind Widget
  windWidget: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    ...shadows.md
  },
  windText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600'
  },
  windSubtext: {
    color: colors.white,
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9
  }
});
