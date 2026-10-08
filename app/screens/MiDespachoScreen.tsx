import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import EstadoVacio from '../components/EstadoVacio';
import api from '../services/api';
import { useNotificacionesDespacho } from '../services/notificaciones';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  touch,
  typography,
  unitStatus,
} from '../theme/colors';

const REFRESH_MS = 15_000;
const BOTONES_RESPUESTA_ALTO = Math.max(
  touch * 3,
  Math.round(Dimensions.get('window').height * 0.22),
);

type EstadoAsignacion = keyof typeof unitStatus;

type MiDespacho = {
  asignacion: number;
  carro: string;
  emergencia: string;
  incidente: number;
  latitud: number | null;
  longitud: number | null;
  severidad: string;
  fase: string;
  estado: string;
  siguientes: string[];
  soy_encargado: boolean;
  mi_estado: string;
};

const ESTADO_CICLO_ES: Record<string, string> = {
  DISPATCHED: 'Despachado',
  EN_ROUTE: 'En camino',
  ON_SCENE: 'En el lugar',
  RETURNING: 'Regresando',
  RECONDITIONING: 'Reacondicionando',
  RELEASED: 'Liberado',
};

const FASE_ES: Record<string, string> = {
  PREPARACION: 'Preparación',
  DESPACHO: 'Despacho',
  COMBATE: 'Combate',
  REACONDICIONAMIENTO: 'Reacondicionamiento',
};

function etiquetaEstado(codigo: string): string {
  if (codigo in unitStatus) {
    return unitStatus[codigo as EstadoAsignacion].label;
  }
  return ESTADO_CICLO_ES[codigo] ?? codigo;
}

function colorSeveridad(severidad: string): string {
  const valor = (severidad || '').toLowerCase();
  if (
    valor.includes('crit') ||
    valor === 'critical' ||
    valor === '4' ||
    valor === 'alta_critica'
  ) {
    return colors.sevCritica;
  }
  if (valor.includes('alt') || valor === 'high' || valor === '3') {
    return colors.sevAlta;
  }
  if (valor.includes('med') || valor === 'medium' || valor === '2') {
    return colors.sevMedia;
  }
  return colors.sevBaja;
}

