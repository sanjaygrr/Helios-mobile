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

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'FORESTAL': return 'leaf';
      case 'URBANO': return 'business';
      case 'APOYO': return 'construct';
      case 'ALJIBE': return 'water';
      case 'PORTAESCALAS': return 'resize';
      case 'RESCATE': return 'medkit';
      case 'HAZMAT': return 'warning';
      default: return 'car';
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return { label: 'Disponible', color: colors.success };
      case 'DEPLOYED': return { label: 'Desplegado', color: colors.danger };
      case 'STANDBY': return { label: 'En Espera', color: colors.warning };
      case 'MAINTENANCE': return { label: 'Mantención', color: colors.gray[500] };
      default: return { label: status, color: colors.gray[500] };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const statusInfo = getStatusInfo(item.status);

    return (
      <View style={styles.card}>
        {/* Header con icono y estado */}
        <View style={styles.cardHeader}>
          <View style={styles.vehicleInfo}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
              <Ionicons name={getVehicleIcon(item.unit_type) as any} size={22} color={colors.white} />
            </View>
            <View style={styles.vehicleDetails}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>{item.type_display || item.unit_type}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* Detalles adicionales */}
        <View style={styles.detailsRow}>
          {item.members_count > 0 && (
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={14} color={colors.gray[500]} />
              <Text style={styles.detailText}>{item.members_count} tripulantes</Text>
            </View>
          )}
          {item.observations && (
            <View style={styles.detailItem}>
              <Ionicons name="document-text-outline" size={14} color={colors.gray[500]} />
              <Text style={styles.detailText} numberOfLines={1}>{item.observations}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenModal(item)}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusText: { fontSize: 10, color: 'white', fontWeight: 'bold' },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    fontSize: 12,
    color: colors.gray[500],
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.gray[50],
  },
  actionText: { fontSize: 13, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 50, color: colors.gray[500], fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.lg,
    textAlign: 'center',
    color: colors.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.gray[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.gray[50],
    borderWidth: 1.5,
    borderColor: colors.gray[200],
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700] },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginTop: 20 },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  saveButton: {
    flex: 2,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonText: { color: 'white', fontWeight: '700', fontSize: 15 }
});
