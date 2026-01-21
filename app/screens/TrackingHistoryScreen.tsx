import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Alert, Text } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

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

    const initialRegion = {
        latitude: trackingPoints[0].latitude,
        longitude: trackingPoints[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    };

    const coordinates = trackingPoints.map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude
    }));

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={initialRegion}
            >
                <Polyline
                    coordinates={coordinates}
                    strokeColor={colors.primary}
                    strokeWidth={4}
                />
                <Marker coordinate={coordinates[0]} title="Inicio">
                    <Ionicons name="play-circle" size={32} color={colors.success} />
                </Marker>
                <Marker coordinate={coordinates[coordinates.length - 1]} title="Fin">
                    <Ionicons name="stop-circle" size={32} color={colors.danger} />
                </Marker>
            </MapView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
