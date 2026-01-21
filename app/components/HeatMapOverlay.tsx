import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

interface FirePoint {
    latitude: number;
    longitude: number;
    brightness: number;
}

interface HeatMapOverlayProps {
    fireData: FirePoint[];
    mapRegion: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
}

export const HeatMapOverlay: React.FC<HeatMapOverlayProps> = ({
    fireData,
    mapRegion,
}) => {
    const { width, height } = Dimensions.get('window');

    // Convert lat/lon to screen coordinates
    const latToY = (lat: number) => {
        const relativeY = (mapRegion.latitude + mapRegion.latitudeDelta / 2 - lat) / mapRegion.latitudeDelta;
        return relativeY * height;
    };

    const lonToX = (lon: number) => {
        const relativeX = (lon - (mapRegion.longitude - mapRegion.longitudeDelta / 2)) / mapRegion.longitudeDelta;
        return relativeX * width;
    };

    // Get color based on brightness
    const getHeatColor = (brightness: number): { color: string; opacity: number } => {
        const intensity = Math.min((brightness - 300) / 100, 1);

        if (intensity < 0.3) {
            return { color: '#00FF00', opacity: 0.4 + intensity * 0.3 };
        } else if (intensity < 0.6) {
            return { color: '#FFFF00', opacity: 0.5 + intensity * 0.3 };
        } else {
            return { color: '#FF0000', opacity: 0.6 + intensity * 0.4 };
        }
    };

    return (
        <View style={[styles.container, { width, height }]} pointerEvents="none">
            <Svg width={width} height={height} style={styles.svg}>
                <Defs>
                    {fireData.map((fire, index) => {
                        const { color, opacity } = getHeatColor(fire.brightness);
                        const intensity = Math.min((fire.brightness - 300) / 100, 1);
                        const radius = 40 + intensity * 30;

                        return (
                            <RadialGradient
                                key={`gradient-${index}`}
                                id={`heat-${index}`}
                                cx="50%"
                                cy="50%"
                            >
                                <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
                                <Stop offset="50%" stopColor={color} stopOpacity={opacity * 0.5} />
                                <Stop offset="100%" stopColor={color} stopOpacity="0" />
                            </RadialGradient>
                        );
                    })}
                </Defs>

                {fireData.map((fire, index) => {
                    const x = lonToX(fire.longitude);
                    const y = latToY(fire.latitude);

                    // Skip if outside visible area
                    if (x < -100 || x > width + 100 || y < -100 || y > height + 100) return null;

                    const intensity = Math.min((fire.brightness - 300) / 100, 1);
                    const radius = 40 + intensity * 30;

                    return (
                        <Circle
                            key={`fire-${index}`}
                            cx={x}
                            cy={y}
                            r={radius}
                            fill={`url(#heat-${index})`}
                        />
                    );
                })}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    svg: {
        position: 'absolute',
    },
});
