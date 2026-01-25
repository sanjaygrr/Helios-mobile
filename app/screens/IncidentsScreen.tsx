import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../theme/colors';

import ModalSelector from '../components/ModalSelector';
import PersonnelForm, { SectionMember } from '../components/PersonnelForm';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LocationPicker from '../components/LocationPicker';


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
    const [editingIncidentId, setEditingIncidentId] = useState<number | null>(null);
    const [newIncident, setNewIncident] = useState({
        title: '',
        description: '',
        incident_type: 'OTRO',
        latitude: 0,
        longitude: 0,
        commander: null as number | null,
    });
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);

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
    const [availableChiefs, setAvailableChiefs] = useState<any[]>([]);
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

    const [addressQuery, setAddressQuery] = useState('');
    const [isGeocoding, setIsGeocoding] = useState(false);

    const handleOpenModal = async () => {
        setModalVisible(true);
        setEditingIncidentId(null);
        setLoadingLocation(true);
        setLoadingUnits(true);
        setAddressQuery('');

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

        // Fetch Chiefs for commander selection
        try {
            const chiefsRes = await api.get('/users/', { params: { role: 'COMPANY_CHIEF' } });
            setAvailableChiefs(chiefsRes.data);
        } catch (e) { console.log("Error loading chiefs", e); }

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

            // Reverse Geocode defaults
            try {
                const addresses = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
                if (addresses.length > 0) {
                    const addr = addresses[0];
                    const addrStr = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}`.trim();
                    setAddressQuery(addrStr);
                }
            } catch (ignore) { }

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo obtener la ubicación.');
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleGeocode = async () => {
        if (!addressQuery) return;
        setIsGeocoding(true);
        try {
            const results = await Location.geocodeAsync(addressQuery);
            if (results.length > 0) {
                const { latitude, longitude } = results[0];
                setNewIncident(prev => ({ ...prev, latitude, longitude }));
                Alert.alert("Ubicación Encontrada", `Coordenadas actualizadas a: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            } else {
                Alert.alert("No encontrado", "No se encontró la dirección.");
            }
        } catch (error) {
            Alert.alert("Error", "Falló la búsqueda de dirección.");
        } finally {
            setIsGeocoding(false);
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

            let incidentId: number;
            if (editingIncidentId) {
                const res = await api.patch(`/incidents/${editingIncidentId}/`, {
                    ...newIncident,
                    description: finalDescription,
                });
                incidentId = res.data.id;
            } else {
                const res = await api.post('/incidents/', {
                    ...newIncident,
                    description: finalDescription,
                    vehicle: selectedVehicle?.id || undefined,
                });
                incidentId = res.data.id;
            }

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
            setNewIncident({ title: '', description: '', incident_type: 'OTRO', latitude: 0, longitude: 0, commander: null });
            setPersonnelList([]);
            setSelectedInitialUnit(null);
            setSelectedVehicle(null);
            setEditingIncidentId(null);

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

                    {/* Action Buttons Grid */}
                    <View style={styles.actionsContainer}>
                        {/* Dispatch (Admin/Chief) */}
                        {(role === 'SUPER_ADMIN' || role === 'COMPANY_CHIEF') && item.is_active && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.gray[100] }]}
                                onPress={() => openDispatchModal(item)}
                            >
                                <Ionicons name="megaphone" size={18} color={colors.primary} />
                                <Text style={styles.actionBtnText}>Despachar</Text>
                            </TouchableOpacity>
                        )}

                        {/* Take Command (Chief only, if empty) */}
                        {(role === 'COMPANY_CHIEF' || role === 'SUPER_ADMIN') && !item.commander && item.is_active && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
                                onPress={() => handleTakeCommand(item.id)}
                            >
                                <Ionicons name="flag" size={18} color="white" />
                                <Text style={[styles.actionBtnText, { color: 'white' }]}>Tomar Mando</Text>
                            </TouchableOpacity>
                        )}

                        {/* Close Incident (Commander only) */}
                        {isMyCommand && item.is_active && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                                onPress={() => handleCloseIncident(item.id)}
                            >
                                <Ionicons name="stop-circle" size={18} color="white" />
                                <Text style={[styles.actionBtnText, { color: 'white' }]}>Finalizar</Text>
                            </TouchableOpacity>
                        )}

                        {/* Edit/Delete (Chief/Admin) */}
                        {(role === 'COMPANY_CHIEF' || role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN') && (
                            <>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: colors.gray[200] }]}
                                    onPress={() => openEditIncident(item)}
                                >
                                    <Ionicons name="pencil" size={18} color={colors.text} />
                                    {/* Hide text on small screens if needed, but keeping for now */}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]}
                                    onPress={() => handleDeleteIncident(item.id)}
                                >
                                    <Ionicons name="trash" size={18} color={colors.danger} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.statusBadge}>
                    <View style={[styles.dot, { backgroundColor: item.is_active ? colors.success : colors.gray[400] }]} />
                </View>
            </View>
        );
    };

    const openEditIncident = (incident: any) => {
        setNewIncident({
            title: incident.title,
            description: incident.description || '',
            incident_type: incident.incident_type || 'OTRO',
            latitude: incident.latitude,
            longitude: incident.longitude,
            commander: incident.commander || null,
        });
        setSelectedVehicle(null);
        setSelectedInitialUnit(null);
        setModalVisible(true);
        setEditingIncidentId(incident.id);
    };

    const handleDeleteIncident = async (incidentId: number) => {
        Alert.alert(
            "Eliminar Emergencia",
            "¿Estás seguro? Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/incidents/${incidentId}/`);
                            fetchIncidents();
                            Alert.alert("Eliminado", "Emergencia eliminada.");
                        } catch (error: any) {
                            Alert.alert("Error", error.response?.data?.error || "No se pudo eliminar.");
                        }
                    }
                }
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

                                    {/* Address Input */}
                                    <View style={{ marginBottom: spacing.md }}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TextInput
                                                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                                placeholder="Dirección / Referencia"
                                                value={addressQuery}
                                                onChangeText={setAddressQuery}
                                                onSubmitEditing={handleGeocode}
                                            />
                                            <TouchableOpacity
                                                style={{ backgroundColor: colors.gray[200], justifyContent: 'center', paddingHorizontal: 12, borderRadius: borderRadius.md }}
                                                onPress={handleGeocode}
                                            >
                                                {isGeocoding ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="search" size={20} color={colors.text} />}
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={{ fontSize: 10, color: colors.gray[500], marginTop: 2 }}>Ingresa dirección y presiona buscar, o ajusta en el mapa.</Text>
                                    </View>

                                    <TouchableOpacity style={[styles.selectButton, { backgroundColor: colors.secondary + '20' }]} onPress={() => setShowLocationPicker(true)}>
                                        <Text style={{ color: colors.secondary, fontWeight: '600' }}>
                                            {newIncident.latitude !== 0 ? 'Map: Ubicación Ajustada' : 'Seleccionar en Mapa'}
                                        </Text>
                                        <Ionicons name="map" size={20} color={colors.secondary} />
                                    </TouchableOpacity>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Descripción (Opcional)"
                                        value={newIncident.description}
                                        onChangeText={(t) => setNewIncident({ ...newIncident, description: t })}
                                        multiline numberOfLines={3}
                                    />
                                    <Text style={{ fontSize: 12, marginBottom: 5, color: colors.gray[500], marginTop: 10 }}>Encargado (Jefe de Compañía):</Text>
                                    {availableChiefs.length > 0 ? (
                                        <View style={{ height: 50, marginBottom: 15 }}>
                                            <FlatList
                                                horizontal
                                                data={availableChiefs}
                                                showsHorizontalScrollIndicator={false}
                                                keyExtractor={c => c.id.toString()}
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.chiefCard,
                                                            newIncident.commander === item.id && styles.chiefCardSelected
                                                        ]}
                                                        onPress={() => setNewIncident({ ...newIncident, commander: newIncident.commander === item.id ? null : item.id })}
                                                    >
                                                        <View style={{ alignItems: 'center' }}>
                                                            <View style={[styles.chiefAvatar, newIncident.commander === item.id && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                                                <Ionicons name="person" size={20} color={newIncident.commander === item.id ? 'white' : colors.primary} />
                                                            </View>
                                                            <Text
                                                                numberOfLines={1}
                                                                style={[
                                                                    styles.chiefName,
                                                                    newIncident.commander === item.id && { color: 'white' }
                                                                ]}
                                                            >
                                                                {item.first_name || item.last_name ? `${item.first_name || ''} ${item.last_name || ''}`.trim() : (item.email || '').split('@')[0]}
                                                            </Text>
                                                            <Text style={[styles.chiefRole, newIncident.commander === item.id && { color: 'rgba(255,255,255,0.8)' }]}>
                                                                Disponible
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
                                            />
                                        </View>
                                    ) : (
                                        <Text style={{ fontStyle: 'italic', color: colors.gray[400], marginBottom: 10 }}>No hay jefes disponibles</Text>
                                    )}

                                    <Text style={{ fontWeight: 'bold', marginBottom: 5, marginTop: 10, color: colors.gray[600] }}>Recursos Iniciales (Opcional):</Text>

                                    {/* Bomberos guardados */}
                                    <Text style={{ fontSize: 12, marginBottom: 5, color: colors.gray[500], marginTop: 10 }}>Bomberos Guardados:</Text>
                                    <SavedFirefighters
                                        onSelect={(f) => {
                                            const member = {
                                                firstName: f.first_name || ((f.email || '').split('@')[0]),
                                                lastName: f.last_name || '',
                                                rut: f.rut || '',
                                                role: 'Bombero',
                                                company: f.company_details?.name || ''
                                            } as SectionMember;
                                            setPersonnelList(prev => [...prev, member]);
                                        }}
                                    />

                                    {/* Formulario de nuevo bombero */}
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
                searchable={true}
            />

            <LocationPicker
                visible={showLocationPicker}
                initialLocation={{ latitude: newIncident.latitude, longitude: newIncident.longitude }}
                onClose={() => setShowLocationPicker(false)}
                onSelect={(lat, lng) => setNewIncident({ ...newIncident, latitude: lat, longitude: lng })}
            />
        </View>
    );
}

