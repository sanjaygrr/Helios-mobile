import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import api from '../services/api';
import ModalSelector from '../components/ModalSelector';

export default function ManageUnitsScreen() {
    const [units, setUnits] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit/Create Modal
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUnit, setEditingUnit] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        unit_type: 'FORESTAL',
        status: 'AVAILABLE'
    });
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [showStatusSelector, setShowStatusSelector] = useState(false);

    // Dictionaries
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

    useEffect(() => {
        fetchUnits();
    }, []);

    const fetchUnits = async () => {
        setLoading(true);
        try {
            const res = await api.get('/units/');
            setUnits(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingUnit(null);
        setFormData({ name: '', unit_type: 'FORESTAL', status: 'AVAILABLE' });
        setModalVisible(true);
    };

    const handleOpenEdit = (unit: any) => {
        setEditingUnit(unit);
        setFormData({
            name: unit.name,
            unit_type: unit.unit_type,
            status: unit.status
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formData.name) {
            Alert.alert("Error", "El nombre es obligatorio");
            return;
        }

        try {
            if (editingUnit) {
                await api.patch(`/units/${editingUnit.id}/`, formData);
                Alert.alert("Éxito", "Unidad actualizada");
            } else {
                await api.post('/units/', formData);
                Alert.alert("Éxito", "Unidad creada");
            }
            setModalVisible(false);
            fetchUnits();
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.name?.[0] || "Error al guardar");
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert(
            "Eliminar Unidad",
            "¿Estás seguro?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/units/${id}/`);
                            fetchUnits();
                        } catch (error) {
                            Alert.alert("Error", "No se pudo eliminar");
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.iconBox}>
                <Ionicons name="bus" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{item.type_display} • {item.status_display}</Text>
                {item.company_name && <Text style={{ fontSize: 12, color: colors.gray[500] }}>{item.company_name}</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => handleOpenEdit(item)}>
                    <Ionicons name="pencil" size={20} color={colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash" size={20} color={colors.danger} />
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
                    keyExtractor={u => u.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={styles.empty}>No hay unidades registradas.</Text>}
                />
            )}

            <TouchableOpacity style={styles.fab} onPress={handleOpenCreate}>
                <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingUnit ? 'Editar Unidad' : 'Nueva Unidad'}</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Nombre (ej: B-5)"
                            value={formData.name}
                            onChangeText={t => setFormData({ ...formData, name: t })}
                        />

                        <TouchableOpacity style={styles.selectBtn} onPress={() => setShowTypeSelector(true)}>
                            <Text>{unitTypes.find(t => t.id === formData.unit_type)?.label}</Text>
                            <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.selectBtn} onPress={() => setShowStatusSelector(true)}>
                            <Text>{unitStatuses.find(t => t.id === formData.status)?.label}</Text>
                            <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
                        </TouchableOpacity>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                                <Text>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <ModalSelector
                visible={showTypeSelector}
                options={unitTypes}
                onClose={() => setShowTypeSelector(false)}
                onSelect={(opt) => setFormData({ ...formData, unit_type: opt.id as string })}
                title="Tipo de Unidad"
            />
            <ModalSelector
                visible={showStatusSelector}
                options={unitStatuses}
                onClose={() => setShowStatusSelector(false)}
                onSelect={(opt) => setFormData({ ...formData, status: opt.id as string })}
                title="Estado Inicial"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.md, paddingBottom: 80 },
    empty: { textAlign: 'center', marginTop: 50, color: colors.gray[500] },
    card: {
        backgroundColor: 'white', padding: spacing.md, marginBottom: spacing.sm,
        borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', ...shadows.sm
    },
    iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    cardSubtitle: { fontSize: 12, color: colors.gray[600] },
    fab: {
        position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.lg
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 15 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { backgroundColor: colors.gray[100], padding: 12, borderRadius: 8, marginBottom: 15 },
    selectBtn: {
        backgroundColor: colors.gray[100], padding: 12, borderRadius: 8, marginBottom: 15,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
    cancelButton: { padding: 12 },
    saveButton: { backgroundColor: colors.primary, padding: 12, borderRadius: 8 }
});
