import React, { useCallback, useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, marcador, spacing, unitStatus } from '../../theme/colors';
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

function readView(map: L.Map): MapRegion & { width: number; height: number } {
    const bounds = map.getBounds();
    const size = map.getSize();
    return {
        latitude: map.getCenter().lat,
        longitude: map.getCenter().lng,
        latitudeDelta: Math.max(bounds.getNorth() - bounds.getSouth(), 0.0001),
        longitudeDelta: Math.max(bounds.getEast() - bounds.getWest(), 0.0001),
        width: size.x,
        height: size.y,
    };
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

function pinIcon(point: MapPoint, selected: boolean, now: number, somethingSelected: boolean): L.DivIcon {
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
    const height = shapeHeight + gap + 48;
    return L.divIcon({
        className: 'lumbre-pin',
        html,
        iconSize: [140, height],
        iconAnchor: [70, shapeHeight / 2],
    });
}

function clusterIcon(count: number, faded: boolean): L.DivIcon {
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
    return L.divIcon({
        className: 'lumbre-pin',
        html,
        iconSize: [96, 68],
        iconAnchor: [48, 20],
    });
}

const MapController = forwardRef<MapWidgetHandle, {
    onView: (view: MapRegion & { width: number; height: number }) => void;
    onMapPress: () => void;
    armIgnore: React.MutableRefObject<boolean>;
}>(({ onView, onMapPress, armIgnore }, ref) => {
    const map = useMap();

    useEffect(() => {
        const linkId = 'leaflet-css';
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        const styleId = 'lumbre-pin-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = '.lumbre-pin.leaflet-div-icon{background:none;border:none;}';
            document.head.appendChild(style);
        }
        const timer = setTimeout(() => map.invalidateSize(), 100);
        onView(readView(map));
        return () => clearTimeout(timer);
    }, [map, onView]);

    useMapEvents({
        moveend: () => onView(readView(map)),
        zoomend: () => onView(readView(map)),
        click: () => {
            if (armIgnore.current) {
                armIgnore.current = false;
                return;
            }
            onMapPress();
        },
    });

    useImperativeHandle(ref, () => ({
        animateToRegion: (region, duration) => {
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

function MarkerLayer({
    points,
    selectedKey,
    now,
    onSelect,
    armIgnore,
}: {
    points: MapPoint[];
    selectedKey: string | null;
    now: number;
    onSelect: (point: MapPoint) => void;
    armIgnore: React.MutableRefObject<boolean>;
}) {
    const map = useMap();
    const [view, setView] = useState<(MapRegion & { width: number; height: number }) | null>(null);

    useMapEvents({
        moveend: () => setView(readView(map)),
        zoomend: () => setView(readView(map)),
    });

    useEffect(() => {
        setView(readView(map));
    }, [map]);

    const groups = useMemo(
        () => clusterMarkers(points, view, view?.width ?? 0, view?.height ?? 0, selectedKey),
        [points, view, selectedKey],
    );

    return (
        <>
            {groups.map((group) => {
                if (group.members.length > 1) {
                    return (
                        <Marker
                            key={group.key}
                            position={[group.latitude, group.longitude]}
                            icon={clusterIcon(group.members.length, selectedKey != null)}
                            zIndexOffset={100}
                            eventHandlers={{
                                click: (event) => {
                                    armIgnore.current = true;
                                    L.DomEvent.stopPropagation(event.originalEvent);
                                    map.flyTo([group.latitude, group.longitude], Math.min(map.getZoom() + 2, 18));
                                },
                            }}
                        />
                    );
                }
                const point = group.members[0];
                const selected = point.key === selectedKey;
                return (
                    <Marker
                        key={point.key}
                        position={[point.latitude, point.longitude]}
                        icon={pinIcon(point, selected, now, selectedKey != null)}
                        zIndexOffset={selected ? 1000 : 0}
                        eventHandlers={{
                            click: (event) => {
                                armIgnore.current = true;
                                L.DomEvent.stopPropagation(event.originalEvent);
                                onSelect(point);
                            },
                        }}
                    />
                );
            })}
        </>
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
    const [now, setNow] = useState(() => Date.now());
    const [localSelected, setLocalSelected] = useState<string | null>(null);
    const armIgnore = useRef(false);

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

    const onRegionChangeRef = useRef(onRegionChange);
    onRegionChangeRef.current = onRegionChange;
    const publishView = useCallback((view: MapRegion) => {
        onRegionChangeRef.current?.(view);
    }, []);

    return (
        <View style={[styles.container, style]}>
            <MapContainer
                center={[currentLocation.latitude, currentLocation.longitude]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
            >
                <MapController
                    ref={ref}
                    onView={publishView}
                    armIgnore={armIgnore}
                    onMapPress={() => {
                        if (selectedId === undefined) setLocalSelected(null);
                        onMapPress();
                    }}
                />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MarkerLayer
                    points={points}
                    selectedKey={selectedKey}
                    now={now}
                    armIgnore={armIgnore}
                    onSelect={(point) => {
                        if (selectedId === undefined) setLocalSelected(point.key);
                        onSelectMarker(point.raw);
                    }}
                />
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
