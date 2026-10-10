import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors, marcador, unitStatus } from '../../theme/colors';
import {
    MapPoint,
    MapRegion,
    MapWidgetHandle,
    MapWidgetProps,
    buildMapPoints,
    captionFor,
    markerFill,
    markerOpacity,
    markerSize,
} from './types';

type BridgeMessage =
    | { type: 'select'; key: string }
    | { type: 'mapPress' }
    | { type: 'region'; region: MapRegion };

function safeJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function createMapHtml(points: MapPoint[], selectedKey: string | null, initialRegion: MapRegion, now: number): string {
    const serializedPoints = points.map((point) => {
        const caption = captionFor(point, now);
        return {
            key: point.key,
            latitude: point.latitude,
            longitude: point.longitude,
            shape: marcador[point.kind].forma,
            size: markerSize(point.kind, point.key === selectedKey),
            fill: markerFill(point.kind, point.status),
            opacity: markerOpacity(point.key === selectedKey, selectedKey != null, caption.stale),
            selected: point.key === selectedKey,
            caption: caption.text,
            captionColor: point.status ? unitStatus[point.status].text : (caption.stale ? colors.warning : colors.text),
            captionBg: point.status ? unitStatus[point.status].bg : colors.surface,
            stale: caption.stale,
            glyph: point.kind === 'bombero' ? 'B' : point.kind === 'carro' ? 'C' : 'F',
        };
    });

    return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:${colors.canvas}}
.leaflet-control-attribution{font:9px system-ui;background:rgba(14,18,23,.82)!important;color:${colors.textMuted}!important}
.leaflet-control-attribution a{color:${colors.info}!important}
.lumbre-pin{display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))}
.lumbre-stale{width:22px;height:4px;background:${colors.warning};margin-bottom:3px}
.lumbre-shape{display:flex;align-items:center;justify-content:center;border:2px solid ${colors.white};box-sizing:border-box;color:${colors.white};font:800 13px system-ui}
.lumbre-circle{border-radius:999px}.lumbre-square{border-radius:9px}.lumbre-diamond{transform:rotate(45deg)}
.lumbre-diamond span{transform:rotate(-45deg)}
.lumbre-selected{outline:4px solid ${colors.accent};outline-offset:2px}
.lumbre-caption{max-width:132px;margin-top:6px;padding:4px 6px;text-align:center;white-space:pre-line;font:700 11px/14px system-ui;box-shadow:0 2px 5px rgba(0,0,0,.5)}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const initial=${safeJson(initialRegion)};
const points=${safeJson(serializedPoints)};
const map=L.map('map',{zoomControl:true,attributionControl:true}).setView([initial.latitude,initial.longitude],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
const send=(message)=>window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(message));
points.forEach((point)=>{
  const shapeClass=point.shape==='circulo'?'circle':point.shape==='cuadrado'?'square':'diamond';
  const stale=point.stale?'<div class="lumbre-stale"></div>':'';
  const selected=point.selected?' lumbre-selected':'';
  const html='<div class="lumbre-pin" style="opacity:'+point.opacity+'">'+stale+
    '<div class="lumbre-shape lumbre-'+shapeClass+selected+'" style="width:'+point.size+'px;height:'+point.size+'px;background:'+point.fill+'"><span>'+point.glyph+'</span></div>'+
    '<div class="lumbre-caption" style="color:'+point.captionColor+';background:'+point.captionBg+'">'+point.caption.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div></div>';
  const icon=L.divIcon({className:'',html,iconSize:[140,84],iconAnchor:[70,35]});
  L.marker([point.latitude,point.longitude],{icon,zIndexOffset:point.selected?1000:0,bubblingMouseEvents:false}).addTo(map).on('click',()=>send({type:'select',key:point.key}));
});
map.on('click',()=>send({type:'mapPress'}));
map.on('moveend',()=>{const c=map.getCenter(),b=map.getBounds();send({type:'region',region:{latitude:c.lat,longitude:c.lng,latitudeDelta:Math.abs(b.getNorth()-b.getSouth()),longitudeDelta:Math.abs(b.getEast()-b.getWest())}})});
window.lumbreSetRegion=(region)=>{const bounds=L.latLngBounds([region.latitude-region.latitudeDelta/2,region.longitude-region.longitudeDelta/2],[region.latitude+region.latitudeDelta/2,region.longitude+region.longitudeDelta/2]);map.flyToBounds(bounds,{duration:.35})};
</script></body></html>`;
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
    const webRef = useRef<WebView>(null);
    const [now, setNow] = useState(() => Date.now());
    const [localSelected, setLocalSelected] = useState<string | null>(null);
    const initialRegion = useRef<MapRegion>({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
    }).current;

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
    const pointsByKey = useMemo(() => new Map(points.map((point) => [point.key, point])), [points]);
    const html = useMemo(() => createMapHtml(points, selectedKey, initialRegion, now), [points, selectedKey, initialRegion, now]);

    useImperativeHandle(ref, () => ({
        animateToRegion: (region) => {
            webRef.current?.injectJavaScript(`window.lumbreSetRegion(${safeJson(region)});true;`);
        },
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
        try {
            const message = JSON.parse(event.nativeEvent.data) as BridgeMessage;
            if (message.type === 'select') {
                const point = pointsByKey.get(message.key);
                if (!point) return;
                if (selectedId === undefined) setLocalSelected(point.key);
                onSelectMarker(point.raw);
            } else if (message.type === 'mapPress') {
                if (selectedId === undefined) setLocalSelected(null);
                onMapPress();
            } else if (message.type === 'region') {
                onRegionChange?.(message.region);
            }
        } catch {
            // Ignora mensajes ajenos al puente del mapa.
        }
    };

    return (
        <WebView
            ref={webRef}
            style={[styles.map, style]}
            source={{ html, baseUrl: 'https://www.openstreetmap.org' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleMessage}
            overScrollMode="never"
        />
    );
});

export default MapWidget;

const styles = StyleSheet.create({ map: { flex: 1, backgroundColor: colors.canvas } });
