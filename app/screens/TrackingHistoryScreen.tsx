import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Alert, Text } from 'react-native';
import { colors, spacing } from '../theme/colors';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import RouteMapWidget from '../components/RouteMapWidget';

export default function TrackingHistoryScreen() {
    const { user } = useAuth();
    const [trackingPoints, setTrackingPoints] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrackingHistory();
    }, []);

    const fetchTrackingHistory = async () => {
        try {
            // TODO: Add date filtering or user filtering if Admin
            // For now, fetch all relative to permissions
            const response = await api.get('/tracking/history/');
            // Sort by timestamp just in case
            const points = response.data.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setTrackingPoints(points);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo cargar el historial.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text>Cargando ruta...</Text>
            </View>
        );
    }

    if (trackingPoints.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <Text>No hay datos de ruta disponibles.</Text>
            </View>
        );
    }

    const coordinates = trackingPoints.map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude
    }));

    return (
        <View style={styles.container}>
            <RouteMapWidget
                routeCoordinates={coordinates}
                startCoordinate={coordinates[0]}
                endCoordinate={coordinates[coordinates.length - 1]}
                style={styles.map}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    map: { width: '100%', height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
