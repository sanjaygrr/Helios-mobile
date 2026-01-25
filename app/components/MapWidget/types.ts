
export interface FirePoint {
    latitude: number;
    longitude: number;
    brightness: number;
    acq_date?: string;
    acq_time?: string;
}

export interface MapUser {
    id: number;
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
}

export interface MapWidgetHandle {
    animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration?: number) => void;
}
