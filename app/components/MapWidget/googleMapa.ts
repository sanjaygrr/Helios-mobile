import Constants from 'expo-constants';

const SCRIPT_ID = 'lumbre-google-maps';
const CALLBACK = '__lumbreGoogleMapsReady';

let pending: Promise<void> | null = null;

export function googleMapsKey(): string {
    const extra = Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined;
    return extra?.googleMapsApiKey || '';
}

/** La misma clave de EAS. En web hace falta el SDK de JavaScript, no el de Android. */
export function loadGoogleMaps(apiKey: string): Promise<void> {
    const google = (window as any).google;
    if (google?.maps?.Map) return Promise.resolve();
    if (!apiKey) return Promise.reject(new Error('missing-key'));
    if (pending) return pending;

    pending = new Promise((resolve, reject) => {
        (window as any)[CALLBACK] = () => resolve();
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&callback=${CALLBACK}`;
        script.onerror = () => {
            pending = null;
            reject(new Error('script'));
        };
        document.head.appendChild(script);
    });
    return pending;
}

export function zoomForDelta(latitudeDelta: number): number {
    const delta = Math.max(latitudeDelta, 0.0001);
    return Math.max(1, Math.min(20, Math.round(Math.log2(360 / delta))));
}

export function readGoogleRegion(map: any, width: number, height: number) {
    const bounds = map.getBounds?.();
    const center = map.getCenter?.();
    if (!bounds || !center) return null;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    return {
        latitude: center.lat(),
        longitude: center.lng(),
        latitudeDelta: Math.max(ne.lat() - sw.lat(), 0.0001),
        longitudeDelta: Math.max(ne.lng() - sw.lng(), 0.0001),
        width,
        height,
    };
}

export function placeHtmlOverlay(
    map: any,
    position: { lat: number; lng: number },
    html: string,
    anchor: [number, number],
    zIndex: number,
    onClick: () => void,
) {
    const google = (window as any).google;
    const overlay = new google.maps.OverlayView();
    let el: HTMLDivElement | null = null;
    overlay.onAdd = () => {
        el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.zIndex = String(zIndex);
        el.style.cursor = 'pointer';
        el.innerHTML = html;
        el.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
            event.preventDefault();
            onClick();
        });
        overlay.getPanes().overlayMouseTarget.appendChild(el);
    };
    overlay.draw = () => {
        if (!el) return;
        const point = overlay.getProjection()?.fromLatLngToDivPixel(
            new google.maps.LatLng(position.lat, position.lng),
        );
        if (!point) return;
        el.style.left = `${point.x - anchor[0]}px`;
        el.style.top = `${point.y - anchor[1]}px`;
    };
    overlay.onRemove = () => {
        el?.remove();
        el = null;
    };
    overlay.setMap(map);
    return overlay;
}
