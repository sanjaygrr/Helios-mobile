import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { isLocationSharingEnabled } from '../services/locationSharing';
import { getDeviceId } from '../services/deviceIdentity';
import { resumeBackgroundTracking, stopBackgroundTracking } from '../services/backgroundTracking';

/** Shares the signed-in person's foreground position across devices. */
export default function TrackingService() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      stopBackgroundTracking().catch(() => {});
      return;
    }
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    let lastSent = 0;
    let sending = false;

    const stop = () => {
      subscription?.remove();
      subscription = null;
    };

    const start = async () => {
      if (subscription || !active || AppState.currentState !== 'active') return;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active || permission.status !== 'granted') return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        async ({ coords }) => {
          const now = Date.now();
          if (!active || !(await isLocationSharingEnabled()) || sending || now - lastSent < 10000) return;
          sending = true;
          try {
            await api.post('/tracking/history/', {
              latitude: coords.latitude,
              longitude: coords.longitude,
              device_id: await getDeviceId(),
            });
            lastSent = now;
          } catch (error) {
            if (__DEV__) console.warn('No se pudo compartir la ubicación', error);
          } finally {
            sending = false;
          }
        }
      );
      if (!active) stop();
    };

    start();
    resumeBackgroundTracking().catch(() => {});
    const appListener = AppState.addEventListener('change', state => {
      if (state === 'active') start();
      else stop();
    });
    return () => {
      active = false;
      stop();
      appListener.remove();
    };
  }, [user?.id]);

  return null;
}
