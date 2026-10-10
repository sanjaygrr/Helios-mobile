import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

interface WindData {
  wind: {
    speed: number;
    deg: number;
  };
}

interface Props {
  weatherData: WindData | null;
  visible: boolean;
}

const CANTIDAD = 42;

/**
 * Rachas cortas que cruzan el mapa en la dirección hacia donde sopla el viento.
 * OpenWeather entrega la dirección de donde viene: se invierte 180°.
 */
export function WindParticles({ weatherData, visible }: Props) {
  const { width, height } = useWindowDimensions();
  const progresos = useRef(Array.from({ length: CANTIDAD }, () => new Animated.Value(0))).current;

  const semillas = useMemo(
    () => Array.from({ length: CANTIDAD }, (_, id) => ({
      id,
      x: Math.random(),
      y: Math.random(),
      espera: Math.random(),
      largo: 16 + Math.random() * 26,
      grosor: Math.random() > 0.7 ? 2.2 : 1.4,
    })),
    [width, height],
  );

  useEffect(() => {
    if (!visible || !weatherData) return undefined;
    const kmh = Math.max(4, (weatherData.wind.speed || 0) * 3.6);
    const duracion = Math.round(Math.min(9000, Math.max(2200, 150000 / kmh)));
    const loops = progresos.map((valor, i) => {
      valor.setValue(0);
      const loop = Animated.sequence([
        Animated.delay(semillas[i].espera * duracion),
        Animated.loop(
          Animated.timing(valor, {
            toValue: 1,
            duration: duracion,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ),
      ]);
      loop.start();
      return loop;
    });
    return () => {
      loops.forEach(loop => loop.stop());
    };
  }, [visible, weatherData, progresos, semillas]);

  if (!visible || !weatherData || width < 1 || height < 1) return null;

  const viaje = Math.hypot(width, height) * 1.15;
  const hacia = ((weatherData.wind.deg || 0) + 180) % 360;
  const rad = (hacia * Math.PI) / 180;
  const dx = Math.sin(rad) * viaje;
  const dy = -Math.cos(rad) * viaje;
  const giro = `${hacia - 90}deg`;

  return (
    <View style={estilos.capa} pointerEvents="none">
      {semillas.map((s, i) => {
        const x0 = s.x * width - dx * 0.5;
        const y0 = s.y * height - dy * 0.5;
        const progreso = progresos[i];
        return (
          <Animated.View
            key={s.id}
            style={{
              position: 'absolute',
              width: s.largo,
              height: s.grosor,
              borderRadius: 2,
              backgroundColor: 'rgba(245,247,250,0.72)',
              opacity: progreso.interpolate({
                inputRange: [0, 0.08, 0.82, 1],
                outputRange: [0, 0.85, 0.85, 0],
              }),
              transform: [
                { translateX: progreso.interpolate({ inputRange: [0, 1], outputRange: [x0, x0 + dx] }) },
                { translateY: progreso.interpolate({ inputRange: [0, 1], outputRange: [y0, y0 + dy] }) },
                { rotate: giro },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  capa: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    overflow: 'hidden',
  },
});
