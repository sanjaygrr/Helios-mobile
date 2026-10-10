import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

type Props = StackScreenProps<RootStackParamList, 'Despacho'>;
type Step = 1 | 2 | 3 | 4 | 5;

interface FireDepartmentReference {
  id?: number;
  name?: string;
}

interface Incident {
  id: number;
  title: string;
  dispatch_code?: string | null;
  description?: string | null;
  requested_units?: number | null;
  severity?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  address?: string | null;
  location?: string | null;
  comuna?: string | null;
  is_active?: boolean;
  status?: string | null;
  fire_department?: number | FireDepartmentReference | null;
  fire_department_details?: FireDepartmentReference | null;
  fire_department_name?: string | null;
}

interface Unit {
  id: number;
  name: string;
  status?: string | null;
  status_display?: string | null;
  unit_type?: string | null;
  type_display?: string | null;
  company_name?: string | null;
  company?: number | null;
  team_leader?: number | null;
  fire_department?: number | FireDepartmentReference | null;
  fire_department_details?: FireDepartmentReference | null;
  fire_department_name?: string | null;
  company_details?: {
    name?: string;
    fire_department?: number | FireDepartmentReference | null;
    fire_department_name?: string | null;
  } | null;
}

interface Person {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  is_active?: boolean;
  company?: number | null;
  fire_department?: number | FireDepartmentReference | null;
  fire_department_details?: FireDepartmentReference | null;
  company_details?: {
    name?: string | null;
    number?: number | string | null;
    fire_department?: number | FireDepartmentReference | null;
    fire_department_name?: string | null;
  } | null;
}

interface AssignmentCreated {
  id: number;
  unit_name: string;
  incident_title: string;
  tripulacion_total: number;
  tripulacion_avisada: number;
}

interface BodyIdentity {
  id?: number;
  name?: string;
}

const stepLabels = ['Emergencia', 'Carro', 'Encargado', 'Tripulación', 'Confirmar'];

function asList<T>(payload: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.results) ? payload.results : [];
}

function numericId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function identityFromReference(
  reference: number | FireDepartmentReference | null | undefined,
): BodyIdentity {
  if (typeof reference === 'number') return { id: reference };
  if (reference && typeof reference === 'object') {
    return { id: numericId(reference.id), name: reference.name || undefined };
  }
  return {};
}

function incidentBody(incident?: Incident): BodyIdentity {
  if (!incident) return {};
  const direct = identityFromReference(incident.fire_department);
  return {
    id: direct.id ?? numericId(incident.fire_department_details?.id),
    name:
      direct.name ||
      incident.fire_department_details?.name ||
      incident.fire_department_name ||
      undefined,
  };
}

function unitBody(unit?: Unit): BodyIdentity {
  if (!unit) return {};
  const direct = identityFromReference(unit.fire_department);
  const company = identityFromReference(unit.company_details?.fire_department);
  return {
    id:
      direct.id ??
      numericId(unit.fire_department_details?.id) ??
      company.id,
    name:
      direct.name ||
      unit.fire_department_details?.name ||
      unit.fire_department_name ||
      company.name ||
      unit.company_details?.fire_department_name ||
      undefined,
  };
}

