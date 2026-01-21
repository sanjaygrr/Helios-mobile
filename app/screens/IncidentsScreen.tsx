import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../theme/colors';
import api from '../services/api';
import ModalSelector from '../components/ModalSelector';
import { useAuth } from '../context/AuthContext';

export default function IncidentsScreen() {
    const { user, role } = useAuth();
    const [incidents, setIncidents] = useState([]);
    const [isModalVisible, setModalVisible] = useState(false);
    const [newIncident, setNewIncident] = useState({
        title: '',
        description: '',
        incident_type: 'OTRO',
        latitude: 0,
        longitude: 0
    });
    const [loadingLocation, setLoadingLocation] = useState(false);

    // Incident Types from Backend
    const incidentTypes = [
        { id: 'FORESTAL', label: 'Forestal' },
        { id: 'ESTRUCTURAL', label: 'Estructural' },
        { id: 'RESCATE', label: 'Rescate' },
        { id: 'HAZMAT', label: 'Hazmat' },
        { id: 'OTRO', label: 'Otro' },
    ];

    const [showTypeSelector, setShowTypeSelector] = useState(false);

    useEffect(() => {
        fetchIncidents();
    }, []);

    const fetchIncidents = async () => {
        try {
            const response = await api.get('/incidents/');
            setIncidents(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async () => {
        setModalVisible(true);
        setLoadingLocation(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se requiere ubicación para reportar emergencia.');
                setLoadingLocation(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setNewIncident(prev => ({
                ...prev,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            }));
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo obtener la ubicación.');
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleCreateIncident = async () => {
        if (!newIncident.title || !newIncident.latitude) {
            Alert.alert('Error', 'Complete los campos y verificque la ubicación.');
            return;
        }

        try {
            await api.post('/incidents/', newIncident);
            setModalVisible(false);
            fetchIncidents();
            setNewIncident({ title: '', description: '', incident_type: 'OTRO', latitude: 0, longitude: 0 });
            Alert.alert('Éxito', 'Emergencia reportada.');
        } catch (error) {
            Alert.alert('Error', 'No se pudo reportar la emergencia.');
        }
    };

    const getTypeLabel = () => incidentTypes.find(t => t.id === newIncident.incident_type)?.label || 'Seleccionar Tipo';

    const renderIncidentItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: getIncidentColor(item.incident_type) }]}>
                <Ionicons name="flame" size={24} color={colors.white} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.incident_type} - {new Date(item.start_time).toLocaleString()}</Text>
                {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
            </View>
            <View style={styles.statusBadge}>
                <View style={[styles.dot, { backgroundColor: item.is_active ? colors.success : colors.gray[400] }]} />
            </View>
        </View>
    );

    const getIncidentColor = (type: string) => {
        switch (type) {
            case 'FORESTAL': return colors.success;
            case 'ESTRUCTURAL': return colors.danger; // Red
            case 'RESCATE': return colors.primary; // Blue
            case 'HAZMAT': return colors.warning; // Orange
            default: return colors.gray[500];
        }
    };

    // ... inside component
    const [status, setStatus] = useState('available');

    const handleStatusChange = (newStatus: string) => {
        const statusLabels: Record<string, string> = {
            available: 'Disponible',
            en_route: 'En Camino',
            on_scene: 'En Escena',
            returning: 'Regresando',
        };
        Alert.alert(
            'Cambiar Estado',
            `Cambiar estado a "${statusLabels[newStatus]}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Confirmar', onPress: () => setStatus(newStatus) }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={incidents}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={renderIncidentItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={<Text style={styles.emptyText}>No hay emergencias activas.</Text>}
                ListFooterComponent={
                    <View style={styles.statusSection}>
                        <Text style={styles.sectionTitle}>Mi Estado</Text>
                        <View style={styles.actionsGrid}>
                            <TouchableOpacity style={[styles.actionButton, status === 'en_route' && styles.actionButtonActive]} onPress={() => handleStatusChange('en_route')}>
                                <Ionicons name="car" size={24} color={status === 'en_route' ? colors.white : colors.warning} />
                                <Text style={[styles.actionButtonText, status === 'en_route' && styles.actionButtonTextActive]}>En Camino</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, status === 'on_scene' && styles.actionButtonActive, status === 'on_scene' && { backgroundColor: colors.danger }]} onPress={() => handleStatusChange('on_scene')}>
                                <Ionicons name="flame" size={24} color={status === 'on_scene' ? colors.white : colors.danger} />
                                <Text style={[styles.actionButtonText, status === 'on_scene' && styles.actionButtonTextActive]}>En Escena</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, status === 'returning' && styles.actionButtonActive, status === 'returning' && { backgroundColor: colors.info }]} onPress={() => handleStatusChange('returning')}>
                                <Ionicons name="arrow-back-circle" size={24} color={status === 'returning' ? colors.white : colors.info} />
                                <Text style={[styles.actionButtonText, status === 'returning' && styles.actionButtonTextActive]}>Regresando</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, status === 'available' && styles.actionButtonActive, status === 'available' && { backgroundColor: colors.success }]} onPress={() => handleStatusChange('available')}>
                                <Ionicons name="checkmark-circle" size={24} color={status === 'available' ? colors.white : colors.success} />
                                <Text style={[styles.actionButtonText, status === 'available' && styles.actionButtonTextActive]}>Disponible</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                }
            />

            {(role === 'SUPER_ADMIN' || role === 'COMPANY_CHIEF') && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={handleOpenModal}
                >
                    <Ionicons name="add" size={24} color={colors.white} />
                </TouchableOpacity>
            )}

            {/* Modals ... */}


            <Modal visible={isModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Reportar Emergencia</Text>

                        {loadingLocation ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text>Obteniendo ubicación...</Text>
                            </View>
                        ) : (
                            <>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Título (ej: Incendio en Sector 5)"
                                    value={newIncident.title}
                                    onChangeText={(t) => setNewIncident({ ...newIncident, title: t })}
                                />

                                <TouchableOpacity style={styles.selectButton} onPress={() => setShowTypeSelector(true)}>
                                    <Text>{getTypeLabel()}</Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
                                </TouchableOpacity>

                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Descripción (Opcional)"
                                    value={newIncident.description}
                                    onChangeText={(t) => setNewIncident({ ...newIncident, description: t })}
                                    multiline
                                    numberOfLines={3}
                                />

                                <Text style={styles.locationText}>
                                    Ubicación: {newIncident.latitude.toFixed(5)}, {newIncident.longitude.toFixed(5)}
                                </Text>

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                                        <Text>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.createButton} onPress={handleCreateIncident}>
                                        <Text style={styles.createButtonText}>Reportar</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            <ModalSelector
                visible={showTypeSelector}
                title="Tipo de Incidente"
                options={incidentTypes}
                onClose={() => setShowTypeSelector(false)}
                onSelect={(opt) => setNewIncident({ ...newIncident, incident_type: opt.id as string })}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing.md },
    card: {
        backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm,
        flexDirection: 'row', alignItems: 'center', elevation: 2
    },
    iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 16, fontWeight: 'bold' },
    subtitle: { fontSize: 12, color: colors.gray[600] },
    desc: { fontSize: 12, color: colors.gray[500], fontStyle: 'italic' },
    statusBadge: { padding: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: 4 },
    emptyText: { textAlign: 'center', marginTop: spacing.xl, color: colors.gray[500] },
    fab: {
        position: 'absolute', bottom: spacing.xl, right: spacing.md, width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', elevation: 6
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
    modalContent: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.xl },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: spacing.lg, textAlign: 'center' },
    input: { backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
    textArea: { height: 80, textAlignVertical: 'top' },
    loadingContainer: { alignItems: 'center', padding: spacing.xl },
    locationText: { fontSize: 12, color: colors.gray[500], marginBottom: spacing.md },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
    cancelButton: { padding: spacing.md },
    createButton: { backgroundColor: colors.danger, padding: spacing.md, borderRadius: borderRadius.md },
    createButtonText: { color: colors.white, fontWeight: '600' },
    selectButton: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md
    },
    // Status Styles
    statusSection: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.lg, elevation: 2 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: spacing.md },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    actionButton: {
        width: '48%', backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, padding: spacing.md,
        alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.gray[200]
    },
    actionButtonActive: { backgroundColor: colors.warning, borderColor: 'transparent' },
    actionButtonText: { fontSize: 13, fontWeight: '600', color: colors.text },
    actionButtonTextActive: { color: colors.white },
});
