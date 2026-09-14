import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { StyleSheet, View, Platform, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadows } from '../../theme/colors';
import { MapWidgetProps, FirePoint, MapWidgetHandle } from './types';

// --- Sub-components (Copied from MapScreen for encapsulation) ---

const FireMarker = React.memo(({ fire, color }: { fire: FirePoint; color: string }) => {
    const [tracksViewChanges, setTracksViewChanges] = useState(true);

    useEffect(() => {
        if (tracksViewChanges) {
            const timer = setTimeout(() => {
                setTracksViewChanges(false);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [tracksViewChanges]);

    return (
        <Marker
            coordinate={{ latitude: fire.latitude, longitude: fire.longitude }}
            zIndex={1}
            tracksViewChanges={tracksViewChanges}
        >
            <Ionicons name="flame" size={24} color={color} />
        </Marker>
    );
});

const markerColors = ['#2563EB', '#7C3AED', '#0891B2', '#BE185D', '#B45309', '#047857'];

const UserMarker = ({ coordinate, role, person, isSelf = false, onPress }: any) => {
    const [tracksViewChanges, setTracksViewChanges] = React.useState(false);

    React.useEffect(() => { }, []);

    const getIcon = () => {
        if (role === 'COMPANY_CHIEF') {
            return <MaterialCommunityIcons name="fire-truck" size={isSelf ? 32 : 28} color={colors.white} />;
        }
        if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') {
            return <MaterialCommunityIcons name="hard-hat" size={isSelf ? 32 : 28} color={colors.white} />;
        }
        return <MaterialCommunityIcons name="account-hard-hat" size={isSelf ? 32 : 28} color={colors.white} />;
    };

    return (
        <Marker
            coordinate={coordinate}
            zIndex={isSelf ? 999 : 990}
            tracksViewChanges={tracksViewChanges}
            onPress={onPress}
            anchor={{ x: 0.5, y: 0.5 }}
        >
            <View style={[isSelf ? styles.myLocationMarker : styles.otherUserMarker, !isSelf && { backgroundColor: markerColors[Math.abs(Number(person?.id) || 0) % markerColors.length] }]}>
                {getIcon()}
            </View>
            {!isSelf && <Text style={styles.markerName} numberOfLines={1}>
                {person?.user_first_name || person?.email?.split('@')[0] || `#${person?.id}`}
                {person?.device_id ? ` · ${person.device_id.slice(0, 4)}` : ''}
            </Text>}
        </Marker>
    );
};

// --- Helpers ---

const getFireColor = (brightness: number): string => {
    if (brightness < 320) return '#00FF00';
    if (brightness < 340) return '#FFFF00';
    if (brightness < 360) return '#FFA500';
    return '#FF0000';
};

// --- Main Component ---

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
    const mapRef = useRef<MapView>(null);

    useImperativeHandle(ref, () => ({
        animateToRegion: (region, duration) => {
            mapRef.current?.animateToRegion(region, duration);
        }
    }));

    return (
        <MapView
            ref={mapRef}
            style={[styles.map, style]}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
            initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
            }}
            showsUserLocation={false}
            showsCompass={true}
            mapType="hybrid"
            onPress={onMapPress}
            onRegionChangeComplete={onRegionChange}
        >
            {/* Self Marker */}
            {selfUser && <UserMarker
                key="self-marker"
                coordinate={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                }}
                role={selfUser?.role}
                person={selfUser}
                isSelf={true}
                onPress={() => onSelectMarker({ ...selfUser, ...currentLocation, isSelf: true })}
            />}

            {/* Other Users */}
            {otherUsers.map((u) => (
                <UserMarker
                    key={`user-${u.id}-${u.device_id || 'legacy'}`}
                    coordinate={{ latitude: u.latitude, longitude: u.longitude }}
                    role={u.role}
                    person={u}
                    isSelf={false}
                    onPress={() => onSelectMarker(u)}
                />
            ))}

            {/* Fires */}
            {showFires && fires.map((fire, index) => (
                <FireMarker
                    key={`fire-${index}-${fire.latitude}`}
                    fire={fire}
                    color={getFireColor(fire.brightness)}
                />
            ))}
        </MapView>
    );
});

export default MapWidget;

const styles = StyleSheet.create({
    map: {
        flex: 1,
    },
    myLocationMarker: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.primary,
        borderWidth: 3, borderColor: 'white',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'visible',
        padding: 4,
        marginLeft: 2,
        ...shadows.lg
    },
    otherUserMarker: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.secondary,
        borderWidth: 2, borderColor: 'white',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'visible',
        padding: 4,
        marginLeft: 2,
        ...shadows.md
    },
    markerName: {
        maxWidth: 110,
        marginTop: 2,
        paddingHorizontal: 5,
        backgroundColor: 'white',
        borderRadius: 4,
        color: colors.text,
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
});
