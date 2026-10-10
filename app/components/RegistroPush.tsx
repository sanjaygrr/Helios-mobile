import { useEffect } from 'react';
import { Alert, Vibration } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import { useAuth } from '../context/AuthContext';
import api, { asList } from '../services/api';
import {
  crearCanalDespachos,
  registrarTokenPush,
} from '../services/notificaciones';

/**
 * Registra el dispositivo para recibir despachos.
 *
 * Sin esto el backend tiene el aviso armado pero no sabe a dónde mandarlo.
 * Corre una vez por sesión, apenas la persona inicia sesión.
 *
 * No renderiza nada y nunca interrumpe: si la persona niega el permiso, o si
 * corre en Expo Go (donde los avisos push no funcionan), simplemente no
 * registra nada y la app sigue igual.
 */
export default function RegistroPush() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let vigente = true;

    (async () => {
      try {
        await crearCanalDespachos();
        const token = await registrarTokenPush();
        if (!vigente || !token) return;
      } catch {
        // Quedarse sin avisos no puede impedir usar la app.
      }
    })();

    return () => {
      vigente = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) return;
    let active = true;
    let initialized = false;
    let known = new Set<number>();

    const checkDispatches = async () => {
      try {
        const { data } = await api.get('/assignments/mis_despachos/');
        if (!active) return;
        const dispatches = asList(data);
        const current = new Set<number>(dispatches.map((item: any) => Number(item.asignacion)));
        if (initialized) {
          const newest = dispatches.find((item: any) => !known.has(Number(item.asignacion)));
          if (newest) {
            Vibration.vibrate([0, 700, 250, 700]);
            Alert.alert(
              'Nuevo despacho',
              [newest.carro, newest.emergencia].filter(Boolean).join(' · '),
            );
          }
        }
        known = current;
        initialized = true;
      } catch {
        // El mapa y el resto de la app siguen funcionando si falla este sondeo.
      }
    };

    checkDispatches();
    const timer = setInterval(checkDispatches, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id]);

  return null;
}
