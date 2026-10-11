import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import EstadoVacio from '../components/EstadoVacio';
import api from '../services/api';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  touch,
} from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = StackScreenProps<RootStackParamList, 'EmergenciaViva'>;

type Phase = 'PREPARACION' | 'DESPACHO' | 'COMBATE' | 'REACONDICIONAMIENTO';

interface Incident {
  id: number;
  title: string;
  dispatch_code?: string | null;
  description?: string | null;
  requested_units?: number | null;
  severity?: string | null;
  reported_at?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  address?: string | null;
  location?: string | null;
  comuna?: string | null;
}

interface AssignmentPersonReference {
  id?: number;
  nombre?: string;
  name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface Assignment {
  id: number;
  unit?: number | { id?: number; name?: string } | null;
  unit_name?: string | null;
  unit_details?: { id?: number; name?: string } | null;
  carro?: string | { id?: number; name?: string } | null;
  incident?: number | { id?: number; title?: string } | null;
  incident_id?: number | null;
  incidente?: number | { id?: number; title?: string } | null;
  incident_title?: string | null;
  fase?: string | null;
  status?: string | null;
  status_display?: string | null;
  encargado?: number | AssignmentPersonReference | null;
  encargado_nombre?: string | null;
  encargado_name?: string | null;
  leader_name?: string | null;
}

interface CrewMember {
  id: number;
  usuario: number;
  nombre: string;
  rol: 'LEADER' | 'CREW';
  rol_texto: string;
  estado:
    | 'NOTIFIED'
    | 'ACCEPTED'
    | 'ABOARD'
    | 'ON_SCENE'
    | 'RETURNED'
    | 'DECLINED';
  estado_texto: string;
  avisado: boolean;
  respondio: boolean;
}

interface CyclePayload {
  fases?: Partial<Record<Phase, Assignment[]>>;
}

interface Snapshot {
  incident: Incident;
  assignments: Assignment[];
  crewByAssignment: Record<number, CrewMember[]>;
  crewErrors: Record<number, boolean>;
}

interface ConfirmationInfo {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  confirmed: boolean;
}

const boardPhases: Phase[] = [
  'PREPARACION',
  'DESPACHO',
  'COMBATE',
  'REACONDICIONAMIENTO',
];

const visiblePhases = [
  { key: 'DESPACHO', label: 'Despacho' },
  { key: 'COMBATE', label: 'Combate' },
  { key: 'REACONDICIONAMIENTO', label: 'Reacondicionamiento' },
] as const;

function asList<T>(payload: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.results) ? payload.results : [];
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLocaleLowerCase('es-CL');
}

function numericId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value && typeof value === 'object' && 'id' in value) {
    return numericId((value as { id?: unknown }).id);
  }
  return undefined;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const response = (error as { response?: { data?: { error?: unknown } } }).response;
  return typeof response?.data?.error === 'string' ? response.data.error : fallback;
}

function severityLabel(severity?: string | null): string {
  const normalized = normalizeText(severity);
  if (['critical', 'critica', 'crítica'].includes(normalized)) return 'Crítica';
  if (['high', 'alta'].includes(normalized)) return 'Alta';
  if (['medium', 'media', 'moderate', 'moderada'].includes(normalized)) return 'Media';
  if (['low', 'baja'].includes(normalized)) return 'Baja';
  return severity || 'Sin severidad';
}

function severityColor(severity?: string | null): string {
  const normalized = normalizeText(severity);
  if (['critical', 'critica', 'crítica', 'high', 'alta'].includes(normalized)) {
    return colors.danger;
  }
  if (['medium', 'media', 'moderate', 'moderada'].includes(normalized)) {
    return colors.warning;
  }
  if (['low', 'baja'].includes(normalized)) return colors.success;
  return colors.textMuted;
}

function incidentLocation(incident: Incident): string | null {
  const namedLocation = incident.address || incident.location || incident.comuna;
  if (namedLocation) return namedLocation;
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
  return null;
}

