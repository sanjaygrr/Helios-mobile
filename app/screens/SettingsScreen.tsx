import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setApiBaseURL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isBackgroundTrackingEnabled, setBackgroundTrackingEnabled, supportsBackgroundTracking } from '../services/backgroundTracking';

const ROLES: Record<string, string> = {
  SUPER_ADMIN: 'Administrador',
  COMPANY_ADMIN: 'Comandante',
  COMPANY_CHIEF: 'OBAC',
  FIREFIGHTER: 'Bombero',
};

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const [nombre, setNombre] = useState(user?.first_name || '');
  const [apellido, setApellido] = useState(user?.last_name || '');
  const [clave, setClave] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [compania, setCompania] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [baseURL, setBaseURL] = useState('');
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const storedBase = await AsyncStorage.getItem('@Api:baseURL');
      setBaseURL(storedBase || (process as any)?.env?.EXPO_PUBLIC_API_URL || '');
      setBackgroundEnabled(await isBackgroundTrackingEnabled());
      try {
        const res = await api.get('/users/me/');
        const data = res.data || {};
        setNombre(data.first_name || '');
        setApellido(data.last_name || '');
        setCuerpo(data.fire_department_details?.name || '');
        setCompania(data.company_details?.name || '');
        if (user) {
          await updateUser({
            ...user,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            email: data.email || user.email,
            role: data.role || user.role,
            fire_department: data.fire_department ?? user.fire_department,
            company: data.company ?? user.company,
          });
        }
      } catch {
        // El cierre de sesión igual funciona si el servidor no responde.
      }
    })();
  }, []);

  const guardarPerfil = async () => {
    if (clave && clave.length < 8) {
      Alert.alert('Contraseña corta', 'Usa al menos 8 caracteres, o déjala vacía para no cambiarla.');
      return;
    }
    setGuardando(true);
    try {
      const payload: { first_name: string; last_name: string; password?: string } = {
        first_name: nombre.trim(),
        last_name: apellido.trim(),
      };
      if (clave) payload.password = clave;
      const res = await api.patch('/users/me/', payload);
      const data = res.data || {};
      if (user) {
        await updateUser({
          ...user,
          first_name: data.first_name || payload.first_name,
          last_name: data.last_name || payload.last_name,
          email: data.email || user.email,
          role: data.role || user.role,
          fire_department: data.fire_department ?? user.fire_department,
          company: data.company ?? user.company,
        });
      }
      setClave('');
      Alert.alert('Listo', clave ? 'Perfil y contraseña actualizados.' : 'Perfil actualizado.');
    } catch (error: any) {
      const msg = error?.response?.data?.password || 'No pude guardar. Cierra sesión y entra de nuevo.';
      Alert.alert('No se guardó', String(msg));
    } finally {
      setGuardando(false);
    }
  };

  const salir = () => {
    // En la web Alert.alert no hace nada, así que el botón cerraba y se quedaba ahí.
    logout().catch(() => undefined);
  };

  const save = async () => {
    if (!baseURL.startsWith('http')) {
      Alert.alert('URL inválida', 'Debe comenzar con http:// o https://');
      return;
    }
    await setApiBaseURL(baseURL);
    Alert.alert('Guardado', 'La URL se guardó. Recarga la app si no ves cambios.');
  };

  const reset = async () => {
    await AsyncStorage.removeItem('@Api:baseURL');
    const env = (process as any)?.env?.EXPO_PUBLIC_API_URL || '';
    setBaseURL(env);
    Alert.alert('Restablecido', 'Se usará la URL por defecto del entorno.');
  };

  const changeBackgroundTracking = async () => {
    if (backgroundEnabled) {
      await setBackgroundTrackingEnabled(false);
      setBackgroundEnabled(false);
      return;
    }
    const enable = async () => {
      try {
        const granted = await setBackgroundTrackingEnabled(true);
        setBackgroundEnabled(granted);
        if (!granted) Alert.alert('Permiso necesario', 'Activa la ubicación en segundo plano en la configuración del teléfono.');
      } catch {
        Alert.alert('No disponible', 'La ubicación en segundo plano requiere una compilación instalada de Lumbre.');
      }
    };
    Alert.alert('Compartir en segundo plano', 'Tu equipo podrá ver tu posición mientras Lumbre esté abierta en segundo plano. Puedes pausarla desde el mapa o desactivarla aquí.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Activar', onPress: enable },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Mi perfil</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.rol}>{ROLES[user?.role || ''] || user?.role || 'Sin rol'}</Text>
      {!!cuerpo && <Text style={styles.meta}>{cuerpo}{compania ? ` · ${compania}` : ''}</Text>}

      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Apellido</Text>
      <TextInput style={styles.input} value={apellido} onChangeText={setApellido} placeholder="Apellido" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Nueva contraseña</Text>
      <TextInput
        style={styles.input}
        value={clave}
        onChangeText={setClave}
        placeholder="Déjala vacía si no la cambias"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.btnPrimary} onPress={guardarPerfil} disabled={guardando}>
        <Text style={styles.btnText}>{guardando ? 'Guardando…' : 'Guardar perfil'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={salir}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { marginTop: spacing.xl }]}>Conexión</Text>
      <Text style={styles.label}>URL del Backend</Text>
      <TextInput
        style={styles.input}
        value={baseURL}
        onChangeText={setBaseURL}
        placeholder="https://tu-backend/api"
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <TouchableOpacity style={styles.btnPrimary} onPress={save}>
          <Text style={styles.btnText}>Guardar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={reset}>
          <Text style={[styles.btnText, { color: colors.text }]}>Restablecer</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ marginTop: spacing.md, color: colors.textLight }}>
        Actual: {baseURL || 'Por defecto (producción)'}
      </Text>
      {!supportsBackgroundTracking && Platform.OS !== 'web' && <Text style={styles.backgroundDescription}>En Expo Go, mantén Lumbre abierta para compartir tu ubicación con el equipo.</Text>}
      {supportsBackgroundTracking && <TouchableOpacity style={styles.backgroundOption} onPress={changeBackgroundTracking}>
        <View style={{ flex: 1 }}>
          <Text style={styles.backgroundTitle}>Ubicación en segundo plano</Text>
          <Text style={styles.backgroundDescription}>Comparte tu posición mientras la app está minimizada.</Text>
        </View>
        <Text style={styles.backgroundState}>{backgroundEnabled ? 'Activada' : 'Desactivada'}</Text>
      </TouchableOpacity>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: 28, fontWeight: '700', marginBottom: spacing.sm, color: colors.text },
  email: { fontSize: 18, color: colors.text, fontWeight: '600' },
  rol: { fontSize: 16, color: colors.accent, marginTop: 4, fontWeight: '700' },
  meta: { fontSize: 16, color: colors.textMuted, marginTop: 4, marginBottom: spacing.md },
  label: { fontSize: 16, color: colors.text, fontWeight: '700', marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: '#24303A', padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: '#6B7380', marginBottom: spacing.md, color: colors.text, fontSize: 18,
  },
  logout: {
    marginTop: spacing.lg, minHeight: 56, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: '#6B7380', backgroundColor: '#24303A',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  btnPrimary: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', flex: 1 },
  btnSecondary: { backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', flex: 1, borderWidth: 1, borderColor: colors.gray[300] },
  btnText: { color: colors.textOnPrimary, fontWeight: '700' },
  backgroundOption: { marginTop: spacing.xl, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center' },
  backgroundTitle: { color: colors.text, fontWeight: '700' },
  backgroundDescription: { color: colors.textLight, fontSize: 12, marginTop: 4 },
  backgroundState: { color: colors.accent, fontWeight: '700' },
});
