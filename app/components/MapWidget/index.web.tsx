import React, { useCallback, useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, marcador, spacing, unitStatus } from '../../theme/colors';
import { estiloMapa } from './estiloMapa';
import {
    googleMapsKey,
    loadGoogleMaps,
    placeHtmlOverlay,
    readGoogleRegion,
    zoomForDelta,
} from './googleMapa';
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

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function shapeHtml(point: MapPoint, selected: boolean): string {
    const size = markerSize(point.kind, selected);
    const shape = marcador[point.kind].forma;
    const fill = markerFill(point.kind, point.status);
    const radius = shape === 'circulo' ? size / 2 : shape === 'cuadrado' ? SQUARE_RADIUS : 0;
    const rotate = shape === 'diamante' ? 'transform:rotate(45deg);' : '';
    const body = `
        <div style="box-sizing:border-box;width:${size}px;height:${size}px;background:${fill};border:${marcador.anilloAncho}px solid ${marcador.anillo};border-radius:${radius}px;"></div>
    `;
    if (!selected) {
        return `<div style="${rotate}display:flex;align-items:center;justify-content:center;">${body}</div>`;
    }
    const outer = size + spacing.xs * 2;
    const outerRadius = shape === 'circulo' ? outer / 2 : shape === 'cuadrado' ? SQUARE_RADIUS + spacing.xs : 0;
    return `
        <div style="${rotate}box-sizing:border-box;width:${outer}px;height:${outer}px;border:${spacing.xs}px solid ${colors.accent};border-radius:${outerRadius}px;display:flex;align-items:center;justify-content:center;">
            ${body}
        </div>
    `;
}

function pinHtml(point: MapPoint, selected: boolean, now: number, somethingSelected: boolean): { html: string; anchor: [number, number] } {
    const caption = captionFor(point, now);
    const opacity = markerOpacity(selected, somethingSelected, caption.stale);
    const size = markerSize(point.kind, selected);
    const shapeHeight = size + (selected ? spacing.xs * 2 : 0);
    const chipColor = point.status ? unitStatus[point.status].text : (caption.stale ? colors.warning : colors.text);
    const chipBg = point.status ? unitStatus[point.status].bg : colors.surface;
    const gap = marcador[point.kind].forma === 'diamante' ? spacing.md : spacing.xs;
    const staleBar = caption.stale
        ? `<div style="width:${size}px;height:${spacing.xs}px;background:${colors.warning};margin-bottom:${spacing.xs}px;"></div>`
        : '';
    const html = `
        <div style="opacity:${opacity};display:flex;flex-direction:column;align-items:center;width:max-content;">
            ${staleBar}
            ${shapeHtml(point, selected)}
            <div style="margin-top:${gap}px;max-width:128px;padding:${spacing.xs}px;background:${chipBg};color:${chipColor};font-size:11px;font-weight:700;text-align:center;white-space:pre-line;line-height:14px;">
                ${escapeHtml(caption.text)}
            </div>
        </div>
    `;
    return { html, anchor: [70, shapeHeight / 2] };
}

