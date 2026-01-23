import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/colors';
import api from '../services/api';

export default function CreateUnitScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState('FORESTAL');
  const [status, setStatus] = useState('AVAILABLE');
  const [membersCount, setMembersCount] = useState('1');
  const [observations, setObservations] = useState('');

  const unitTypes = [
    { id: 'FORESTAL', label: 'Forestal' },
    { id: 'URBANO', label: 'Urbano' },
    { id: 'APOYO', label: 'Apoyo' },
  ];
  const unitStatuses = [
    { id: 'AVAILABLE', label: 'Disponible' },
    { id: 'DEPLOYED', label: 'Desplegado' },
    { id: 'STANDBY', label: 'En Espera' },
  ];

  const handleCreate = async () => {
    if (!name) {
      Alert.alert('Error', 'El nombre del carro es obligatorio');
      return;
    }
    try {
      await api.post('/units/', {
        name,
        unit_type: unitType,
        status,
        members_count: parseInt(membersCount || '1', 10),
        // observations (not persisted yet)
      });
      Alert.alert('Éxito', 'Carro creado correctamente');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.name?.[0] || 'No se pudo crear el carro');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear Carro</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre (ej: B-5)"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chipsRow}>
        {unitTypes.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.chip, unitType === t.id && styles.chipSelected]}
            onPress={() => setUnitType(t.id)}
          >
            <Text style={[styles.chipText, unitType === t.id && { color: 'white' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Estado</Text>
      <View style={styles.chipsRow}>
        {unitStatuses.map(s => (
          <TouchableOpacity
            key={s.id}
            style={[styles.chip, status === s.id && styles.chipSelected]}
            onPress={() => setStatus(s.id)}
          >
            <Text style={[styles.chipText, status === s.id && { color: 'white' }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Miembros</Text>
      <TextInput
        style={styles.input}
        placeholder="Cantidad"
        keyboardType="numeric"
        value={membersCount}
        onChangeText={setMembersCount}
      />

      <Text style={styles.label}>Observaciones</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Caracteristicas u observaciones"
        multiline
        numberOfLines={3}
        value={observations}
        onChangeText={setObservations}
      />

      <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
        <Ionicons name="save" size={20} color="white" />
        <Text style={styles.createButtonText}>Guardar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: 20, fontWeight: '700', marginBottom: spacing.md, color: colors.text },
  input: { backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.gray[200] },
  textArea: { height: 100, textAlignVertical: 'top' },
  label: { fontSize: 12, color: colors.gray[600], marginBottom: 8 },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, flexWrap: 'wrap' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.gray[100], borderWidth: 1, borderColor: colors.gray[300] },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700] },
  createButton: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: spacing.md },
  createButtonText: { color: 'white', fontWeight: '700' },
});

