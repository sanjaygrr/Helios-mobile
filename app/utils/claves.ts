/** Clave de despacho chilena (2-x). No es el orden alfabético del nombre. */
export const CLAVES_CARRO = [
  { id: 'BOMBA', nombre: 'Bomba', clave: 'B' },
  { id: 'PORTAESCALAS', nombre: 'Portaescalas', clave: 'Q' },
  { id: 'RESCATE', nombre: 'Rescate', clave: 'R' },
  { id: 'ALJIBE', nombre: 'Aljibe', clave: 'Z' },
  { id: 'HAZMAT', nombre: 'Hazmat', clave: 'H' },
  { id: 'ESCALA', nombre: 'Escala', clave: 'M' },
  { id: 'FORESTAL', nombre: 'Forestal', clave: 'F' },
  { id: 'URBANO', nombre: 'Urbano', clave: '' },
  { id: 'APOYO', nombre: 'Apoyo', clave: '' },
] as const;

export function etiquetaCarro(tipo?: string | null, display?: string | null) {
  const item = CLAVES_CARRO.find(c => c.id === tipo);
  if (item) return item.clave ? `${item.nombre} ${item.clave}` : item.nombre;
  return display || tipo || 'Sin especialidad';
}

export function ordenCarro(tipo?: string | null) {
  const i = CLAVES_CARRO.findIndex(c => c.id === tipo);
  return i === -1 ? CLAVES_CARRO.length : i;
}

export function ordenEtiqueta(texto?: string | null) {
  const t = (texto || '').trim();
  const i = CLAVES_CARRO.findIndex(c => {
    const et = c.clave ? `${c.nombre} ${c.clave}` : c.nombre;
    return et === t || c.id === t || c.nombre === t;
  });
  return i === -1 ? CLAVES_CARRO.length : i;
}

export function compararCarros(
  a: { unit_type?: string | null; name?: string | null },
  b: { unit_type?: string | null; name?: string | null },
) {
  const d = ordenCarro(a.unit_type) - ordenCarro(b.unit_type);
  if (d) return d;
  return String(a.name || '').localeCompare(String(b.name || ''), 'es', { numeric: true });
}

export const TIPOS_CARRO = CLAVES_CARRO.map(c => ({
  id: c.id,
  label: c.clave ? `${c.nombre} ${c.clave}` : c.nombre,
}));
