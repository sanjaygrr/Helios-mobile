import type { UserRole } from '../navigation/types';

export type Vista = 'CUERPO' | 'COMPANIA' | 'CARRO' | 'BOMBERO';

export const VISTAS: { id: Vista; label: string; detalle: string }[] = [
  { id: 'CUERPO', label: 'Central comunal', detalle: 'La central del cuerpo, en su comuna' },
  { id: 'COMPANIA', label: 'Comandante comunal', detalle: 'Mando de la comuna: compañías, carros y personas' },
  { id: 'CARRO', label: 'OBAC', detalle: 'El carro, el mapa y quién va en él' },
  { id: 'BOMBERO', label: 'Bombero', detalle: 'Solo el despacho que le llega' },
];

export function esVista(value: string | null): value is Vista {
  return VISTAS.some(vista => vista.id === value);
}

const CUENTAS_CON_VISTA = new Set([
  'sanjaygrr@helios.com',
  'franciscoo.barriga.d@gmail.com',
]);

export function puedePrevisualizar(user?: { role?: string | null; email?: string | null } | null) {
  const email = (user?.email || '').trim().toLowerCase();
  return user?.role === 'SUPER_ADMIN' && CUENTAS_CON_VISTA.has(email);
}

export function rolDeVista(vista: Vista): UserRole {
  if (vista === 'CUERPO') return 'SUPER_ADMIN';
  if (vista === 'COMPANIA') return 'COMPANY_ADMIN';
  if (vista === 'BOMBERO') return 'FIREFIGHTER';
  return 'COMPANY_CHIEF';
}
