import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { StyleSheet, View, Text, LayoutChangeEvent } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { colors, marcador, shadows, spacing, unitStatus } from '../../theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { estiloMapa } from './estiloMapa';
import {
    MapWidgetProps,
    MapWidgetHandle,
    MapPoint,
    MapRegion,
    buildMapPoints,
    captionFor,
    clusterMarkers,
    markerFill,
    markerOpacity,
    markerSize,
} from './types';

const SQUARE_RADIUS = 10;

function useTrackChanges(signature: string) {
    const [tracking, setTracking] = useState(true);
    useEffect(() => {
        setTracking(true);
        const timer = setTimeout(() => setTracking(false), 800);
        return () => clearTimeout(timer);
    }, [signature]);
    return tracking;
}

function MarkerShape({
    point,
    selected,
}: {
    point: MapPoint;
    selected: boolean;
}) {
    const size = markerSize(point.kind, selected);
    const shape = marcador[point.kind].forma;
    const fill = markerFill(point.kind, point.status);
    const outer = size + (selected ? spacing.xs * 2 : 0);
    const ring = selected
        ? {
            width: outer,
            height: outer,
            borderWidth: spacing.xs,
            borderColor: colors.accent,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
        }
        : {
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
        };
    const body = {
        width: size,
        height: size,
        backgroundColor: fill,
        borderWidth: marcador.anilloAncho,
        borderColor: marcador.anillo,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    };
    // Un circulo de color no dice nada: el icono dice si es persona, carro o fuego.
    const glifo = (
        <MaterialCommunityIcons
            name={marcador[point.kind].icono}
            size={Math.round(size * 0.56)}
            color={colors.white}
        />
    );

    if (shape === 'circulo') {
        return (
            <View style={[ring, selected && { borderRadius: outer / 2 }]}>
                <View style={[body, { borderRadius: size / 2 }]}>{glifo}</View>
            </View>
        );
    }
    if (shape === 'cuadrado') {
        return (
            <View style={[ring, selected && { borderRadius: SQUARE_RADIUS + spacing.xs }]}>
                <View style={[body, { borderRadius: SQUARE_RADIUS }]}>{glifo}</View>
            </View>
        );
    }
    return (
        <View style={[ring, { transform: [{ rotate: '45deg' }] }]}>
            <View style={body}>
                {/* el rombo se rota, el icono se desrota para que no quede chueco */}
                <View style={{ transform: [{ rotate: '-45deg' }] }}>{glifo}</View>
            </View>
        </View>
    );
}

function UnitMarker({
    point,
    selected,
    somethingSelected,
    now,
    onPress,
}: {
    point: MapPoint;
    selected: boolean;
    somethingSelected: boolean;
    now: number;
    onPress: () => void;
}) {
    const caption = captionFor(point, now);
    const opacity = markerOpacity(selected, somethingSelected, caption.stale);
    const size = markerSize(point.kind, selected);
    const shapeHeight = size + (selected ? spacing.xs * 2 : 0);
    const labelHeight = 44;
    const gap = marcador[point.kind].forma === 'diamante' ? spacing.md : spacing.xs;
    const anchorY = (shapeHeight / 2) / (shapeHeight + gap + labelHeight);
    const tracking = useTrackChanges(`${point.key}|${selected}|${caption.text}|${opacity}|${point.status || ''}`);
    const chipColor = point.status ? unitStatus[point.status].text : (caption.stale ? colors.warning : colors.text);
    const chipBg = point.status ? unitStatus[point.status].bg : colors.surface;

    return (
        <Marker
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            zIndex={selected ? 1000 : caption.stale ? 1 : 10}
            tracksViewChanges={tracking}
            onPress={onPress}
            anchor={{ x: 0.5, y: anchorY }}
        >
            <View style={[styles.pin, { opacity }]} collapsable={false}>
                {caption.stale && <View style={[styles.staleMark, { width: size, backgroundColor: colors.warning }]} />}
                <MarkerShape point={point} selected={selected} />
                <View style={[styles.caption, { marginTop: gap, backgroundColor: chipBg }]}>
                    <Text style={[styles.captionText, { color: chipColor }]} numberOfLines={3}>
                        {caption.text}
                    </Text>
                </View>
            </View>
        </Marker>
    );
}