function SavedFirefighters({ onSelect }: { onSelect: (f: any) => void }) {
    const [firefighters, setFirefighters] = React.useState<any[]>([]);
    React.useEffect(() => {
        api.get('/users/', { params: { role: 'FIREFIGHTER' } })
            .then(res => setFirefighters(Array.isArray(res.data) ? res.data : []))
            .catch(() => setFirefighters([]));
    }, []);
    return (
        <View style={{ height: 50, marginBottom: 15 }}>
            <FlatList
                horizontal
                data={firefighters}
                showsHorizontalScrollIndicator={false}
                keyExtractor={u => u.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.unitChip}
                        onPress={() => onSelect(item)}
                    >
                        <Text style={styles.unitChipText}>
                            {item.first_name || item.last_name
                                ? `${item.first_name || ''} ${item.last_name || ''}`.trim()
                                : (item.email || '').split('@')[0]}
                        </Text>
                    </TouchableOpacity>
                )}
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
    unitChipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700] },

    // New Styles for Actions and Chief Cards
    actionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, gap: 6
    },
    actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },

    chiefCard: {
        width: 100, padding: 8, backgroundColor: colors.gray[100], borderRadius: 8, marginRight: 8,
        borderWidth: 1, borderColor: colors.gray[200], alignItems: 'center', justifyContent: 'center'
    },
    chiefCardSelected: {
        backgroundColor: colors.primary, borderColor: colors.primary
    },
    chiefAvatar: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray[300],
        alignItems: 'center', justifyContent: 'center', marginBottom: 6
    },
    chiefName: { fontSize: 11, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 2 },
    chiefRole: { fontSize: 10, color: colors.gray[500], textAlign: 'center' }
});
