import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  isLocationSharingEnabled,
  setLocationSharingEnabled,
} from '../services/locationSharing';
import { resumeBackgroundTracking } from '../services/backgroundTracking';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  touch,
} from '../theme/colors';

const REFRESH_INTERVAL_MS = 10_000;
const VISIBLE_WINDOW_MS = 60_000;

type LocationState = {
  canAskAgain: boolean;
  granted: boolean;
  servicesEnabled: boolean;
  sharingEnabled: boolean;
};

const initialLocationState: LocationState = {
  canAskAgain: true,
  granted: false,
  servicesEnabled: true,
  sharingEnabled: true,
};

function getAssignedVehicle(assignment: unknown): string | null {
  const data = assignment as Record<string, any> | null;
  if (!data) return null;

  const candidates = [
    data.unit_details?.name,
    data.unit_name,
    data.unit_details?.vehicle,
    data.vehicle_name,
    data.vehicle_details?.name,
    typeof data.unit === 'object' ? data.unit?.name : null,
  ];

  const match = candidates.find(
    value => typeof value === 'string' && value.trim().length > 0,
  );
  return match?.trim() ?? null;
}

function getLatestTransmission(positions: unknown, userId: number): number | null {
  if (!Array.isArray(positions)) return null;

  return positions.reduce<number | null>((latest, position) => {
    if (Number(position?.user_id) !== userId) return latest;
    const timestamp = new Date(position?.timestamp).getTime();
    if (!Number.isFinite(timestamp)) return latest;
    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);
}

function formatElapsed(timestamp: number | null, now: number): string {
  if (timestamp === null) return 'Todavía sin transmisión';

  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 15) return 'Hace menos de 15 segundos';
  if (elapsedSeconds < 60) return `Hace ${elapsedSeconds} segundos`;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes === 1) return 'Hace 1 minuto';
  if (elapsedMinutes < 60) return `Hace ${elapsedMinutes} minutos`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours === 1) return 'Hace 1 hora';
  if (elapsedHours < 24) return `Hace ${elapsedHours} horas`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays === 1 ? 'Hace 1 día' : `Hace ${elapsedDays} días`;
}

