import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../theme/colors';
import api from '../services/api';
import ModalSelector from '../components/ModalSelector';
import PersonnelForm, { SectionMember } from '../components/PersonnelForm';
import { useAuth } from '../context/AuthContext';


const getIncidentColor = (type: string) => {
    switch (type) {
        case 'FORESTAL': return colors.success;
        case 'ESTRUCTURAL': return colors.danger;
        case 'RESCATE': return colors.warning;
        case 'HAZMAT': return colors.secondary;
        default: return colors.gray[500];
    }
};

export default function IncidentsScreen() {
    const { user, role } = useAuth();
    const [incidents, setIncidents] = useState<any[]>([]);

    // Incident Creation State
    const [isModalVisible, setModalVisible] = useState(false);
    const [newIncident, setNewIncident] = useState({
        title: '',
        description: '',
        incident_type: 'OTRO',
        latitude: 0,
        longitude: 0
    });
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [showTypeSelector, setShowTypeSelector] = useState(false);

    // Dispatch State
    const [isDispatchModalVisible, setDispatchModalVisible] = useState(false);
    const [selectedIncidentForDispatch, setSelectedIncidentForDispatch] = useState<any>(null);
    const [availableUnits, setAvailableUnits] = useState<any[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [loadingUnits, setLoadingUnits] = useState(false);

    // Initial Assignment State
    const [personnelList, setPersonnelList] = useState<SectionMember[]>([]);
    const [selectedInitialUnit, setSelectedInitialUnit] = useState<any>(null);
    const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);


    // Incident Types
    const incidentTypes = [
        { id: 'FORESTAL', label: 'Forestal' },
        { id: 'ESTRUCTURAL', label: 'Estructural' },
        { id: 'RESCATE', label: 'Rescate' },
        { id: 'HAZMAT', label: 'Hazmat' },
        { id: 'OTRO', label: 'Otro' },
    ];

    const getTypeLabel = () => {
        const type = incidentTypes.find(t => t.id === newIncident.incident_type);
        return type ? type.label : 'Seleccionar Tipo';
    };

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

    // --- Dispatch Logic ---

    const openDispatchModal = async (incident: any) => {
        setSelectedIncidentForDispatch(incident);
        setDispatchModalVisible(true);
        setLoadingUnits(true);
        try {
            const res = await api.get('/units/available/');
            setAvailableUnits(res.data);
        } catch (error) {
            Alert.alert("Error", "No se pudieron cargar las unidades");
        } finally {
            setLoadingUnits(false);
        }
    };

    const handleDispatch = async () => {
        if (!selectedUnit || !selectedIncidentForDispatch) return;

        try {
            await api.post('/assignments/', {
                unit: selectedUnit.id,
                incident: selectedIncidentForDispatch.id
            });
            Alert.alert("Éxito", `Unidad ${selectedUnit.name} despachada a ${selectedIncidentForDispatch.title}`);
            setDispatchModalVisible(false);
            setSelectedUnit(null);
            // Optionally refresh incidents or units
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.error || "Error al despachar unidad");
        }
    };

    // --- Create Incident Logic ---

    const handleOpenModal = async () => {
        setModalVisible(true);
        setLoadingLocation(true);
        setLoadingUnits(true);

        // Fetch Units for initial dispatch
        try {
            const res = await api.get('/units/available/');
            setAvailableUnits(res.data);

            // Pre-select chief's unit if they are a chief
            if (role === 'COMPANY_CHIEF') {
                // Try to find user's assigned unit
                const userUnit = res.data.find((unit: any) => unit.assigned_to === user?.id);
                if (userUnit) {
                    setSelectedInitialUnit(userUnit);
                }
            }
        } catch (e) { console.log("Error loading units", e); }

        // Fetch Vehicles
        try {
            const vehiclesRes = await api.get('/units/'); // Assuming vehicles are units or separate endpoint
            setAvailableVehicles(vehiclesRes.data);
        } catch (e) { console.log("Error loading vehicles", e); }

        setLoadingUnits(false);

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
            // 1. Format Personnel Data
            let personnelDescription = '';
            if (personnelList.length > 0) {
                personnelDescription = '\n\n--- PERSONAL CONCURRENTE (Form. IF-AC-3) ---\n';
                personnelList.forEach((m, idx) => {
                    personnelDescription += `${idx + 1}. ${m.firstName} ${m.lastName} | RUT: ${m.rut} | ${m.role} | ${m.company}\n`;
                });
            }

            // Append formatted crew info to description
            const finalDescription = newIncident.description + personnelDescription;

            const res = await api.post('/incidents/', {
                ...newIncident,
                description: finalDescription,
                vehicle: selectedVehicle?.id // Include vehicle if selected
            });
            const incidentId = res.data.id;

            // 2. Dispatch Unit (if selected)
            if (selectedInitialUnit) {
                await api.post('/assignments/', {
                    unit: selectedInitialUnit.id,
                    incident: incidentId
                });
            }

            // 3. Auto-Take Command (if Chief/Admin)
            if (role === 'COMPANY_CHIEF' || role === 'SUPER_ADMIN') {
                await api.post(`/incidents/${incidentId}/take_command/`);
            }

            setModalVisible(false);
            fetchIncidents();
            // Reset
            setNewIncident({ title: '', description: '', incident_type: 'OTRO', latitude: 0, longitude: 0 });
            setPersonnelList([]);
            setSelectedInitialUnit(null);
            setSelectedVehicle(null);

            Alert.alert('Éxito', 'Emergencia reportada y recursos asignados.');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo reportar la emergencia completamente.');
        }
    };

    const handleTakeCommand = async (incidentId: number) => {
        try {
            await api.post(`/incidents/${incidentId}/take_command/`);
            Alert.alert("Mando Asumido", "Ahora estás a cargo de esta emergencia.");
            fetchIncidents();
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.error || "No se pudo asumir el mando.");
        }
    };

    const handleUpdateStatus = async (incidentId: number, newStatus: string) => {
        try {
            await api.patch(`/incidents/${incidentId}/`, { status: newStatus });
            Alert.alert("Estado Actualizado", `Incidente marcado como ${newStatus.replace('_', ' ')}`);
            fetchIncidents();
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.error || "No se pudo actualizar el estado.");
        }
    };

    const handleCloseIncident = async (incidentId: number) => {
        Alert.alert(
            "Finalizar Emergencia",
            "¿Estás seguro? Esto cerrará el proceso y liberará las unidades.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Finalizar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.post(`/incidents/${incidentId}/close_incident/`);
                            Alert.alert("Finalizado", "Emergencia cerrada exitosamente.");
                            fetchIncidents();
                        } catch (error: any) {
                            Alert.alert("Error", error.response?.data?.error || "No se pudo finalizar.");
                        }
                    }
                }
            ]
        );
    };

    const renderIncidentItem = ({ item }: { item: any }) => {
        const isMyCommand = item.commander === user?.id; // user.id from auth context

        return (
            <View style={styles.card}>
                <View style={[styles.iconBox, { backgroundColor: getIncidentColor(item.incident_type) }]}>
                    <Ionicons name="flame" size={24} color={colors.white} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.subtitle}>
                        {item.incident_type} - {new Date(item.reported_at).toLocaleString()}
                    </Text>

                    {/* Commander Info */}
                    {item.commander_name ? (
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 4 }}>
                            Jefe de Compañía: {item.commander_name}
                        </Text>
                    ) : (
                        <Text style={{ fontSize: 12, color: colors.gray[500], marginTop: 4 }}>Sin Comandante</Text>
                    )}

                    {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}

                    {/* Action Buttons Row */}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        {/* Dispatch (Admin/Chief) */}
                        {(role === 'SUPER_ADMIN' || role === 'COMPANY_CHIEF') && item.is_active && (
                            <TouchableOpacity
                                style={styles.dispatchButtonSmall}
                                onPress={() => openDispatchModal(item)}
                            >
                                <Ionicons name="megaphone-outline" size={16} color={colors.primary} />
                                <Text style={styles.dispatchButtonText}>Despachar</Text>
                            </TouchableOpacity>
                        )}

                        {/* Take Command (Chief only, if empty) */}
                        {(role === 'COMPANY_CHIEF' || role === 'SUPER_ADMIN') && !item.commander && item.is_active && (
                            <TouchableOpacity
                                style={[styles.dispatchButtonSmall, { backgroundColor: colors.secondary }]}
                                onPress={() => handleTakeCommand(item.id)}
                            >
                                <Ionicons name="flag" size={16} color="white" />
                                <Text style={[styles.dispatchButtonText, { color: 'white' }]}>Tomar Mando</Text>
                            </TouchableOpacity>
                        )}

                        {/* Quick Status Buttons (Commander only) */}
                        {isMyCommand && item.is_active && (
                            <>
                                <TouchableOpacity
                                    style={[styles.dispatchButtonSmall, { backgroundColor: colors.warning }]}
                                    onPress={() => handleUpdateStatus(item.id, 'EN_PROGRESO')}
                                >
                                    <Ionicons name="time" size={16} color="white" />
                                    <Text style={[styles.dispatchButtonText, { color: 'white' }]}>En Progreso</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dispatchButtonSmall, { backgroundColor: colors.success }]}
                                    onPress={() => handleUpdateStatus(item.id, 'BAJO_CONTROL')}
                                >
                                    <Ionicons name="checkmark-circle" size={16} color="white" />
                                    <Text style={[styles.dispatchButtonText, { color: 'white' }]}>Bajo Control</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Close Incident (Commander only) */}
                        {isMyCommand && item.is_active && (
                            <TouchableOpacity
                                style={[styles.dispatchButtonSmall, { backgroundColor: colors.danger }]}
                                onPress={() => handleCloseIncident(item.id)}
                            >
                                <Ionicons name="stop-circle" size={16} color="white" />
                                <Text style={[styles.dispatchButtonText, { color: 'white' }]}>Finalizar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.statusBadge}>
                    <View style={[styles.dot, { backgroundColor: item.is_active ? colors.success : colors.gray[400] }]} />
                </View>
            </View>
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
                ListFooterComponent={<View style={{ height: 80 }} />}
            />

            {user && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={handleOpenModal}
                >
                    <Ionicons name="add" size={24} color={colors.white} />
                </TouchableOpacity>
            )}

            {/* Create Incident Modal */}
            <Modal visible={isModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Reportar Emergencia</Text>

                        <ScrollView style={{ maxHeight: '80%' }}>
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
                                        multiline numberOfLines={3}
                                    />

                                    <Text style={{ fontWeight: 'bold', marginBottom: 5, marginTop: 10, color: colors.gray[600] }}>Recursos Iniciales (Opcional):</Text>

                                    <PersonnelForm
                                        initialMembers={personnelList}
                                        onChange={setPersonnelList}
                                    />

                                    <Text style={{ fontSize: 12, marginBottom: 5, color: colors.gray[500], marginTop: 15 }}>Unidad a Utilizar (Despacho inmediato):</Text>
                                    {availableUnits.length > 0 ? (
                                        <View style={{ height: 50, marginBottom: 15 }}>
                                            <FlatList
                                                horizontal
                                                data={availableUnits}
                                                showsHorizontalScrollIndicator={false}
                                                keyExtractor={u => u.id.toString()}
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.unitChip,
                                                            selectedInitialUnit?.id === item.id && styles.unitChipSelected
                                                        ]}
                                                        onPress={() => setSelectedInitialUnit(item === selectedInitialUnit ? null : item)}
                                                    >
                                                        <Text style={[
                                                            styles.unitChipText,
                                                            selectedInitialUnit?.id === item.id && { color: 'white' }
                                                        ]}>{item.name}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            />
                                        </View>
                                    ) : (
                                        <Text style={{ fontStyle: 'italic', color: colors.gray[400], marginBottom: 10 }}>No hay unidades disponibles</Text>
                                    )}

                                    {/* Vehicle Selector */}
                                    <Text style={{ fontSize: 12, marginBottom: 5, marginTop: 15, color: colors.gray[500] }}>Vehículo a Utilizar (Opcional):</Text>
                                    {availableVehicles.length > 0 ? (
                                        <View style={{ height: 50, marginBottom: 15 }}>
                                            <FlatList
                                                horizontal
                                                data={availableVehicles}
                                                showsHorizontalScrollIndicator={false}
                                                keyExtractor={v => v.id.toString()}
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.unitChip,
                                                            selectedVehicle?.id === item.id && styles.unitChipSelected
                                                        ]}
                                                        onPress={() => setSelectedVehicle(item === selectedVehicle ? null : item)}
                                                    >
                                                        <Text style={[
                                                            styles.unitChipText,
                                                            selectedVehicle?.id === item.id && { color: 'white' }
                                                        ]}>{item.name}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            />
                                        </View>
                                    ) : (
                                        <Text style={{ fontStyle: 'italic', color: colors.gray[400], marginBottom: 10 }}>No hay vehículos disponibles</Text>
                                    )}


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
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Dispatch Modal */}
            <Modal visible={isDispatchModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Despachar Unidad</Text>
                        <Text style={styles.modalSubtitle}>Incidente: {selectedIncidentForDispatch?.title}</Text>

                        {loadingUnits ? (
                            <ActivityIndicator size="large" color={colors.primary} />
                        ) : (
                            <>
                                <Text style={{ marginBottom: 10, fontWeight: 'bold', color: colors.gray[600] }}>Unidades Disponibles:</Text>
                                {availableUnits.length === 0 ? (
                                    <Text style={{ fontStyle: 'italic', marginBottom: 20 }}>No hay unidades disponibles.</Text>
                                ) : (
                                    <View style={{ maxHeight: 200 }}>
                                        <FlatList
                                            data={availableUnits}
                                            keyExtractor={(u) => u.id.toString()}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity
                                                    style={[
                                                        styles.unitItem,
                                                        selectedUnit?.id === item.id && styles.unitItemSelected
                                                    ]}
                                                    onPress={() => setSelectedUnit(item)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                        <Ionicons name="bus" size={20} color={selectedUnit?.id === item.id ? colors.white : colors.primary} />
                                                        <Text style={[styles.unitItemText, selectedUnit?.id === item.id && { color: 'white' }]}>
                                                            {item.name} ({item.type_display})
                                                        </Text>
                                                    </View>
                                                    {selectedUnit?.id === item.id && <Ionicons name="checkmark" size={20} color="white" />}
                                                </TouchableOpacity>
                                            )}
                                        />
                                    </View>
                                )}

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity style={styles.cancelButton} onPress={() => setDispatchModalVisible(false)}>
                                        <Text>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.createButton, (!selectedUnit) && { backgroundColor: colors.gray[400] }]}
                                        onPress={handleDispatch}
                                        disabled={!selectedUnit}
                                    >
                                        <Text style={styles.createButtonText}>Confirmar Despacho</Text>
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
        flexDirection: 'row', alignItems: 'flex-start', elevation: 2
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
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: spacing.sm, textAlign: 'center' },
    modalSubtitle: { fontSize: 14, color: colors.gray[600], marginBottom: spacing.lg, textAlign: 'center' },
    input: { backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
    textArea: { height: 80, textAlignVertical: 'top' },
    loadingContainer: { alignItems: 'center', padding: spacing.xl },
    locationText: { fontSize: 12, color: colors.gray[500], marginBottom: spacing.md },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: 20 },
    cancelButton: { padding: spacing.md },
    createButton: { backgroundColor: colors.danger, padding: spacing.md, borderRadius: borderRadius.md },
    createButtonText: { color: colors.white, fontWeight: '600' },
    selectButton: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md
    },
    dispatchButtonSmall: {
        flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
        paddingVertical: 4, paddingHorizontal: 8,
        backgroundColor: colors.gray[100], borderRadius: 4, alignSelf: 'flex-start'
    },
    dispatchButtonText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    unitItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 12, borderRadius: 8, backgroundColor: colors.gray[50], marginBottom: 8,
        borderWidth: 1, borderColor: colors.gray[200]
    },
    unitItemSelected: {
        backgroundColor: colors.primary, borderColor: colors.primary
    },
    unitItemText: { fontWeight: '600', color: colors.text },
    unitChip: {
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
        backgroundColor: colors.gray[100], marginRight: 8, borderWidth: 1, borderColor: colors.gray[300]
    },
    unitChipSelected: {
        backgroundColor: colors.primary, borderColor: colors.primary
    },
    unitChipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700] }
});
