import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchWeatherData, WeatherData } from '../services/weather';
import { useAuth } from '../context/AuthContext';
import api, { asList } from '../services/api';
import { isLocationSharingEnabled, setLocationSharingEnabled } from '../services/locationSharing';
import { getDeviceId } from '../services/deviceIdentity';
import { resumeBackgroundTracking, stopBackgroundTracking } from '../services/backgroundTracking';
import { colors, spacing, borderRadius, shadows, overlay, touch } from '../theme/colors';
import { etiquetaCarro, nombreCarroConOrigen, origenCarro } from '../utils/claves';

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
  tipo?: 'bombero' | 'carro' | 'emergencia' | 'compania';
  es_carro?: boolean;
  status?: string;
  nombre?: string;
  description?: string;
  address?: string;
  company_name?: string;
  fire_department_name?: string;
  comuna?: string;
  region?: string;
  unit_type?: string;
  type_display?: string;
  status_display?: string;
}

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const { user, role } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(true);

  const [currentRegion, setCurrentRegion] = useState<any>(null); // Type 'any' for Region compat
  const [asumiendo, setAsumiendo] = useState(false);
  const [errorAsumir, setErrorAsumir] = useState('');
  const envioAsumir = useRef(false);
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

  // Las emergencias son nacionales: los clusters del mapa manejan la densidad.
  const visibleFires = useMemo(() => {
    return fireData.slice(0, 250);
  }, [fireData]);

  const showAllEmergencies = () => {
    if (!fireData.length || !mapRef.current) return;
    const lats = fireData.map(point => point.latitude);
    const lngs = fireData.map(point => point.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    mapRef.current.animateToRegion({
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.08, (maxLat - minLat) * 1.35),
      longitudeDelta: Math.max(0.08, (maxLng - minLng) * 1.35),
    }, 650);
  };

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
            nombre: c.name,
            tipo: 'compania',
            address: c.address,
            comuna: c.comuna,
            description: c.description || `Cuartel de ${c.name}${c.comuna ? ` en ${c.comuna}` : ''}.`,
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
            user_first_name: nombreCarroConOrigen(u),
            nombre: nombreCarroConOrigen(u),
            tipo: 'carro',
            es_carro: true,
            status: u.status,
            status_display: u.status_display,
            company_name: u.company_name,
            fire_department_name: u.fire_department_name,
            comuna: u.comuna,
            region: u.region,
            unit_type: u.unit_type,
            type_display: u.type_display,
            description: `${etiquetaCarro(u.unit_type, u.type_display)} de ${u.company_name || 'compañía no informada'}.`,
            timestamp: ahora,
          });
        });
        setFijos(puntos);
        setSinPunto({ companias: companiasSin, carros: carrosSin });
        // Geocodificar y guardar es una tarea administrativa. Antes todos los
        // teléfonos repetían estas consultas cada minuto aunque el PATCH diera 403.
        const canPersistLocations = role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN';
        const faltan = canPersistLocations ? comps.filter((c: any) => {
          const lat = Number(c.latitude);
          const lng = Number(c.longitude);
          return !tienePunto(lat, lng) && (c.address || c.comuna);
        }).slice(0, 12) : [];
        for (const c of faltan) {
          if (!vivo) return;
          try {
            const consulta = [c.address, c.comuna, 'Chile'].filter(Boolean).join(', ');
            const hallado = await Location.geocodeAsync(consulta);
            if (!vivo || !hallado[0]) continue;
            c.latitude = hallado[0].latitude;
            c.longitude = hallado[0].longitude;
            puntos.push({
              id: 1_000_000 + c.id,
              latitude: c.latitude,
              longitude: c.longitude,
              role: 'COMPANIA',
              user_first_name: c.name,
              nombre: c.name,
              tipo: 'compania',
              address: c.address,
              comuna: c.comuna,
              description: c.description || `Cuartel de ${c.name}${c.comuna ? ` en ${c.comuna}` : ''}.`,
            });
            companiasSin -= 1;
            setFijos([...puntos]);
            setSinPunto({ companias: companiasSin, carros: carrosSin });
            api.patch(`/companies/${c.id}/`, {
              latitude: c.latitude,
              longitude: c.longitude,
            }).catch(() => undefined);
          } catch {
            /* sigue sin punto */
          }
        }
      } catch {
        if (vivo) {
          setFijos([]);
        }
      }
    };
    cargarFijos();
    const timer = setInterval(cargarFijos, 60000);
    return () => { vivo = false; clearInterval(timer); };
  }, [role]);

  useEffect(() => {
    let vivo = true;
    const cargarEmergencias = () => {
      api.get('/incidents/mapa/')
        .then(res => {
          if (!vivo) return;
          const points: FirePoint[] = asList(res.data)
            .filter((i: any) => Number.isFinite(Number(i.latitude)) && Number.isFinite(Number(i.longitude)))
            .map((i: any) => ({
              id: i.id,
              latitude: Number(i.latitude),
              longitude: Number(i.longitude),
              brightness: i.severity === 'high' ? 360 : 330,
              title: i.title,
              address: [i.address, i.comuna].filter(Boolean).join(', '),
              description: i.description,
              dispatch_code: i.dispatch_code,
              commander: i.commander ?? null,
              commander_name: i.commander_name,
              recursos: Array.isArray(i.recursos) ? i.recursos : [],
              central_name: i.centrales?.find((c: any) => c.role === 'PROTAGONISTA')?.central,
              acq_date: (i.reported_at || '').slice(0, 10),
              acq_time: '',
            }));
          setFireData(points);
        })
        .catch(() => { });
    };
    cargarEmergencias();
    const interval = setInterval(cargarEmergencias, 20000);
    return () => { vivo = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (location && !weatherData) {
      fetchWeatherData(location.coords.latitude, location.coords.longitude).then(setWeatherData);
    }
  }, [location]);

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
  const selectedType = selectedItem?.brightness ? 'Emergencia'
    : selectedItem?.role === 'COMPANIA' ? 'Compañía'
      : selectedItem?.role === 'CARRO' ? 'Carro'
        : (selectedItem?.role === 'COMPANY_CHIEF' ? 'OBAC' : selectedItem?.role?.includes('ADMIN') ? 'Comandante' : 'Voluntario');
  const selectedName = selectedItem?.brightness ? (selectedItem.title || 'Emergencia')
    : selectedItem?.role === 'CARRO' ? (selectedItem.nombre || selectedItem.user_first_name || 'Carro sin nombre')
      : (selectedItem?.user_first_name || selectedItem?.user_last_name
        ? `${selectedItem.user_first_name || ''} ${selectedItem.user_last_name || ''}`.trim()
        : (selectedItem?.nombre || selectedItem?.email?.split('@')[0] || 'Sin nombre'));
  const selectedDescription = selectedItem?.brightness
    ? (selectedItem.description || 'Emergencia activa sin descripción adicional.')
    : selectedItem?.role === 'CARRO'
      ? (selectedItem.description || `${etiquetaCarro(selectedItem.unit_type, selectedItem.type_display)} operativo.`)
      : selectedItem?.role === 'COMPANIA'
        ? (selectedItem.description || 'Cuartel y punto operativo de la compañía.')
        : 'Ubicación operativa compartida por esta persona.';
  const selectedIcon = selectedItem?.brightness ? 'fire'
    : selectedItem?.role === 'CARRO' ? 'fire-truck'
      : selectedItem?.role === 'COMPANIA' ? 'home-city'
        : selectedItem?.role === 'COMPANY_CHIEF' || selectedItem?.role?.includes('ADMIN') ? 'hard-hat' : 'account-hard-hat';

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
            <TouchableOpacity onPress={showAllEmergencies}>
            <Text style={[styles.statusLabel, { color: colors.accent }]}>
              {visibleFires.length === 1 ? '1 emergencia' : `${visibleFires.length} emergencias`}
            </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.map}>
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
      </View>

      {!location && <View style={styles.locationNotice}>
        {!errorMsg && <ActivityIndicator size="small" color={colors.primary} />}
        <Text style={styles.locationNoticeText}>{errorMsg || 'Obteniendo tu ubicación...'}</Text>
      </View>}

      {/* Wind Info Widget (Top-Right) */}
      {weatherData && (
        <View style={styles.windWidget}>
          <View style={{ position: 'relative', alignItems: 'center', marginBottom: 4 }}>
            <MaterialCommunityIcons name="compass-rose" size={24} color={colors.white} style={{ opacity: 0.35 }} />
            <Ionicons name="navigate" size={18} color={colors.white} style={{ position: 'absolute', transform: [{ rotate: `${((weatherData.wind.deg || 0) + 180) % 360}deg` }] }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.windText}>{Math.round(weatherData.wind.speed * 3.6)} km/h</Text>
          </View>
          <Text style={styles.windSubtext}>{Math.round(weatherData.main.temp)}°C</Text>
        </View>
      )}

      {/* Info Card (Dynamic) */}
      {selectedItem && (
        <View style={styles.infoCard} accessibilityViewIsModal>
          <View style={styles.infoAccent} />
          <View style={styles.infoHeader}>
            <View style={styles.infoIdentity}>
              <View style={styles.infoIcon}>
                <MaterialCommunityIcons name={selectedIcon as any} size={23} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoEyebrow}>{selectedType.toUpperCase()}</Text>
                <Text style={styles.infoTitle}>{selectedName}</Text>
                {selectedItem.role === 'CARRO' && !!origenCarro(selectedItem) && (
                  <Text style={styles.infoSubtitle}>{origenCarro(selectedItem)}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedItem(null)}
              style={styles.infoClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar información"
            >
              <Ionicons name="close" size={21} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.infoGrid} showsVerticalScrollIndicator={false}>
            <Text style={styles.infoDescription}>{selectedDescription}</Text>
            {/* Fire Data */}
            {selectedItem.brightness && (
              <>
                <View style={styles.incidentRow}>
                  <Ionicons name="location" size={18} color={colors.danger} />
                  <Text style={styles.incidentText}>{selectedItem.address || 'Dirección no informada'}</Text>
                </View>
                <View style={styles.incidentRow}>
                  <Ionicons name="person" size={18} color={colors.accent} />
                  <Text style={styles.incidentText}>Mando: {selectedItem.commander_name || 'Sin asumir'}</Text>
                </View>
                <View style={styles.incidentRow}>
                  <Ionicons name="radio" size={18} color={colors.textMuted} />
                  <Text style={styles.incidentText}>Central: {selectedItem.central_name || 'Sin central'}</Text>
                </View>
              </>
            )}

            {selectedItem.role === 'CARRO' && (
              <>
                <View style={styles.incidentRow}>
                  <MaterialCommunityIcons name="garage" size={18} color={colors.accent} />
                  <Text style={styles.incidentText}>{selectedItem.company_name || 'Compañía no informada'}</Text>
                </View>
                <View style={styles.incidentRow}>
                  <Ionicons name="shield-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.incidentText}>{selectedItem.fire_department_name || 'Cuerpo no informado'}</Text>
                </View>
                <View style={styles.incidentRow}>
                  <Ionicons name="pulse-outline" size={18} color={colors.success} />
                  <Text style={styles.incidentText}>{selectedItem.status_display || selectedItem.status || 'Estado no informado'}</Text>
                </View>
              </>
            )}

            {selectedItem.role === 'COMPANIA' && (
              <View style={styles.incidentRow}>
                <Ionicons name="location-outline" size={18} color={colors.accent} />
                <Text style={styles.incidentText}>{[selectedItem.address, selectedItem.comuna].filter(Boolean).join(', ') || 'Dirección no informada'}</Text>
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
          {selectedItem.brightness ? (
            <View style={styles.recursosCaja}>
              <Text style={styles.recursosTitulo}>Recursos</Text>
              {(selectedItem.recursos || []).length === 0 ? (
                <Text style={styles.recursosVacio}>Sin carros despachados</Text>
              ) : (selectedItem.recursos || []).map((recurso: { id: number; carro: string; compania?: string; estado?: string }) => (
                <View key={recurso.id} style={styles.incidentRow}>
                  <MaterialCommunityIcons name="fire-truck" size={18} color={colors.accent} />
                  <Text style={styles.incidentText}>
                    {recurso.carro}
                    {recurso.compania ? ` · ${recurso.compania}` : ''}
                    {recurso.estado ? ` · ${recurso.estado}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {selectedItem.brightness ? (
            <TouchableOpacity
              style={styles.infoAction}
              disabled={asumiendo}
              onPress={() => {
                const abrir = () => navigation.dispatch(CommonActions.navigate('EmergenciaViva', { incidentId: selectedItem.id }));
                const puedeAsumir = (role === 'COMPANY_ADMIN' || role === 'COMPANY_CHIEF') && !selectedItem.commander;
                if (!puedeAsumir) {
                  abrir();
                  return;
                }
                if (envioAsumir.current) return;
                envioAsumir.current = true;
                setErrorAsumir('');
                setAsumiendo(true);
                api.post(`/incidents/${selectedItem.id}/take_command/`)
                  .then((respuesta) => {
                    const mando = respuesta.data?.commander ?? user?.id;
                    const nombre = respuesta.data?.commander_name || 'Tú';
                    setFireData((prev) => prev.map((punto) => (
                      punto.id === selectedItem.id
                        ? { ...punto, commander: mando, commander_name: nombre }
                        : punto
                    )));
                    setSelectedItem((prev: any) => prev ? { ...prev, commander: mando, commander_name: nombre } : prev);
                    abrir();
                  })
                  .catch((error: any) => {
                    const data = error.response?.data;
                    const mensaje = data?.error || data?.detail || 'No se pudo asumir. Intenta de nuevo.';
                    setErrorAsumir(typeof mensaje === 'string' ? mensaje : 'No se pudo asumir. Intenta de nuevo.');
                  })
                  .finally(() => {
                    setAsumiendo(false);
                    setTimeout(() => { envioAsumir.current = false; }, 700);
                  });
              }}
            >
              <Text style={styles.infoActionText}>
                {asumiendo
                  ? 'Asumiendo…'
                  : (role === 'COMPANY_ADMIN' || role === 'COMPANY_CHIEF') && !selectedItem.commander
                    ? 'Asumir'
                    : 'Ver en vivo'}
              </Text>
              {errorAsumir ? <Text style={styles.recursosVacio}>{errorAsumir}</Text> : null}
            </TouchableOpacity>
          ) : null}
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
    padding: 18, paddingTop: 20, borderRadius: borderRadius.lg,
    maxHeight: 520, overflow: 'hidden',
    flexDirection: 'column',
    ...overlay,
    borderWidth: 1, borderColor: colors.border,
  },
  infoAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
    backgroundColor: colors.primary,
  },
  infoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10
  },
  infoIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingRight: 10 },
  infoIcon: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  infoClose: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  infoEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.accent, marginBottom: 2 },
  infoTitle: { fontSize: 19, lineHeight: 23, fontWeight: '800', color: colors.text },
  infoSubtitle: { fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 3 },
  infoDescription: { fontSize: 14, lineHeight: 20, color: colors.text, marginBottom: 8 },
  recursosCaja: { flexShrink: 0, marginTop: 8 },
  recursosTitulo: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginTop: 0, marginBottom: 2 },
  recursosVacio: { fontSize: 14, color: colors.textMuted, marginVertical: 4 },
  infoGrid: { marginTop: 5, flexGrow: 1, flexShrink: 1, minHeight: 0 },
  incidentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginVertical: 4,
    backgroundColor: colors.surfaceRaised, paddingVertical: 8, paddingHorizontal: 10, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  incidentText: {
    fontSize: 13, fontWeight: '600', color: colors.text, flex: 1,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: 2, paddingHorizontal: 4
  },
  detailText: { fontSize: 16, color: colors.text },
  detailSubText: { fontSize: 15, color: colors.textMuted, marginLeft: 0 },
  infoAction: { marginTop: 10, backgroundColor: colors.primary, padding: 12, borderRadius: borderRadius.md, alignItems: 'center' },
  infoActionText: { color: colors.white, fontWeight: '700' },
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
    zIndex: 5,
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