export default function MiEstadoScreen() {
  const { user } = useAuth();
  const [locationState, setLocationState] = useState(initialLocationState);
  const [assignedVehicle, setAssignedVehicle] = useState<string | null>(null);
  const [lastTransmission, setLastTransmission] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFixing, setIsFixing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const [permission, servicesEnabled, sharingEnabled] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.hasServicesEnabledAsync(),
      isLocationSharingEnabled(),
    ]);

    setLocationState({
      canAskAgain: permission.canAskAgain,
      granted: permission.status === 'granted',
      servicesEnabled,
      sharingEnabled,
    });

    const [assignmentResult, positionsResult] = await Promise.allSettled([
      api.get('/assignments/my_unit/'),
      api.get('/tracking/history/live/'),
    ]);

    if (assignmentResult.status === 'fulfilled') {
      setAssignedVehicle(getAssignedVehicle(assignmentResult.value.data));
    } else {
      setAssignedVehicle(null);
    }

    if (positionsResult.status === 'fulfilled') {
      setLastTransmission(
        getLatestTransmission(positionsResult.value.data, user.id),
      );
      setRefreshError(false);
    } else {
      setRefreshError(true);
    }

    setNow(Date.now());
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refreshStatus().catch(() => {
      setRefreshError(true);
      setIsLoading(false);
    });

    const interval = setInterval(() => {
      refreshStatus().catch(() => setRefreshError(true));
    }, REFRESH_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshStatus().catch(() => setRefreshError(true));
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [refreshStatus]);

  const needsLocationFix =
    !locationState.granted ||
    !locationState.servicesEnabled ||
    !locationState.sharingEnabled;

  const isVisible =
    !needsLocationFix &&
    lastTransmission !== null &&
    now - lastTransmission <= VISIBLE_WINDOW_MS;

  const permissionButtonLabel = useMemo(() => {
    if (!locationState.servicesEnabled) return 'Abrir ajustes de ubicación';
    if (!locationState.granted && !locationState.canAskAgain) {
      return 'Abrir ajustes del teléfono';
    }
    if (!locationState.granted) return 'Permitir ubicación';
    return 'Activar ubicación';
  }, [locationState]);

  const fixLocation = async () => {
    if (isFixing) return;
    setIsFixing(true);

    try {
      if (
        !locationState.servicesEnabled ||
        (!locationState.granted && !locationState.canAskAgain)
      ) {
        await Linking.openSettings();
        return;
      }

      let granted = locationState.granted;
      if (!granted) {
        const permission = await Location.requestForegroundPermissionsAsync();
        granted = permission.status === 'granted';
      }

      if (granted) {
        await setLocationSharingEnabled(true);
        await resumeBackgroundTracking().catch(() => undefined);
      }
      await refreshStatus();
    } finally {
      setIsFixing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Confirmando tu ubicación…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <View
        style={[
          styles.visibilityCard,
          isVisible ? styles.visibleCard : styles.notVisibleCard,
        ]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={isVisible ? 'Estás visible' : 'No estás visible'}
      >
        <Ionicons
          name={isVisible ? 'radio' : 'radio-outline'}
          size={touch}
          color={isVisible ? colors.success : colors.danger}
        />
        <Text
          style={[
            styles.visibilityLabel,
            { color: isVisible ? colors.success : colors.danger },
          ]}
        >
          {isVisible ? 'VISIBLE' : 'NO VISIBLE'}
        </Text>
        <Text style={styles.visibilityHelp}>
          {isVisible
            ? 'La central puede ver tu posición.'
            : needsLocationFix
              ? 'Tu ubicación necesita atención.'
              : 'Esperando una transmisión reciente.'}
        </Text>
      </View>

      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="car" size={spacing.lg} color={colors.primary} />
          </View>
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailLabel}>Carro asignado</Text>
            <Text style={styles.detailValue}>
              {assignedVehicle ?? 'Sin carro asignado'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="time" size={spacing.lg} color={colors.primary} />
          </View>
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailLabel}>Última transmisión</Text>
            <Text style={styles.detailValue}>
              {formatElapsed(lastTransmission, now)}
            </Text>
          </View>
        </View>
      </View>

      {refreshError ? (
        <View style={styles.warningRow} accessible accessibilityRole="alert">
          <Ionicons name="cloud-offline" size={spacing.lg} color={colors.warning} />
          <Text style={styles.warningText}>
            No pudimos confirmar el estado con la central. Reintentaremos automáticamente.
          </Text>
        </View>
      ) : null}

      {needsLocationFix ? (
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={fixLocation}
          disabled={isFixing}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={permissionButtonLabel}
        >
          {isFixing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="location" size={spacing.lg} color={colors.white} />
              <Text style={styles.permissionButtonText}>
                {permissionButtonLabel}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textLight,
    fontSize: spacing.md,
  },
  visibilityCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touch * 4,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.md,
  },
  visibleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.success,
  },
  notVisibleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
  },
  visibilityLabel: {
    marginTop: spacing.md,
    fontSize: touch / 2,
    fontWeight: '800',
    letterSpacing: spacing.xs,
    textAlign: 'center',
  },
  visibilityHelp: {
    marginTop: spacing.sm,
    color: colors.textLight,
    fontSize: spacing.md,
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  detailRow: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailIcon: {
    width: touch,
    height: touch,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  detailTextContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  detailLabel: {
    color: colors.textLight,
    fontSize: spacing.sm,
  },
  detailValue: {
    color: colors.text,
    fontSize: spacing.md,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceRaised,
  },
  warningText: {
    flex: 1,
    color: colors.textLight,
    fontSize: spacing.sm,
  },
  permissionButton: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    ...shadows.md,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: spacing.md,
    fontWeight: '700',
    textAlign: 'center',
  },
});
