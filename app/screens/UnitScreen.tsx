import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  FlatList,
  RefreshControl
} from 'react-native';
import PersonnelForm from '../components/PersonnelForm';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

type UnitStatus = 'available' | 'en_route' | 'on_scene' | 'returning';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  isLeader: boolean;
}

export default function UnitScreen() {
  const { user, role } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [incidentDetails, setIncidentDetails] = useState<any>(null);
  const [status, setStatus] = useState<UnitStatus>('available');
  const [loading, setLoading] = useState(true);

  const [myCommand, setMyCommand] = useState<any>(null);
  const [commandedUnits, setCommandedUnits] = useState<any[]>([]);

  useEffect(() => {
    fetchUserUnit();
  }, []);

  const fetchUserUnit = async () => {
    try {
      setLoading(true);

      // 1. Check for specific unit assignment (Physical Unit)
      let foundAssignment = null;
      try {
        if (role === 'SUPER_ADMIN') {
          const res = await api.get('/assignments/'); // View everything
          if (Array.isArray(res.data)) setAllAssignments(res.data);
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
  if (!loading && role === 'SUPER_ADMIN' && !viewedUnit) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerCard, { backgroundColor: colors.secondary }]}>
          <Ionicons name="apps" size={32} color={colors.white} />
          <View style={{ marginLeft: 16 }}>
            <Text style={[styles.unitName, { fontSize: 22 }]}>Panel de Comando</Text>
            <Text style={styles.unitType}>Todas las Unidades Activas</Text>
          </View>
        </View>
        <FlatList
          data={allAssignments}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchUserUnit} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptySubtitle}>No hay unidades desplegadas.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => {
            const statusConf = getStatusConfig(
              item.status === 'DISPATCHED' ? 'available' : // Adjust mapping as needed
                item.status === 'EN_ROUTE' ? 'en_route' :
                  item.status === 'ON_SCENE' ? 'on_scene' :
                    item.status === 'RETURNING' ? 'returning' : 'available'
            ) || { label: item.status, color: colors.gray[500], icon: 'help', bgColor: colors.gray[100] };

            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setAssignment(item); // Set this as the "active" assignment for the shared view logic
                  setViewedUnit(item);
                  // Set status state locally so the view reflects it
                  const asgStatus = (item.status || 'DISPATCHED') as string;
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
                      <Text style={[styles.sectionTitle, { fontSize: 18 }]}>{item.unit_name || item.unit_details?.name}</Text>
                      <Text style={{ color: colors.textLight, fontSize: 12 }}>{item.incident_title || `Incidente #${item.incident}`}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConf.bgColor }]}>
                      <Ionicons name={statusConf.icon as any} size={14} color={statusConf.color} />
                      <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
                    </View>
                  </View>
                  {/* Basic details */}
                  <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
                    <Text style={{ fontSize: 12, color: colors.gray[600] }}>
                      <Ionicons name="people" /> {item.unit_details?.members_count || 0} Pers.
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.gray[600] }}>
                      <Ionicons name="car" /> {item.unit_details?.vehicle || 'N/A'}
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
  if (myCommand && !assignment && !viewedUnit) {
    return (
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchUserUnit} />}>
        <View style={[styles.headerCard, { backgroundColor: colors.danger }]}>
          <Ionicons name="flame" size={32} color={colors.white} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={[styles.unitName, { fontSize: 20 }]}>Puesto de Mando</Text>
            <Text style={styles.unitType}>{myCommand.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{myCommand.incident_type}</Text>
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
                <Text style={[styles.unitChipText, myCommand.status === s && { color: 'white' }]}>
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
  if (!assignment) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="shield-checkmark-outline" size={72} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Sin Asignación Activa</Text>
        <Text style={styles.emptySubtitle}>
          No tienes una unidad asignada ni estás al mando de una emergencia.
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
  const unit = assignment.unit_details || {};
  useEffect(() => {
    if (assignment?.incident) {
      api.get(`/incidents/${assignment.incident}/`).then(res => {
        setIncidentDetails(res.data);
      }).catch(() => setIncidentDetails(null));
    } else {
      setIncidentDetails(null);
    }
  }, [assignment]);

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
                  assignment?.id === asg.id && { color: 'white' }
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
          <Text style={styles.unitName}>{unit.name}</Text>
          <Text style={styles.unitType}>{unit.type_display || unit.unit_type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Ionicons name={statusConfig.icon} size={16} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Personnel Form for Chief Logic */}
      {(role === 'COMPANY_CHIEF' || role === 'COMPANY_ADMIN') && (
        <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}>
          <PersonnelForm
            initialMembers={[]} // In future, load from API if saved
            onChange={(members) => {
              // console.log("Members updated", members);
              // Autosave logic could go here
            }}
          />
        </View>
      )}

      {/* Incident Boarding Pass Style */}
      <View style={styles.ticketContainer}>
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
                  <Text style={styles.ticketValue}>{incidentDetails.latitude.toFixed(4)}, {incidentDetails.longitude.toFixed(4)}</Text>
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
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(170, 43, 29, 0.1)' }]}>
            <Ionicons name="people" size={20} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{unit.members_count || 0}</Text>
          <Text style={styles.statLabel}>Miembros</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(204, 86, 30, 0.1)' }]}>
            <Ionicons name="water" size={20} color={colors.secondary} />
          </View>
          <Text style={styles.statValue}>{unit.capacity || 'N/A'}</Text>
          <Text style={styles.statLabel}>Capacidad</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(190, 202, 92, 0.1)' }]}>
            <Ionicons name="speedometer" size={20} color={colors.highlight} />
          </View>
          <Text style={styles.statValue}>100%</Text>
          <Text style={styles.statLabel}>Operativo</Text>
        </View>
      </View>

      {/* Vehicle Info */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="car-sport" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Vehiculo</Text>
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{unit.vehicle || 'Sin Vehículo'}</Text>
          <View style={styles.vehicleDetails}>
            <View style={styles.vehicleDetail}>
              <Ionicons name="water-outline" size={16} color={colors.textLight} />
              <Text style={styles.vehicleDetailText}>{unit.capacity || 'N/A'} agua</Text>
            </View>
            <View style={styles.vehicleDetail}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.vehicleDetailText}>Operativo</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Status Actions */}
      <View style={styles.sectionCard}>
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
      </View>

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
    borderRadius: 12,
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
    borderRadius: 20,
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
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
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
    borderRadius: 16,
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
    borderRadius: 14,
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
    borderRadius: 16,
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
    borderRadius: 18,
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
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
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
    borderRadius: 14,
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
    borderRadius: 20,
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
    color: 'rgba(255,255,255,0.9)',
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
    borderRadius: 12,
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
