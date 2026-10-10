import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, FlatList, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import api, { asList } from '../services/api';
import ModalSelector from '../components/ModalSelector';
import { useAuth } from '../context/AuthContext';
import ListaAgrupada from '../components/ListaAgrupada';

export default function ManageCarsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [detalleCarro, setDetalleCarro] = useState<any>(null);
  const [editingUnit, setEditingUnit] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState('FORESTAL');
  const [status, setStatus] = useState('AVAILABLE');
  const [membersCount, setMembersCount] = useState('1');
  const [waterLevel, setWaterLevel] = useState('100');
  const [fuelLevel, setFuelLevel] = useState('100');
  const [equipmentReady, setEquipmentReady] = useState(true);
  const [observations, setObservations] = useState('');
  const [company, setCompany] = useState<number | null>(user?.company || null);
  const [companies, setCompanies] = useState<{ id: number; label: string }[]>([]);
  const [showCompanySelector, setShowCompanySelector] = useState(false);

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
    api.get('/companies/').then(res => {
      setCompanies(asList(res.data).map((item: any) => ({ id: item.id, label: `${item.name} (${item.number})` })));
    }).catch(() => {});
  }, []);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/units/');
      setUnits(asList(res.data));
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
      setWaterLevel(String(unit.water_level ?? 100));
      setFuelLevel(String(unit.fuel_level ?? 100));
      setEquipmentReady(unit.equipment_ready !== false);
      setObservations(unit.observations || '');
      setCompany(unit.company || null);
    } else {
      setEditingUnit(null);
      setName('');
      setUnitType('FORESTAL');
      setStatus('AVAILABLE');
      setMembersCount('1');
      setWaterLevel('100');
      setFuelLevel('100');
      setEquipmentReady(true);
      setObservations('');
      setCompany(user?.company || null);
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Error', 'El nombre del carro es obligatorio');
      return;
    }
    if (!company) {
      Alert.alert('Error', 'Selecciona una compañía para el carro');
      return;
    }
    const water = Number(waterLevel);
    const fuel = Number(fuelLevel);
    if (!Number.isFinite(water) || water < 0 || water > 100 ||
        !Number.isFinite(fuel) || fuel < 0 || fuel > 100) {
      Alert.alert('Error', 'Agua y combustible deben estar entre 0 y 100');
      return;
    }

    const payload = {
      name,
      unit_type: unitType,
      status,
      members_count: parseInt(membersCount || '1', 10),
      water_level: Math.round(water),
      fuel_level: Math.round(fuel),
      equipment_ready: equipmentReady,
      observations,
      company,
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
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => setDetalleCarro(item)}
      >
        {/* Header con icono y estado */}
        <View style={styles.cardHeader}>
          <View style={styles.vehicleInfo}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
              <Ionicons name={getVehicleIcon(item.unit_type) as any} size={24} color={colors.white} />
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
              <Ionicons name="people-outline" size={18} color={colors.gray[500]} />
              <Text style={styles.detailText}>{item.members_count} tripulantes</Text>
            </View>
          )}
          {item.observations && (
            <View style={styles.detailItem}>
              <Ionicons name="document-text-outline" size={18} color={colors.gray[500]} />
              <Text style={styles.detailText} numberOfLines={1}>{item.observations}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenModal(item)}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.accent }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.crearBarra} onPress={() => handleOpenModal()}>
        <Ionicons name="add" size={22} color={colors.white} />
        <Text style={styles.crearBarraTexto}>Crear carro</Text>
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <ListaAgrupada
          datos={units}
          criterios={[
            { clave: 'comuna', etiqueta: 'Ciudad',
              grupo: (u: any) => u.comuna || 'Sin ciudad' },
            { clave: 'compania', etiqueta: 'Compañía',
              grupo: (u: any) => u.company_name || 'Sin compañía' },
            { clave: 'cuerpo', etiqueta: 'Cuerpo',
              grupo: (u: any) => u.fire_department_name || 'Sin cuerpo' },
            { clave: 'tipo', etiqueta: 'Tipo',
              grupo: (u: any) => u.type_display || 'Sin tipo' },
          ]}
          claveItem={(u: any) => String(u.id)}
          buscarEn={(u: any) =>
            `${u.name} ${u.company_name || ''} ${u.comuna || ''} ${u.type_display || ''}`}
          render={(item: any) => renderItem({ item } as any)}
          vacio={<Text style={styles.emptyText}>No hay carros registrados</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => handleOpenModal()}>
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Detalle del carro */}
      <Modal visible={!!detalleCarro} animationType="slide" transparent
             onRequestClose={() => setDetalleCarro(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { gap: 0 }]}>
            <View style={estilosDetalle.header}>
              <View style={{ flex: 1 }}>
                <Text style={estilosDetalle.titulo}>{detalleCarro?.name}</Text>
                <Text style={estilosDetalle.sub}>
                  {detalleCarro?.type_display || detalleCarro?.unit_type}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetalleCarro(null)} hitSlop={12}
                                style={estilosDetalle.cerrar}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {[
              ['pulse', 'Estado', detalleCarro?.status_display],
              ['business', 'Compañía', detalleCarro?.company_name],
              ['location', 'Ciudad', detalleCarro?.comuna],
              ['shield', 'Cuerpo', detalleCarro?.fire_department_name],
              ['people', 'Dotación', detalleCarro?.members_count
                ? `${detalleCarro.members_count} personas` : null],
              ['water', 'Agua', detalleCarro?.water_level != null
                ? `${detalleCarro.water_level}%` : null],
              ['speedometer', 'Combustible', detalleCarro?.fuel_level != null
                ? `${detalleCarro.fuel_level}%` : null],
              ['construct', 'Equipamiento', detalleCarro?.equipment_ready === false
                ? 'Requiere revisión' : 'Listo para servicio'],
              ['document-text', 'Observaciones', detalleCarro?.observations],
            ].map(([ic, et, va]: any) => (
              <View key={et} style={estilosDetalle.fila}>
                <Ionicons name={ic} size={20} color={colors.textMuted} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={estilosDetalle.etiqueta}>{et}</Text>
                  <Text style={estilosDetalle.valor}>{va || 'Sin registrar'}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={estilosDetalle.editar}
              activeOpacity={0.8}
              onPress={() => { const c = detalleCarro; setDetalleCarro(null); handleOpenModal(c); }}
            >
              <Ionicons name="create-outline" size={20} color={colors.white} />
              <Text style={estilosDetalle.editarTexto}>Editar carro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <Text style={styles.modalTitle}>{editingUnit ? 'Editar Carro' : 'Nuevo Carro'}</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: B-1"
              value={name}
              onChangeText={setName}
                placeholderTextColor={colors.textMuted}
                        />

            <Text style={styles.label}>Compañía</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowCompanySelector(true)}>
              <Text style={styles.inputText}>{companies.find(item => item.id === company)?.label || 'Seleccionar compañía'}</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Tipo</Text>
            <View style={[styles.chipsRow, { marginBottom: 15 }]}>
              {unitTypes.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, unitType === t.id && styles.chipSelected]}
                  onPress={() => setUnitType(t.id)}
                >
                  <Text style={[styles.chipText, unitType === t.id && { color: colors.white }]}>{t.label}</Text>
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
                  <Text style={[styles.chipText, status === s.id && { color: colors.white }]}>{s.label}</Text>
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
                placeholderTextColor={colors.textMuted}
                        />

            <Text style={styles.label}>Nivel de agua (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="100"
              keyboardType="numeric"
              value={waterLevel}
              onChangeText={setWaterLevel}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Nivel de combustible (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="100"
              keyboardType="numeric"
              value={fuelLevel}
              onChangeText={setFuelLevel}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Equipamiento</Text>
            <View style={[styles.chipsRow, { marginBottom: spacing.md }]}>
              <TouchableOpacity
                style={[styles.chip, equipmentReady && styles.chipSelected]}
                onPress={() => setEquipmentReady(true)}
              >
                <Text style={[styles.chipText, equipmentReady && styles.chipTextSelected]}>
                  Listo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, !equipmentReady && styles.chipSelected]}
                onPress={() => setEquipmentReady(false)}
              >
                <Text style={[styles.chipText, !equipmentReady && styles.chipTextSelected]}>
                  Requiere revisión
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Observaciones</Text>
            <TextInput
              style={[styles.input, styles.observationsInput]}
              placeholder="Equipamiento faltante, fallas u observaciones"
              value={observations}
              onChangeText={setObservations}
              multiline
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ModalSelector
        visible={showCompanySelector}
        title="Seleccionar compañía"
        options={companies}
        onClose={() => setShowCompanySelector(false)}
        onSelect={item => setCompany(Number(item.id))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  crearBarra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: spacing.md, minHeight: 56, borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  crearBarraTexto: { color: colors.white, fontSize: 18, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
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
    borderRadius: borderRadius.md,
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
    borderRadius: borderRadius.lg,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: borderRadius.sm,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusText: { fontSize: 10, color: colors.white, fontWeight: 'bold' },
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
    borderRadius: borderRadius.sm,
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
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '92%',
  },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { paddingBottom: spacing.md },
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
    backgroundColor: '#24303A',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#6B7380', color: colors.text,},
  inputText: { color: colors.text, fontSize: 18 },
  observationsInput: { minHeight: 88, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    backgroundColor: '#24303A',
    borderWidth: 1.5,
    borderColor: '#6B7380',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  chipText: { fontSize: 16, fontWeight: '700', color: colors.text },
  chipTextSelected: { color: colors.textOnPrimary },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginTop: 20 },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#24303A',
    borderWidth: 1,
    borderColor: '#6B7380',
    alignItems: 'center',
  },
  cancelText: { color: colors.text, fontSize: 16, fontWeight: '700' },
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
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 }
});

const estilosDetalle = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  titulo: { fontSize: 26, fontWeight: '700', color: colors.text },
  sub: { fontSize: 16, color: colors.textMuted, marginTop: 2 },
  cerrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13,
          borderTopWidth: 1, borderTopColor: colors.border },
  etiqueta: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6,
              textTransform: 'uppercase', color: colors.textMuted },
  valor: { fontSize: 17, color: colors.text, marginTop: 2 },
  editar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: spacing.sm, height: 56, borderRadius: borderRadius.md,
            backgroundColor: colors.primary, marginTop: spacing.lg },
  editarTexto: { fontSize: 18, fontWeight: '700', color: colors.textOnPrimary },
});
