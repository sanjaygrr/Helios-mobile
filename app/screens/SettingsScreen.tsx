import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setApiBaseURL } from '../services/api';

export default function SettingsScreen() {
  const [baseURL, setBaseURL] = useState('');

  useEffect(() => {
    (async () => {
      const storedBase = await AsyncStorage.getItem('@Api:baseURL');
      setBaseURL(storedBase || (process as any)?.env?.EXPO_PUBLIC_API_URL || '');
    })();
  }, []);

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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Configuración</Text>
      <Text style={styles.label}>URL del Backend</Text>
      <TextInput
        style={styles.input}
        value={baseURL}
        onChangeText={setBaseURL}
        placeholder="https://tu-backend/api"
        autoCapitalize="none"
        autoCorrect={false}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: 20, fontWeight: '700', marginBottom: spacing.md, color: colors.text },
  label: { fontSize: 12, color: colors.gray[600], marginBottom: spacing.xs },
  input: { backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gray[200], marginBottom: spacing.md },
  btnPrimary: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', flex: 1 },
  btnSecondary: { backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', flex: 1, borderWidth: 1, borderColor: colors.gray[300] },
  btnText: { color: colors.white, fontWeight: '700' },
});