function incidentStart(incident: Incident): Date | null {
  const raw = incident.reported_at || incident.started_at || incident.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function elapsedLabel(incident: Incident, now: number): string {
  const start = incidentStart(incident);
  if (!start) return 'Hora de inicio no disponible';
  const elapsedMinutes = Math.max(0, Math.floor((now - start.getTime()) / 60000));
  if (elapsedMinutes < 1) return 'Empezó hace menos de 1 min';
  if (elapsedMinutes < 60) return `Empezó hace ${elapsedMinutes} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  if (hours < 24) {
    return minutes ? `Empezó hace ${hours} h ${minutes} min` : `Empezó hace ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `Empezó hace ${days} d ${remainingHours} h` : `Empezó hace ${days} d`;
}

function flattenAssignments(payload: CyclePayload): Assignment[] {
  const unique = new Map<number, Assignment>();
  boardPhases.forEach((phase) => {
    const items = payload.fases?.[phase];
    if (!Array.isArray(items)) return;
    items.forEach((assignment) => {
      const id = numericId(assignment.id);
      if (id === undefined) return;
      unique.set(id, {
        ...assignment,
        id,
        fase: assignment.fase || phase,
      });
    });
  });
  return [...unique.values()];
}

function assignmentIncidentId(assignment: Assignment): number | undefined {
  return numericId(assignment.incident) ??
    numericId(assignment.incident_id) ??
    numericId(assignment.incidente);
}

function assignmentIncidentTitle(assignment: Assignment): string | undefined {
  if (assignment.incident_title) return assignment.incident_title;
  if (assignment.incident && typeof assignment.incident === 'object') {
    return assignment.incident.title;
  }
  if (assignment.incidente && typeof assignment.incidente === 'object') {
    return assignment.incidente.title;
  }
  return undefined;
}

function belongsToIncident(assignment: Assignment, incident: Incident): boolean {
  const id = assignmentIncidentId(assignment);
  if (id !== undefined) return id === incident.id;
  const title = assignmentIncidentTitle(assignment);
  return Boolean(title && normalizeText(title) === normalizeText(incident.title));
}

function assignmentUnitName(assignment: Assignment): string {
  if (assignment.unit_name) return assignment.unit_name;
  if (assignment.unit && typeof assignment.unit === 'object' && assignment.unit.name) {
    return assignment.unit.name;
  }
  if (assignment.unit_details?.name) return assignment.unit_details.name;
  if (typeof assignment.carro === 'string') return assignment.carro;
  if (assignment.carro && typeof assignment.carro === 'object' && assignment.carro.name) {
    return assignment.carro.name;
  }
  return `Carro ${numericId(assignment.unit) || ''}`.trim();
}

function assignmentLeaderName(assignment: Assignment, crew: CrewMember[]): string {
  const leader = crew.find((member) => member.rol === 'LEADER');
  if (leader?.nombre) return leader.nombre;
  if (assignment.encargado_nombre) return assignment.encargado_nombre;
  if (assignment.encargado_name) return assignment.encargado_name;
  if (assignment.leader_name) return assignment.leader_name;
  if (assignment.encargado && typeof assignment.encargado === 'object') {
    const composed = `${assignment.encargado.first_name || ''} ${assignment.encargado.last_name || ''}`.trim();
    return assignment.encargado.nombre ||
      assignment.encargado.full_name ||
      assignment.encargado.name ||
      composed ||
      assignment.encargado.email ||
      'No informado';
  }
  return 'No informado';
}

function normalizedPhase(assignment: Assignment): Phase {
  const raw = (assignment.fase || 'DESPACHO').toUpperCase();
  if (raw === 'PREPARACION') return 'PREPARACION';
  if (raw === 'COMBATE') return 'COMBATE';
  if (raw === 'REACONDICIONAMIENTO') return 'REACONDICIONAMIENTO';
  return 'DESPACHO';
}

function phaseIndex(phase: Phase): number {
  if (phase === 'COMBATE') return 1;
  if (phase === 'REACONDICIONAMIENTO') return 2;
  return 0;
}

function phaseLabel(phase: Phase): string {
  if (phase === 'PREPARACION') return 'Despacho';
  if (phase === 'COMBATE') return 'Combate';
  if (phase === 'REACONDICIONAMIENTO') return 'Reacondicionamiento';
  return 'Despacho';
}

function statusLabel(assignment: Assignment): string {
  if (assignment.status_display) return assignment.status_display;
  const status = (assignment.status || '').toUpperCase();
  const labels: Record<string, string> = {
    DISPATCHED: 'Despachado',
    EN_ROUTE: 'En camino',
    ON_SCENE: 'En el lugar',
    RETURNING: 'Regresando',
    RECONDITIONING: 'Reacondicionando',
    RELEASED: 'Liberado',
  };
  return labels[status] || assignment.status || 'Estado no informado';
}

function confirmationInfo(member: CrewMember): ConfirmationInfo {
  if (!member.avisado) {
    return {
      label: 'No avisado',
      icon: 'notifications-off-outline',
      color: colors.textMuted,
      confirmed: false,
    };
  }
  if (member.estado === 'DECLINED') {
    return {
      label: 'No va',
      icon: 'close-circle-outline',
      color: colors.textMuted,
      confirmed: false,
    };
  }
  if (
    ['ACCEPTED', 'ABOARD', 'ON_SCENE', 'RETURNED'].includes(member.estado) ||
    member.respondio
  ) {
    return {
      label: 'Confirmó',
      icon: 'checkmark-circle',
      color: colors.success,
      confirmed: true,
    };
  }
  return {
    label: 'Sin responder',
    icon: 'time-outline',
    color: colors.warning,
    confirmed: false,
  };
}

function ActionButton({ label, onPress, icon }: {
  label: string;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={spacing.lg} color={colors.textOnPrimary} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function Header({ navigation, refreshing, onRefresh }: Pick<Props, 'navigation'> & {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Volver"
        accessibilityRole="button"
        onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Main');
        }}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" size={spacing.lg} color={colors.text} />
      </Pressable>
      <View style={styles.headerText}>
        <Text accessibilityRole="header" style={styles.headerTitle}>Emergencia en vivo</Text>
        <Text style={styles.headerSubtitle}>Se actualiza cada 15 segundos</Text>
      </View>
      <Pressable
        accessibilityLabel="Actualizar ahora"
        accessibilityRole="button"
        accessibilityState={{ busy: refreshing, disabled: refreshing }}
        disabled={refreshing}
        onPress={onRefresh}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      >
        {refreshing ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Ionicons name="refresh" size={spacing.lg} color={colors.text} />
        )}
      </Pressable>
    </View>
  );
}

