import type { AddonKey } from '@/config/saas-plans';

/**
 * Catálogo de ítems del menú que el Super Admin puede activar/desactivar por
 * escuela (tabla `school_module_overrides`, RPC `admin_set_school_module`).
 * Es una capa independiente de los addons comerciales: un ítem con `addon`
 * definido (Contabilidad, Control de Acceso) sigue necesitando el addon
 * activo — este mecanismo solo puede APAGAR por encima, nunca sustituir la
 * compra del addon (fórmula "derecho AND no apagado", ver
 * docs/specs/capacidades-de-la-escuela-2026-08-18.md §14.3).
 *
 * Fuente de verdad en TypeScript, no en BD — mismo patrón que
 * `AddonKey`/`ADDONS` en `saas-plans.ts`: el catálogo cambia junto con
 * `navigation.ts` en el mismo commit. La tabla en BD solo guarda overrides
 * por escuela, con un CHECK que enumera estas mismas claves (ampliar ambos
 * lados juntos si se agrega un módulo).
 */
export type ModuleKey =
  | 'gestion_deportiva_equipos_planes'
  | 'gestion_deportiva_calendario'
  | 'gestion_deportiva_entrenamiento_metricas'
  | 'gestion_deportiva_entrenamiento_rutinas'
  | 'gestion_deportiva_informe_mensual'
  | 'finanzas_pagos'
  | 'finanzas_recepcion'
  | 'finanzas_contabilidad'
  | 'reportes_finanzas'
  | 'reportes_reportes'
  | 'reportes_panel'
  | 'documentos_carnets'
  | 'documentos_constancias'
  | 'documentos_qr_inscripcion'
  | 'documentos_recordatorios'
  | 'documentos_plantillas_mensajes'
  | 'sedes_sedes'
  | 'sedes_instalaciones'
  | 'sedes_control_acceso'
  | 'cuenta_perfil_publico';

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  group: 'Gestión Deportiva' | 'Finanzas' | 'Reportes' | 'Documentos e Identidad' | 'Sedes e Instalaciones' | 'Cuenta';
  /**
   * Si está definido, la visibilidad efectiva del ítem sigue siendo
   * `hasAddon(addon) AND isModuleEnabled(key)` — el override de este catálogo
   * nunca reemplaza al addon, solo puede apagar por encima.
   */
  addon?: AddonKey;
}

export const MODULE_CATALOG: Record<ModuleKey, ModuleDefinition> = {
  gestion_deportiva_equipos_planes: {
    key: 'gestion_deportiva_equipos_planes',
    label: 'Equipos y Planes',
    group: 'Gestión Deportiva',
  },
  gestion_deportiva_calendario: {
    key: 'gestion_deportiva_calendario',
    label: 'Calendario',
    group: 'Gestión Deportiva',
  },
  gestion_deportiva_entrenamiento_metricas: {
    key: 'gestion_deportiva_entrenamiento_metricas',
    label: 'Métricas y Rendimiento',
    group: 'Gestión Deportiva',
  },
  gestion_deportiva_entrenamiento_rutinas: {
    key: 'gestion_deportiva_entrenamiento_rutinas',
    label: 'Gestión de Rutinas',
    group: 'Gestión Deportiva',
  },
  gestion_deportiva_informe_mensual: {
    key: 'gestion_deportiva_informe_mensual',
    label: 'Informe Mensual',
    group: 'Gestión Deportiva',
  },
  finanzas_pagos: {
    key: 'finanzas_pagos',
    label: 'Pagos',
    group: 'Finanzas',
  },
  finanzas_recepcion: {
    key: 'finanzas_recepcion',
    label: 'Modo Recepción',
    group: 'Finanzas',
  },
  finanzas_contabilidad: {
    key: 'finanzas_contabilidad',
    label: 'Contabilidad',
    group: 'Finanzas',
    addon: 'accounting',
  },
  reportes_finanzas: {
    key: 'reportes_finanzas',
    label: 'Finanzas',
    group: 'Reportes',
  },
  reportes_reportes: {
    key: 'reportes_reportes',
    label: 'Reportes',
    group: 'Reportes',
  },
  reportes_panel: {
    key: 'reportes_panel',
    label: 'Panel de Reportes',
    group: 'Reportes',
  },
  documentos_carnets: {
    key: 'documentos_carnets',
    label: 'Carnets',
    group: 'Documentos e Identidad',
  },
  documentos_constancias: {
    key: 'documentos_constancias',
    label: 'Constancias',
    group: 'Documentos e Identidad',
  },
  documentos_qr_inscripcion: {
    key: 'documentos_qr_inscripcion',
    label: 'QR de Inscripción',
    group: 'Documentos e Identidad',
  },
  documentos_recordatorios: {
    key: 'documentos_recordatorios',
    label: 'Recordatorios',
    group: 'Documentos e Identidad',
  },
  documentos_plantillas_mensajes: {
    key: 'documentos_plantillas_mensajes',
    label: 'Plantillas de Mensajes',
    group: 'Documentos e Identidad',
  },
  sedes_sedes: {
    key: 'sedes_sedes',
    label: 'Sedes',
    group: 'Sedes e Instalaciones',
  },
  sedes_instalaciones: {
    key: 'sedes_instalaciones',
    label: 'Instalaciones',
    group: 'Sedes e Instalaciones',
  },
  sedes_control_acceso: {
    key: 'sedes_control_acceso',
    label: 'Control de Acceso',
    group: 'Sedes e Instalaciones',
    addon: 'access_control',
  },
  cuenta_perfil_publico: {
    key: 'cuenta_perfil_publico',
    label: 'Mi Perfil Público',
    group: 'Cuenta',
  },
};

export const MODULE_GROUPS: ModuleDefinition['group'][] = [
  'Gestión Deportiva',
  'Finanzas',
  'Reportes',
  'Documentos e Identidad',
  'Sedes e Instalaciones',
  'Cuenta',
];
