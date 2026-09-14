import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import api from './api';
import { getDeviceId } from './deviceIdentity';
import { isLocationSharingEnabled } from './locationSharing';

const TASK_NAME = 'helios-background-location';
const BACKGROUND_KEY = '@Helios:backgroundTracking';

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error || !data || !(await isLocationSharingEnabled())) return;
  const token = await AsyncStorage.getItem('@Auth:token');
  if (!token) return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;
  try {
    await api.post('/tracking/history/', {
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      device_id: await getDeviceId(),
    });
  } catch (sendError) {
    if (__DEV__) console.warn('No se pudo compartir la ubicación en segundo plano', sendError);
  }
});

export async function isBackgroundTrackingEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(BACKGROUND_KEY)) === 'true';
}

export async function stopBackgroundTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}

export async function setBackgroundTrackingEnabled(enabled: boolean): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!enabled) {
    await AsyncStorage.setItem(BACKGROUND_KEY, 'false');
    await stopBackgroundTracking();
    return false;
  }
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') return false;
  await AsyncStorage.setItem(BACKGROUND_KEY, 'true');
  await resumeBackgroundTracking();
  return true;
}

export async function resumeBackgroundTracking(): Promise<void> {
  if (Platform.OS === 'web' || !(await isBackgroundTrackingEnabled()) || !(await isLocationSharingEnabled())) return;
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) return;
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 25,
    timeInterval: 15000,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Helios comparte tu ubicación',
      notificationBody: 'Tu equipo puede ver tu posición mientras estés en servicio.',
    },
  });
}
