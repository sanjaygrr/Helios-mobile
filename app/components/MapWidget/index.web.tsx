import React, { useMemo, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapWidgetProps, MapWidgetHandle } from './types';
import { colors } from '../../theme/colors';

// --- Styles for DivIcons ---
const PRIMARY_COLOR = colors.primary;
const SECONDARY_COLOR = colors.secondary;

const createMarkerIcon = (color: string, size: number, border: string = 'white', isSelf: boolean = false) => {
    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${isSelf ? '3px' : '2px'} solid ${border};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
      </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

const getFireColor = (brightness: number): string => {
    if (brightness < 320) return '#00FF00';
    if (brightness < 340) return '#FFFF00';
    if (brightness < 360) return '#FFA500';
    return '#FF0000';
};

// Internal Controller to access map instance
const MapController = forwardRef<MapWidgetHandle, any>((_, ref) => {
    const map = useMap();

    React.useEffect(() => {
        // Inject Leaflet CSS if not already present
        const linkId = 'leaflet-css';
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        // Force map invalidation after a short delay to ensure rendering
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);

    useImperativeHandle(ref, () => ({
        animateToRegion: (region, duration) => { // duration ignored for now or used in options
            const southWest = L.latLng(
                region.latitude - region.latitudeDelta / 2,
                region.longitude - region.longitudeDelta / 2
            );
            const northEast = L.latLng(
                region.latitude + region.latitudeDelta / 2,
                region.longitude + region.longitudeDelta / 2
            );
            map.flyToBounds(L.latLngBounds(southWest, northEast), { duration: duration ? duration / 1000 : 1 });
        }
    }));
    return null;
});

const MapWidget = forwardRef<MapWidgetHandle, MapWidgetProps>(({
    style,
    currentLocation,
    selfUser,
    otherUsers,
    fires,
    showFires,
    onSelectMarker,
    onMapPress,
    onRegionChange
}, ref) => {

    const selfIcon = useMemo(() => createMarkerIcon(PRIMARY_COLOR, 20, 'white', true), []);
    const userIcon = useMemo(() => createMarkerIcon(SECONDARY_COLOR, 16, 'white', false), []);

    // Note: we set initial center but allow map to move.
    // Reactive updates to center (forcing map to move on prop change) are avoided unless we add logic.
    // The animateToRegion handle covers the "Recenter" use case.

    return (
        <View style={[styles.container, style]}>
            <MapContainer
                center={[currentLocation.latitude, currentLocation.longitude]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
            >
                <MapController ref={ref} />

                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Helper to capture map clicks if strictly needed, but Leaflet markers handle their own clicks well */}

                {/* Self Marker */}
                <Marker
                    position={[currentLocation.latitude, currentLocation.longitude]}
                    icon={selfIcon}
                    eventHandlers={{
                        click: () => onSelectMarker({ ...selfUser, ...currentLocation, isSelf: true })
                    }}
                />

                {/* Other Users */}
                {otherUsers.map((u) => (
                    <Marker
                        key={`user-${u.id}`}
                        position={[u.latitude, u.longitude]}
                        icon={userIcon}
                        eventHandlers={{
                            click: () => onSelectMarker(u)
                        }}
                    />
                ))}

                {/* Fires */}
                {showFires && fires.map((fire, index) => (
                    <Marker
                        key={`fire-${index}-${fire.latitude}`}
                        position={[fire.latitude, fire.longitude]}
                        icon={L.divIcon({
                            className: 'fire-marker',
                            html: `<div style="background-color: ${getFireColor(fire.brightness)}; width: 10px; height: 10px; border-radius: 50%; border: 1px solid white;"></div>`,
                            iconSize: [10, 10],
                            iconAnchor: [5, 5]
                        })}
                        eventHandlers={{
                            click: () => onSelectMarker(fire)
                        }}
                    />
                ))}

            </MapContainer>
        </View>
    );
});

export default MapWidget;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
});