function clusterHtml(count: number, faded: boolean): { html: string; anchor: [number, number] } {
    const opacity = faded ? marcador.opacidadNoSeleccionado : 1;
    const html = `
        <div style="opacity:${opacity};width:96px;display:flex;flex-direction:column;align-items:center;">
            <div style="position:relative;box-sizing:border-box;width:40px;height:40px;border-radius:13px;background:${colors.primary};border:${marcador.anilloAncho}px solid ${marcador.anillo};display:flex;align-items:center;justify-content:center;">
                <div style="position:absolute;width:18px;height:18px;border:2px solid ${colors.white};border-radius:4px;transform:translate(-4px,4px);"></div>
                <div style="position:absolute;width:18px;height:18px;border:2px solid ${colors.white};border-radius:4px;transform:translate(4px,-4px);"></div>
                <div style="position:absolute;top:-8px;right:-12px;min-width:24px;height:24px;padding:0 5px;box-sizing:border-box;border-radius:12px;background:${colors.accent};border:2px solid ${colors.surface};color:${colors.white};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;">${count}</div>
            </div>
            <div style="margin-top:${spacing.xs}px;padding:4px 7px;border-radius:8px;background:${colors.surface};border:1px solid ${colors.border};color:${colors.text};font-size:11px;line-height:14px;font-weight:800;white-space:nowrap;">${count} elementos</div>
        </div>
    `;
    return { html, anchor: [48, 20] };
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
    const hostRef = useRef<View>(null);
    const mapRef = useRef<any>(null);
    const overlaysRef = useRef<any[]>([]);
    const armIgnore = useRef(false);
    const regionRef = useRef<MapRegion>({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
    });
    const [now, setNow] = useState(() => Date.now());
    const [localSelected, setLocalSelected] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<(MapRegion & { width: number; height: number }) | null>(null);

    const onMapPressRef = useRef(onMapPress);
    onMapPressRef.current = onMapPress;
    const onSelectRef = useRef(onSelectMarker);
    onSelectRef.current = onSelectMarker;
    const onRegionChangeRef = useRef(onRegionChange);
    onRegionChangeRef.current = onRegionChange;

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(timer);
    }, []);

    const selectedKey = selectedId !== undefined
        ? (selectedId == null ? null : String(selectedId))
        : localSelected;

    const points = useMemo(() => buildMapPoints({
        selfUser,
        currentLocation,
        otherUsers,
        fires,
        showFires,
        now,
    }), [selfUser, currentLocation, otherUsers, fires, showFires, now]);

    const groups = useMemo(
        () => clusterMarkers(points, view, view?.width ?? 0, view?.height ?? 0, selectedKey),
        [points, view, selectedKey],
    );

    const publishView = useCallback(() => {
        const map = mapRef.current;
        const node = hostRef.current as unknown as HTMLElement | null;
        if (!map || !node) return;
        const next = readGoogleRegion(map, node.clientWidth, node.clientHeight);
        if (!next) return;
        regionRef.current = next;
        setView(next);
        onRegionChangeRef.current?.(next);
    }, []);

    useImperativeHandle(ref, () => ({
        animateToRegion: (region) => {
            const map = mapRef.current;
            const google = (window as any).google;
            if (!map || !google) return;
            const bounds = new google.maps.LatLngBounds(
                {
                    lat: region.latitude - region.latitudeDelta / 2,
                    lng: region.longitude - region.longitudeDelta / 2,
                },
                {
                    lat: region.latitude + region.latitudeDelta / 2,
                    lng: region.longitude + region.longitudeDelta / 2,
                },
            );
            map.fitBounds(bounds, 24);
        },
    }));

    useEffect(() => {
        const node = hostRef.current as unknown as HTMLElement | null;
        if (!node) return;
        let cancelled = false;
        (window as any).gm_authFailure = () => {
            if (!cancelled) setError('Google Maps rechazó la clave en este sitio.');
        };
        const key = googleMapsKey();
        loadGoogleMaps(key).then(() => {
            if (cancelled || mapRef.current) return;
            const google = (window as any).google;
            const map = new google.maps.Map(node, {
                center: { lat: currentLocation.latitude, lng: currentLocation.longitude },
                zoom: zoomForDelta(0.1),
                styles: estiloMapa,
                backgroundColor: '#1A2026',
                clickableIcons: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                gestureHandling: 'greedy',
            });
            map.addListener('idle', publishView);
            map.addListener('click', () => {
                if (armIgnore.current) {
                    armIgnore.current = false;
                    return;
                }
                if (selectedId === undefined) setLocalSelected(null);
                onMapPressRef.current();
            });
            mapRef.current = map;
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
        // El centro inicial se toma una vez, igual que el mapa del teléfono.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        overlaysRef.current.forEach((overlay) => overlay.setMap(null));
        const next: any[] = [];
        groups.forEach((group) => {
            if (group.members.length > 1) {
                const drawn = clusterHtml(group.members.length, selectedKey != null);
                next.push(placeHtmlOverlay(
                    map,
                    { lat: group.latitude, lng: group.longitude },
                    drawn.html,
                    drawn.anchor,
                    100,
                    () => {
                        armIgnore.current = true;
                        const zoom = map.getZoom?.() ?? 13;
                        map.setZoom(Math.min(zoom + 2, 18));
                        map.panTo({ lat: group.latitude, lng: group.longitude });
                    },
                ));
                return;
            }
            const point = group.members[0];
            const selected = point.key === selectedKey;
            const drawn = pinHtml(point, selected, now, selectedKey != null);
            next.push(placeHtmlOverlay(
                map,
                { lat: point.latitude, lng: point.longitude },
                drawn.html,
                drawn.anchor,
                selected ? 1000 : 1,
                () => {
                    armIgnore.current = true;
                    if (selectedId === undefined) setLocalSelected(point.key);
                    onSelectRef.current(point.raw);
                },
            ));
        });
        overlaysRef.current = next;
        return () => {
            next.forEach((overlay) => overlay.setMap(null));
        };
    }, [groups, now, ready, selectedId, selectedKey]);

    return (
        <View style={[styles.container, style]}>
            <View ref={hostRef} style={styles.map} />
            {error ? (
                <View style={styles.error}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}
        </View>
    );
});

export default MapWidget;

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
        padding: spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    errorText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
});
