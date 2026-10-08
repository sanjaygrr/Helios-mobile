import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import { colors, spacing , borderRadius} from '../theme/colors';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import RouteMapWidget from '../components/RouteMapWidget';
import ModalSelector from '../components/ModalSelector';

export default function TrackingHistoryScreen() {
    const { user } = useAuth();
    const [trackingPoints, setTrackingPoints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(user?.id || null);
    const [people, setPeople] = useState<{ id: number; label: string }[]>([]);
    const [showPicker, setShowPicker] = useState(false);

    useEffect(() => {
        if (selectedUserId) fetchTrackingHistory(selectedUserId);
    }, [selectedUserId]);

    useEffect(() => {
        api.get('/users/').then(response => setPeople(response.data.map((person: any) => ({
            id: person.id,
            label: `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email,
        })))).catch(() => {});
    }, []);

    const fetchTrackingHistory = async (personId: number) => {
        setLoading(true);
        try {
            const response = await api.get('/tracking/history/', { params: { user: personId } });
            const points = response.data.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setTrackingPoints(points);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo cargar el historial.');
        } finally {
            setLoading(false);
        }
    };

    const coordinates = trackingPoints.map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude
    }));

    return (
        <View style={styles.container}>
            {loading ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View> :
            coordinates.length ? <RouteMapWidget
                key={selectedUserId}
                routeCoordinates={coordinates}
                startCoordinate={coordinates[0]}
                endCoordinate={coordinates[coordinates.length - 1]}
                style={styles.map}
            /> : <View style={styles.loadingContainer}><Text>No hay datos de ruta para esta persona.</Text></View>}
            <TouchableOpacity style={styles.personButton} onPress={() => setShowPicker(true)}>
                <Text style={styles.personButtonText}>{people.find(person => person.id === selectedUserId)?.label || user?.email || 'Seleccionar persona'} ▾</Text>
            </TouchableOpacity>
            <ModalSelector visible={showPicker} title="Historial de persona" searchable options={people} onClose={() => setShowPicker(false)} onSelect={option => setSelectedUserId(Number(option.id))} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    map: { width: '100%', height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    personButton: { position: 'absolute', top: 16, left: 16, right: 16, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 14 },
    personButtonText: { color: colors.text, fontWeight: '700' },
});
