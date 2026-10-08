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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return colors.success;
            case 'DEPLOYED': return colors.danger;
            case 'STANDBY': return colors.warning;
            default: return colors.gray[500];
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'FORESTAL': return 'leaf';
            case 'URBANO': return 'business';
            case 'APOYO': return 'construct';
            default: return 'bus';
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const statusColor = getStatusColor(item.status);

        return (
            <View style={styles.card}>
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primary }]}>
                        <Ionicons name={getTypeIcon(item.unit_type) as any} size={24} color={colors.white} />
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <Text style={styles.cardSubtitle}>{item.type_display || item.unit_type}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{item.status_display || item.status}</Text>
                    </View>
                </View>

                {/* Company info */}
                {item.company_name && (
                    <View style={styles.companyRow}>
                        <Ionicons name="business-outline" size={18} color={colors.gray[500]} />
                        <Text style={styles.companyText}>{item.company_name}</Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenEdit(item)}>
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                        <Text style={[styles.actionText, { color: colors.accent }]}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
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
                                <Text style={{ color: colors.white, fontWeight: 'bold' }}>Guardar</Text>
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
    list: { padding: spacing.md, paddingBottom: 100 },
    empty: { textAlign: 'center', marginTop: 50, color: colors.gray[500], fontSize: 15 },
    card: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardInfo: {
        flex: 1,
        marginLeft: spacing.md,
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
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    companyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.gray[100],
    },
    companyText: {
        fontSize: 13,
        color: colors.gray[500],
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.gray[100],
        gap: 16,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.gray[50],
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
    },
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
        padding: spacing.xl,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: spacing.lg,
        textAlign: 'center',
        color: colors.text,
    },
    input: {
        backgroundColor: colors.gray[50],
        padding: 14,
        borderRadius: borderRadius.md,
        marginBottom: 15,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.gray[200],
    },
    selectBtn: {
        backgroundColor: colors.gray[50],
        padding: 14,
        borderRadius: borderRadius.md,
        marginBottom: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.gray[200],
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 20 },
    cancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: borderRadius.md,
        backgroundColor: colors.gray[100],
        alignItems: 'center',
    },
    saveButton: {
        flex: 2,
        backgroundColor: colors.primary,
        padding: 14,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    }
});
