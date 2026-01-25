import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, FlatList, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import api from '../services/api';

export default function ManageCarsScreen({ navigation }: any) {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState('FORESTAL');
  const [status, setStatus] = useState('AVAILABLE');
  const [membersCount, setMembersCount] = useState('1');
  const [observations, setObservations] = useState('');

  const unitTypes = [
    { id: 'FORESTAL', label: 'Forestal' },
    { id: 'URBANO', label: 'Urbano' },
    { id: 'APOYO', label: 'Apoyo' },
    { id: 'ALJIBE', label: 'Aljibe' },
    { id: 'PORTAESCALAS', label: 'Portaescalas' },
    { id: 'RESCATE', label: 'Rescate' },
    { id: 'HAZMAT', label: 'HazMat' },
  ];
  const unitStatuses = [
    { id: 'AVAILABLE', label: 'Disponible' },
    { id: 'DEPLOYED', label: 'Desplegado' },
    { id: 'STANDBY', label: 'En Espera' },
    { id: 'MAINTENANCE', label: 'Mantención' },
  ];

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/units/');
      setUnits(res.data);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudieron cargar los carros');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (unit?: any) => {
    if (unit) {
      setEditingUnit(unit);
      setName(unit.name);
      setUnitType(unit.unit_type || 'FORESTAL');
      setStatus(unit.status || 'AVAILABLE');
      setMembersCount(unit.members_count?.toString() || '1');
      setObservations(unit.observations || '');
    } else {
      setEditingUnit(null);
      setName('');
      setUnitType('FORESTAL');
      setStatus('AVAILABLE');
      setMembersCount('1');
      setObservations('');
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Error', 'El nombre del carro es obligatorio');
      return;
    }

    const payload = {
      name,
      unit_type: unitType,
      status,
      members_count: parseInt(membersCount || '1', 10),
      observations
    };

    try {
      if (editingUnit) {
        await api.patch(`/units/${editingUnit.id}/`, payload);
        Alert.alert('Éxito', 'Carro actualizado');
      } else {
        await api.post('/units/', payload);
        Alert.alert('Éxito', 'Carro creado');
      }
      setModalVisible(false);
      fetchUnits();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo guardar');
    }
  };

  const handleDelete = (unit: any) => {
    Alert.alert(
      'Eliminar Carro',
      `¿Estás seguro de eliminar el carro ${unit.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/units/${unit.id}/`);
              fetchUnits();
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar el carro');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.iconContainer}>
            <Ionicons name="bus" size={20} color={colors.white} />
          </View>
          <View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>{item.type_display || item.unit_type}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'AVAILABLE' ? colors.success : colors.warning }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenModal(item)}>
          <Ionicons name="pencil" size={18} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
          <Ionicons name="trash" size={18} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger }]}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={units}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay carros registrados</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => handleOpenModal()}>
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingUnit ? 'Editar Carro' : 'Nuevo Carro'}</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: B-1"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Tipo</Text>
            <View style={[styles.chipsRow, { marginBottom: 15 }]}>
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

            <Text style={styles.label}>Estado Inicial</Text>
            <View style={[styles.chipsRow, { marginBottom: 15 }]}>
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

            <Text style={styles.label}>Tripulación Típica (Cantidad)</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              keyboardType="numeric"
              value={membersCount}
              onChangeText={setMembersCount}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  cardSubtitle: { fontSize: 12, color: colors.gray[600] },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, color: 'white', fontWeight: 'bold' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 15, borderTopWidth: 1, borderTopColor: colors.gray[100], paddingTop: 10 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 14, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 50, color: colors.gray[500] },
  fab: {
    position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.lg
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.xl },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: spacing.lg, textAlign: 'center' },
  label: { fontSize: 12, color: colors.gray[600], marginBottom: 5 },
  input: { backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
  chipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.gray[100], borderWidth: 1, borderColor: colors.gray[300] },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.gray[700] },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: 10 },
  cancelButton: { padding: spacing.md },
  saveButton: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md },
  saveButtonText: { color: 'white', fontWeight: '600' }
});