function etiquetaSeveridad(severidad: string): string {
  const valor = (severidad || '').toLowerCase();
  if (valor.includes('crit') || valor === 'critical' || valor === '4') {
    return 'Crítica';
  }
  if (valor.includes('alt') || valor === 'high' || valor === '3') {
    return 'Alta';
  }
  if (valor.includes('med') || valor === 'medium' || valor === '2') {
    return 'Media';
  }
  if (valor.includes('baj') || valor === 'low' || valor === '1') {
    return 'Baja';
  }
  return severidad?.trim() ? severidad : 'Sin severidad';
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatearDistancia(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return 'Distancia no disponible';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function parsearDespacho(raw: Record<string, unknown>): MiDespacho | null {
  const asignacion = Number(raw.asignacion ?? raw.id);
  if (!Number.isFinite(asignacion)) return null;

  const siguientesRaw = raw.siguientes;
  const siguientes = Array.isArray(siguientesRaw)
    ? siguientesRaw.filter((item): item is string => typeof item === 'string')
    : [];

  const latitud =
    typeof raw.latitud === 'number'
      ? raw.latitud
      : typeof raw.latitude === 'number'
        ? raw.latitude
        : null;
  const longitud =
    typeof raw.longitud === 'number'
      ? raw.longitud
      : typeof raw.longitude === 'number'
        ? raw.longitude
        : null;

  return {
    asignacion,
    carro: String(raw.carro ?? raw.unit_name ?? 'Carro sin nombre'),
    emergencia: String(
      raw.emergencia ?? raw.incident_title ?? 'Emergencia sin título',
    ),
    incidente: Number(raw.incidente ?? raw.incident) || 0,
    latitud,
    longitud,
    severidad: String(raw.severidad ?? raw.severity ?? ''),
    fase: String(raw.fase ?? ''),
    estado: String(raw.estado ?? raw.status ?? ''),
    siguientes,
    soy_encargado: Boolean(raw.soy_encargado ?? raw.esJefe),
    mi_estado: String(raw.mi_estado ?? ''),
  };
}

export default function MiDespachoScreen() {
  const [despacho, setDespacho] = useState<MiDespacho | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const silenciosoRef = useRef(false);
  const montadoRef = useRef(true);

  const refrescar = useCallback(async () => {
    const silencioso = silenciosoRef.current;
    try {
      const { data } = await api.get('/assignments/mis_despachos/');
      if (!montadoRef.current) return;

      const lista = Array.isArray(data) ? data : [];
      const parseados = lista
        .map(item =>
          item && typeof item === 'object'
            ? parsearDespacho(item as Record<string, unknown>)
            : null,
        )
        .filter((item): item is MiDespacho => item != null);

      const activo =
        parseados.find(
          item =>
            item.mi_estado !== 'DECLINED' && item.estado !== 'RELEASED',
        ) ??
        parseados[0] ??
        null;

      setDespacho(activo);
      setError(false);

      if (
        activo &&
        typeof activo.latitud === 'number' &&
        typeof activo.longitud === 'number'
      ) {
        try {
          const permiso = await Location.getForegroundPermissionsAsync();
          if (permiso.status === 'granted') {
            const posicion = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (!montadoRef.current) return;
            setDistanciaKm(
              haversineKm(
                posicion.coords.latitude,
                posicion.coords.longitude,
                activo.latitud,
                activo.longitud,
              ),
            );
          } else {
            setDistanciaKm(null);
          }
        } catch {
          if (montadoRef.current) setDistanciaKm(null);
        }
      } else {
        setDistanciaKm(null);
      }
    } catch {
      if (!montadoRef.current) return;
      if (!silencioso) setError(true);
    } finally {
      if (montadoRef.current) {
        setCargando(false);
        silenciosoRef.current = true;
      }
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    refrescar();

    const intervalo = setInterval(() => {
      refrescar();
    }, REFRESH_MS);

    const appState = AppState.addEventListener('change', estado => {
      if (estado === 'active') refrescar();
    });

    return () => {
      montadoRef.current = false;
      clearInterval(intervalo);
      appState.remove();
    };
  }, [refrescar]);

  useNotificacionesDespacho({
    onRecibida: () => {
      refrescar();
    },
    onTocada: () => {
      refrescar();
    },
  });

  const responder = useCallback(
    async (acepta: boolean) => {
      if (!despacho || accionando) return;
      setAccionando(true);
      setErrorAccion(null);
      try {
        await api.post(`/assignments/${despacho.asignacion}/responder/`, {
          acepta,
        });
        await refrescar();
      } catch (err: unknown) {
        const mensaje =
          (err as { response?: { data?: { error?: string } } })?.response
            ?.data?.error ?? 'No se pudo registrar tu respuesta.';
        setErrorAccion(mensaje);
      } finally {
        setAccionando(false);
      }
    },
    [accionando, despacho, refrescar],
  );

  const avanzar = useCallback(
    async (status: string) => {
      if (!despacho || accionando) return;
      setAccionando(true);
      setErrorAccion(null);
      try {
        await api.patch(`/assignments/${despacho.asignacion}/`, { status });
        await refrescar();
      } catch (err: unknown) {
        const data = (err as { response?: { data?: { error?: string } } })
          ?.response?.data;
        setErrorAccion(data?.error ?? 'No se pudo avanzar el ciclo.');
      } finally {
        setAccionando(false);
      }
    },
    [accionando, despacho, refrescar],
  );

  const estadoVisual = useMemo(() => {
    if (!despacho) return null;
    const key = despacho.estado as EstadoAsignacion;
    if (key in unitStatus) return unitStatus[key];
    return {
      text: colors.text,
      bg: colors.surfaceRaised,
      label: etiquetaEstado(despacho.estado),
    };
  }, [despacho]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.cargandoTexto}>Buscando tu despacho…</Text>
      </View>
    );
  }

  if (error && !despacho) {
    return (
      <EstadoVacio
        icono="cloud-offline"
        titulo="Sin conexión con la central"
        texto="No pudimos cargar tu despacho. Reintenta cuando tengas señal."
        botonTexto="Reintentar"
        onPressBoton={() => {
          silenciosoRef.current = false;
          setCargando(true);
          refrescar();
        }}
      />
    );
  }

  if (!despacho) {
    return (
      <EstadoVacio
        icono="shield-checkmark"
        titulo="En servicio"
        texto="Estás visible para la central. Cuando te despachen a una emergencia, verás aquí qué hacer."
      />
    );
  }

  const pendienteRespuesta = despacho.mi_estado === 'NOTIFIED';
  const confirmo =
    despacho.mi_estado === 'ACCEPTED' ||
    despacho.mi_estado === 'ABOARD' ||
    despacho.mi_estado === 'ON_SCENE' ||
    despacho.mi_estado === 'RETURNED';
  const rechazo = despacho.mi_estado === 'DECLINED';
  const siguientes = Array.isArray(despacho.siguientes)
    ? despacho.siguientes
    : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <View style={styles.alarma}>
        <Text style={styles.alarmaEtiqueta}>DESPACHO ACTIVO</Text>
        <Text style={styles.emergenciaNombre}>{despacho.emergencia}</Text>

        <View style={styles.chips}>
          <View
            style={[
              styles.chip,
              { backgroundColor: colorSeveridad(despacho.severidad) },
            ]}
          >
            <Text style={styles.chipTextoOscuro}>
              {etiquetaSeveridad(despacho.severidad)}
            </Text>
          </View>
          {despacho.fase ? (
            <View style={[styles.chip, styles.chipNeutro]}>
              <Text style={styles.chipTextoClaro}>
                {FASE_ES[despacho.fase] ?? despacho.fase}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.carroFila}>
          <Ionicons name="car" size={spacing.lg} color={colors.primary} />
          <Text style={styles.carroTexto}>{despacho.carro}</Text>
        </View>

        {despacho.soy_encargado ? (
          <View style={styles.encargadoBanner} accessibilityRole="summary">
            <Ionicons name="star" size={spacing.lg} color={colors.textOnPrimary} />
            <Text style={styles.encargadoTexto}>VAS A CARGO</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tarjeta}>
        <View style={styles.detalleFila}>
          <View style={styles.detalleIcono}>
            <Ionicons name="location" size={spacing.lg} color={colors.primary} />
          </View>
          <View style={styles.detalleTexto}>
            <Text style={styles.detalleLabel}>Ubicación</Text>
            <Text style={styles.detalleValor}>
              {despacho.latitud != null && despacho.longitud != null
                ? `${despacho.latitud.toFixed(5)}, ${despacho.longitud.toFixed(5)}`
                : 'Sin coordenadas'}
            </Text>
          </View>
        </View>

        <View style={styles.separador} />

        <View style={styles.detalleFila}>
          <View style={styles.detalleIcono}>
            <Ionicons name="navigate" size={spacing.lg} color={colors.primary} />
          </View>
          <View style={styles.detalleTexto}>
            <Text style={styles.detalleLabel}>Distancia</Text>
            <Text style={styles.detalleValor}>
              {formatearDistancia(distanciaKm)}
            </Text>
          </View>
        </View>

        {estadoVisual ? (
          <>
            <View style={styles.separador} />
            <View style={styles.detalleFila}>
              <View
                style={[
                  styles.detalleIcono,
                  { backgroundColor: estadoVisual.bg },
                ]}
              >
                <Ionicons
                  name="flag"
                  size={spacing.lg}
                  color={estadoVisual.text}
                />
              </View>
              <View style={styles.detalleTexto}>
                <Text style={styles.detalleLabel}>Estado del carro</Text>
                <Text style={[styles.detalleValor, { color: estadoVisual.text }]}>
                  {estadoVisual.label}
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </View>

      {errorAccion ? (
        <View style={styles.errorCaja} accessibilityRole="alert">
          <Ionicons name="warning" size={spacing.lg} color={colors.warning} />
          <Text style={styles.errorTexto}>{errorAccion}</Text>
        </View>
      ) : null}

      {pendienteRespuesta ? (
        <View style={styles.respuestaCaja}>
          <Text style={styles.respuestaTitulo}>¿Puedes ir?</Text>
          <TouchableOpacity
            style={[styles.botonVoy, accionando && styles.botonDeshabilitado]}
            onPress={() => responder(true)}
            disabled={accionando}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Voy"
          >
            {accionando ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={touch / 2}
                  color={colors.textOnPrimary}
                />
                <Text style={styles.botonVoyTexto}>VOY</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.botonNoPuedo,
              accionando && styles.botonDeshabilitado,
            ]}
            onPress={() => responder(false)}
            disabled={accionando}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="No puedo"
          >
            <Ionicons
              name="close-circle"
              size={touch / 2}
              color={colors.danger}
            />
            <Text style={styles.botonNoPuedoTexto}>NO PUEDO</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {rechazo ? (
        <View style={styles.infoCaja}>
          <Text style={styles.infoTexto}>
            Marcaste que no puedes asistir a este despacho.
          </Text>
        </View>
      ) : null}

      {confirmo && despacho.soy_encargado ? (
        <View style={styles.cicloCaja}>
          <Text style={styles.cicloTitulo}>Avanzar ciclo del carro</Text>
          {siguientes.length === 0 ? (
            <Text style={styles.infoTexto}>
              No hay transiciones disponibles ahora.
            </Text>
          ) : (
            siguientes.map(codigo => (
              <TouchableOpacity
                key={codigo}
                style={[
                  styles.botonCiclo,
                  accionando && styles.botonDeshabilitado,
                ]}
                onPress={() => avanzar(codigo)}
                disabled={accionando}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={etiquetaEstado(codigo)}
              >
                <Text style={styles.botonCicloTexto}>
                  {etiquetaEstado(codigo)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      {confirmo && !despacho.soy_encargado ? (
        <View style={styles.infoCaja}>
          <Text style={styles.infoTexto}>
            Confirmaste asistencia. El avance del ciclo lo controla quien va a
            cargo del carro.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  cargandoTexto: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
  alarma: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.md,
  },
  alarmaEtiqueta: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 1.2,
  },
  emergenciaNombre: {
    ...typography.h1,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: touch / 1.5,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipNeutro: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTextoOscuro: {
    ...typography.label,
    color: colors.white,
  },
  chipTextoClaro: {
    ...typography.label,
    color: colors.text,
  },
  carroFila: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  carroTexto: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  encargadoBanner: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  encargadoTexto: {
    ...typography.button,
    color: colors.textOnPrimary,
    letterSpacing: 1,
  },
  tarjeta: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  detalleFila: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detalleIcono: {
    width: touch,
    height: touch,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  detalleTexto: {
    flex: 1,
    gap: spacing.xs,
  },
  detalleLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  detalleValor: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  separador: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  errorTexto: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  respuestaCaja: {
    gap: spacing.md,
  },
  respuestaTitulo: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  botonVoy: {
    minHeight: BOTONES_RESPUESTA_ALTO,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.lg,
  },
  botonVoyTexto: {
    fontSize: typography.h1.fontSize,
    fontWeight: '800',
    lineHeight: typography.h1.lineHeight,
    color: colors.textOnPrimary,
    letterSpacing: 2,
  },
  botonNoPuedo: {
    minHeight: BOTONES_RESPUESTA_ALTO,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 3,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.md,
  },
  botonNoPuedoTexto: {
    fontSize: typography.h1.fontSize,
    fontWeight: '800',
    lineHeight: typography.h1.lineHeight,
    color: colors.danger,
    letterSpacing: 2,
  },
  botonDeshabilitado: {
    opacity: 0.55,
  },
  cicloCaja: {
    gap: spacing.md,
  },
  cicloTitulo: {
    ...typography.h3,
    color: colors.text,
  },
  botonCiclo: {
    minHeight: touch,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  botonCicloTexto: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  infoCaja: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  infoTexto: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
});
