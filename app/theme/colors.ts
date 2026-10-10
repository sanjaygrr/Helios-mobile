// Lumbre — sistema visual
//
// Regla de jerarquía (lo que estaba roto antes): competían cinco rojos y naranjas
// al mismo peso, así que botón, ícono, severidad y marca gritaban igual.
//   · un solo relleno de acción .......... primary
//   · un solo acento de lectura .......... accent
//   · brand solo para el logo y la severidad crítica
//
// Oscuro siempre: se usa de noche y el blanco encandila.
// La rampa `gray` está INVERTIDA: gray[50] es la más oscura.

export const colors = {
  brand: '#FF1E00',            // logo y severidad crítica, nada más

  // Acción: vuelve el rojo marrón aprobado anteriormente.
  primary: '#B82E0A',          // relleno de botón — blanco encima 6.12:1
  primaryPressed: '#8F2408',
  accent: '#FF8A3D',           // texto, íconos y bordes sobre oscuro — 8.01:1
  accentMuted: '#C45A18',
  secondary: '#3DDC97',
  highlight: '#FF8A3D',

  // Superficies
  canvas: '#0E1217',
  background: '#0E1217',
  surface: '#161C24',
  surfaceRaised: '#1C232B',
  surfaceOverlay: '#141A21',   // base de lo que flota sobre el mapa
  backgroundDark: '#0A0D11',
  surfaceDark: '#1C232B',

  // Bordes
  border: '#3A4550',
  borderSubtle: 'rgba(255,255,255,0.14)',

  // Texto
  text: '#F5F7FA',             // 17.51:1 sobre canvas
  textMuted: '#A8B0BA',        // 8.58:1
  textLight: '#A8B0BA',
  textDisabled: '#6B7380',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#0E1217',
  white: '#FFFFFF',            // solo texto sobre rellenos de color
  black: '#000000',

  // Semánticos — cada uno su color, ya no colapsan de a dos
  danger: '#FFB4A2',
  dangerFill: '#B82E0A',
  warning: '#FFC43D',
  warningFill: '#7A4A00',
  success: '#3DDC97',
  successFill: '#0A5C3A',
  info: '#7EB6F0',
  infoFill: '#0B3D82',

  // Severidad de emergencia
  sevCritica: '#FF1E00',
  sevAlta: '#FF8A3D',
  sevMedia: '#FFC43D',
  sevBaja: '#7EB6F0',

  // Capas
  scrim: 'rgba(14,18,23,0.72)',
  pressOverlay: 'rgba(255,255,255,0.08)',
  disabledOverlay: 'rgba(14,18,23,0.55)',

  // Rampa invertida: 50 = más oscura
  gray: {
    50: '#0E1217',
    100: '#161C24',
    200: '#1C232B',
    300: '#2A333D',
    400: '#3A4550',
    500: '#6B7380',
    600: '#A8B0BA',
    700: '#C9D0D8',
    800: '#E2E6EB',
    900: '#F5F7FA',
  },
};

// Lo que flota sobre el mapa. Antes era blanco con texto claro: 1.09:1, ilegible.
// Esta receta se lee sobre cualquier tesela porque no depende del mapa.
export const overlay = {
  backgroundColor: colors.surfaceOverlay,
  opacity: 0.94,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.45,
  shadowRadius: 12,
  elevation: 8,
};

// Marcadores: la forma distingue el tipo, no solo el color.
// Antes se coloreaban por hash del id, así que no se leía ni rol ni estado.
export const marcador = {
  bombero:    { forma: 'circulo' as const,  tam: 30, sel: 38, relleno: colors.accent,
                icono: 'account' as const },
  carro:      { forma: 'cuadrado' as const, tam: 32, sel: 40, relleno: colors.primary,
                icono: 'fire-truck' as const },
  emergencia: { forma: 'diamante' as const, tam: 32, sel: 40, relleno: colors.brand,
                icono: 'fire' as const },
  anillo: colors.white,
  anilloAncho: 2,
  opacidadNoSeleccionado: 0.85,
};

// Estado del carro en un despacho
export const unitStatus = {
  DISPATCHED:     { text: '#FF8A3D', bg: '#3A1C0C', label: 'Despachado' },
  EN_ROUTE:       { text: '#7EB6F0', bg: '#102033', label: 'En camino' },
  ON_SCENE:       { text: '#FFB4A2', bg: '#3A1614', label: 'En el lugar' },
  RETURNING:      { text: '#C9A6EE', bg: '#241833', label: 'Regresando' },
  RECONDITIONING: { text: '#FFD36A', bg: '#3B2A10', label: 'Reacondicionando' },
  RELEASED:       { text: '#3DDC97', bg: '#0A2A1E', label: 'Liberado' },
} as const;

// En oscuro la sombra casi no se ve: la elevación es salto de superficie + borde.
export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 5 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 9 },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const borderRadius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 };

// Con guantes, de noche, en movimiento.
export const touch = 56;

export const typography = {
  h1:        { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  h2:        { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  h3:        { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  body:      { fontSize: 18, fontWeight: '400' as const, lineHeight: 26 },
  bodySmall: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  label:     { fontSize: 16, fontWeight: '700' as const, lineHeight: 22 },
  button:    { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  caption:   { fontSize: 14, fontWeight: '400' as const, lineHeight: 18 },
};
