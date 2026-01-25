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
} from 'react-native';
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
  const [incidentDetails, setIncidentDetails] = useState<any>(null);
  const [status, setStatus] = useState<UnitStatus>('available');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserUnit();
  }, []);

  const fetchUserUnit = async () => {
    try {
      // Try to get user's assigned unit
      if (role === 'COMPANY_CHIEF' || role === 'COMPANY_ADMIN') {
        const resList = await api.get('/assignments/my_units/');
        const list = Array.isArray(resList.data) ? resList.data : [];
        setAssignments(list);
        if (list.length > 0) {
          setAssignment(list[0]);
          const asgStatus = (list[0].status || 'DISPATCHED') as string;
          const mapToLocal: Record<string, UnitStatus> = {
            DISPATCHED: 'available',
            EN_ROUTE: 'en_route',
            ON_SCENE: 'on_scene',
            RETURNING: 'returning',
            RELEASED: 'available'
          };
          setStatus(mapToLocal[asgStatus] || 'available');
        }
      } else {
        const res = await api.get('/assignments/my_unit/');
        if (res.data) {
          setAssignment(res.data);
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
      }
    } catch (error) {
      console.log('No unit assigned or error fetching unit:', error);
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
      available: 'DISPATCHED',
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

  // --- LOADING STATE ---
  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: spacing.md, color: colors.textLight }}>Cargando unidad...</Text>
      </View>
    );
  }

  // --- EMPTY STATE VIEW ---
  if (!assignment) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="shield-checkmark-outline" size={64} color={colors.textLight} />
        </View>
        <Text style={styles.emptyTitle}>Sin Asignación Activa</Text>
        <Text style={styles.emptySubtitle}>
          No tienes una unidad asignada en este momento.
          {"\n"}
          Cuando se despache una emergencia, verás los detalles aquí.
        </Text>
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

  // --- ACTIVE UNIT VIEW ---
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.ticketFooterText}>Sistema Helios • {new Date().toLocaleDateString()}</Text>
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
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: colors.gray[100],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Header Card
  headerCard: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.lg,
  },
  unitIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  unitName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
  },
  unitType: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  // Section Card
  sectionCard: {
    backgroundColor: colors.white,
    margin: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: colors.primary, borderColor: colors.primary
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
    gap: spacing.sm,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  actionButtonActive: {
    backgroundColor: colors.warning,
    borderColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  actionButtonTextActive: {
    color: colors.white,
  },
  // Ticket Styles
  ticketContainer: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  ticketHeader: {
    backgroundColor: colors.danger,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketTitle: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  },
  ticketId: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
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
    color: colors.textLight,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  ticketValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  ticketValueLarge: {
    fontSize: 20,
    color: colors.text,
    fontWeight: '700',
  },
  ticketDivider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: spacing.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 1
  },
  ticketFooter: {
    backgroundColor: colors.gray[50],
    padding: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  ticketFooterText: {
    fontSize: 10,
    color: colors.gray[500],
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  closeIncidentButton: {
    backgroundColor: colors.danger,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closeIncidentText: {
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
