import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

interface WindData {
  wind: { speed: number; deg: number };
}

interface Props {
  weatherData: WindData | null;
  visible: boolean;
}

const CORRIENTES = 12;
const PERIODO = 280;

function trayectoria(y: number, width: number, amplitude: number, phase: number) {
  const start = -PERIODO + phase;
  let d = `M ${start} ${y}`;
  for (let x = start; x < width + PERIODO; x += PERIODO) {
    d += ` Q ${x + PERIODO * 0.25} ${y + amplitude}`;
    d += ` ${x + PERIODO * 0.5} ${y}`;
    d += ` Q ${x + PERIODO * 0.75} ${y - amplitude}`;
    d += ` ${x + PERIODO} ${y}`;
  }
  return d;
}

/** Corrientes continuas orientadas hacia donde sopla el viento. */
export function WindParticles({ weatherData, visible }: Props) {
  const { width, height } = useWindowDimensions();
  const movement = useRef(new Animated.Value(0)).current;
  const size = Math.ceil(Math.hypot(width, height) + PERIODO * 2);

  const streams = useMemo(() => Array.from({ length: CORRIENTES }, (_, index) => ({
    id: index,
    y: (size / (CORRIENTES + 1)) * (index + 1),
    amplitude: 5 + (index % 4) * 1.5,
    phase: (index % 3) * 38,
    opacity: 0.62 + (index % 3) * 0.12,
  })), [size]);

  useEffect(() => {
    movement.stopAnimation();
    movement.setValue(0);
    if (!visible || !weatherData) return undefined;
    const kmh = Math.max(4, Number(weatherData.wind.speed || 0) * 3.6);
    const duration = Math.round(Math.min(12000, Math.max(4800, 90000 / kmh)));
    const animation = Animated.loop(Animated.timing(movement, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [visible, weatherData?.wind.deg, weatherData?.wind.speed, movement]);

  if (!visible || !weatherData || width < 1 || height < 1) return null;

  // El proveedor informa desde dónde viene; el flujo apunta 180° al otro lado.
  const toward = ((Number(weatherData.wind.deg) || 0) + 180) % 360;
  const rotation = `${toward - 90}deg`;
  const translateX = movement.interpolate({
    inputRange: [0, 1],
    outputRange: [-PERIODO, 0],
  });
  const extendedWidth = size + PERIODO * 2;

  return (
    <View style={styles.layer} pointerEvents="none">
      <View style={[
        styles.field,
        {
          width: size,
          height: size,
          left: (width - size) / 2,
          top: (height - size) / 2,
          transform: [{ rotate: rotation }],
        },
      ]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="windBase" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#DCEEFF" stopOpacity="0" />
              <Stop offset="0.18" stopColor="#DCEEFF" stopOpacity="0.08" />
              <Stop offset="0.82" stopColor="#DCEEFF" stopOpacity="0.08" />
              <Stop offset="1" stopColor="#DCEEFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {streams.map(stream => (
            <Path
              key={`base-${stream.id}`}
              d={trayectoria(stream.y, size, stream.amplitude, stream.phase)}
              fill="none"
              stroke="url(#windBase)"
              strokeWidth={1}
              strokeLinecap="round"
            />
          ))}
        </Svg>

        <Animated.View style={[
          styles.moving,
          { width: extendedWidth, height: size, transform: [{ translateX }] },
        ]}>
          <Svg width={extendedWidth} height={size}>
            {streams.map(stream => (
              <Path
                key={`flow-${stream.id}`}
                d={trayectoria(stream.y, extendedWidth, stream.amplitude, stream.phase)}
                fill="none"
                stroke="#E7F3FF"
                strokeOpacity={0.17 * stream.opacity}
                strokeWidth={1}
                strokeLinecap="round"
                strokeDasharray={`${Math.round(PERIODO * 0.8)} ${Math.round(PERIODO * 0.2)}`}
              />
            ))}
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    overflow: 'hidden',
  },
  field: { position: 'absolute', overflow: 'hidden' },
  moving: { position: 'absolute', left: 0, top: 0 },
});
