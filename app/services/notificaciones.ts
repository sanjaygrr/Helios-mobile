import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { isDevice } from 'expo-device';
import * as Notifications from 'expo-notifications';

import api from './api';

const CANAL_DESPACHOS = 'despachos';

export type DespachoPushData = {
  tipo: 'despacho';
  assignment: number | string;
  incidente: number | string;
  carro: number | string;
  esJefe: boolean;
};

export type NotificacionDespachoHandlers = {
  onRecibida?: (
    data: DespachoPushData,
    notification: Notifications.Notification,
  ) => void;
  onTocada?: (
    data: DespachoPushData,
    response: Notifications.NotificationResponse,
  ) => void;
};

function pushSoportado(): boolean {
  if (Platform.OS === 'web') return false;
  if (!isDevice) return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false;
  }
  return true;
}

function leerDataDespacho(
  raw: Record<string, unknown> | undefined | null,
): DespachoPushData | null {
  if (!raw || raw.tipo !== 'despacho') return null;

  const assignment = raw.assignment ?? raw.asignacion;
  const incidente = raw.incidente ?? raw.incident;
  const carro = raw.carro ?? raw.unit;
  if (assignment == null || incidente == null || carro == null) return null;

  return {
    tipo: 'despacho',
    assignment: assignment as number | string,
    incidente: incidente as number | string,
    carro: carro as number | string,
    esJefe: Boolean(raw.esJefe ?? raw.es_jefe ?? raw.soy_encargado),
  };
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  // Expo Go / web: el handler puede no estar disponible.
}

/**
 * Crea el canal Android de despachos con prioridad máxima, sonido y vibración.
 * En iOS / web no hace nada. Nunca lanza.
 */
export async function crearCanalDespachos(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(CANAL_DESPACHOS, {
      name: 'Despachos',
      description: 'Avisos de despacho a emergencias',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 600, 200, 600, 200, 800],
      bypassDnd: true,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
  } catch {
    // Canal no disponible (Expo Go, emulador sin soporte, etc.).
  }
}

/**
 * Pide permiso, obtiene el token Expo del dispositivo y lo registra en el backend.
 * Devuelve el token o null si el usuario niega, corre en Expo Go o falla.
 */
export async function registrarTokenPush(): Promise<string | null> {
  if (!pushSoportado()) return null;

  try {
    await crearCanalDespachos();

    const actual = await Notifications.getPermissionsAsync();
    let estado = actual.status;
    if (estado !== 'granted') {
      const pedido = await Notifications.requestPermissionsAsync();
      estado = pedido.status;
    }
    if (estado !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId || typeof projectId !== 'string') return null;

    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenResult.data;
    if (!token) return null;

    await enviarTokenAlBackend(token);
    return token;
  } catch {
    return null;
  }
}

/**
 * Envía el token al backend. Devuelve true si el POST respondió bien.
 */
export async function enviarTokenAlBackend(token: string): Promise<boolean> {
  try {
    await api.post('/users/push_token/', { token });
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook para reaccionar cuando llega un aviso de despacho o cuando el usuario lo toca.
 * Seguro en Expo Go / sin permiso: simplemente no se suscribe.
 */
export function useNotificacionesDespacho(
  handlers: NotificacionDespachoHandlers = {},
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!pushSoportado()) return;

    let recibidaSub: Notifications.EventSubscription | null = null;
    let tocadaSub: Notifications.EventSubscription | null = null;

    try {
      recibidaSub = Notifications.addNotificationReceivedListener(
        notification => {
          const data = leerDataDespacho(
            notification.request.content.data as Record<string, unknown>,
          );
          if (!data) return;
          handlersRef.current.onRecibida?.(data, notification);
        },
      );

      tocadaSub = Notifications.addNotificationResponseReceivedListener(
        response => {
          const data = leerDataDespacho(
            response.notification.request.content.data as Record<
              string,
              unknown
            >,
          );
          if (!data) return;
          handlersRef.current.onTocada?.(data, response);
        },
      );
    } catch {
      return;
    }

    return () => {
      recibidaSub?.remove();
      tocadaSub?.remove();
    };
  }, []);
}
