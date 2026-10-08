import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  borderRadius,
  colors,
  shadows,
  spacing,
  touch,
} from '../theme/colors';

export interface EstadoVacioProps {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto: string;
  botonTexto?: string;
  onPressBoton?: () => void;
}

export default function EstadoVacio({
  icono,
  titulo,
  texto,
  botonTexto,
  onPressBoton,
}: EstadoVacioProps) {
  const mostrarBoton = Boolean(botonTexto && onPressBoton);

  return (
    <View style={styles.container}>
      <View style={styles.iconoContainer}>
        <Ionicons name={icono} size={spacing.xl} color={colors.primary} />
      </View>

      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.texto}>{texto}</Text>

      {mostrarBoton ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={botonTexto}
          activeOpacity={0.7}
          onPress={onPressBoton}
          style={styles.boton}
        >
          <Text style={styles.botonTexto}>{botonTexto}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  iconoContainer: {
    width: touch * 2,
    height: touch * 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  titulo: {
    color: colors.text,
    fontSize: spacing.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  texto: {
    marginTop: spacing.sm,
    color: colors.textLight,
    fontSize: spacing.md,
    lineHeight: spacing.lg,
    textAlign: 'center',
  },
  boton: {
    minWidth: touch,
    minHeight: touch,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  botonTexto: {
    color: colors.white,
    fontSize: spacing.md,
    fontWeight: '700',
    textAlign: 'center',
  },
});
