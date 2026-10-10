import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../theme/colors';
import { RouteMapWidgetProps } from './types';

function safeJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

export default function RouteMapWidget({ routeCoordinates, startCoordinate, endCoordinate, style }: RouteMapWidgetProps) {
    const html = useMemo(() => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;width:100%;margin:0;background:${colors.canvas}}.leaflet-control-attribution{font:9px system-ui;background:rgba(14,18,23,.82)!important;color:${colors.textMuted}!important}.route-dot{width:22px;height:22px;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px #000}</style>
</head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const route=${safeJson(routeCoordinates)},start=${safeJson(startCoordinate ?? null)},end=${safeJson(endCoordinate ?? null)};
const fallback=start||end||route[0]||{latitude:-33.45,longitude:-70.66};
const map=L.map('map').setView([fallback.latitude,fallback.longitude],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
const latlngs=route.map(p=>[p.latitude,p.longitude]);
if(latlngs.length){L.polyline(latlngs,{color:'${colors.primary}',weight:5}).addTo(map);if(latlngs.length>1)map.fitBounds(latlngs,{padding:[28,28]});}
const dot=(point,color,title)=>{if(!point)return;const icon=L.divIcon({className:'',html:'<div class="route-dot" style="background:'+color+'" title="'+title+'"></div>',iconSize:[28,28],iconAnchor:[14,14]});L.marker([point.latitude,point.longitude],{icon}).addTo(map)};
dot(start,'${colors.success}','Inicio');dot(end,'${colors.dangerFill}','Fin');
</script></body></html>`, [routeCoordinates, startCoordinate, endCoordinate]);

    return (
        <WebView
            style={[styles.map, style]}
            source={{ html, baseUrl: 'https://www.openstreetmap.org' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            overScrollMode="never"
        />
    );
}

const styles = StyleSheet.create({ map: { width: '100%', height: '100%', backgroundColor: colors.canvas } });
