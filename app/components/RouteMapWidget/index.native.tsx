import React from 'react';
import { StyleSheet, View, Platform, Dimensions } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { RouteMapWidgetProps } from './types';

export default function RouteMapWidget({
    routeCoordinates,
    startCoordinate,
    endCoordinate,
    style
}: RouteMapWidgetProps) {

    const initialRegion = routeCoordinates.length > 0 ? {
        latitude: routeCoordinates[0].latitude,
        longitude: routeCoordinates[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    } : undefined;

    return (
        <MapView
            style={[styles.map, style]}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
            initialRegion={initialRegion}
        >
            <Polyline
                coordinates={routeCoordinates}
                strokeColor={colors.primary}
                strokeWidth={4}
            />
            {startCoordinate && (
                <Marker coordinate={startCoordinate} title="Inicio">
                    <Ionicons name="play-circle" size={32} color={colors.success} />
                </Marker>
            )}
            {endCoordinate && (
                <Marker coordinate={endCoordinate} title="Fin">
                    <Ionicons name="stop-circle" size={32} color={colors.danger} />
                </Marker>
            )}
        </MapView>
    );
}

const styles = StyleSheet.create({
    map: { width: '100%', height: '100%' },
});