function personBody(person: Person): BodyIdentity {
  const direct = identityFromReference(person.fire_department);
  const company = identityFromReference(person.company_details?.fire_department);
  return {
    id: direct.id ?? numericId(person.fire_department_details?.id) ?? company.id,
    name:
      direct.name ||
      person.fire_department_details?.name ||
      company.name ||
      person.company_details?.fire_department_name ||
      undefined,
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLocaleLowerCase('es-CL');
}

function belongsToBody(person: Person, body: BodyIdentity): boolean {
  if (body.id === undefined && !body.name) return true;
  const candidate = personBody(person);
  if (body.id !== undefined && candidate.id !== undefined) {
    return body.id === candidate.id;
  }
  if (body.name && candidate.name) {
    return normalizeText(body.name) === normalizeText(candidate.name);
  }
  return false;
}

function isCompatibleBody(candidate: BodyIdentity, target: BodyIdentity): boolean {
  if (target.id === undefined && !target.name) return true;
  if (candidate.id !== undefined && target.id !== undefined) {
    return candidate.id === target.id;
  }
  if (candidate.name && target.name) {
    return normalizeText(candidate.name) === normalizeText(target.name);
  }
  // Si alguno de los serializers no trae una identidad comparable, la API
  // autenticada sigue siendo la autoridad de alcance y no ocultamos el carro.
  return true;
}

function personName(person?: Person): string {
  if (!person) return 'Sin seleccionar';
  const composed = `${person.first_name || ''} ${person.last_name || ''}`.trim();
  return person.full_name || person.name || composed || person.email || `Persona ${person.id}`;
}

function unitType(unit: Unit): string {
  return unit.type_display || unit.unit_type || 'Tipo no informado';
}

function companyName(unit: Unit): string {
  return unit.company_name || unit.company_details?.name || 'Sin compañía';
}

function belongsToCompany(person: Person, unit?: Unit): boolean {
  if (!unit) return true;
  if (unit.company != null && person.company != null) {
    return unit.company === person.company;
  }
  const unitName = companyName(unit);
  const personCompany = person.company_details?.name;
  return Boolean(
    personCompany &&
    normalizeText(unitName) === normalizeText(personCompany),
  );
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

function incidentLocation(incident: Incident): string {
  const namedLocation = incident.address || incident.location || incident.comuna;
  if (namedLocation) return namedLocation;
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
  return 'Ubicación no informada';
}

function isIncidentOpen(incident: Incident): boolean {
  if (incident.is_active === false) return false;
  const status = (incident.status || '').toUpperCase();
  return !['CLOSED', 'RESOLVED', 'FINISHED', 'CANCELLED'].includes(status);
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const response = (error as { response?: { data?: { error?: unknown } } }).response;
  return typeof response?.data?.error === 'string' ? response.data.error : fallback;
}

function ActionButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}) {
  const primary = variant === 'primary';
  const foreground = disabled
    ? colors.textDisabled
    : primary
      ? colors.textOnPrimary
      : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        disabled && styles.actionButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={spacing.lg} color={foreground} /> : null}
          <Text style={[styles.actionButtonText, { color: foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function SearchField({ value, onChangeText, placeholder }: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchField}>
      <Ionicons name="search" size={spacing.lg} color={colors.textMuted} />
      <TextInput
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        value={value}
      />
    </View>
  );
}

function Header({ navigation }: Pick<Props, 'navigation'>) {
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
        <Text accessibilityRole="header" style={styles.headerTitle}>Nuevo despacho</Text>
        <Text style={styles.headerSubtitle}>Comando de emergencia</Text>
      </View>
    </View>
  );
}

