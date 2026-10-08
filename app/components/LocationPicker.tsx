import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/colors';
import MapWidget from './MapWidget';
import { MapWidgetHandle } from './MapWidget/types';
import * as Location from 'expo-location';

interface LocationPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (lat: number, lng: number) => void;
    initialLocation?: { latitude: number; longitude: number };
}

export default function LocationPicker({ visible, onClose, onSelect, initialLocation }: LocationPickerProps) {
    const [region, setRegion] = useState({
        latitude: -33.4489,
        longitude: -70.6693,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    });
    const mapRef = useRef<MapWidgetHandle>(null);

    useEffect(() => {
        if (visible) {
            if (initialLocation && initialLocation.latitude !== 0) {
                setRegion({
                    latitude: initialLocation.latitude,
                    longitude: initialLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01
                });
            } else {
                // Get current loc
                Location.getCurrentPositionAsync().then(loc => {
                    setRegion({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01
                    });
                }).catch(() => { });
            }
        }
    }, [visible, initialLocation]);

    const handleConfirm = () => {
        onSelect(region.latitude, region.longitude);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide">
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Seleccionar Ubicación</Text>
                    <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
                        <Text style={styles.confirmText}>Confirmar</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.mapContainer}>
                    <MapWidget
                        ref={mapRef}
                        currentLocation={region}
                        selfUser={null}
                        otherUsers={[]}
                        fires={[]}
                        showFires={false}
                        onSelectMarker={() => { }}
                        onMapPress={() => { }}
                        // We use onRegionChange to update the center reticle position logically
                        onRegionChange={(r) => setRegion(r)}
                        style={{ flex: 1 }}
                    />

                    {/* Fixed Center Marker Reticle */}
                    <View style={styles.reticleContainer} pointerEvents="none">
                        <Ionicons name="location" size={40} color={colors.danger} style={{ marginBottom: 20 }} />
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.coordText}>{region.latitude.toFixed(5)}, {region.longitude.toFixed(5)}</Text>
                    <Text style={styles.hintText}>Mueve el mapa para posicionar el marcador</Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 50, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
        backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.gray[100]
    },
    title: { fontSize: 18, fontWeight: 'bold' },
    closeButton: { padding: spacing.sm },
    confirmButton: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: borderRadius.md },
    confirmText: { color: colors.textOnPrimary, fontWeight: '600' },
    mapContainer: { flex: 1, position: 'relative' },
    reticleContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 10
    },
    footer: { padding: spacing.lg, alignItems: 'center', backgroundColor: colors.surface },
    coordText: { fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace' },
    hintText: { fontSize: 12, color: colors.gray[500], marginTop: 4 }
});