export default function EmergenciaVivaScreen({ navigation, route }: Props) {
  const { incidentId } = route.params;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const snapshotRef = useRef<Snapshot | null>(null);
  const crewCacheRef = useRef<Record<number, CrewMember[]>>({});
  const inFlightRef = useRef(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const aplicar = () => {
      const el = document.getElementById('emergencia-viva-scroll');
      if (!el) return;
      let nodo: HTMLElement | null = el;
      while (nodo && nodo !== document.body) {
        if (nodo.scrollHeight > nodo.clientHeight + 24) {
          nodo.style.overflowY = 'auto';
          nodo.style.overflowX = 'hidden';
        }
        nodo = nodo.parentElement;
      }
    };
    aplicar();
    const timer = setTimeout(aplicar, 400);
    return () => clearTimeout(timer);
  }, [snapshot]);

  const loadLiveData = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!snapshotRef.current) setInitialLoading(true);
    else setRefreshing(true);
    try {
      const [incidentResponse, cycleResponse] = await Promise.all([
        api.get('/incidents/'),
        api.get<CyclePayload>('/assignments/ciclo/', { params: { incident: incidentId } }),
      ]);
      const incidents = asList<Incident>(incidentResponse.data);
      const incident = incidents.find((item) => item.id === incidentId);
      if (!incident) throw new Error('INCIDENT_NOT_FOUND');

      const assignments = flattenAssignments(cycleResponse.data)
        .filter((assignment) => belongsToIncident(assignment, incident))
        .sort((a, b) => {
          const phaseDifference = phaseIndex(normalizedPhase(a)) - phaseIndex(normalizedPhase(b));
          return phaseDifference || assignmentUnitName(a).localeCompare(assignmentUnitName(b), 'es-CL');
        });

      const crewResults = await Promise.allSettled(
        assignments.map(async (assignment) => {
          const response = await api.get(`/assignments/${assignment.id}/tripulacion/`);
          return {
            assignmentId: assignment.id,
            crew: asList<CrewMember>(response.data),
          };
        }),
      );

      const nextCrew = { ...crewCacheRef.current };
      const crewErrors: Record<number, boolean> = {};
      crewResults.forEach((result, index) => {
        const assignmentId = assignments[index].id;
        if (result.status === 'fulfilled') {
          nextCrew[result.value.assignmentId] = result.value.crew;
        } else {
          crewErrors[assignmentId] = true;
        }
      });

      if (!focusedRef.current) return;
      crewCacheRef.current = nextCrew;
      const nextSnapshot: Snapshot = {
        incident,
        assignments,
        crewByAssignment: nextCrew,
        crewErrors,
      };
      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setFatalError(null);
      setRefreshError(null);
      setLastUpdated(new Date());
      setNow(Date.now());
    } catch (loadError) {
      if (!focusedRef.current) return;
      const isMissingIncident = loadError instanceof Error && loadError.message === 'INCIDENT_NOT_FOUND';
      const message = isMissingIncident
        ? 'La emergencia ya no está disponible.'
        : apiErrorMessage(loadError, 'No pudimos actualizar la emergencia.');
      if (snapshotRef.current) setRefreshError(message);
      else setFatalError(message);
    } finally {
      inFlightRef.current = false;
      if (focusedRef.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [incidentId]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      loadLiveData().catch(() => undefined);
      const interval = setInterval(() => {
        loadLiveData().catch(() => undefined);
      }, 15000);
      return () => {
        focusedRef.current = false;
        clearInterval(interval);
      };
    }, [loadLiveData]),
  );

  const assignments = snapshot?.assignments || [];
  const liveSummary = useMemo(() => {
    let confirmed = 0;
    let total = 0;
    assignments.forEach((assignment) => {
      const crew = snapshot?.crewByAssignment[assignment.id] || [];
      total += crew.length;
      confirmed += crew.filter((member) => confirmationInfo(member).confirmed).length;
    });
    return { confirmed, total };
  }, [assignments, snapshot?.crewByAssignment]);

  if (initialLoading && !snapshot) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Header
          navigation={navigation}
          refreshing={false}
          onRefresh={() => loadLiveData().catch(() => undefined)}
        />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Cargando la emergencia en vivo…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (fatalError || !snapshot) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Header
          navigation={navigation}
          refreshing={refreshing}
          onRefresh={() => loadLiveData().catch(() => undefined)}
        />
        <View style={styles.errorState}>
          <EstadoVacio
            icono="cloud-offline-outline"
            titulo="No pudimos abrir la emergencia"
            texto={fatalError || 'No hay datos disponibles.'}
          />
          <View style={styles.errorAction}>
            <ActionButton
              label="Reintentar"
              icon="refresh"
              onPress={() => loadLiveData().catch(() => undefined)}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const { incident } = snapshot;
  const location = incidentLocation(incident);
  const severity = severityColor(incident.severity);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Header
        navigation={navigation}
        refreshing={refreshing}
        onRefresh={() => loadLiveData().catch(() => undefined)}
      />
      <ScrollView
        nativeID="emergencia-viva-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.incidentCard}>
          <View style={styles.incidentTopRow}>
            <View style={[styles.severityBadge, { borderColor: severity }]}>
              <View style={[styles.severityDot, { backgroundColor: severity }]} />
              <Text style={[styles.severityText, { color: severity }]}>
                Severidad {severityLabel(incident.severity)}
              </Text>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN VIVO</Text>
            </View>
          </View>
          <Text style={styles.incidentTitle}>{incident.title}</Text>
          <Text style={styles.incidentMeta}>
            Clave {incident.dispatch_code || 'sin definir'} · {incident.requested_units || 1} {Number(incident.requested_units || 1) === 1 ? 'carro solicitado' : 'carros solicitados'}
          </Text>
          {incident.description ? (
            <Text style={styles.incidentDescription}>{incident.description}</Text>
          ) : null}
          <View style={styles.incidentMetaRow}>
            <Ionicons name="time-outline" size={spacing.lg} color={colors.text} />
            <Text style={styles.incidentMeta}>{elapsedLabel(incident, now)}</Text>
          </View>
          {location ? (
            <View style={styles.incidentMetaRow}>
              <Ionicons name="location-outline" size={spacing.lg} color={colors.text} />
              <Text style={styles.incidentMeta}>{location}</Text>
            </View>
          ) : null}
        </View>

        {refreshError ? (
          <View style={styles.refreshError}>
            <Ionicons name="cloud-offline-outline" size={spacing.lg} color={colors.text} />
            <Text style={styles.refreshErrorText}>
              {refreshError} Mostramos la última información disponible.
            </Text>
          </View>
        ) : null}

        <View style={styles.boardHeading}>
          <View>
            <Text style={styles.boardTitle}>Ciclo de carros</Text>
            <Text style={styles.boardSubtitle}>
              {assignments.length === 1 ? '1 carro despachado' : `${assignments.length} carros despachados`}
            </Text>
          </View>
          {liveSummary.total > 0 ? (
            <View style={styles.confirmedSummary}>
              <Text style={styles.confirmedNumber}>{liveSummary.confirmed}/{liveSummary.total}</Text>
              <Text style={styles.confirmedLabel}>confirmaron</Text>
            </View>
          ) : null}
        </View>

        {assignments.length === 0 ? (
          <View style={styles.emptyAssignments}>
            <EstadoVacio
              icono="bus-outline"
              titulo="Aún no hay carros despachados"
              texto="Despacha el primer carro para comenzar a seguir el ciclo."
            />
            <ActionButton
              label="Despachar carro"
              icon="add"
              onPress={() => navigation.navigate('Despacho', { incidentId, returnToLive: true })}
            />
          </View>
        ) : assignments.map((assignment) => {
          const phase = normalizedPhase(assignment);
          const currentPhaseIndex = phaseIndex(phase);
          const crew = (snapshot.crewByAssignment[assignment.id] || [])
            .slice()
            .sort((a, b) => {
              if (a.rol !== b.rol) return a.rol === 'LEADER' ? -1 : 1;
              return a.nombre.localeCompare(b.nombre, 'es-CL');
            });
          const confirmedCount = crew.filter((member) => confirmationInfo(member).confirmed).length;

          return (
            <View key={assignment.id} style={styles.assignmentCard}>
              <View style={styles.assignmentHeader}>
                <View style={styles.truckIcon}>
                  <Ionicons name="bus" size={spacing.xl} color={colors.text} />
                </View>
                <View style={styles.assignmentHeaderText}>
                  <Text style={styles.unitName}>{assignmentUnitName(assignment)}</Text>
                  <Text style={styles.leaderName}>
                    A cargo: {assignmentLeaderName(assignment, crew)}
                  </Text>
                </View>
              </View>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{statusLabel(assignment)}</Text>
              </View>

              <View style={styles.currentPhase}>
                <Text style={styles.currentPhaseLabel}>FASE ACTUAL</Text>
                <Text style={styles.currentPhaseValue}>{phaseLabel(phase)}</Text>
              </View>

              <View accessibilityLabel={`Fase actual: ${phaseLabel(phase)}`} style={styles.phaseTrack}>
                {visiblePhases.map((visiblePhase, index) => {
                  const active = index === currentPhaseIndex;
                  const complete = index < currentPhaseIndex;
                  return (
                    <View
                      key={visiblePhase.key}
                      style={[
                        styles.phaseSegment,
                        active && styles.phaseSegmentActive,
                        complete && styles.phaseSegmentComplete,
                      ]}
                    >
                      {complete ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      ) : null}
                      <Text style={[
                        styles.phaseSegmentText,
                        active && styles.phaseSegmentTextActive,
                        complete && styles.phaseSegmentTextComplete,
                      ]}>
                        {visiblePhase.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.crewHeader}>
                <Text style={styles.crewTitle}>Tripulación</Text>
                <Text style={styles.crewCount}>{confirmedCount}/{crew.length} confirmaron</Text>
              </View>

              {snapshot.crewErrors[assignment.id] && crew.length > 0 ? (
                <View style={styles.staleCrewNotice}>
                  <Ionicons name="time-outline" size={spacing.lg} color={colors.text} />
                  <Text style={styles.staleCrewNoticeText}>
                    Mostrando la última confirmación disponible para esta tripulación.
                  </Text>
                </View>
              ) : null}

              {snapshot.crewErrors[assignment.id] && crew.length === 0 ? (
                <View style={styles.crewMessage}>
                  <Ionicons name="cloud-offline-outline" size={spacing.lg} color={colors.textMuted} />
                  <Text style={styles.crewMessageText}>No se pudo actualizar esta tripulación.</Text>
                </View>
              ) : crew.length === 0 ? (
                <View style={styles.crewMessage}>
                  <Ionicons name="people-outline" size={spacing.lg} color={colors.textMuted} />
                  <Text style={styles.crewMessageText}>Sin tripulación registrada.</Text>
                </View>
              ) : crew.map((member) => {
                const confirmation = confirmationInfo(member);
                return (
                  <View key={member.id} style={styles.crewRow}>
                    <View style={styles.memberIcon}>
                      <Ionicons
                        name={member.rol === 'LEADER' ? 'person' : 'person-outline'}
                        size={spacing.lg}
                        color={colors.text}
                      />
                    </View>
                    <View style={styles.memberMain}>
                      <Text style={styles.memberName}>{member.nombre}</Text>
                      <Text style={styles.memberRole}>
                        {member.rol_texto || (member.rol === 'LEADER' ? 'Encargado' : 'Tripulación')}
                        {member.estado_texto ? ` · ${member.estado_texto}` : ''}
                      </Text>
                    </View>
                    <View style={styles.confirmation}>
                      <Ionicons name={confirmation.icon} size={spacing.lg} color={confirmation.color} />
                      <Text style={[styles.confirmationText, { color: confirmation.color }]}>
                        {confirmation.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {assignments.length > 0 ? (
          <ActionButton
            label="Despachar otro carro"
            icon="add"
            onPress={() => navigation.navigate('Despacho', { incidentId, returnToLive: true })}
          />
        ) : null}

        <Text style={styles.lastUpdated}>
          {lastUpdated
            ? `Última actualización: ${lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Esperando primera actualización'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web' ? {
      height: '100%',
      maxHeight: '100%',
      overflow: 'hidden' as const,
    } : null),
  },
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
    ...(Platform.OS === 'web' ? { overflowY: 'auto' as const } : null),
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: touch,
    paddingHorizontal: spacing.sm,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: borderRadius.md,
    height: touch,
    justifyContent: 'center',
    width: touch,
  },
  headerText: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  incidentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.md,
  },
  incidentTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  severityBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  severityDot: {
    borderRadius: borderRadius.full,
    height: 12,
    width: 12,
  },
  severityText: {
    fontSize: 18,
    fontWeight: '800',
  },
  liveBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  liveDot: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.full,
    height: 10,
    width: 10,
  },
  liveText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  incidentTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  incidentMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  incidentMeta: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  incidentDescription: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  refreshError: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  refreshErrorText: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    lineHeight: 25,
  },
  boardHeading: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  boardTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  boardSubtitle: {
    color: colors.textMuted,
    fontSize: 18,
    marginTop: spacing.xs,
  },
  confirmedSummary: {
    alignItems: 'flex-end',
  },
  confirmedNumber: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  confirmedLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  assignmentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.md,
    ...shadows.sm,
  },
  assignmentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  truckIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    height: touch,
    justifyContent: 'center',
    width: touch,
  },
  assignmentHeaderText: {
    flex: 1,
  },
  unitName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  leaderName: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 25,
    marginTop: spacing.xs,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  currentPhase: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  currentPhaseLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  currentPhaseValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  phaseTrack: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  phaseSegment: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: touch,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  phaseSegmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  phaseSegmentComplete: {
    backgroundColor: colors.surface,
    borderColor: colors.success,
  },
  phaseSegmentText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  phaseSegmentTextActive: {
    color: colors.textOnPrimary,
  },
  phaseSegmentTextComplete: {
    color: colors.text,
  },
  crewHeader: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  crewTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  crewCount: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  crewRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: touch,
    paddingVertical: spacing.sm,
  },
  memberIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  memberMain: {
    flex: 1,
  },
  memberName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  memberRole: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  confirmation: {
    alignItems: 'flex-end',
    maxWidth: 112,
  },
  confirmationText: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  crewMessage: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: touch,
    paddingVertical: spacing.md,
  },
  crewMessageText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 18,
  },
  staleCrewNotice: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  staleCrewNoticeText: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: touch,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  actionButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyAssignments: {
    minHeight: touch * 6,
  },
  lastUpdated: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateText: {
    color: colors.text,
    fontSize: 18,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorState: {
    flex: 1,
  },
  errorAction: {
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.72,
  },
});
