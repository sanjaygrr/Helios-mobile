// Lumbre — sistema visual
//
// Oscuro por defecto: la app se usa de noche y el blanco encandila.
// El rojo de marca (#FF1E00) NO se usa como relleno: con texto blanco da 3.86:1
// y reprueba WCAG AA. Queda como riel de severidad crítica y marca.
//
// `primary` es el relleno de acción (texto blanco encima, 5.52:1).
// `accent`  es el mismo gesto para texto, íconos y bordes sobre lienzo oscuro (6.96:1).
// La rampa `gray` está INVERTIDA respecto a la convención web: gray[50] es la más
// oscura. Así el código existente (fondos en gray[50]/[100], texto en gray[500])
// queda correcto sin tocarlo.

export const colors = {
  // Marca
  brand: '#FF1E00',        // solo logo y riel de severidad crítica

  // Acción
  primary: '#C4320A',      // relleno de botón — blanco encima 5.52:1
  accent: '#FF7A18',       // texto / ícono / borde sobre oscuro — 6.96:1
  secondary: '#5EE0A0',    // confirmación
  highlight: '#FF7A18',

  // Neutros (INVERTIDOS: 50 = más oscuro)
  white: '#FFFFFF',        // texto sobre rellenos de color
  black: '#000000',
  gray: {
    50: '#12161B',   // lienzo
    100: '#1A1F26',  // superficie
    200: '#222B33',  // superficie elevada
    300: '#2E3942',  // separadores
    400: '#7D8794',  // bordes · 4.99:1
    500: '#AEB6C0',  // texto secundario · 8.87:1
    600: '#C4CBD3',
    700: '#D5DBE2',  // texto fuerte · 13.02:1
    800: '#E6EAEE',
    900: '#F3F5F7',  // texto principal · 16.62:1
  },

  // Semánticos — ya no colapsan en dos colores
  danger: '#FFB4A2',       // 10.64:1
  dangerFill: '#C4320A',
  warning: '#FFD36A',      // 12.78:1
  warningFill: '#7A4A00',
  success: '#5EE0A0',      // 9.61:1
  successFill: '#085D3A',
  info: '#8EBEF5',         // 8.49:1
  infoFill: '#0B3D82',

  // Severidad de emergencia — cuatro peldaños distinguibles
  sevCritica: '#FF1E00',
  sevAlta: '#FF8A3D',
  sevMedia: '#FFD36A',
  sevBaja: '#8EBEF5',

  // Superficies
  background: '#12161B',
  backgroundDark: '#0C1013',
  surface: '#1A1F26',
  surfaceDark: '#222B33',
  border: '#7D8794',

  // Texto
  text: '#F3F5F7',
  textLight: '#AEB6C0',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#12161B',
};

// Estado del carro — par texto/fondo por estado de UnitAssignment
export const unitStatus = {
  DISPATCHED: { text: '#FF8A3D', bg: '#3A1C0C', label: 'Despachado' },
  EN_ROUTE:   { text: '#8EBEF5', bg: '#102033', label: 'En camino' },
  ON_SCENE:   { text: '#FFB4A2', bg: '#3A1614', label: 'En el lugar' },
  RETURNING:  { text: '#C9A6EE', bg: '#241833', label: 'Regresando' },
  RELEASED:   { text: '#5EE0A0', bg: '#10261C', label: 'Liberado' },
} as const;

// En oscuro la sombra no se ve: la elevación es salto de superficie + borde.
export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 6 },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const borderRadius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 };

// Altura mínima de toque: con guantes, en movimiento.
export const touch = 56;

// Mínimo que decide una acción: 18px. Usuarios mayores leyendo dentro del carro.
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
