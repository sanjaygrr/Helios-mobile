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

const COLUMNAS = 4;
const FILAS = 4;
const RECORRIDO = 160;

/**
 * Rachas cortas, todas en la misma dirección: hacia donde sopla el viento.
 * OpenWeather dice de dónde viene, así que se invierte 180°.
 * El giro va en el contenedor y el movimiento solo en el eje largo,
 * para que no se abran en diagonal.
 */
export function WindParticles({ weatherData, visible }: Props) {
  const { width, height } = useWindowDimensions();
  const total = COLUMNAS * FILAS;
  const progresos = useRef(Array.from({ length: total }, () => new Animated.Value(0))).current;

  const semillas = useMemo(
    () => Array.from({ length: total }, (_, id) => ({
      id,
      col: id % COLUMNAS,
      fila: Math.floor(id / COLUMNAS),
      largo: 22 + (id % 3) * 10,
      espera: (id % 5) * 0.16,
    })),
    [],
  );

  useEffect(() => {
    if (!visible || !weatherData) return undefined;
    const kmh = Math.max(6, (weatherData.wind.speed || 0) * 3.6);
    const duracion = Math.round(Math.min(12000, Math.max(5600, 200000 / kmh)));
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
  }, [visible, weatherData?.wind.deg, weatherData?.wind.speed, progresos, semillas]);

  if (!visible || !weatherData || width < 1 || height < 1) return null;

  const hacia = ((weatherData.wind.deg || 0) + 180) % 360;
  const rad = (hacia * Math.PI) / 180;
  const giro = `${hacia - 90}deg`;
  const ox = -Math.sin(rad) * 70;
  const oy = Math.cos(rad) * 70;

  return (
    <View style={estilos.capa} pointerEvents="none">
      {semillas.map((s, i) => {
        const progreso = progresos[i];
        return (
          <View
            key={s.id}
            style={{
              position: 'absolute',
              left: ((s.col + 0.5) / COLUMNAS) * width + ox,
              top: ((s.fila + 0.5) / FILAS) * height + oy,
              width: s.largo,
              height: 2,
              transform: [{ rotate: giro }],
            }}
          >
            <Animated.View
              style={{
                width: s.largo,
                height: 1.5,
                borderRadius: 1,
                backgroundColor: 'rgba(255,255,255,0.9)',
                opacity: progreso.interpolate({
                  inputRange: [0, 0.15, 0.7, 1],
                  outputRange: [0, 0.42, 0.28, 0],
                }),
                transform: [{
                  translateX: progreso.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-s.largo, RECORRIDO],
                  }),
                }],
              }}
            />
          </View>
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
