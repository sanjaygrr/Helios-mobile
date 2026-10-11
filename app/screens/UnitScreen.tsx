import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  FlatList,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import api, { asList } from '../services/api';
import { compararCarros, etiquetaCarro, nombreCarroConOrigen, origenCarro } from '../utils/claves';

const ESTADOS_CARRO = [
  { id: 'AVAILABLE', label: 'Disponible' },
  { id: 'STANDBY', label: 'En espera' },
  { id: 'DEPLOYED', label: 'Desplegado' },
  { id: 'MAINTENANCE', label: 'Mantención' },
  { id: 'RECONDITIONING', label: 'Reacondicionamiento' },
];

type UnitStatus = 'available' | 'en_route' | 'on_scene' | 'returning';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  isLeader: boolean;
}

export default function UnitScreen() {
  const { user, role, vista } = useAuth();
  const esJefeDeCarro = vista === 'CARRO';
  const [assignment, setAssignment] = useState<any>(null);
  const [carros, setCarros] = useState<any[]>([]);
  const [carroId, setCarroId] = useState<number | null>(null);
  const [despachos, setDespachos] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [incidentDetails, setIncidentDetails] = useState<any>(null);
  const [status, setStatus] = useState<UnitStatus>('available');
  const [loading, setLoading] = useState(true);
  const [tripulacion, setTripulacion] = useState<any[]>([]);
  const [waterInput, setWaterInput] = useState('');
  const [fuelInput, setFuelInput] = useState('');
  const [equipmentReady, setEquipmentReady] = useState(true);
  const [observationsInput, setObservationsInput] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  const [myCommand, setMyCommand] = useState<any>(null);
  const [commandedUnits, setCommandedUnits] = useState<any[]>([]);

  useEffect(() => {
    fetchUserUnit();
  }, []);

  const fetchUserUnit = async () => {
    try {
      setLoading(true);

      if (esJefeDeCarro) {
        const [uRes, aRes] = await Promise.all([
          api.get('/units/'),
          api.get('/assignments/').catch(() => ({ data: [] })),
        ]);
        const lista = asList(uRes.data);
        const activas = asList(aRes.data).filter((a: any) => a.is_active !== false && a.status !== 'RELEASED');
        const ordenados = [...lista].sort((a: any, b: any) => {
          const cuerpo = String(a.fire_department_name || '').localeCompare(String(b.fire_department_name || ''), 'es');
          const compania = String(a.company_name || '').localeCompare(String(b.company_name || ''), 'es', { numeric: true });
          return cuerpo || compania || compararCarros(a, b);
        });
        setCarros(ordenados);
        setDespachos(activas);
        const preferido = ordenados.find((u: any) => u.commander === user?.id || u.team_leader === user?.id)
          || ordenados.find((u: any) => user?.company && u.company === user.company)
          || ordenados[0];
        const elegido = ordenados.find((u: any) => u.id === carroId) || preferido || null;
        setCarroId(elegido?.id ?? null);
        const despacho = activas.find((a: any) => a.unit === elegido?.id) || null;
        setAssignment(despacho);
        if (despacho) {
          const mapToLocal: Record<string, UnitStatus> = {
            DISPATCHED: 'available',
            EN_ROUTE: 'en_route',
            ON_SCENE: 'on_scene',
            RETURNING: 'returning',
            RELEASED: 'available',
          };
          setStatus(mapToLocal[despacho.status] || 'available');
        }
        return;
      }

      // 1. Check for specific unit assignment (Physical Unit)
      let foundAssignment = null;
      try {
        if (role === 'SUPER_ADMIN') {
          const [assignmentRes, unitRes] = await Promise.all([
            api.get('/assignments/'), api.get('/units/'),
          ]);
          setAllAssignments(asList(assignmentRes.data));
          setCarros(asList(unitRes.data));
        } else {
          // Try fetching my specific unit assignment
          try {
            const res = await api.get('/assignments/my_unit/');
            if (res.data) {
              foundAssignment = res.data;
              setAssignment(res.data);
              // Update local status
              const asgStatus = (res.data.status || 'DISPATCHED') as string;
              const mapToLocal: Record<string, UnitStatus> = {
                DISPATCHED: 'available',
                EN_ROUTE: 'en_route',
                ON_SCENE: 'on_scene',
                RETURNING: 'returning',
                RELEASED: 'available'
              };
              setStatus(mapToLocal[asgStatus] || 'available');
            }
          } catch (e) {
            // Fallback for company chief with multiple units? 
            // For now, if my_unit fails, we assume no physical unit or search for my_units list
            // The original code had complex logic here, simplifying to priority:
            // 1. Assigned Unit
            // 2. Incident Command
          }
        }
      } catch (e) { console.log("Error fetching unit", e); }


      // 2. Check if I am a Commander of an active incident (Command Unit)
      // Only if I'm a Chief or Admin, or if I don't have a physical unit
      if ((role === 'COMPANY_CHIEF' || role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN')) {
        try {
          // Fetch active incidents where I am commander
          const incRes = await api.get('/incidents/', { params: { active: true, commander: user?.id } });
          // Filter client-side if API doesn't support filter by param perfectly
          const myIncidents = incRes.data.filter((i: any) => i.commander === user?.id && i.is_active);

          if (myIncidents.length > 0) {
            const activeCommand = myIncidents[0];
            setMyCommand(activeCommand);
            setIncidentDetails(activeCommand); // Use this for details view

            // Fetch units assigned to this incident
            const unitsRes = await api.get('/assignments/', { params: { incident: activeCommand.id } });
            const incidentUnits = unitsRes.data.filter((a: any) => a.incident === activeCommand.id);
            setCommandedUnits(incidentUnits);
          } else {
            setMyCommand(null);
            setCommandedUnits([]);
          }
        } catch (e) { console.log("Error fetching command", e); }
      }

    } catch (error) {
      console.log('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (currentStatus: UnitStatus) => {
    const configs = {
      available: {
        label: 'Disponible',
        color: colors.success,
        icon: 'checkmark-circle' as const,
        bgColor: 'rgba(16, 185, 129, 0.1)',
      },
      en_route: {
        label: 'En Camino',
        color: colors.warning,
        icon: 'car' as const,
        bgColor: 'rgba(245, 158, 11, 0.1)',
      },
      on_scene: {
        label: 'En Escena',
        color: colors.danger,
        icon: 'flame' as const,
        bgColor: 'rgba(239, 68, 68, 0.1)',
      },
      returning: {
        label: 'Regresando',
        color: colors.info,
        icon: 'arrow-back-circle' as const,
        bgColor: 'rgba(59, 130, 246, 0.1)',
      },
    };
    return configs[currentStatus];
  };

  const handleStatusChange = async (newStatus: UnitStatus) => {
    const statusLabels = {
      available: 'Disponible',
      en_route: 'En Camino',
      on_scene: 'En Escena',
      returning: 'Regresando',
    };

    if (!assignment) return;
    const mapToRemote: Record<UnitStatus, string> = {
      available: 'RELEASED',
      en_route: 'EN_ROUTE',
      on_scene: 'ON_SCENE',
      returning: 'RETURNING'
    };
    try {
      await api.patch(`/assignments/${assignment.id}/`, { status: mapToRemote[newStatus] });
      setStatus(newStatus);
      // Refresh assignment to reflect timestamps if needed
      fetchUserUnit();
      Alert.alert('Estado Actualizado', `Unidad marcada como "${statusLabels[newStatus]}"`);
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar el estado de la unidad.');
    }
  };


  const [viewedUnit, setViewedUnit] = useState<any>(null); // For SuperAdmin drill-down

  const handleBackToDashboard = () => {
    setViewedUnit(null);
    setAssignment(null); // Clear assignment to force list view
    fetchUserUnit(); // Refresh list
  };

  // --- COMANDANTE DASHBOARD ---
  // Los hooks van siempre antes de cualquier return condicional: si no, React
  // cuenta distinta cantidad entre renders y la pantalla queda en blanco.
  useEffect(() => {
    if (assignment?.incident) {
      api.get(`/incidents/${assignment.incident}/`).then(res => {
        setIncidentDetails(res.data);
      }).catch(() => setIncidentDetails(null));
    } else {
      setIncidentDetails(null);
    }
  }, [assignment]);

  useEffect(() => {
    if (!assignment?.id) {
      setTripulacion([]);
      return;
    }
    api.get(`/assignments/${assignment.id}/tripulacion/`)
      .then(res => setTripulacion(asList(res.data)))
      .catch(() => setTripulacion([]));
  }, [assignment?.id]);

  const carro = carros.find(c => c.id === carroId) || null;

  useEffect(() => {
    if (!carro) return;
    setWaterInput(String(carro.water_level ?? ''));
    setFuelInput(String(carro.fuel_level ?? ''));
    setEquipmentReady(carro.equipment_ready !== false);
    setObservationsInput(carro.observations || '');
  }, [carro?.id, carro?.water_level, carro?.fuel_level, carro?.equipment_ready, carro?.observations]);

  const guardarFichaCarro = async () => {
    if (!carro) return;
    const water = Number(waterInput);
    const fuel = Number(fuelInput);
    if (!Number.isFinite(water) || !Number.isFinite(fuel) || water < 0 || water > 100 || fuel < 0 || fuel > 100) {
      Alert.alert('Revisa los niveles', 'Agua y combustible deben estar entre 0 y 100.');
      return;
    }
    setSavingVehicle(true);
    try {
      const payload = { water_level: water, fuel_level: fuel, equipment_ready: equipmentReady, observations: observationsInput.trim() };
      const res = await api.patch(`/units/${carro.id}/resources/`, payload);
      setCarros(lista => lista.map(item => item.id === carro.id ? { ...item, ...res.data } : item));
      Alert.alert('Carro actualizado', 'Los recursos quedaron guardados.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar el estado del carro.');
    } finally {
      setSavingVehicle(false);
    }
  };

  const cambiarEstadoCarro = async (nuevo: string) => {
    if (!carro) return;
    try {
      await api.patch(`/units/${carro.id}/`, { status: nuevo });
      setCarros(lista => lista.map(c => c.id === carro.id ? { ...c, status: nuevo } : c));
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado del carro.');
    }
  };

  if (!loading && role === 'SUPER_ADMIN' && !viewedUnit && !esJefeDeCarro) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerCard, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name="apps" size={32} color={colors.white} />
          <View style={{ marginLeft: 16 }}>
            <Text style={[styles.unitName, { fontSize: 22 }]}>Panel de Comando</Text>
            <Text style={styles.unitType}>Todas las Unidades Activas</Text>
          </View>
        </View>
        <FlatList
          data={carros}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchUserUnit} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptySubtitle}>No hay unidades desplegadas.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => {
            const activeAssignment = allAssignments.find((a: any) => a.unit === item.id && a.is_active !== false);
            const statusConf = getStatusConfig(
              activeAssignment?.status === 'EN_ROUTE' ? 'en_route' :
                activeAssignment?.status === 'ON_SCENE' ? 'on_scene' :
                  activeAssignment?.status === 'RETURNING' ? 'returning' : 'available'
            ) || { label: item.status, color: colors.gray[500], icon: 'help', bgColor: colors.gray[100] };

            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setCarroId(item.id);
                  setAssignment(activeAssignment || null);
                  setViewedUnit(item);
                  // Set status state locally so the view reflects it
                  const asgStatus = (activeAssignment?.status || 'DISPATCHED') as string;
                  const mapToLocal: Record<string, UnitStatus> = {
                    DISPATCHED: 'available',
                    EN_ROUTE: 'en_route',
                    ON_SCENE: 'on_scene',
                    RETURNING: 'returning',
                    RELEASED: 'available'
                  };
                  setStatus(mapToLocal[asgStatus] || 'available');
                }}
              >
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={[styles.sectionTitle, { fontSize: 18 }]}>{nombreCarroConOrigen(item)}</Text>
                      <Text style={styles.originText}>{origenCarro(item) || 'Procedencia no informada'}</Text>
                      <Text style={styles.listIncidentText}>{activeAssignment?.incident_title || 'Sin emergencia activa'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConf.bgColor }]}>
                      <Ionicons name={statusConf.icon as any} size={18} color={statusConf.color} />
                      <Text style={[styles.statusText, { color: statusConf.color }]}>{activeAssignment ? statusConf.label : item.status_display}</Text>
                    </View>
                  </View>
                  {/* Basic details */}
                  <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
                    <Text style={{ fontSize: 12, color: colors.gray[600] }}>
                      <Ionicons name="people" /> {item.members_count || 0} Pers.
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.gray[600] }}>
                      <Ionicons name="water" /> {item.water_level ?? '—'}% · Combustible {item.fuel_level ?? '—'}%
                    </Text>
                  </View>
                  <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>Ver Detalles &gt;</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // --- LOADING STATE ---
  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: spacing.md, color: colors.textLight }}>Cargando unidad...</Text>
      </View>
    );
  }

  // --- COMMANDER DASHBOARD (For Incident Commanders) ---
  if (myCommand && !assignment && !viewedUnit && !esJefeDeCarro) {
    return (
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchUserUnit} />}>
        <View style={[styles.headerCard, { backgroundColor: colors.danger }]}>
          <Ionicons name="flame" size={32} color={colors.white} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={[styles.unitName, { fontSize: 20 }]}>Puesto de Mando</Text>
            <Text style={styles.unitType}>{myCommand.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{myCommand.incident_type}</Text>
          </View>
        </View>

        {/* Status Management */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Estado de Emergencia</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {['PRE_INFORME', 'ALARMA_GENERAL', 'INCENDIO', 'CONTROLADO'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.unitChip,
                  myCommand.status === s && styles.unitChipSelected,
                  { minWidth: '45%', justifyContent: 'center', alignItems: 'center' }
                ]}
                onPress={async () => {
                  try {
                    await api.patch(`/incidents/${myCommand.id}/`, { status: s });
                    fetchUserUnit();
                    Alert.alert("Estado Actualizado");
                  } catch (e) { Alert.alert("Error"); }
                }}
              >
                <Text style={[styles.unitChipText, myCommand.status === s && { color: colors.white }]}>
                  {s.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.closeIncidentButton, { marginTop: 15, backgroundColor: colors.danger }]}
            onPress={() => {
              Alert.alert("Finalizar", "¿Cerrar emergencia?", [
                { text: "Cancelar" },
                {
                  text: "Sí, Finalizar", onPress: async () => {
                    await api.post(`/incidents/${myCommand.id}/close_incident/`);
                    setMyCommand(null);
                    fetchUserUnit();
                  }
                }
              ])
            }}
          >
            <Text style={styles.closeIncidentText}>FINALIZAR EMERGENCIA</Text>
          </TouchableOpacity>
        </View>

        {/* Units List */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Unidades Asignadas ({commandedUnits.length})</Text>
          {commandedUnits.length === 0 ? (
            <Text style={{ fontStyle: 'italic', color: colors.gray[500] }}>No hay unidades asignadas.</Text>
          ) : (
            commandedUnits.map((u: any) => {
              const statusConf = getStatusConfig(
                u.status === 'DISPATCHED' ? 'available' : // map API status to local
                  u.status === 'EN_ROUTE' ? 'en_route' :
                    u.status === 'ON_SCENE' ? 'on_scene' :
                      u.status === 'RETURNING' ? 'returning' : 'available'
              ) || { label: u.status, color: colors.gray[500], icon: 'help', bgColor: colors.gray[100] };

              return (
                <View key={u.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.gray[100], alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontWeight: '600' }}>{u.unit_name || u.unit_details?.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.gray[500] }}>{u.unit_details?.vehicle || 'Sin Vehículo'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConf.bgColor, paddingVertical: 4, paddingHorizontal: 8 }]}>
                    <Ionicons name={statusConf.icon as any} size={12} color={statusConf.color} />
                    <Text style={[styles.statusText, { color: statusConf.color, fontSize: 10 }]}>{statusConf.label}</Text>
                  </View>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>
    );
  }

  // --- EMPTY STATE VIEW ---
  if (!assignment && !carro) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="shield-checkmark-outline" size={72} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>{esJefeDeCarro ? 'Sin carro' : 'Sin Asignación Activa'}</Text>
        <Text style={styles.emptySubtitle}>
          {esJefeDeCarro
            ? 'No hay un carro para mostrar en esta vista.'
            : 'No tienes una unidad asignada ni estás al mando de una emergencia.'}
        </Text>
        <Text style={styles.emptyHint}>
          Cuando se despache una emergencia, verás los detalles aquí.
        </Text>
        <TouchableOpacity onPress={fetchUserUnit} style={styles.refreshButton}>
          <Ionicons name="refresh" size={18} color={colors.white} />
          <Text style={styles.refreshButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = getStatusConfig(status);
  const unit = { ...(assignment?.unit_details || {}), ...(carro || {}) };
  const etiquetaEstado = esJefeDeCarro
    ? (ESTADOS_CARRO.find(opcion => opcion.id === unit.status)?.label || unit.status_display || statusConfig.label)
    : statusConfig.label;
  // --- ACTIVE UNIT VIEW (For Unit Chiefs & Super Admin Detail View) ---
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchUserUnit} />}>
      {/* Back Button for Super Admin */}
      {viewedUnit && (
        <TouchableOpacity onPress={handleBackToDashboard} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 0 }}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
          <Text style={{ marginLeft: 8, fontSize: 16, color: colors.accent, fontWeight: 'bold' }}>Volver al Panel</Text>
        </TouchableOpacity>
      )}

      {esJefeDeCarro && carros.length > 1 && (
        <View style={[styles.vehiclePicker, { marginTop: spacing.lg }]}>
          <View style={styles.vehiclePickerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehiclePickerEyebrow}>{role === 'SUPER_ADMIN' ? 'VISTA SUPERADMIN' : 'MI COMPAÑÍA'}</Text>
              <Text style={styles.vehiclePickerTitle}>Selecciona el carro</Text>
              <Text style={styles.vehiclePickerHint}>
                {role === 'SUPER_ADMIN'
                  ? `${carros.length} carros de todos los cuerpos, identificados por procedencia.`
                  : `${carros.length} carros disponibles para esta vista.`}
              </Text>
            </View>
            <View style={styles.vehicleCount}><Text style={styles.vehicleCountText}>{carros.length}</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehiclePickerList}>
            {carros.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.vehicleOption, carroId === item.id && styles.vehicleOptionSelected]}
                onPress={() => {
                  setCarroId(item.id);
                  const despacho = despachos.find(a => a.unit === item.id) || null;
                  setAssignment(despacho);
                  if (despacho) {
                    const mapToLocal: Record<string, UnitStatus> = {
                      DISPATCHED: 'available', EN_ROUTE: 'en_route', ON_SCENE: 'on_scene', RETURNING: 'returning', RELEASED: 'available',
                    };
                    setStatus(mapToLocal[despacho.status] || 'available');
                  }
                }}
              >
                <View style={styles.vehicleOptionTop}>
                  <Ionicons name="bus" size={18} color={carroId === item.id ? colors.white : colors.primary} />
                  {carroId === item.id && <Ionicons name="checkmark-circle" size={18} color={colors.white} />}
                </View>
                <Text numberOfLines={2} style={[styles.vehicleOptionName, carroId === item.id && styles.vehicleOptionTextSelected]}>
                  {nombreCarroConOrigen(item)}
                </Text>
                <Text numberOfLines={2} style={[styles.vehicleOptionOrigin, carroId === item.id && styles.vehicleOptionOriginSelected]}>
                  {origenCarro(item) || etiquetaCarro(item.unit_type, item.type_display)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {/* If multiple assignments, let chief select by unit name */}
      {assignments.length > 1 && (
        <View style={[styles.sectionCard, { marginTop: spacing.lg }]}>
          <Text style={{ fontSize: 12, color: colors.gray[600], marginBottom: 8 }}>Selecciona Unidad a visualizar:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {assignments.map(asg => (
              <TouchableOpacity
                key={asg.id}
                style={[
                  styles.unitChip,
                  assignment?.id === asg.id && styles.unitChipSelected
                ]}
                onPress={() => {
                  setAssignment(asg);
                  const asgStatus = (asg.status || 'DISPATCHED') as string;
                  const mapToLocal: Record<string, UnitStatus> = {
                    DISPATCHED: 'available',
                    EN_ROUTE: 'en_route',
                    ON_SCENE: 'on_scene',
                    RETURNING: 'returning',
                    RELEASED: 'available'
                  };
                  setStatus(mapToLocal[asgStatus] || 'available');
                }}
              >
                <Text style={[
                  styles.unitChipText,
                  assignment?.id === asg.id && { color: colors.white }
                ]}>{asg.unit_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {/* Unit Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.unitIconContainer}>
          <Ionicons name="bus" size={32} color={colors.white} />
        </View>
        <View style={styles.unitInfo}>
          <Text style={styles.unitName}>{nombreCarroConOrigen(unit)}</Text>
          <Text style={styles.unitType}>{[etiquetaCarro(unit.unit_type, unit.type_display), origenCarro(unit)].filter(Boolean).join(' · ')}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Ionicons name={statusConfig.icon} size={18} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {etiquetaEstado}
          </Text>
        </View>
      </View>

      {esJefeDeCarro && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="speedometer" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Estado del carro</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ESTADOS_CARRO.map(opcion => (
              <TouchableOpacity
                key={opcion.id}
                style={[styles.unitChip, unit.status === opcion.id && styles.unitChipSelected]}
                onPress={() => cambiarEstadoCarro(opcion.id)}
              >
                <Text style={[styles.unitChipText, unit.status === opcion.id && { color: colors.white }]}>{opcion.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!unit.observations && (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>{unit.observations}</Text>
          )}
        </View>
      )}

      {/* Incident Boarding Pass Style */}
      {assignment && <View style={styles.ticketContainer}>
        <View style={styles.ticketHeader}>
          <Ionicons name="alert-circle" size={24} color={colors.white} />
          <Text style={styles.ticketTitle}>DESPACHO ACTIVO</Text>
          <Text style={styles.ticketId}>#{assignment.incident}</Text>
        </View>
        <View style={styles.ticketBody}>
          <View style={styles.ticketRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ticketLabel}>EMERGENCIA</Text>
              <Text style={styles.ticketValueLarge}>{assignment.incident_title}</Text>
            </View>
          </View>

          {incidentDetails && (
            <>
              <View style={styles.ticketDivider} />
              <View style={styles.ticketRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketLabel}>TIPO</Text>
                  <Text style={styles.ticketValue}>{incidentDetails.incident_type}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketLabel}>HORA</Text>
                  <Text style={styles.ticketValue}>{new Date(incidentDetails.reported_at).toLocaleTimeString().slice(0, 5)}</Text>
                </View>
              </View>
              <View style={styles.ticketRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketLabel}>UBICACIÓN</Text>
                  <Text style={styles.ticketValue}>{[incidentDetails.address, incidentDetails.comuna].filter(Boolean).join(', ') || `${Number(incidentDetails.latitude).toFixed(4)}, ${Number(incidentDetails.longitude).toFixed(4)}`}</Text>
                </View>
              </View>
              {incidentDetails.description ? (
                <View style={styles.ticketRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketLabel}>DETALLES</Text>
                    <Text style={[styles.ticketValue, { fontStyle: 'italic' }]}>{incidentDetails.description}</Text>
                  </View>
                </View>
              ) : null}
            </>
          )}

          {(role === 'COMPANY_CHIEF' || role === 'COMPANY_ADMIN') && incidentDetails?.is_active && (
            <TouchableOpacity
              style={styles.closeIncidentButton}
              onPress={async () => {
                try {
                  Alert.alert('Finalizar', '¿Cerrar emergencia?', [
                    { text: 'Cancelar' },
                    {
                      text: 'Sí, Finalizar', onPress: async () => {
                        await api.post(`/incidents/${assignment.incident}/close_incident/`);
                        fetchUserUnit();
                      }
                    }
                  ])
                } catch (e) { }
              }}
            >
              <Text style={styles.closeIncidentText}>FINALIZAR EMERGENCIA</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Ticket Rip/Tear effect visual could go here */}
        <View style={styles.ticketFooter}>
          <Text style={styles.ticketFooterText}>Sistema Lumbre • {new Date().toLocaleDateString()}</Text>
        </View>
      </View>}

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.dangerFill }]}>
            <Ionicons name="people" size={20} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{unit.members_count || 0}</Text>
          <Text style={styles.statLabel}>Miembros</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.surfaceRaised }]}>
            <Ionicons name="water" size={20} color={colors.secondary} />
          </View>
          <Text style={styles.statValue}>{unit.water_level ?? '—'}%</Text>
          <Text style={styles.statLabel}>Agua</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.surfaceRaised }]}>
            <Ionicons name="speedometer" size={20} color={colors.highlight} />
          </View>
          <Text style={styles.statValue}>{unit.fuel_level ?? '—'}%</Text>
          <Text style={styles.statLabel}>Combustible</Text>
        </View>
      </View>

      {carro && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="options" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Recursos del carro</Text>
          </View>
          <View style={styles.resourceInputs}>
            <View style={styles.resourceField}>
              <Text style={styles.resourceLabel}>Agua %</Text>
              <TextInput value={waterInput} onChangeText={setWaterInput} keyboardType="number-pad" style={styles.resourceInput} />
            </View>
            <View style={styles.resourceField}>
              <Text style={styles.resourceLabel}>Combustible %</Text>
              <TextInput value={fuelInput} onChangeText={setFuelInput} keyboardType="number-pad" style={styles.resourceInput} />
            </View>
          </View>
          <TouchableOpacity style={[styles.equipmentToggle, equipmentReady && styles.equipmentToggleOn]} onPress={() => setEquipmentReady(value => !value)}>
            <Ionicons name={equipmentReady ? 'checkmark-circle' : 'alert-circle'} size={20} color={equipmentReady ? colors.success : colors.warning} />
            <Text style={styles.resourceLabel}>{equipmentReady ? 'Equipamiento listo' : 'Equipamiento incompleto'}</Text>
          </TouchableOpacity>
          <TextInput value={observationsInput} onChangeText={setObservationsInput} multiline placeholder="Observaciones del carro" placeholderTextColor={colors.textMuted} style={[styles.resourceInput, styles.observationsInput]} />
          <TouchableOpacity style={styles.saveVehicleButton} onPress={guardarFichaCarro} disabled={savingVehicle}>
            {savingVehicle ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveVehicleText}>Guardar estado del carro</Text>}
          </TouchableOpacity>
        </View>
      )}

      {assignment && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Tripulación ({tripulacion.length})</Text>
          </View>
          {tripulacion.length === 0 ? <Text style={styles.memberRole}>Sin tripulación informada.</Text> : tripulacion.map(member => (
            <View key={member.id} style={styles.memberRow}>
              <View style={[styles.memberAvatar, member.rol === 'LEADER' && styles.memberAvatarLeader]}>
                <Ionicons name="person" size={18} color={colors.white} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.nombre}</Text>
                <Text style={styles.memberRole}>{member.rol_texto} · {member.estado_texto}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Vehicle Info */}
      {!esJefeDeCarro && <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="car-sport" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Vehiculo</Text>
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{nombreCarroConOrigen(unit)}</Text>
          {!!origenCarro(unit) && <Text style={styles.originText}>{origenCarro(unit)}</Text>}
          <View style={styles.vehicleDetails}>
            <View style={styles.vehicleDetail}>
              <Ionicons name="water-outline" size={18} color={colors.textLight} />
              <Text style={styles.vehicleDetailText}>{unit.water_level ?? '—'}% agua</Text>
            </View>
            <View style={styles.vehicleDetail}>
              <Ionicons name={unit.equipment_ready === false ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={18} color={unit.equipment_ready === false ? colors.warning : colors.success} />
              <Text style={styles.vehicleDetailText}>{unit.equipment_ready === false ? 'Equipo incompleto' : 'Equipo listo'}</Text>
            </View>
          </View>
        </View>
      </View>}

      {/* Status Actions */}
      {assignment && <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="radio" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Reportar Estado</Text>
        </View>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              status === 'en_route' && styles.actionButtonActive,
            ]}
            onPress={() => handleStatusChange('en_route')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="car"
              size={24}
              color={status === 'en_route' ? colors.white : colors.warning}
            />
            <Text
              style={[
                styles.actionButtonText,
                status === 'en_route' && styles.actionButtonTextActive,
              ]}
            >
              En Camino
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              status === 'on_scene' && styles.actionButtonActive,
              status === 'on_scene' && { backgroundColor: colors.danger },
            ]}
            onPress={() => handleStatusChange('on_scene')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flame"
              size={24}
              color={status === 'on_scene' ? colors.white : colors.danger}
            />
            <Text
              style={[
                styles.actionButtonText,
                status === 'on_scene' && styles.actionButtonTextActive,
              ]}
            >
              En Escena
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              status === 'returning' && styles.actionButtonActive,
              status === 'returning' && { backgroundColor: colors.info },
            ]}
            onPress={() => handleStatusChange('returning')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-back-circle"
              size={24}
              color={status === 'returning' ? colors.white : colors.info}
            />
            <Text
              style={[
                styles.actionButtonText,
                status === 'returning' && styles.actionButtonTextActive,
              ]}
            >
              Regresando
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              status === 'available' && styles.actionButtonActive,
              status === 'available' && { backgroundColor: colors.success },
            ]}
            onPress={() => handleStatusChange('available')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={status === 'available' ? colors.white : colors.success}
            />
            <Text
              style={[
                styles.actionButtonText,
                status === 'available' && styles.actionButtonTextActive,
              ]}
            >
              Disponible
            </Text>
          </TouchableOpacity>
        </View>
      </View>}

      {/* Bottom spacing */}
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  originText: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  listIncidentText: { color: colors.textLight, fontSize: 12, marginTop: 5 },
  vehiclePicker: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  vehiclePickerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  vehiclePickerEyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  vehiclePickerTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  vehiclePickerHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  vehicleCount: {
    minWidth: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  vehicleCountText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  vehiclePickerList: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 10 },
  vehicleOption: {
    width: 178, minHeight: 112, padding: 13, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  vehicleOptionSelected: { backgroundColor: colors.primary, borderColor: colors.accent },
  vehicleOptionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  vehicleOptionName: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  vehicleOptionTextSelected: { color: colors.white },
  vehicleOptionOrigin: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 5 },
  vehicleOptionOriginSelected: { color: 'rgba(255,255,255,0.78)' },
  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.gray[400],
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: borderRadius.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  refreshButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  // Header Card
  headerCard: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  unitIconContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.pressOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  unitName: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  unitType: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray[500],
    marginTop: 4,
    fontWeight: '500',
  },
  // Section Card
  sectionCard: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  memberCount: {
    fontSize: 12,
    color: colors.textLight,
  },
  // Vehicle Info
  vehicleInfo: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  vehicleDetails: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  vehicleDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  vehicleDetailText: {
    fontSize: 13,
    color: colors.textLight,
  },
  resourceInputs: { flexDirection: 'row', gap: spacing.sm },
  resourceField: { flex: 1 },
  resourceLabel: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  resourceInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.background },
  observationsInput: { minHeight: 82, textAlignVertical: 'top', paddingTop: 12, marginTop: spacing.md },
  equipmentToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: spacing.md, borderWidth: 1, borderColor: colors.warning, borderRadius: borderRadius.md },
  equipmentToggleOn: { borderColor: colors.success },
  saveVehicleButton: { minHeight: 50, marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  saveVehicleText: { color: colors.white, fontWeight: '700' },
  // Team Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarLeader: {
    backgroundColor: colors.primary,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  memberRole: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 1,
  },
  unitChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[100], marginRight: 8, borderWidth: 1, borderColor: colors.gray[300]
  },
  unitChipSelected: {
    backgroundColor: colors.primary, borderColor: colors.accent
  },
  unitChipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700] },
  leaderBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  leaderBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
  },
  // Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.gray[200],
  },
  actionButtonActive: {
    backgroundColor: colors.warning,
    borderColor: 'transparent',
    shadowColor: colors.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  actionButtonTextActive: {
    color: colors.white,
  },
  // Ticket Styles
  ticketContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  ticketHeader: {
    backgroundColor: colors.danger,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketTitle: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  ticketId: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 16,
  },
  ticketBody: {
    padding: spacing.lg,
  },
  ticketRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  ticketLabel: {
    fontSize: 10,
    color: colors.gray[400],
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ticketValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  ticketValueLarge: {
    fontSize: 22,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  ticketDivider: {
    height: 1,
    backgroundColor: 'transparent',
    marginVertical: spacing.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 1
  },
  ticketFooter: {
    backgroundColor: colors.gray[50],
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  ticketFooterText: {
    fontSize: 11,
    color: colors.gray[500],
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  closeIncidentButton: {
    backgroundColor: colors.danger,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  closeIncidentText: {
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontSize: 14,
  },
});
