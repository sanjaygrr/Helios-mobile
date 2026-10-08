import React, { useMemo, useState } from 'react';
import {
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, borderRadius, touch } from '../theme/colors';

export type Criterio<T> = {
  clave: string;
  etiqueta: string;
  grupo: (item: T) => string;
};

type Props<T> = {
  datos: T[];
  criterios: Criterio<T>[];
  claveItem: (item: T) => string;
  render: (item: T) => React.ReactElement;
  buscarEn?: (item: T) => string;
  vacio?: React.ReactElement;
};

/**
 * Lista agrupada con selector de criterio y buscador.
 *
 * El super admin ve los 44 carros y las 27 compañías de cuatro cuerpos: una
 * lista plana es inservible. Agrupa por ciudad, por compañía o por cuerpo,
 * y cada encabezado se puede plegar.
 */
export default function ListaAgrupada<T>({
  datos,
  criterios,
  claveItem,
  render,
  buscarEn,
  vacio,
}: Props<T>) {
  const [criterio, setCriterio] = useState(criterios[0]?.clave);
  const [busqueda, setBusqueda] = useState('');
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});

  const activo = criterios.find(c => c.clave === criterio) || criterios[0];

  const secciones = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filtrados = texto && buscarEn
      ? datos.filter(d => buscarEn(d).toLowerCase().includes(texto))
      : datos;

    const mapa = new Map<string, T[]>();
    filtrados.forEach(d => {
      const g = activo?.grupo(d) || 'Sin asignar';
      if (!mapa.has(g)) mapa.set(g, []);
      mapa.get(g)!.push(d);
    });

    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([titulo, items]) => ({
        titulo,
        total: items.length,
        data: plegados[titulo] ? [] : items,
      }));
  }, [datos, activo, busqueda, plegados, buscarEn]);

  const totalVisible = secciones.reduce((n, s) => n + s.total, 0);
  const todosPlegados = secciones.length > 0 && secciones.every(s => plegados[s.titulo]);

  const alternarTodos = () => {
    if (todosPlegados) {
      setPlegados({});
    } else {
      setPlegados(Object.fromEntries(secciones.map(s => [s.titulo, true])));
    }
  };

  return (
    <View style={estilos.contenedor}>
      {buscarEn && (
        <View style={estilos.buscador}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={estilos.input}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={12}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {criterios.length > 1 && (
        <View style={estilos.criterios}>
          <Text style={estilos.criteriosEtiqueta}>Agrupar por</Text>
          <View style={estilos.criteriosFila}>
            {criterios.map(c => {
              const sel = c.clave === activo?.clave;
              return (
                <TouchableOpacity
                  key={c.clave}
                  onPress={() => { setCriterio(c.clave); setPlegados({}); }}
                  activeOpacity={0.7}
                  style={[estilos.chip, sel && estilos.chipActivo]}
                >
                  <Text style={[estilos.chipTexto, sel && estilos.chipTextoActivo]}>
                    {c.etiqueta}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <SectionList
        sections={secciones}
        keyExtractor={item => claveItem(item)}
        renderItem={({ item }) => render(item)}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }: any) => {
          const plegado = !!plegados[section.titulo];
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                setPlegados(p => ({ ...p, [section.titulo]: !p[section.titulo] }))
              }
              style={estilos.encabezado}
            >
              <Ionicons
                name={plegado ? 'chevron-forward' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
              <Text style={estilos.encabezadoTexto} numberOfLines={1}>
                {section.titulo}
              </Text>
              <Text style={estilos.encabezadoTotal}>{section.total}</Text>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          totalVisible > 0 ? (
            <View style={estilos.resumenFila}>
              <Text style={estilos.resumen}>
                {totalVisible} {totalVisible === 1 ? 'resultado' : 'resultados'} en{' '}
                {secciones.length} {secciones.length === 1 ? 'grupo' : 'grupos'}
              </Text>
              {secciones.length > 1 && (
                <TouchableOpacity
                  onPress={alternarTodos}
                  activeOpacity={0.7}
                  hitSlop={10}
                  style={estilos.alternar}
                >
                  <Ionicons
                    name={todosPlegados ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color={colors.accent}
                  />
                  <Text style={estilos.alternarTexto}>
                    {todosPlegados ? 'Abrir todo' : 'Cerrar todo'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={vacio}
        contentContainerStyle={estilos.lista}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.background },
  lista: { paddingBottom: spacing.xxl },

  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: touch,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 0 },

  criterios: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  criteriosEtiqueta: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  criteriosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTexto: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  chipTextoActivo: { color: colors.textOnPrimary },

  resumenFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  resumen: { fontSize: 14, color: colors.textMuted, flex: 1 },
  alternar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: spacing.md,
  },
  alternarTexto: { fontSize: 15, fontWeight: '700', color: colors.accent },

  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  encabezadoTexto: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  encabezadoTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
});
