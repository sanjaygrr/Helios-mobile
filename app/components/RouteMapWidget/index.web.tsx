import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RouteMapWidgetProps } from './types';
import { colors } from '../../theme/colors';

// Custom Icons for Web
const startIcon = L.divIcon({
    className: 'start-marker',
    html: `<div style="color: ${colors.success}; font-size: 32px; display:flex; align-items:center; justify-content:center;">
             <i class="ion-icon" style="font-style: normal;">&#9658;</i> 
           </div>`, // Simple play triangle approximation or we can pull in ionic via font if available. 
    // For simplicity in pure HTML/JS without extra font loaders being guaranteed, let's use a colored circle with text or shape.
    // Actually, using a simple circle for now is safer.
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

const endIcon = L.divIcon({
    className: 'end-marker',
    html: `<div style="background-color: ${colors.danger}; width: 24px; height: 24px; border-radius: 4px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const startDivIcon = L.divIcon({
    className: 'start-marker',
    html: `<div style="background-color: ${colors.success}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});


function MapBoundsFitter({ coordinates }: { coordinates: { lat: number, lng: number }[] }) {
    const map = useMap();
    useEffect(() => {
        if (coordinates.length > 0) {
            const bounds = L.latLngBounds(coordinates.map(c => [c.lat, c.lng]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [coordinates, map]);
    return null;
}

export default function RouteMapWidget({
    routeCoordinates,
    startCoordinate,
    endCoordinate,
    style
}: RouteMapWidgetProps) {

    const polylinePositions = routeCoordinates.map(c => [c.latitude, c.longitude] as [number, number]);
    const center = routeCoordinates.length > 0 ? [routeCoordinates[0].latitude, routeCoordinates[0].longitude] : [0, 0];

    return (
        <View style={[styles.container, style]}>
            <MapContainer
                center={center as [number, number]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Polyline
                    positions={polylinePositions}
                    pathOptions={{ color: colors.accent, weight: 4 }}
                />

                {startCoordinate && (
                    <Marker
                        position={[startCoordinate.latitude, startCoordinate.longitude]}
                        icon={startDivIcon}
                    />
                )}

                {endCoordinate && (
                    <Marker
                        position={[endCoordinate.latitude, endCoordinate.longitude]}
                        icon={endIcon}
                    />
                )}

                <MapBoundsFitter coordinates={routeCoordinates.map(c => ({ lat: c.latitude, lng: c.longitude }))} />

            </MapContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
});
