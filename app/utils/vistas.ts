import type { UserRole } from '../navigation/types';

export type Vista = 'CUERPO' | 'COMPANIA' | 'CARRO' | 'BOMBERO';

export const VISTAS: { id: Vista; label: string; detalle: string }[] = [
  { id: 'CUERPO', label: 'Central regional', detalle: 'Vista general de la región, sus comunas y emergencias' },
  { id: 'COMPANIA', label: 'Comandante comunal', detalle: 'Mando de la comuna: compañías, carros y personas' },
  { id: 'CARRO', label: 'Jefe de carro', detalle: 'El carro y quién va en él' },
  { id: 'BOMBERO', label: 'Bombero', detalle: 'Solo el despacho que le llega' },
];

export function esVista(value: string | null): value is Vista {
  return VISTAS.some(vista => vista.id === value);
}

export function puedePrevisualizar(role?: string | null) {
  return role === 'SUPER_ADMIN';
}

export function rolDeVista(vista: Vista): UserRole {
  if (vista === 'CUERPO') return 'SUPER_ADMIN';
  if (vista === 'COMPANIA') return 'COMPANY_ADMIN';
  if (vista === 'BOMBERO') return 'FIREFIGHTER';
  return 'COMPANY_CHIEF';
}
