import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchWeatherData, WeatherData } from '../services/weather';
import { useAuth } from '../context/AuthContext';
import api, { asList } from '../services/api';
import { isLocationSharingEnabled, setLocationSharingEnabled } from '../services/locationSharing';
import { getDeviceId } from '../services/deviceIdentity';
import { resumeBackgroundTracking, stopBackgroundTracking } from '../services/backgroundTracking';
import { colors, spacing, borderRadius, shadows, overlay, touch } from '../theme/colors';

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
  tipo?: 'bombero' | 'carro' | 'emergencia';
  es_carro?: boolean;
  status?: string;
  nombre?: string;
}

export default function MapScreen() {
  const { user } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(true);

  const [currentRegion, setCurrentRegion] = useState<any>(null); // Type 'any' for Region compat
  const [otherUsers, setOtherUsers] = useState<{ [key: string]: OtherUser }>({});
  const [fijos, setFijos] = useState<OtherUser[]>([]);
  const [sinPunto, setSinPunto] = useState({ companias: 0, carros: 0 });
  const [fireData, setFireData] = useState<FirePoint[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

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
    if (!currentRegion || !fireData.length) return [];

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
  }, [fireData, currentRegion]);

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
    let vivo = true;
    const cargarFijos = async () => {
      try {
        const [cRes, uRes] = await Promise.all([api.get('/companies/'), api.get('/units/')]);
        if (!vivo) return;
        const comps = asList(cRes.data);
        const units = asList(uRes.data);
        const porId = new Map<number, any>(comps.map((c: any) => [c.id, c]));
        const ahora = Date.now();
        const puntos: OtherUser[] = [];
        let companiasSin = 0;
        let carrosSin = 0;
        const tienePunto = (lat: number, lng: number) =>
          Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
        comps.forEach((c: any) => {
          const lat = Number(c.latitude);
          const lng = Number(c.longitude);
          if (!tienePunto(lat, lng)) {
            companiasSin += 1;
            return;
          }
          puntos.push({
            id: 1_000_000 + c.id,
            latitude: lat,
            longitude: lng,
            role: 'COMPANIA',
            user_first_name: c.name,
            timestamp: ahora,
            tipo: 'bombero',
          });
        });
        const usados = new Map<number, number>();
        units.forEach((u: any) => {
          const comp = porId.get(u.company);
          const lat0 = Number(comp?.latitude);
          const lng0 = Number(comp?.longitude);
          if (!comp || !tienePunto(lat0, lng0)) {
            carrosSin += 1;
            return;
          }
          const n = usados.get(u.company) || 0;
          usados.set(u.company, n + 1);
          const ang = n * 0.9;
          puntos.push({
            id: 2_000_000 + u.id,
            latitude: lat0 + Math.cos(ang) * 0.00035,
            longitude: lng0 + Math.sin(ang) * 0.00035,
            role: 'CARRO',
            user_first_name: u.name,
            nombre: u.name,
            tipo: 'carro',
            es_carro: true,
            status: u.status,
            timestamp: ahora,
          });
        });
        setFijos(puntos);
        setSinPunto({ companias: companiasSin, carros: carrosSin });
      } catch {
        if (vivo) {
          setFijos([]);
        }
      }
    };
    cargarFijos();
    const timer = setInterval(cargarFijos, 60000);
    return () => { vivo = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (location) {
      if (fireData.length === 0) {
        api.get('/incidents/', { params: { is_active: true } })
          .then(res => {
            const lista = asList(res.data);
            if (lista.length || Array.isArray(res.data)) {
              const points: FirePoint[] = lista.map((i: any) => ({
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
          const lista = asList(res.data);
          {
            const points: FirePoint[] = lista.map((i: any) => ({
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

  // Apenas llega la ubicacion real, el mapa se va ahi.
  const yaCentrado = useRef(false);
  useEffect(() => {
    if (location && !yaCentrado.current && mapRef.current) {
      yaCentrado.current = true;
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 600);
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

  // Chile como ultimo recurso, nunca una ciudad puntual: antes arrancaba
  // siempre en Puerto Montt aunque estuvieras en otra region.
  const mapCenter = location?.coords || Object.values(otherUsers)[0] || fireData[0]
    || { latitude: -35.6751, longitude: -71.5430 };

  return (
    <View style={styles.container}>
      {/* Status Indicators */}
      <View style={styles.franja}>
        <View style={[styles.statusDot, { backgroundColor: isTracking ? colors.success : colors.danger }]} />
        <Text style={styles.statusLabel}>{isTracking ? 'Ubicación activada' : 'Ubicación pausada'}</Text>
        <View style={styles.statusDivider} />
        <Text style={styles.statusLabel}>
          {Object.keys(otherUsers).length === 1 ? '1 persona'
            : `${Object.keys(otherUsers).length} personas`}
        </Text>
        <View style={styles.statusDivider} />
        <Text style={styles.statusLabel}>
          {fijos.filter(p => p.role === 'COMPANIA').length} cías · {fijos.filter(p => p.role === 'CARRO').length} carros
        </Text>
        {(sinPunto.companias > 0 || sinPunto.carros > 0) && (
          <Text style={styles.statusLabel}>
            {sinPunto.companias + sinPunto.carros} sin ubicación
          </Text>
        )}
        {visibleFires.length > 0 && (
          <>
            <View style={styles.statusDivider} />
            <Text style={styles.statusLabel}>
              {visibleFires.length === 1 ? '1 emergencia' : `${visibleFires.length} emergencias`}
            </Text>
          </>
        )}
      </View>

      <MapWidget
        ref={mapRef}
        style={styles.map}
        currentLocation={mapCenter}
        selfUser={location ? user : null}
        otherUsers={[...Object.values(otherUsers), ...fijos]}
        fires={visibleFires}
        showFires
        onSelectMarker={setSelectedItem}
        onMapPress={() => setSelectedItem(null)}
        onRegionChange={setCurrentRegion}
      />

      {!location && <View style={styles.locationNotice}>
        {!errorMsg && <ActivityIndicator size="small" color={colors.primary} />}
        <Text style={styles.locationNoticeText}>{errorMsg || 'Obteniendo tu ubicación...'}</Text>
      </View>}

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
              <View style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, padding: 4 }}>
                <MaterialCommunityIcons name={
                  selectedItem.role === 'COMPANY_CHIEF' ? 'fire-truck' :
                    (selectedItem.brightness ? 'fire' :  // Handle Fire Item
                      (selectedItem.role?.includes('ADMIN') ? 'hard-hat' : 'account-hard-hat'))
                } size={20} color="white" />
              </View>
              <View>
                <Text style={styles.infoTitle}>
                  {selectedItem.brightness ? 'Emergencia' :
                    selectedItem.role === 'COMPANIA' ? 'Compañía' :
                    selectedItem.role === 'CARRO' ? 'Carro' :
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
                <Ionicons name="flame" size={18} color={colors.danger} />
                <Text style={styles.incidentText}>
                  Detectado: {selectedItem.acq_date || 'N/A'} {selectedItem.acq_time || ''}
                </Text>
              </View>
            )}

            {/* Last confirmed position */}
            {!selectedItem.brightness && selectedItem.timestamp && (
              <View style={[styles.incidentRow, { backgroundColor: colors.gray[200] }]}>
                <Ionicons name="time-outline" size={18} color={colors.gray[600]} />
                <Text style={[styles.incidentText, { color: colors.gray[600] }]}>Última señal: {new Date(selectedItem.timestamp).toLocaleTimeString()}</Text>
              </View>
            )}

            {/* Incident Info (User only) */}
            {selectedItem.assigned_incident && (
              <View style={styles.incidentRow}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.incidentText}>
                  Mando: {selectedItem.assigned_incident.title}
                </Text>
              </View>
            )}

            {/* Vehicle for Chief */}
            {selectedItem.role === 'COMPANY_CHIEF' && selectedItem.assigned_vehicle && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="fire-truck" size={18} color={colors.primary} />
                <Text style={styles.detailText}>Carro: {selectedItem.assigned_vehicle}</Text>
              </View>
            )}

            {/* Companions for Chief */}
            {selectedItem.role === 'COMPANY_CHIEF' && selectedItem.companions && selectedItem.companions.length > 0 && (
              <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                <MaterialCommunityIcons name="account-group" size={18} color={colors.text} style={{ marginTop: 2 }} />
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


        {/* Recenter Button */}
        <TouchableOpacity style={styles.fabSmall} onPress={centerOnUser}>
          <Ionicons name="locate" size={20} color={colors.text} />
        </TouchableOpacity>

        {/* Toggle Tracking */}

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
    backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 12,
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
  franja: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10,
    paddingVertical: 12, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusDot: { width: 12, height: 12, borderRadius: borderRadius.sm },
  statusLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  statusDivider: { width: 1, height: 12, backgroundColor: colors.border, marginHorizontal: 2 },

  infoCard: {
    position: 'absolute', bottom: 100, left: 16, right: 16,
    padding: 18, borderRadius: borderRadius.lg,
    maxHeight: 280,
    ...overlay,
  },
  infoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10
  },
  infoTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
  infoSubtitle: { fontSize: 15, color: colors.textMuted },
  infoGrid: { marginTop: 5 },
  incidentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginVertical: 4,
    backgroundColor: colors.gray[50], padding: 6, borderRadius: borderRadius.sm
  },
  incidentText: {
    fontSize: 13, fontWeight: '600', color: colors.text
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: 2, paddingHorizontal: 4
  },
  detailText: { fontSize: 16, color: colors.text },
  detailSubText: { fontSize: 15, color: colors.textMuted, marginLeft: 0 },
  coordsText: { fontSize: 12, fontFamily: 'monospace', color: colors.gray[500], marginTop: 8 },

  // FABs
  controlsContainer: {
    position: 'absolute', bottom: 30, right: 20,
    alignItems: 'center', gap: 15
  },
  fab: {
    width: 56, height: 56, borderRadius: borderRadius.full,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.lg
  },
  fabAncho: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: touch, paddingHorizontal: spacing.md, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.lg,
  },
  fabAnchoTexto: { fontSize: 15, fontWeight: '700', color: colors.text },
  fabSmall: {
    width: touch, height: touch, borderRadius: touch / 2,
    alignItems: 'center', justifyContent: 'center',
    ...overlay,
  },
  fabActive: {
    backgroundColor: colors.primary
  },

  // Wind Widget
  windWidget: {
    position: 'absolute',
    top: 100,
    right: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...overlay,
  },
  windText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  windSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9
  }
});