export default function DespachoScreen({ navigation, route }: Props) {
  const requestedIncidentId = route.params?.incidentId;
  const [step, setStep] = useState<Step>(1);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [leaderId, setLeaderId] = useState<number | null>(null);
  const [crewIds, setCrewIds] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshingUnits, setRefreshingUnits] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitRefreshError, setUnitRefreshError] = useState<string | null>(null);
  const [parameterNotice, setParameterNotice] = useState<string | null>(null);
  const [created, setCreated] = useState<AssignmentCreated | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incidentResponse, unitResponse, peopleResponse] = await Promise.all([
        api.get('/incidents/'),
        api.get('/units/'),
        api.get('/users/'),
      ]);
      const nextIncidents = asList<Incident>(incidentResponse.data).filter(isIncidentOpen);
      const nextUnits = asList<Unit>(unitResponse.data);
      const nextPeople = asList<Person>(peopleResponse.data);
      setIncidents(nextIncidents);
      setUnits(nextUnits);
      setPeople(nextPeople);

      if (requestedIncidentId !== undefined) {
        const exists = nextIncidents.some((incident) => incident.id === requestedIncidentId);
        if (exists) {
          setSelectedIncidentId(requestedIncidentId);
          setStep(2);
          setParameterNotice(null);
        } else {
          setParameterNotice('La emergencia indicada ya no está activa. Elige otra.');
        }
      }
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'No pudimos cargar los datos para armar el despacho.'));
    } finally {
      setLoading(false);
    }
  }, [requestedIncidentId]);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  useEffect(() => {
    setQuery('');
  }, [step]);

  const refreshUnits = useCallback(async () => {
    setRefreshingUnits(true);
    setUnitRefreshError(null);
    try {
      const response = await api.get('/units/');
      const nextUnits = asList<Unit>(response.data);
      setUnits(nextUnits);
      if (
        selectedUnitId !== null &&
        !nextUnits.some(
          (unit) => unit.id === selectedUnitId && (unit.status || '').toUpperCase() === 'AVAILABLE',
        )
      ) {
        setSelectedUnitId(null);
      }
    } catch (refreshError) {
      setUnitRefreshError(
        apiErrorMessage(refreshError, 'No se pudo actualizar la disponibilidad de carros.'),
      );
    } finally {
      setRefreshingUnits(false);
    }
  }, [selectedUnitId]);

  const activeIncidents = useMemo(
    () => incidents.slice().sort((a, b) => a.title.localeCompare(b.title, 'es-CL')),
    [incidents],
  );
  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId);
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const selectedLeader = people.find((person) => person.id === leaderId);
  const selectedCrew = people.filter((person) => crewIds.includes(person.id));
  const unitsForIncident = useMemo(() => {
    const body = incidentBody(selectedIncident);
    return units.filter((unit) => isCompatibleBody(unitBody(unit), body));
  }, [selectedIncident, units]);
  const availableUnits = useMemo(
    () => unitsForIncident.filter((unit) => (unit.status || '').toUpperCase() === 'AVAILABLE'),
    [unitsForIncident],
  );
  const unavailableCount = unitsForIncident.length - availableUnits.length;

  const targetBody = useMemo(() => {
    const fromIncident = incidentBody(selectedIncident);
    const fromUnit = unitBody(selectedUnit);
    return {
      id: fromUnit.id ?? fromIncident.id,
      name: fromUnit.name || fromIncident.name,
    };
  }, [selectedIncident, selectedUnit]);

  const eligiblePeople = useMemo(
    () => people
      .filter((person) =>
        person.is_active !== false &&
        belongsToBody(person, targetBody) &&
        belongsToCompany(person, selectedUnit)
      )
      .sort((a, b) => personName(a).localeCompare(personName(b), 'es-CL')),
    [people, selectedUnit, targetBody],
  );

  const normalizedQuery = normalizeText(query);
  const filteredIncidents = activeIncidents.filter((incident) => {
    const haystack = `${incident.title} ${incidentLocation(incident)} ${severityLabel(incident.severity)}`;
    return normalizeText(haystack).includes(normalizedQuery);
  });
  const filteredUnits = availableUnits.filter((unit) => {
    const haystack = `${unit.name} ${companyName(unit)} ${unitType(unit)}`;
    return normalizeText(haystack).includes(normalizedQuery);
  });
  const filteredPeople = eligiblePeople.filter((person) => {
    const haystack = `${personName(person)} ${person.email || ''} ${person.company_details?.name || ''}`;
    return normalizeText(haystack).includes(normalizedQuery);
  });
  const crewCandidates = filteredPeople.filter((person) => person.id !== leaderId);

  const groupedUnits = useMemo(() => {
    const groups = new Map<string, Unit[]>();
    filteredUnits.forEach((unit) => {
      const company = companyName(unit);
      groups.set(company, [...(groups.get(company) || []), unit]);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es-CL'))
      .map(([company, companyUnits]) => ({
        company,
        units: companyUnits.sort((a, b) => a.name.localeCompare(b.name, 'es-CL')),
      }));
  }, [filteredUnits]);

  const chooseIncident = (incident: Incident) => {
    if (selectedIncidentId !== incident.id) {
      setSelectedUnitId(null);
      setLeaderId(null);
      setCrewIds([]);
    }
    setSelectedIncidentId(incident.id);
    setParameterNotice(null);
  };

  const chooseUnit = (unit: Unit) => {
    if (selectedUnitId !== unit.id) {
      const companyPeople = people.filter(
        (person) =>
          person.is_active !== false &&
          belongsToBody(person, unitBody(unit)) &&
          belongsToCompany(person, unit),
      );
      const captain =
        companyPeople.find((person) => person.role === 'COMPANY_CHIEF') ??
        companyPeople.find((person) => person.id === unit.team_leader) ??
        null;
      setLeaderId(captain?.id ?? null);
      setCrewIds(
        companyPeople
          .filter((person) => person.id !== captain?.id)
          .map((person) => person.id),
      );
    }
    setSelectedUnitId(unit.id);
  };

  const chooseLeader = (person: Person) => {
    setLeaderId(person.id);
    setCrewIds(
      eligiblePeople
        .filter((candidate) => candidate.id !== person.id)
        .map((candidate) => candidate.id),
    );
  };

  const canContinue =
    (step === 1 && selectedIncidentId !== null) ||
    (step === 2 && selectedUnitId !== null) ||
    (step === 3 && leaderId !== null) ||
    step === 4;
  const continueHint = step === 1
    ? 'Elige una emergencia para continuar.'
    : step === 2
      ? 'Elige un carro para continuar.'
      : 'Elige al encargado para continuar.';

  const confirmDispatch = async () => {
    if (!selectedIncident || !selectedUnit || !selectedLeader) {
      Alert.alert('Faltan datos', 'Revisa la emergencia, el carro y el encargado.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.post<AssignmentCreated>('/assignments/', {
        unit: selectedUnit.id,
        incident: selectedIncident.id,
        encargado: selectedLeader.id,
        tripulacion: [...new Set(crewIds)].filter((id) => id !== selectedLeader.id),
      });
      setCreated(response.data);
      await refreshUnits();
    } catch (submitError) {
      const message = apiErrorMessage(submitError, 'No se pudo confirmar el despacho.');
      const isUnitConflict = normalizeText(message).includes('ya esta asignada') ||
        normalizeText(message).includes('ya está asignada');
      if (isUnitConflict) {
        setSelectedUnitId(null);
        setLeaderId(null);
        setCrewIds([]);
        setStep(2);
        await refreshUnits();
      }
      Alert.alert('Despacho no enviado', message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderIncidentStep = () => (
    <View>
      <Text style={styles.sectionTitle}>Elige la emergencia</Text>
      <Text style={styles.sectionText}>El carro y la tripulación quedarán asociados a esta emergencia.</Text>
      {parameterNotice ? <Text style={styles.notice}>{parameterNotice}</Text> : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar emergencia" />
      {filteredIncidents.length === 0 ? (
        <View style={styles.emptyPanel}>
          <EstadoVacio
            icono="alert-circle-outline"
            titulo="No hay emergencias activas"
            texto={query ? 'No encontramos coincidencias.' : 'Cuando haya una emergencia activa aparecerá aquí.'}
          />
        </View>
      ) : filteredIncidents.map((incident) => {
        const selected = incident.id === selectedIncidentId;
        const severity = severityColor(incident.severity);
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={incident.id}
            onPress={() => chooseIncident(incident)}
            style={({ pressed }) => [
              styles.optionCard,
              selected && styles.optionCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.optionMain}>
              <Text style={styles.optionTitle}>{incident.title}</Text>
              <Text style={styles.optionDetail}>
                Clave {incident.dispatch_code || 'sin definir'} · {incident.requested_units || 1} {Number(incident.requested_units || 1) === 1 ? 'carro' : 'carros'}
              </Text>
              <Text style={styles.optionDetail}>{incidentLocation(incident)}</Text>
              <View style={styles.severityRow}>
                <View style={[styles.severityDot, { backgroundColor: severity }]} />
                <Text style={[styles.severityText, { color: severity }]}>
                  Severidad {severityLabel(incident.severity)}
                </Text>
              </View>
            </View>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={spacing.xl}
              color={selected ? colors.primary : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );

  const renderUnitStep = () => (
    <View>
      <View style={styles.sectionHeadingRow}>
        <View style={styles.sectionHeadingText}>
          <Text style={styles.sectionTitle}>Elige el carro</Text>
          <Text style={styles.sectionText}>Solo aparecen carros disponibles, agrupados por compañía.</Text>
        </View>
        <Pressable
          accessibilityLabel="Actualizar carros disponibles"
          accessibilityRole="button"
          disabled={refreshingUnits}
          onPress={() => refreshUnits().catch(() => undefined)}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
        >
          {refreshingUnits ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Ionicons name="refresh" size={spacing.lg} color={colors.text} />
          )}
        </Pressable>
      </View>
      <Text style={styles.notice}>
        Los carros ya despachados no se pueden elegir porque están asignados a otra emergencia.
        {unavailableCount > 0 ? ` ${unavailableCount} no están disponibles ahora.` : ''}
      </Text>
      {unitRefreshError ? <Text style={styles.inlineError}>{unitRefreshError}</Text> : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar carro o compañía" />
      {groupedUnits.length === 0 ? (
        <View style={styles.emptyPanel}>
          <EstadoVacio
            icono="bus-outline"
            titulo="No hay carros disponibles"
            texto={query ? 'No encontramos coincidencias.' : 'Todos los carros están asignados o fuera de servicio.'}
          />
        </View>
      ) : groupedUnits.map((group) => (
        <View key={group.company} style={styles.group}>
          <Text style={styles.groupTitle}>{group.company}</Text>
          {group.units.map((unit) => {
            const selected = unit.id === selectedUnitId;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={unit.id}
                onPress={() => chooseUnit(unit)}
                style={({ pressed }) => [
                  styles.optionCard,
                  selected && styles.optionCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.unitIcon}>
                  <Ionicons name="bus" size={spacing.lg} color={colors.text} />
                </View>
                <View style={styles.optionMain}>
                  <Text style={styles.optionTitle}>{unit.name}</Text>
                  <Text style={styles.optionDetail}>{unitType(unit)}</Text>
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={spacing.xl}
                  color={selected ? colors.primary : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );

  const renderLeaderStep = () => (
    <View>
      <Text style={styles.sectionTitle}>Elige al encargado</Text>
      <Text style={styles.sectionText}>
        Será la persona a cargo de {selectedUnit?.name || 'este carro'}.
      </Text>
      {targetBody.name ? <Text style={styles.contextLabel}>Cuerpo: {targetBody.name}</Text> : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar persona" />
      {filteredPeople.length === 0 ? (
        <View style={styles.emptyPanel}>
          <EstadoVacio
            icono="people-outline"
            titulo="No hay personas disponibles"
            texto={query ? 'No encontramos coincidencias.' : 'No hay personas activas del cuerpo para asignar.'}
          />
        </View>
      ) : filteredPeople.map((person) => {
        const selected = person.id === leaderId;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={person.id}
            onPress={() => chooseLeader(person)}
            style={({ pressed }) => [
              styles.optionCard,
              selected && styles.optionCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.personIcon}>
              <Ionicons name="person" size={spacing.lg} color={colors.text} />
            </View>
            <View style={styles.optionMain}>
              <Text style={styles.optionTitle}>{personName(person)}</Text>
              <Text style={styles.optionDetail}>
                {person.company_details?.name || person.email || 'Compañía no informada'}
              </Text>
            </View>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={spacing.xl}
              color={selected ? colors.primary : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );

  const renderCrewStep = () => (
    <View>
      <Text style={styles.sectionTitle}>Personas que recibirán la alarma</Text>
      <Text style={styles.sectionText}>
        Se avisará automáticamente a todos los miembros activos de {selectedUnit ? companyName(selectedUnit) : 'la compañía'}.
      </Text>
      <View style={styles.noticeRow}>
        <Ionicons name="information-circle-outline" size={spacing.lg} color={colors.text} />
        <Text style={styles.noticeRowText}>
          {personName(selectedLeader)} ya está incluido como encargado y no se cuenta dos veces.
        </Text>
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar tripulante" />
      {crewCandidates.length === 0 ? (
        <View style={styles.emptyPanel}>
          <EstadoVacio
            icono="people-outline"
            titulo="No hay más personas"
            texto={query ? 'No encontramos coincidencias.' : 'Puedes continuar solo con el encargado.'}
          />
        </View>
      ) : crewCandidates.map((person) => (
          <View key={person.id} style={[styles.optionCard, styles.optionCardSelected]}>
            <View style={styles.personIcon}>
              <Ionicons name="person-outline" size={spacing.lg} color={colors.text} />
            </View>
            <View style={styles.optionMain}>
              <Text style={styles.optionTitle}>{personName(person)}</Text>
              <Text style={styles.optionDetail}>
                {person.company_details?.name || person.email || 'Compañía no informada'}
              </Text>
            </View>
            <Ionicons
              name="notifications"
              size={spacing.xl}
              color={colors.primary}
            />
          </View>
      ))}
    </View>
  );

  const SummaryRow = ({
    label,
    value,
    detail,
    targetStep,
  }: {
    label: string;
    value: string;
    detail?: string;
    targetStep: Step;
  }) => (
    <Pressable
      accessibilityHint={`Volver al paso ${targetStep} para cambiar`}
      accessibilityRole="button"
      onPress={() => setStep(targetStep)}
      style={({ pressed }) => [styles.summaryRow, pressed && styles.pressed]}
    >
      <View style={styles.summaryText}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
        {detail ? <Text style={styles.summaryDetail}>{detail}</Text> : null}
      </View>
      <View style={styles.changeAction}>
        <Text style={styles.changeText}>Cambiar</Text>
        <Ionicons name="chevron-forward" size={spacing.lg} color={colors.text} />
      </View>
    </Pressable>
  );

  const renderConfirmStep = () => (
    <View>
      <Text style={styles.sectionTitle}>Confirma el despacho</Text>
      <Text style={styles.sectionText}>Revisa quién va, en qué carro y a dónde será enviado.</Text>
      <View style={styles.summaryCard}>
        <SummaryRow
          label="Emergencia y destino"
          value={selectedIncident?.title || 'Sin emergencia'}
          detail={selectedIncident ? incidentLocation(selectedIncident) : undefined}
          targetStep={1}
        />
        <SummaryRow
          label="Carro"
          value={selectedUnit?.name || 'Sin carro'}
          detail={selectedUnit ? `${companyName(selectedUnit)} · ${unitType(selectedUnit)}` : undefined}
          targetStep={2}
        />
        <SummaryRow
          label="Encargado"
          value={personName(selectedLeader)}
          targetStep={3}
        />
        <SummaryRow
          label="Miembros avisados"
          value={selectedCrew.length === 1 ? '1 persona' : `${selectedCrew.length} personas`}
          detail={selectedCrew.length ? selectedCrew.map(personName).join(', ') : 'Solo viaja el encargado'}
          targetStep={4}
        />
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalNumber}>{selectedCrew.length + 1}</Text>
        <Text style={styles.totalText}>
          {selectedCrew.length === 0 ? 'persona recibirá el despacho' : 'personas recibirán el despacho'}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Header navigation={navigation} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Cargando datos del despacho…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Header navigation={navigation} />
        <View style={styles.errorState}>
          <EstadoVacio
            icono="cloud-offline-outline"
            titulo="No pudimos cargar el despacho"
            texto={error}
          />
          <View style={styles.errorAction}>
            <ActionButton label="Reintentar" icon="refresh" onPress={() => loadData().catch(() => undefined)} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (created) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Header navigation={navigation} />
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={touch} color={colors.textOnPrimary} />
          </View>
          <Text accessibilityRole="header" style={styles.successTitle}>Despacho enviado</Text>
          <Text style={styles.successCount}>
            {created.tripulacion_avisada} de {created.tripulacion_total}
          </Text>
          <Text style={styles.successText}>personas quedaron avisadas</Text>
          <View style={styles.successSummary}>
            <Text style={styles.successSummaryTitle}>{created.unit_name || selectedUnit?.name}</Text>
            <Text style={styles.successSummaryText}>{created.incident_title || selectedIncident?.title}</Text>
          </View>
          <View style={styles.successActions}>
            <ActionButton
              label="Ver emergencia en vivo"
              icon="pulse"
              onPress={() => {
                if (route.params?.returnToLive && navigation.canGoBack()) navigation.goBack();
                else navigation.replace('EmergenciaViva', { incidentId: selectedIncidentId as number });
              }}
            />
            <ActionButton
              label="Despachar otro carro"
              icon="add"
              variant="secondary"
              onPress={() => {
                setCreated(null);
                setSelectedUnitId(null);
                setLeaderId(null);
                setCrewIds([]);
                setStep(2);
              }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Header navigation={navigation} />
      <View accessibilityLabel={`Paso ${step} de 5: ${stepLabels[step - 1]}`} style={styles.progress}>
        {stepLabels.map((label, index) => {
          const number = index + 1;
          const complete = number < step;
          const current = number === step;
          return (
            <View key={label} style={styles.progressItem}>
              <View style={[
                styles.progressCircle,
                (complete || current) && styles.progressCircleActive,
              ]}>
                {complete ? (
                  <Ionicons name="checkmark" size={spacing.md} color={colors.textOnPrimary} />
                ) : (
                  <Text style={[
                    styles.progressNumber,
                    current && styles.progressNumberActive,
                  ]}>{number}</Text>
                )}
              </View>
              <Text numberOfLines={2} style={[
                styles.progressLabel,
                current && styles.progressLabelActive,
              ]}>{label}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? renderIncidentStep() : null}
        {step === 2 ? renderUnitStep() : null}
        {step === 3 ? renderLeaderStep() : null}
        {step === 4 ? renderCrewStep() : null}
        {step === 5 ? renderConfirmStep() : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 ? (
          <View style={styles.footerButton}>
            <ActionButton
              label="Volver"
              icon="arrow-back"
              variant="secondary"
              onPress={() => setStep((step - 1) as Step)}
            />
          </View>
        ) : null}
        <View style={styles.footerButtonPrimary}>
          {step === 5 ? (
            <ActionButton
              label="Confirmar despacho"
              icon="send"
              loading={submitting}
              onPress={() => confirmDispatch().catch(() => undefined)}
            />
          ) : canContinue ? (
            <ActionButton
              label="Continuar"
              icon="arrow-forward"
              onPress={() => setStep((step + 1) as Step)}
            />
          ) : (
            <View style={styles.footerHint}>
              <Ionicons name="information-circle-outline" size={spacing.lg} color={colors.textMuted} />
              <Text style={styles.footerHintText}>{continueHint}</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
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
  progress: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
  },
  progressCircle: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  progressCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressNumber: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  progressNumberActive: {
    color: colors.textOnPrimary,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: colors.text,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionHeadingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  sectionHeadingText: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  sectionText: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 25,
    marginTop: spacing.sm,
  },
  contextLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  notice: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    color: colors.text,
    fontSize: 18,
    lineHeight: 25,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  inlineError: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  noticeRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  noticeRowText: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    lineHeight: 25,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: touch,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    minHeight: touch,
    paddingVertical: spacing.sm,
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    minHeight: touch,
    padding: spacing.md,
    ...shadows.sm,
  },
  optionCardSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  optionMain: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  optionDetail: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 25,
    marginTop: spacing.xs,
  },
  severityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
  unitIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.md,
    height: touch,
    justifyContent: 'center',
    width: touch,
  },
  personIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.full,
    height: touch,
    justifyContent: 'center',
    width: touch,
  },
  group: {
    marginBottom: spacing.md,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    height: touch,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: touch,
  },
  emptyPanel: {
    minHeight: touch * 5,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  summaryRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: touch,
    padding: spacing.md,
  },
  summaryText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  summaryDetail: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 25,
    marginTop: spacing.xs,
  },
  changeAction: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  changeText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  totalCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  totalNumber: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  totalText: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
  footerButtonPrimary: {
    flex: 2,
  },
  footerHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: touch,
    paddingHorizontal: spacing.sm,
  },
  footerHintText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 18,
    lineHeight: 25,
    textAlign: 'center',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: touch,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  actionButtonDisabled: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
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
  successContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    height: touch * 2,
    justifyContent: 'center',
    width: touch * 2,
  },
  successTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  successCount: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
    marginTop: spacing.xl,
  },
  successText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  successSummary: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    width: '100%',
  },
  successSummaryTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  successSummaryText: {
    color: colors.textMuted,
    fontSize: 18,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  successActions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    width: '100%',
  },
});
