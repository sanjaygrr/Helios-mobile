import { marcador, unitStatus } from '../../theme/colors';

export interface FirePoint {
    latitude: number;
    longitude: number;
    brightness: number;
    acq_date?: string;
    acq_time?: string;
    timestamp?: number;
    title?: string;
    address?: string;
    tipo?: MarkerKind;
    status?: string;
    unit_status?: string;
}

export type MarkerKind = 'bombero' | 'carro' | 'emergencia' | 'compania';

export type UnitStatusKey = keyof typeof unitStatus;

export interface MapUser {
    id: number;
    device_id?: string;
    latitude: number;
    longitude: number;
    role?: string;
    email?: string;
    user_first_name?: string;
    user_last_name?: string;
    rut?: string;
    assigned_vehicle?: string;
    companions?: string[];
    assigned_incident?: {
        id: number;
        title: string;
        incident_type: string;
    } | null;
    timestamp?: number;
    tipo?: MarkerKind;
    kind?: MarkerKind;
    status?: string;
    unit_status?: string;
    unit_type?: string;
    es_carro?: boolean;
    nombre?: string;
}

export interface MapRegion {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

export interface MapPoint {
    key: string;
    latitude: number;
    longitude: number;
    kind: MarkerKind;
    status?: UnitStatusKey;
    timestamp?: number;
    label: string;
    raw: MapUser | FirePoint | Record<string, unknown>;
}

export interface MarkerGroup {
    key: string;
    latitude: number;
    longitude: number;
    members: MapPoint[];
}

export interface MapWidgetProps {
    style?: any;
    currentLocation: {
        latitude: number;
        longitude: number;
    };
    selfUser: MapUser | any;
    otherUsers: MapUser[];
    fires: FirePoint[];
    showFires: boolean;
    onSelectMarker: (item: MapUser | FirePoint | any) => void;
    onMapPress: () => void;
    onRegionChange?: (region: any) => void;
    provider?: any;
    selectedId?: number | string | null;
}

export interface MapWidgetHandle {
    animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration?: number) => void;
}

