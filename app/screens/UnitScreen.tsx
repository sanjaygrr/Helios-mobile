import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../theme/colors';

type UnitStatus = 'available' | 'en_route' | 'on_scene' | 'returning';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  isLeader: boolean;
}

export default function UnitScreen() {
  const [status, setStatus] = useState<UnitStatus>('available');

  // Mock data - esto vendria del backend
  const unitData = {
    name: 'BX-3',
    type: 'Forestal',
    members: 5,
    vehicle: 'Mercedes-Benz Unimog',
    capacity: '3000L',
  };

  const teamMembers: TeamMember[] = [
    { id: '1', name: 'Carlos Mendez', role: 'Team Leader', isLeader: true },
    { id: '2', name: 'Ana Rodriguez', role: 'Conductor', isLeader: false },
    { id: '3', name: 'Pedro Silva', role: 'Bombero', isLeader: false },
    { id: '4', name: 'Maria Lopez', role: 'Bombero', isLeader: false },
    { id: '5', name: 'Juan Perez', role: 'Bombero', isLeader: false },
  ];

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

  const handleStatusChange = (newStatus: UnitStatus) => {
    const statusLabels = {
      available: 'Disponible',
      en_route: 'En Camino',
      on_scene: 'En Escena',
      returning: 'Regresando',
    };

    Alert.alert(
      'Cambiar Estado',
      `Cambiar estado a "${statusLabels[newStatus]}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => setStatus(newStatus),
        },
      ]
    );
  };

  const statusConfig = getStatusConfig(status);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Unit Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.unitIconContainer}>
          <Ionicons name="bus" size={32} color={colors.white} />
        </View>
        <View style={styles.unitInfo}>
          <Text style={styles.unitName}>{unitData.name}</Text>
          <Text style={styles.unitType}>{unitData.type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Ionicons name={statusConfig.icon} size={16} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(170, 43, 29, 0.1)' }]}>
            <Ionicons name="people" size={20} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{unitData.members}</Text>
          <Text style={styles.statLabel}>Miembros</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(204, 86, 30, 0.1)' }]}>
            <Ionicons name="water" size={20} color={colors.secondary} />
          </View>
          <Text style={styles.statValue}>{unitData.capacity}</Text>
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
          <Text style={styles.vehicleName}>{unitData.vehicle}</Text>
          <View style={styles.vehicleDetails}>
            <View style={styles.vehicleDetail}>
              <Ionicons name="water-outline" size={16} color={colors.textLight} />
              <Text style={styles.vehicleDetailText}>{unitData.capacity} agua</Text>
            </View>
            <View style={styles.vehicleDetail}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.vehicleDetailText}>Operativo</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Team Members */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Equipo</Text>
          <Text style={styles.memberCount}>{teamMembers.length} miembros</Text>
        </View>
        {teamMembers.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <View style={[styles.memberAvatar, member.isLeader && styles.memberAvatarLeader]}>
              <Ionicons
                name={member.isLeader ? 'star' : 'person'}
                size={16}
                color={member.isLeader ? colors.accent : colors.white}
              />
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberRole}>{member.role}</Text>
            </View>
            {member.isLeader && (
              <View style={styles.leaderBadge}>
                <Text style={styles.leaderBadgeText}>Lider</Text>
              </View>
            )}
          </View>
        ))}
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
});
