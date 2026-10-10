import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../theme/colors';

import ModalSelector from '../components/ModalSelector';
import PersonnelForm, { SectionMember } from '../components/PersonnelForm';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api, { asList } from '../services/api';
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
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user, role } = useAuth();
    const [incidents, setIncidents] = useState<any[]>([]);

    // Incident Creation State
    const [isModalVisible, setModalVisible] = useState(false);
    const [editingIncidentId, setEditingIncidentId] = useState<number | null>(null);
    const [newIncident, setNewIncident] = useState({
        title: '',
        dispatch_code: '',
        description: '',
        requested_units: '1',
        incident_type: 'OTRO',
        latitude: 0,
        longitude: 0,
        commander: null as number | null,
        fire_department: user?.fire_department || null as number | null,
    });
    const [departments, setDepartments] = useState<{ id: number; label: string }[]>([]);
    const [companyDepartments, setCompanyDepartments] = useState<Record<number, number>>({});
    const [showDepartmentSelector, setShowDepartmentSelector] = useState(false);
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
            setIncidents(asList(response.data));
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
            setAvailableUnits(asList(res.data));
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
        setNewIncident({ title: '', dispatch_code: '', description: '', requested_units: '1', incident_type: 'OTRO', latitude: 0, longitude: 0, commander: null, fire_department: user?.fire_department || null });
        setModalVisible(true);
        setEditingIncidentId(null);
        setLoadingLocation(true);
        setLoadingUnits(true);
        setAddressQuery('');
        if (role === 'SUPER_ADMIN') {
            api.get('/departments/').then(res => setDepartments(asList(res.data).map((item: any) => ({ id: item.id, label: item.name })))).catch(() => {});
            api.get('/companies/').then(res => setCompanyDepartments(Object.fromEntries(asList(res.data).map((item: any) => [item.id, item.fire_department])))).catch(() => {});
        }

        // Fetch Units for initial dispatch
        try {
            const res = await api.get('/units/available/');
            const lista = asList(res.data);
            setAvailableUnits(lista);

            // Pre-select chief's unit if they are a chief
            if (role === 'COMPANY_CHIEF') {
                const userUnit = lista.find((unit: any) => unit.assigned_to === user?.id);
                if (userUnit) {
                    setSelectedInitialUnit(userUnit);
                }
            }
        } catch (e) { console.log("Error loading units", e); }

        try {
            const vehiclesRes = await api.get('/units/');
            setAvailableVehicles(asList(vehiclesRes.data));
        } catch (e) { console.log("Error loading vehicles", e); }

        try {
            const chiefsRes = await api.get('/users/', { params: { role: 'COMPANY_CHIEF' } });
            setAvailableChiefs(asList(chiefsRes.data));
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

    useEffect(() => {
        if (!route.params?.crear) return;
        handleOpenModal();
        navigation.setParams({ crear: false });
    }, [route.params?.crear]);

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
        if (role === 'SUPER_ADMIN' && !newIncident.fire_department) {
            Alert.alert('Error', 'Selecciona el cuerpo de bomberos antes de reportar.');
            return;
        }
        const requestedUnits = Number.parseInt(newIncident.requested_units, 10);
        if (!newIncident.title.trim() || !newIncident.dispatch_code.trim() || !newIncident.latitude) {
            Alert.alert('Error', 'Completa el título, la clave 10 y verifica la ubicación.');
            return;
        }
        if (!Number.isInteger(requestedUnits) || requestedUnits < 1 || requestedUnits > 50) {
            Alert.alert('Error', 'La cantidad de carros debe estar entre 1 y 50.');
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
                    dispatch_code: newIncident.dispatch_code.trim(),
                    requested_units: requestedUnits,
                    description: finalDescription,
                });
                incidentId = res.data.id;
            } else {
                const res = await api.post('/incidents/', {
                    ...newIncident,
                    dispatch_code: newIncident.dispatch_code.trim(),
                    requested_units: requestedUnits,
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
            if ((role === 'COMPANY_CHIEF' || role === 'SUPER_ADMIN') && !newIncident.commander) {
                await api.post(`/incidents/${incidentId}/take_command/`);
            }

            setModalVisible(false);
            fetchIncidents();
            // Reset
            setNewIncident({ title: '', dispatch_code: '', description: '', requested_units: '1', incident_type: 'OTRO', latitude: 0, longitude: 0, commander: null, fire_department: user?.fire_department || null });
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
        const isMyCommand = item.commander === user?.id;
        const incidentColor = getIncidentColor(item.incident_type);
        const reportedDate = new Date(item.reported_at);
        const timeString = reportedDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        const dateString = reportedDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });

        return (
            <View style={styles.card}>
                {/* Header con tipo y estado */}
                <View style={styles.cardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: incidentColor + '20' }]}>
                        <View style={[styles.typeIconBox, { backgroundColor: incidentColor }]}>
                            <Ionicons
                                name={item.incident_type === 'FORESTAL' ? 'leaf' :
                                      item.incident_type === 'ESTRUCTURAL' ? 'business' :
                                      item.incident_type === 'RESCATE' ? 'people' :
                                      item.incident_type === 'HAZMAT' ? 'warning' : 'flame'}
                                size={18}
                                color={colors.white}
                            />
                        </View>
                        <Text style={[styles.typeText, { color: incidentColor }]}>{item.incident_type}</Text>
                    </View>
                    <View style={[styles.statusIndicator, { backgroundColor: item.is_active ? colors.success + '20' : colors.gray[200] }]}>
                        <View style={[styles.statusDot, { backgroundColor: item.is_active ? colors.success : colors.gray[400] }]} />
                        <Text style={[styles.statusLabel, { color: item.is_active ? colors.success : colors.gray[500] }]}>
                            {item.is_active ? 'Activa' : 'Cerrada'}
                        </Text>
                    </View>
                </View>

                {/* Título y descripción */}
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>
                    Clave {item.dispatch_code || 'sin definir'} · {item.requested_units || 1} {Number(item.requested_units || 1) === 1 ? 'carro' : 'carros'}
                </Text>
                {item.description ? (
                    <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
                ) : null}

                {/* Info row */}
                <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                        <Ionicons name="time-outline" size={18} color={colors.gray[500]} />
                        <Text style={styles.infoText}>{timeString} • {dateString}</Text>
                    </View>
                    {item.commander_name ? (
                        <View style={styles.infoItem}>
                            <Ionicons name="person" size={18} color={colors.primary} />
                            <Text style={[styles.infoText, { color: colors.accent, fontWeight: '600' }]}>{item.commander_name}</Text>
                        </View>
                    ) : (
                        <View style={[styles.commanderBadge, { backgroundColor: colors.warning + '20' }]}>
                            <Ionicons name="alert-circle" size={12} color={colors.warning} />
                            <Text style={{ fontSize: 11, color: colors.warning, fontWeight: '600' }}>Sin Comandante</Text>
                        </View>
                    )}
                </View>

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                    {(role === 'SUPER_ADMIN' || role === 'COMPANY_CHIEF') && item.is_active && (
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnOutline]}
                            onPress={() => navigation.navigate('Despacho', { incidentId: item.id })}
                        >
                            <Ionicons name="send" size={18} color={colors.accent} />
                            <Text style={[styles.actionBtnText, { color: colors.accent }]}>Despachar</Text>
                        </TouchableOpacity>
                    )}

                    {item.is_active && (
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnOutline]}
                            onPress={() => navigation.navigate('EmergenciaViva', { incidentId: item.id })}
                        >
                            <Ionicons name="pulse" size={18} color={colors.accent} />
                            <Text style={[styles.actionBtnText, { color: colors.accent }]}>En vivo</Text>
                        </TouchableOpacity>
                    )}

                    {(role === 'COMPANY_CHIEF' || role === 'SUPER_ADMIN') && !item.commander && item.is_active && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.surfaceRaised }]}
                            onPress={() => handleTakeCommand(item.id)}
                        >
                            <Ionicons name="flag" size={18} color="white" />
                            <Text style={[styles.actionBtnText, { color: colors.white }]}>Tomar Mando</Text>
                        </TouchableOpacity>
                    )}

                    {isMyCommand && item.is_active && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                            onPress={() => handleCloseIncident(item.id)}
                        >
                            <Ionicons name="checkmark-done" size={18} color="white" />
                            <Text style={[styles.actionBtnText, { color: colors.white }]}>Finalizar</Text>
                        </TouchableOpacity>
                    )}

                    <View style={{ flex: 1 }} />

                    {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN' || isMyCommand || (role === 'COMPANY_CHIEF' && !item.commander)) && (
                        <View style={styles.iconActions}>
                            <TouchableOpacity
                                style={styles.iconBtn}
                                onPress={() => openEditIncident(item)}
                            >
                                <Ionicons name="create-outline" size={20} color={colors.gray[600]} />
                            </TouchableOpacity>
                            {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN') && <TouchableOpacity
                                style={styles.iconBtn}
                                onPress={() => handleDeleteIncident(item.id)}
                            >
                                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                            </TouchableOpacity>}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const openEditIncident = (incident: any) => {
        setNewIncident({
            title: incident.title,
            dispatch_code: incident.dispatch_code || '',
            description: incident.description || '',
            requested_units: String(incident.requested_units || 1),
            incident_type: incident.incident_type || 'OTRO',
            latitude: incident.latitude,
            longitude: incident.longitude,
            commander: incident.commander || null,
            fire_department: incident.fire_department || null,
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
            <TouchableOpacity style={styles.crearBarra} onPress={handleOpenModal}>
                <Ionicons name="add" size={22} color={colors.white} />
                <Text style={styles.crearBarraTexto}>Crear emergencia</Text>
            </TouchableOpacity>
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
                                    <Text style={{ color: colors.text, fontSize: 16, marginTop: 8 }}>Obteniendo ubicación...</Text>
                                </View>
                            ) : (
                                <>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Título (ej: Incendio en Sector 5)"
                                        placeholderTextColor={colors.textMuted}
                                        value={newIncident.title}
                                        onChangeText={(t) => setNewIncident({ ...newIncident, title: t })}
                                    />
                                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>Clave 10</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Ej: 10-0"
                                                placeholderTextColor={colors.textMuted}
                                                value={newIncident.dispatch_code}
                                                onChangeText={(t) => setNewIncident({ ...newIncident, dispatch_code: t })}
                                                autoCapitalize="characters"
                                            />
                                        </View>
                                        <View style={{ width: 120 }}>
                                            <Text style={styles.fieldLabel}>Carros</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="1"
                                                placeholderTextColor={colors.textMuted}
                                                value={newIncident.requested_units}
                                                onChangeText={(t) => setNewIncident({ ...newIncident, requested_units: t.replace(/[^0-9]/g, '') })}
                                                keyboardType="number-pad"
                                                maxLength={2}
                                            />
                                        </View>
                                    </View>
                                    {role === 'SUPER_ADMIN' && !editingIncidentId && <TouchableOpacity style={styles.selectButton} onPress={() => setShowDepartmentSelector(true)}>
                                        <Text style={styles.selectText}>{departments.find(item => item.id === newIncident.fire_department)?.label || 'Seleccionar cuerpo de bomberos'}</Text>
                                        <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
                                    </TouchableOpacity>}
                                    <TouchableOpacity style={styles.selectButton} onPress={() => setShowTypeSelector(true)}>
                                        <Text style={styles.selectText}>{getTypeLabel()}</Text>
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
                                                placeholderTextColor={colors.textMuted}
                        />
                                            <TouchableOpacity
                                                style={{ backgroundColor: colors.gray[200], justifyContent: 'center', paddingHorizontal: 12, borderRadius: borderRadius.md }}
                                                onPress={handleGeocode}
                                            >
                                                {isGeocoding ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="search" size={20} color={colors.text} />}
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>Ingresa dirección y presiona buscar, o ajusta en el mapa.</Text>
                                    </View>

                                    <TouchableOpacity style={[styles.selectButton, { backgroundColor: colors.secondary + '20' }]} onPress={() => setShowLocationPicker(true)}>
                                        <Text style={{ color: colors.secondary, fontWeight: '600' }}>
                                            {newIncident.latitude !== 0 ? 'Map: Ubicación Ajustada' : 'Seleccionar en Mapa'}
                                        </Text>
                                        <Ionicons name="map" size={20} color={colors.secondary} />
                                    </TouchableOpacity>
                                    <Text style={styles.fieldLabel}>Descripción del llamado</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Qué ocurre, riesgos, personas afectadas y referencias"
                                        placeholderTextColor={colors.textMuted}
                                        value={newIncident.description}
                                        onChangeText={(t) => setNewIncident({ ...newIncident, description: t })}
                                        multiline numberOfLines={3}
                                    />
                                    <Text style={{ fontSize: 12, marginBottom: 5, color: colors.textMuted, marginTop: 10 }}>Encargado (Jefe de Compañía):</Text>
                                    {availableChiefs.length > 0 ? (
                                        <View style={{ height: 50, marginBottom: 15 }}>
                                            <FlatList
                                                horizontal
                                                data={availableChiefs.filter(item => role !== 'SUPER_ADMIN' || item.fire_department === newIncident.fire_department)}
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
                                                            <View style={[styles.chiefAvatar, newIncident.commander === item.id && { backgroundColor: colors.pressOverlay }]}>
                                                                <Ionicons name="person" size={20} color={newIncident.commander === item.id ? 'white' : colors.primary} />
                                                            </View>
                                                            <Text
                                                                numberOfLines={1}
                                                                style={[
                                                                    styles.chiefName,
                                                                    newIncident.commander === item.id && { color: colors.white }
                                                                ]}
                                                            >
                                                                {item.first_name || item.last_name ? `${item.first_name || ''} ${item.last_name || ''}`.trim() : (item.email || '').split('@')[0]}
                                                            </Text>
                                                            <Text style={[styles.chiefRole, newIncident.commander === item.id && { color: colors.textMuted }]}>
                                                                Disponible
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
                                            />
                                        </View>
                                    ) : (
                                        <Text style={{ fontStyle: 'italic', color: colors.textMuted, marginBottom: 10 }}>No hay jefes disponibles</Text>
                                    )}

                                    <Text style={{ fontWeight: 'bold', marginBottom: 5, marginTop: 10, color: colors.gray[600] }}>Recursos Iniciales (Opcional):</Text>

                                    {/* Bomberos guardados */}
                                    <Text style={{ fontSize: 12, marginBottom: 5, color: colors.textMuted, marginTop: 10 }}>Bomberos Guardados:</Text>
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

                                    <Text style={{ fontSize: 12, marginBottom: 5, color: colors.textMuted, marginTop: 15 }}>Unidad a Utilizar (Despacho inmediato):</Text>
                                    {availableUnits.length > 0 ? (
                                        <View style={{ height: 50, marginBottom: 15 }}>
                                            <FlatList
                                                horizontal
                                                data={availableUnits.filter(item => role !== 'SUPER_ADMIN' || companyDepartments[item.company] === newIncident.fire_department)}
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
                                                            selectedInitialUnit?.id === item.id && { color: colors.white }
                                                        ]}>{item.name}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            />
                                        </View>
                                    ) : (
                                        <Text style={{ fontStyle: 'italic', color: colors.textMuted, marginBottom: 10 }}>No hay unidades disponibles</Text>
                                    )}

                                    {/* Vehicle Selector - Only show if NO Unit is selected, to avoid confusion/duplication */}
                                    {!selectedInitialUnit && (
                                        <>
                                            <Text style={{ fontSize: 12, marginBottom: 5, marginTop: 15, color: colors.textMuted }}>Vehículo a Utilizar (Opcional):</Text>
                                            {availableVehicles.length > 0 ? (
                                                <View style={{ height: 50, marginBottom: 15 }}>
                                                    <FlatList
                                                        horizontal
                                                        data={availableVehicles.filter(item => role !== 'SUPER_ADMIN' || companyDepartments[item.company] === newIncident.fire_department)}
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
                                                                    selectedVehicle?.id === item.id && { color: colors.white }
                                                                ]}>{item.name}</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    />
                                                </View>
                                            ) : (
                                                <Text style={{ fontStyle: 'italic', color: colors.textMuted, marginBottom: 10 }}>No hay vehículos disponibles</Text>
                                            )}
                                        </>
                                    )}


                                    <Text style={styles.locationText}>
                                        Ubicación: {newIncident.latitude.toFixed(5)}, {newIncident.longitude.toFixed(5)}
                                    </Text>
                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                                            <Text style={styles.cancelText}>Cancelar</Text>
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
                                    <Text style={{ fontStyle: 'italic', marginBottom: 20, color: colors.text, fontSize: 16 }}>No hay unidades disponibles.</Text>
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
                                                        <Text style={[styles.unitItemText, selectedUnit?.id === item.id && { color: colors.white }]}>
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
                                        <Text style={styles.cancelText}>Cancelar</Text>
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
            <ModalSelector
                visible={showDepartmentSelector}
                title="Cuerpo de bomberos"
                options={departments}
                onClose={() => setShowDepartmentSelector(false)}
                onSelect={option => {
                    setNewIncident({ ...newIncident, fire_department: Number(option.id), commander: null });
                    setSelectedInitialUnit(null);
                    setSelectedVehicle(null);
                }}
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

    // Card styles mejorados
    card: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
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
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        paddingLeft: 4,
        borderRadius: borderRadius.lg,
        gap: 6,
    },
    typeIconBox: {
        width: 28,
        height: 28,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: borderRadius.md,
        gap: 5,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: borderRadius.sm,
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 18,
        marginBottom: spacing.sm,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    infoText: {
        fontSize: 12,
        color: colors.textMuted,
    },
    commanderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: borderRadius.md,
        gap: 4,
    },
    cardDivider: {
        height: 1,
        backgroundColor: colors.gray[100],
        marginVertical: spacing.md,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: borderRadius.sm,
        gap: 6,
    },
    actionBtnOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.accent,
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    iconActions: {
        flexDirection: 'row',
        gap: 4,
    },
    iconBtn: {
        padding: 8,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.gray[50],
    },

    // Legacy styles
    iconBox: { width: 40, height: 40, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 16, fontWeight: 'bold' },
    subtitle: { fontSize: 12, color: colors.gray[600] },
    desc: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
    statusBadge: { padding: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: borderRadius.sm },
    emptyText: { textAlign: 'center', marginTop: spacing.xl, color: colors.textMuted },
    crearBarra: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        margin: spacing.md, minHeight: 56, borderRadius: borderRadius.md,
        backgroundColor: colors.primary,
    },
    crearBarraTexto: { color: colors.white, fontSize: 18, fontWeight: '700' },
    fab: {
        position: 'absolute', bottom: spacing.xl, right: spacing.md, width: 60, height: 60, borderRadius: borderRadius.full,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8
    },
    modalOverlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: spacing.xl,
        paddingTop: spacing.lg,
        maxHeight: '90%',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: spacing.xs,
        textAlign: 'center',
        color: colors.text,
    },
    modalSubtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg, textAlign: 'center' },
    fieldLabel: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: '#24303A',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        fontSize: 18,
        borderWidth: 1,
        borderColor: '#6B7380', color: colors.text,},
    textArea: { height: 100, textAlignVertical: 'top' },
    loadingContainer: { alignItems: 'center', padding: spacing.xl },
    locationText: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: spacing.md,
        textAlign: 'center',
        backgroundColor: colors.gray[50],
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginTop: 20 },
    cancelButton: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.gray[100],
        alignItems: 'center',
    },
    createButton: {
        flex: 2,
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    createButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    selectButton: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#24303A', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md,
        borderWidth: 1, borderColor: '#6B7380'
    },
    selectText: { color: colors.text, fontSize: 18, flex: 1 },
    cancelText: { color: colors.text, fontSize: 16, fontWeight: '700' },
    dispatchButtonSmall: {
        flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
        paddingVertical: 4, paddingHorizontal: 8,
        backgroundColor: colors.gray[100], borderRadius: borderRadius.sm, alignSelf: 'flex-start'
    },
    dispatchButtonText: { fontSize: 12, fontWeight: '600', color: colors.accent },
    unitItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 14, borderRadius: borderRadius.md, backgroundColor: colors.gray[50], marginBottom: 8,
        borderWidth: 1.5, borderColor: colors.gray[200]
    },
    unitItemSelected: {
        backgroundColor: colors.primary, borderColor: colors.accent
    },
    unitItemText: { fontWeight: '600', color: colors.text },
    unitChip: {
        paddingVertical: 10, paddingHorizontal: 16, borderRadius: borderRadius.full,
        backgroundColor: '#24303A', marginRight: 8, borderWidth: 1.5, borderColor: '#6B7380'
    },
    unitChipSelected: {
        backgroundColor: colors.primary, borderColor: colors.accent
    },
    unitChipText: { fontSize: 16, fontWeight: '700', color: colors.text },

    // Chief Cards mejorados
    chiefCard: {
        width: 90, padding: 10, backgroundColor: colors.gray[50], borderRadius: borderRadius.md, marginRight: 10,
        borderWidth: 1.5, borderColor: colors.gray[200], alignItems: 'center', justifyContent: 'center'
    },
    chiefCardSelected: {
        backgroundColor: colors.primary, borderColor: colors.accent
    },
    chiefAvatar: {
        width: 44, height: 44, borderRadius: borderRadius.full, backgroundColor: colors.gray[200],
        alignItems: 'center', justifyContent: 'center', marginBottom: 8
    },
    chiefName: { fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 2 },
    chiefRole: { fontSize: 10, color: colors.textMuted, textAlign: 'center' }
});