/** Una posicion de mas de 5 minutos no puede verse igual que una fresca. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

export const STALE_OPACITY = 0.45;

const CLUSTER_PX = Math.max(marcador.bombero.sel, marcador.carro.sel, marcador.emergencia.sel, marcador.compania.sel);

export function resolveKind(item: Partial<MapUser> & Partial<FirePoint>): MarkerKind {
    const explicit = item.tipo || item.kind;
    if (explicit === 'bombero' || explicit === 'carro' || explicit === 'emergencia' || explicit === 'compania') return explicit;
    if (typeof item.brightness === 'number') return 'emergencia';
    if (item.es_carro || item.unit_type) return 'carro';
    const role = (item.role || '').toUpperCase();
    if (role.includes('VEHICLE') || role.includes('CARRO') || role === 'UNIT' || role === 'ENGINE') return 'carro';
    return 'bombero';
}

export function resolveStatus(item: Partial<MapUser> & Partial<FirePoint>): UnitStatusKey | undefined {
    const raw = item.status || item.unit_status;
    if (typeof raw === 'string' && raw in unitStatus) return raw as UnitStatusKey;
    return undefined;
}

export function markerFill(kind: MarkerKind, status: UnitStatusKey | undefined): string {
    if (status) return unitStatus[status].text;
    return marcador[kind].relleno;
}

export function markerSize(kind: MarkerKind, selected: boolean): number {
    const spec = marcador[kind];
    return selected ? spec.sel : spec.tam;
}

export function positionAge(timestamp: number | undefined, now: number): { text: string; stale: boolean } {
    if (timestamp == null || !Number.isFinite(timestamp)) {
        return { text: 'sin hora', stale: true };
    }
    const delta = Math.max(0, now - timestamp);
    const stale = delta >= STALE_AFTER_MS;
    const seconds = Math.floor(delta / 1000);
    if (seconds < 60) return { text: `hace ${seconds} s`, stale };
    if (seconds < 3600) return { text: `hace ${Math.floor(seconds / 60)} min`, stale };
    if (seconds < 86400) return { text: `hace ${Math.floor(seconds / 3600)} h`, stale };
    return { text: `hace ${Math.floor(seconds / 86400)} d`, stale };
}

export function markerOpacity(selected: boolean, somethingSelected: boolean, stale: boolean): number {
    if (stale) return selected ? 0.6 : STALE_OPACITY;
    if (somethingSelected && !selected) return marcador.opacidadNoSeleccionado;
    return 1;
}

function readTimestamp(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string' && value) {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return undefined;
}

function userLabel(user: MapUser): string {
    const name = `${user.user_first_name || ''} ${user.user_last_name || ''}`.trim();
    if (name) return name;
    if (user.nombre) return user.nombre;
    if (user.email) return user.email.split('@')[0];
    if (user.assigned_vehicle) return user.assigned_vehicle;
    return `#${user.id}`;
}

export function buildMapPoints(input: {
    selfUser?: MapUser | null;
    currentLocation: { latitude: number; longitude: number };
    otherUsers: MapUser[];
    fires: FirePoint[];
    showFires: boolean;
    now: number;
}): MapPoint[] {
    const points: MapPoint[] = [];
    if (input.selfUser) {
        points.push({
            key: 'self',
            latitude: input.currentLocation.latitude,
            longitude: input.currentLocation.longitude,
            kind: resolveKind(input.selfUser),
            status: resolveStatus(input.selfUser),
            timestamp: readTimestamp(input.selfUser.timestamp) ?? input.now,
            label: userLabel(input.selfUser),
            raw: { ...input.selfUser, ...input.currentLocation, isSelf: true },
        });
    }
    input.otherUsers.forEach((user) => {
        points.push({
            key: `user-${user.id}-${user.device_id || 'legacy'}`,
            latitude: user.latitude,
            longitude: user.longitude,
            kind: resolveKind(user),
            status: resolveStatus(user),
            timestamp: readTimestamp(user.timestamp),
            label: userLabel(user),
            raw: user,
        });
    });
    if (input.showFires) {
        input.fires.forEach((fire, index) => {
            points.push({
                key: `fire-${index}-${fire.latitude}-${fire.longitude}`,
                latitude: fire.latitude,
                longitude: fire.longitude,
                kind: 'emergencia',
                status: resolveStatus(fire),
                timestamp: readTimestamp(fire.timestamp),
                label: fire.title || fire.address || 'Emergencia',
                raw: fire,
            });
        });
    }
    return points;
}

export function captionFor(point: MapPoint, now: number): { text: string; stale: boolean } {
    if (point.kind === 'compania' || point.kind === 'emergencia') {
        return { text: point.label || '', stale: false };
    }
    const age = positionAge(point.timestamp, now);
    const statusLabel = point.status ? unitStatus[point.status].label : null;
    const bits = [statusLabel, age.text, age.stale ? 'vieja' : null].filter(Boolean);
    const detail = bits.join(' · ');
    return {
        text: point.label ? `${point.label}\n${detail}` : detail,
        stale: age.stale,
    };
}

export function clusterMarkers(
    points: MapPoint[],
    region: MapRegion | null,
    width: number,
    height: number,
    selectedKey: string | null,
): MarkerGroup[] {
    const loose: MapPoint[] = [];
    const rest: MapPoint[] = [];
    points.forEach((point) => {
        if (selectedKey && point.key === selectedKey) loose.push(point);
        else rest.push(point);
    });

    const singles = (list: MapPoint[]): MarkerGroup[] => list.map((point) => ({
        key: point.key,
        latitude: point.latitude,
        longitude: point.longitude,
        members: [point],
    }));

    if (!region || width < 1 || height < 1) {
        return singles(points);
    }

    const cellLat = (Math.abs(region.latitudeDelta) / height) * CLUSTER_PX;
    const cellLng = (Math.abs(region.longitudeDelta) / width) * CLUSTER_PX;
    if (cellLat <= 0 || cellLng <= 0) return singles(points);

    const buckets = new Map<string, MapPoint[]>();
    rest.forEach((point) => {
        const gx = Math.floor(point.longitude / cellLng);
        const gy = Math.floor(point.latitude / cellLat);
        const bucketKey = `${gx}:${gy}`;
        const bucket = buckets.get(bucketKey);
        if (bucket) bucket.push(point);
        else buckets.set(bucketKey, [point]);
    });

    const groups: MarkerGroup[] = [];
    buckets.forEach((members, bucketKey) => {
        const latitude = members.reduce((sum, member) => sum + member.latitude, 0) / members.length;
        const longitude = members.reduce((sum, member) => sum + member.longitude, 0) / members.length;
        groups.push({
            key: members.length === 1 ? members[0].key : `grupo-${bucketKey}`,
            latitude,
            longitude,
            members,
        });
    });
    loose.forEach((point) => {
        groups.push({
            key: point.key,
            latitude: point.latitude,
            longitude: point.longitude,
            members: [point],
        });
    });
    return groups;
}
