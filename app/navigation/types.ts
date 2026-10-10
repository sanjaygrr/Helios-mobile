import type { NavigatorScreenParams } from '@react-navigation/native';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'COMPANY_ADMIN'
  | 'COMPANY_CHIEF'
  | 'FIREFIGHTER';

export type MandoRole = Exclude<UserRole, 'FIREFIGHTER'>;

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Despacho: { incidentId?: number; returnToLive?: boolean } | undefined;
  EmergenciaViva: { incidentId: number };
  Ajustes: undefined;
};

export type MandoTabParamList = {
  Mapa: undefined;
  Recursos: NavigatorScreenParams<RecursosStackParamList> | undefined;
  Gestion: NavigatorScreenParams<GestionStackParamList> | undefined;
};

export type RecursosStackParamList = {
  RecursosInicio: undefined;
  Unidad: undefined;
  Unidades: undefined;
  Carros: undefined;
};

export type GestionStackParamList = {
  GestionInicio: undefined;
  Usuarios: undefined;
  Companias: undefined;
  Emergencias: { crear?: boolean } | undefined;
};

export type BomberoStackParamList = {
  MiDespacho: undefined;
  MiEstado: undefined;
};
