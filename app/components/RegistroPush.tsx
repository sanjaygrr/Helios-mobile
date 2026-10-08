import { useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import {
  crearCanalDespachos,
  enviarTokenAlBackend,
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
        await enviarTokenAlBackend(token);
      } catch {
        // Quedarse sin avisos no puede impedir usar la app.
      }
    })();

    return () => {
      vigente = false;
    };
  }, [user?.id]);

  return null;
}