function ClusterBubble({
    count,
    latitude,
    longitude,
    faded,
    onPress,
}: {
    count: number;
    latitude: number;
    longitude: number;
    faded: boolean;
    onPress: () => void;
}) {
    const size = marcador.carro.tam;
    const tracking = useTrackChanges(`cluster-${count}-${latitude}-${longitude}-${faded}`);
    return (
        <Marker
            coordinate={{ latitude, longitude }}
            zIndex={50}
            tracksViewChanges={tracking}
            onPress={onPress}
            anchor={{ x: 0.5, y: 0.5 }}
        >
            <View
                style={[styles.cluster, { minWidth: size, height: size, borderRadius: size / 2, opacity: faded ? marcador.opacidadNoSeleccionado : 1 }]}
                accessibilityLabel={`${count} marcadores juntos`}
            >
                <Text style={styles.clusterText}>{count}</Text>
            </View>
        </Marker>
    );
}

const MapWidget = forwardRef<MapWidgetHandle, MapWidgetProps>(({
    style,
    currentLocation,
    selfUser,
    otherUsers,
    fires,
    showFires,
    onSelectMarker,
    onMapPress,
    onRegionChange,
    selectedId,
}, ref) => {
    const mapRef = useRef<MapView>(null);
    const ignoreMapPress = useRef(false);
    const [now, setNow] = useState(() => Date.now());
    const [localSelected, setLocalSelected] = useState<string | null>(null);
    const [layout, setLayout] = useState({ width: 0, height: 0 });
    const [region, setRegion] = useState<MapRegion>({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
    });

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(timer);
    }, []);

    const selectedKey = selectedId !== undefined
        ? (selectedId == null ? null : String(selectedId))
        : localSelected;

    useImperativeHandle(ref, () => ({
        animateToRegion: (next, duration) => {
            mapRef.current?.animateToRegion(next, duration);
        }
    }));

    const points = useMemo(() => buildMapPoints({
        selfUser,
        currentLocation,
        otherUsers,
        fires,
        showFires,
        now,
    }), [selfUser, currentLocation, otherUsers, fires, showFires, now]);

    const groups = useMemo(
        () => clusterMarkers(points, region, layout.width, layout.height, selectedKey),
        [points, region, layout.width, layout.height, selectedKey],
    );

    const onLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setLayout({ width, height });
    };

    const onRegion = (next: Region) => {
        setRegion(next);
        onRegionChange?.(next);
    };

    const zoomTo = (latitude: number, longitude: number) => {
        mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: Math.max(region.latitudeDelta / 2, 0.002),
            longitudeDelta: Math.max(region.longitudeDelta / 2, 0.002),
        }, 350);
    };

    return (
        <MapView
            ref={mapRef}
            style={[styles.map, style]}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
            }}
            showsUserLocation={false}
            showsCompass={true}
            mapType="standard"
            // Google Maps en Android e iOS; el mismo estilo limpia ambos mapas.
            customMapStyle={estiloMapa}
            // La prop lleva una "s" de mas: asi se llama en la libreria.
            showsPointsOfInterests={false}
            // En iOS manda sobre la anterior: lista vacia = ninguna categoria.
            pointsOfInterestFilter={[]}
            showsBuildings={false}
            toolbarEnabled={false}
            onLayout={onLayout}
            onPress={() => {
                if (ignoreMapPress.current) {
                    ignoreMapPress.current = false;
                    return;
                }
                if (selectedId === undefined) setLocalSelected(null);
                onMapPress();
            }}
            onRegionChangeComplete={onRegion}
        >
            {groups.map((group) => {
                if (group.members.length > 1) {
                    return (
                        <ClusterBubble
                            key={group.key}
                            count={group.members.length}
                            latitude={group.latitude}
                            longitude={group.longitude}
                            faded={selectedKey != null}
                            onPress={() => {
                                ignoreMapPress.current = true;
                                zoomTo(group.latitude, group.longitude);
                            }}
                        />
                    );
                }
                const point = group.members[0];
                const selected = point.key === selectedKey;
                return (
                    <UnitMarker
                        key={point.key}
                        point={point}
                        selected={selected}
                        somethingSelected={selectedKey != null}
                        now={now}
                        onPress={() => {
                            ignoreMapPress.current = true;
                            if (selectedId === undefined) setLocalSelected(point.key);
                            onSelectMarker(point.raw);
                        }}
                    />
                );
            })}
        </MapView>
    );
});

export default MapWidget;

const styles = StyleSheet.create({
    map: {
        flex: 1,
    },
    pin: {
        alignItems: 'center',
    },
    staleMark: {
        height: spacing.xs,
        marginBottom: spacing.xs,
    },
    caption: {
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        maxWidth: 128,
        ...shadows.sm,
    },
    captionText: {
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
    cluster: {
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: marcador.anilloAncho,
        borderColor: marcador.anillo,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.md,
    },
    clusterText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
});
