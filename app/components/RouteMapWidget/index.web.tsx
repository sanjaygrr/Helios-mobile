import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import { estiloMapa } from '../MapWidget/estiloMapa';
import { googleMapsKey, loadGoogleMaps, placeHtmlOverlay, zoomForDelta } from '../MapWidget/googleMapa';
import { RouteMapWidgetProps } from './types';

function dot(color: string, round: boolean): string {
    const radius = round ? '50%' : '4px';
    return `<div style="background:${color};width:24px;height:24px;border-radius:${radius};border:2px solid ${colors.white};"></div>`;
}

export default function RouteMapWidget({
    routeCoordinates,
    startCoordinate,
    endCoordinate,
    style,
}: RouteMapWidgetProps) {
    const hostRef = useRef<View>(null);
    const mapRef = useRef<any>(null);
    const overlaysRef = useRef<any[]>([]);
    const lineRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const first = routeCoordinates[0];

    useEffect(() => {
        const node = hostRef.current as unknown as HTMLElement | null;
        if (!node) return;
        let cancelled = false;
        (window as any).gm_authFailure = () => {
            if (!cancelled) setError('Google Maps rechazó la clave en este sitio.');
        };
        loadGoogleMaps(googleMapsKey()).then(() => {
            if (cancelled || mapRef.current) return;
            const google = (window as any).google;
            const center = first
                ? { lat: first.latitude, lng: first.longitude }
                : { lat: -36.95, lng: -73.02 };
            mapRef.current = new google.maps.Map(node, {
                center,
                zoom: zoomForDelta(0.05),
                styles: estiloMapa,
                backgroundColor: '#1A2026',
                clickableIcons: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                gestureHandling: 'greedy',
            });
            setReady(true);
        }).catch((reason: Error) => {
            if (cancelled) return;
            setError(reason.message === 'missing-key'
                ? 'Falta la clave de Google Maps en este build.'
                : 'No se pudo cargar Google Maps.');
        });
        return () => {
            cancelled = true;
        };
    }, [first]);

    useEffect(() => {
        const map = mapRef.current;
        const google = (window as any).google;
        if (!ready || !map || !google) return;

        lineRef.current?.setMap(null);
        overlaysRef.current.forEach((overlay) => overlay.setMap(null));

        if (routeCoordinates.length > 0) {
            lineRef.current = new google.maps.Polyline({
                map,
                path: routeCoordinates.map((point) => ({ lat: point.latitude, lng: point.longitude })),
                strokeColor: colors.primary,
                strokeWeight: 4,
            });
            const bounds = new google.maps.LatLngBounds();
            routeCoordinates.forEach((point) => bounds.extend({ lat: point.latitude, lng: point.longitude }));
            map.fitBounds(bounds, 50);
        }

        const overlays = [];
        if (startCoordinate) {
            overlays.push(placeHtmlOverlay(
                map,
                { lat: startCoordinate.latitude, lng: startCoordinate.longitude },
                dot(colors.success, true),
                [12, 12],
                2,
                () => undefined,
            ));
        }
        if (endCoordinate) {
            overlays.push(placeHtmlOverlay(
                map,
                { lat: endCoordinate.latitude, lng: endCoordinate.longitude },
                dot(colors.danger, false),
                [12, 12],
                2,
                () => undefined,
            ));
        }
        overlaysRef.current = overlays;
    }, [endCoordinate, ready, routeCoordinates, startCoordinate]);

    return (
        <View style={[styles.container, style]}>
            <View ref={hostRef} style={styles.map} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
    },
    map: {
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
    },
    error: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        bottom: spacing.md,
        color: colors.text,
        backgroundColor: colors.surface,
        padding: spacing.sm,
        fontSize: 14,
        fontWeight: '700',
    },
});
