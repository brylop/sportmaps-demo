/**
 * SportMaps SaaS — Source of Truth de planes, addons y features.
 *
 * Este archivo se duplica EXACTAMENTE en la landing pública
 * (`Landing_page/sportmap-maps-landing-page/frontend/src/config/saas-plans.ts`).
 * Cualquier cambio aquí debe replicarse allá en el mismo PR / commit.
 *
 * Define el universo cerrado de:
 *   - 5 tiers de Academia (starter → enterprise)
 *   - 8 addons ortogonales
 *   - Map de features → tier mínimo / addon requerido / límite numérico
 *
 * Los componentes <EntitlementGate /> y <UpgradeModal /> leen
 * exclusivamente de aquí — no hay strings sueltos en pantallas.
 */

// ============================================================
// Tipos
// ============================================================

export type TierCode =
  | 'starter'
  | 'crecimiento'
  | 'profesional'
  | 'elite'
  | 'enterprise';

export type TierInternal = 'free' | 'pro' | 'enterprise';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'trial_expired'
  | 'past_due'
  | 'cancelled'
  | 'grandfathered';

export type AddonKey =
  | 'tournaments'
  | 'access_control'
  | 'biomech'
  | 'nutrition'
  | 'whitelabel'
  | 'whatsapp'
  | 'wompi'
  | 'mp';

export type FeatureKey =
  // Núcleo Academia
  | 'athletes'
  | 'teams'
  | 'branches'
  | 'coaches'
  | 'attendance_manual'
  | 'attendance_qr'
  | 'attendance_multi_coach'
  | 'calendar_basic'
  | 'calendar_resources'
  | 'calendar_supervision'
  | 'messages_direct'
  | 'messages_templates'
  | 'messages_bulk'
  | 'announcements'
  // Pagos
  | 'payments_manual'
  | 'payments_online_addon'
  | 'payments_online_included'
  // Marketplace
  | 'marketplace_basic'
  | 'marketplace_pro'
  | 'marketplace_elite'
  // Certificados
  | 'certificates_predefined'
  | 'certificates_custom'
  // Reportes y analytics
  | 'reports_basic'
  | 'analytics_advanced'
  | 'finance_advanced'
  // Médico / rendimiento
  | 'medical_history'
  | 'physical_evaluations'
  // Roles y permisos
  | 'secondary_roles'
  // API
  | 'api_read'
  | 'api_write'
  // Branding
  | 'branding_basic'
  | 'branding_full'
  | 'custom_subdomain'
  // Soporte
  | 'support_docs'
  | 'support_email'
  | 'support_chat'
  | 'support_whatsapp'
  | 'support_sla'
  | 'assisted_onboarding';

export interface TierDefinition {
  code: TierCode;
  internal: TierInternal;
  /** Nombre comercial (mostrado al usuario). */
  name: string;
  /** Precio mensual en centavos COP. -1 = cotización. */
  priceCents: number;
  /** Descuento anual (-17% = 2 meses gratis). */
  annualDiscountPct: number;
  /** Días de trial sin tarjeta. 0 = no trial. */
  trialDays: number;
  /** Copy corto para badge / tarjeta de plan. */
  tagline: string;
  /** Orden visual (también orden jerárquico para gating). */
  order: number;
}

export interface AddonDefinition {
  key: AddonKey;
  name: string;
  description: string;
  /** Precio mensual en centavos COP. -1 = cotización. */
  priceCents: number;
  /** Setup único en centavos COP (whitelabel). 0 = sin setup. */
  setupCents: number;
  /** Tiers en los que el addon viene incluido sin costo extra. */
  includedIn: TierCode[];
  /** Si requiere conversación con ventas en vez de auto-activar. */
  salesLed: boolean;
}

export type FeatureKind = 'tier' | 'tierWithLimit' | 'addon';

interface FeatureBase {
  key: FeatureKey;
  label: string;
  description?: string;
}

interface TierFeature extends FeatureBase {
  kind: 'tier';
  minTier: TierCode;
}

interface TierWithLimitFeature extends FeatureBase {
  kind: 'tierWithLimit';
  minTier: TierCode;
  /** Límite numérico por tier. -1 = ilimitado. */
  limits: Partial<Record<TierCode, number>>;
  /** Unidad para mensaje (ej: "atletas", "envíos/mes"). */
  unit: string;
}

interface AddonFeature extends FeatureBase {
  kind: 'addon';
  addonKey: AddonKey;
}

export type FeatureDefinition =
  | TierFeature
  | TierWithLimitFeature
  | AddonFeature;

// ============================================================
// Tiers Academia
// ============================================================

export const ACADEMY_TIERS: Record<TierCode, TierDefinition> = {
  starter: {
    code: 'starter',
    internal: 'free',
    name: 'Starter',
    priceCents: 0,
    annualDiscountPct: 0,
    trialDays: 0, // free para siempre, no necesita trial
    tagline: 'Para empezar',
    order: 0,
  },
  crecimiento: {
    code: 'crecimiento',
    internal: 'pro',
    name: 'Crecimiento',
    priceCents: 14_900_000,
    annualDiscountPct: 17,
    trialDays: 14,
    tagline: 'Para escuelas en expansión',
    order: 1,
  },
  profesional: {
    code: 'profesional',
    internal: 'pro',
    name: 'Profesional',
    priceCents: 34_900_000,
    annualDiscountPct: 17,
    trialDays: 14,
    tagline: 'Para operación robusta',
    order: 2,
  },
  elite: {
    code: 'elite',
    internal: 'pro',
    name: 'Elite',
    priceCents: 79_900_000,
    annualDiscountPct: 17,
    trialDays: 7, // trial más corto, alto valor — incentiva decisión rápida
    tagline: 'Para clubes consolidados',
    order: 3,
  },
  enterprise: {
    code: 'enterprise',
    internal: 'enterprise',
    name: 'Enterprise',
    priceCents: -1,
    annualDiscountPct: 0,
    trialDays: 0, // solo demo asistida
    tagline: 'A medida',
    order: 4,
  },
};

export const TIER_ORDER: TierCode[] = [
  'starter',
  'crecimiento',
  'profesional',
  'elite',
  'enterprise',
];

export function tierMeetsMinimum(current: TierCode, required: TierCode): boolean {
  return ACADEMY_TIERS[current].order >= ACADEMY_TIERS[required].order;
}

export function nextTierAbove(current: TierCode): TierCode | null {
  const idx = TIER_ORDER.indexOf(current);
  if (idx === -1 || idx === TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

// ============================================================
// Addons
// ============================================================

export const ADDONS: Record<AddonKey, AddonDefinition> = {
  tournaments: {
    key: 'tournaments',
    name: 'Torneos',
    description: 'Americanos, brackets eliminatorios y ranking PWR.',
    priceCents: 4_900_000,
    setupCents: 0,
    includedIn: [],
    salesLed: false,
  },
  access_control: {
    key: 'access_control',
    name: 'Control de acceso biométrico',
    description: 'Integración con Suprema / BioStar2 para entrada física.',
    priceCents: 9_900_000,
    setupCents: 0,
    includedIn: [],
    salesLed: true,
  },
  biomech: {
    key: 'biomech',
    name: 'Biomecánica',
    description: 'Análisis postural, asimetrías y prevención de lesiones.',
    priceCents: 9_900_000,
    setupCents: 0,
    includedIn: [],
    salesLed: false,
  },
  nutrition: {
    key: 'nutrition',
    name: 'Nutrición',
    description:
      'Seguimiento nutricional integral con planes personalizados por atleta.',
    priceCents: 4_900_000,
    setupCents: 0,
    includedIn: [],
    salesLed: false,
  },
  whitelabel: {
    key: 'whitelabel',
    name: 'App White Label',
    description: 'App propia con tu marca, splash y deep links.',
    priceCents: 29_900_000,
    setupCents: 150_000_000,
    includedIn: [],
    salesLed: true,
  },
  whatsapp: {
    key: 'whatsapp',
    name: 'WhatsApp campañas',
    description: 'Envíos masivos vía WhatsApp Cloud API.',
    priceCents: 5_900_000,
    setupCents: 0,
    includedIn: [],
    salesLed: false,
  },
  wompi: {
    key: 'wompi',
    name: 'Pasarela Wompi',
    description: 'PSE, Nequi, tarjetas y transferencias.',
    priceCents: 5_000_000,
    setupCents: 0,
    includedIn: ['profesional', 'elite'], // Profesional incluye 1, Elite ambas
    salesLed: false,
  },
  mp: {
    key: 'mp',
    name: 'Pasarela MercadoPago',
    description: 'Cobros con MercadoPago, billetera y QR.',
    priceCents: 9_000_000,
    setupCents: 0,
    includedIn: ['elite'],
    salesLed: false,
  },
};

// ============================================================
// Features — qué requiere cada función
//
// REGLA DE LECTURA:
//   - kind='tier'           → minTier o superior
//   - kind='tierWithLimit'  → minTier o superior + límite numérico por tier
//   - kind='addon'          → requiere addon activo (sin importar tier)
// ============================================================

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  // ---------- Núcleo: límites cuantitativos ----------
  athletes: {
    key: 'athletes',
    kind: 'tierWithLimit',
    label: 'Atletas',
    minTier: 'starter',
    unit: 'atletas',
    limits: {
      starter: 30,
      crecimiento: 100,
      profesional: 300,
      elite: 800,
      enterprise: -1,
    },
  },
  teams: {
    key: 'teams',
    kind: 'tierWithLimit',
    label: 'Equipos',
    minTier: 'starter',
    unit: 'equipos',
    limits: {
      starter: 3,
      crecimiento: 10,
      profesional: 30,
      elite: -1,
      enterprise: -1,
    },
  },
  branches: {
    key: 'branches',
    kind: 'tierWithLimit',
    label: 'Sedes',
    minTier: 'starter',
    unit: 'sedes',
    limits: {
      starter: 1,
      crecimiento: 2,
      profesional: 5,
      elite: -1,
      enterprise: -1,
    },
  },
  coaches: {
    key: 'coaches',
    kind: 'tierWithLimit',
    label: 'Coaches',
    minTier: 'starter',
    unit: 'coaches',
    limits: {
      starter: 2,
      crecimiento: 5,
      profesional: 15,
      elite: -1,
      enterprise: -1,
    },
  },

  // ---------- Asistencia ----------
  attendance_manual: {
    key: 'attendance_manual',
    kind: 'tier',
    minTier: 'starter',
    label: 'Asistencia manual',
  },
  attendance_qr: {
    key: 'attendance_qr',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Asistencia con QR',
    description: 'Check-in rápido con código QR escaneado en sede.',
  },
  attendance_multi_coach: {
    key: 'attendance_multi_coach',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Asistencia múltiple por coach',
    description: 'Varios coaches pueden marcar asistencia simultáneamente.',
  },

  // ---------- Calendario ----------
  calendar_basic: {
    key: 'calendar_basic',
    kind: 'tier',
    minTier: 'starter',
    label: 'Calendario básico',
  },
  calendar_resources: {
    key: 'calendar_resources',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Calendario con recursos compartidos',
    description: 'Reserva espacios y equipos para evitar choques.',
  },
  calendar_supervision: {
    key: 'calendar_supervision',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Calendario con supervisión cross-equipo',
  },

  // ---------- Mensajes ----------
  messages_direct: {
    key: 'messages_direct',
    kind: 'tier',
    minTier: 'starter',
    label: 'Mensajes 1-a-1',
  },
  messages_templates: {
    key: 'messages_templates',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Templates de mensajes',
  },
  messages_bulk: {
    key: 'messages_bulk',
    kind: 'tierWithLimit',
    minTier: 'crecimiento',
    label: 'Envíos masivos',
    unit: 'envíos/mes',
    limits: {
      crecimiento: 200,
      profesional: -1,
      elite: -1,
      enterprise: -1,
    },
  },
  announcements: {
    key: 'announcements',
    kind: 'tierWithLimit',
    minTier: 'starter',
    label: 'Anuncios públicos',
    unit: 'anuncios/mes',
    limits: {
      starter: 5,
      crecimiento: -1,
      profesional: -1,
      elite: -1,
      enterprise: -1,
    },
  },

  // ---------- Pagos ----------
  payments_manual: {
    key: 'payments_manual',
    kind: 'tier',
    minTier: 'starter',
    label: 'Pagos manuales (efectivo / transferencia)',
  },
  payments_online_addon: {
    key: 'payments_online_addon',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Pasarela online (addon)',
    description: 'Wompi o MercadoPago activable como addon.',
  },
  payments_online_included: {
    key: 'payments_online_included',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Pasarela online incluida',
    description: 'Profesional incluye 1 pasarela. Elite incluye ambas.',
  },

  // ---------- Marketplace ----------
  marketplace_basic: {
    key: 'marketplace_basic',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Marketplace (12% take rate)',
  },
  marketplace_pro: {
    key: 'marketplace_pro',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Marketplace Pro (7% take rate)',
  },
  marketplace_elite: {
    key: 'marketplace_elite',
    kind: 'tier',
    minTier: 'elite',
    label: 'Marketplace Elite (4% take rate)',
  },

  // ---------- Certificados ----------
  certificates_predefined: {
    key: 'certificates_predefined',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Certificados predefinidos',
  },
  certificates_custom: {
    key: 'certificates_custom',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Certificados personalizados',
  },

  // ---------- Reportes y analytics ----------
  reports_basic: {
    key: 'reports_basic',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Reportes básicos',
  },
  analytics_advanced: {
    key: 'analytics_advanced',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Analytics deportivo + retención',
  },
  finance_advanced: {
    key: 'finance_advanced',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Finanzas avanzadas',
  },

  // ---------- Médico / rendimiento ----------
  // Ajuste 2026-05-13: medical_history baja de Profesional → Crecimiento.
  // Razón: las escuelas en Crecimiento tienen coaches reales que necesitan
  // saber si un atleta tuvo lesión. Es diferenciador de retención, no de precio.
  medical_history: {
    key: 'medical_history',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Historial médico',
    description: 'Lesiones, alergias y notas médicas por atleta.',
  },
  physical_evaluations: {
    key: 'physical_evaluations',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Evaluaciones físicas',
    description: 'Tests de fuerza, velocidad y resistencia por temporada.',
  },

  // ---------- Roles y permisos ----------
  // Ajuste 2026-05-13: secondary_roles baja de Profesional → Crecimiento.
  // Razón: una escuela de 100 atletas necesita más de una persona
  // administrando. Limitarlo al tier superior genera dolor operativo
  // que el cliente atribuye a SportMaps, no al plan.
  secondary_roles: {
    key: 'secondary_roles',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Roles secundarios (admin / coach asistente)',
  },

  // ---------- API ----------
  api_read: {
    key: 'api_read',
    kind: 'tier',
    minTier: 'profesional',
    label: 'API de lectura',
  },
  api_write: {
    key: 'api_write',
    kind: 'tier',
    minTier: 'elite',
    label: 'API de escritura',
  },

  // ---------- Branding ----------
  branding_basic: {
    key: 'branding_basic',
    kind: 'tier',
    minTier: 'starter',
    label: 'Logo + 1 color',
  },
  branding_full: {
    key: 'branding_full',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Branding completo (paleta + tipografía)',
  },
  custom_subdomain: {
    key: 'custom_subdomain',
    kind: 'tier',
    minTier: 'elite',
    label: 'Subdominio custom (miclub.sportmaps.co)',
  },

  // ---------- Soporte ----------
  support_docs: {
    key: 'support_docs',
    kind: 'tier',
    minTier: 'starter',
    label: 'Documentación pública',
  },
  support_email: {
    key: 'support_email',
    kind: 'tier',
    minTier: 'crecimiento',
    label: 'Soporte por email',
  },
  support_chat: {
    key: 'support_chat',
    kind: 'tier',
    minTier: 'profesional',
    label: 'Soporte por chat',
  },
  support_whatsapp: {
    key: 'support_whatsapp',
    kind: 'tier',
    minTier: 'elite',
    label: 'Soporte WhatsApp + manager',
  },
  support_sla: {
    key: 'support_sla',
    kind: 'tier',
    minTier: 'enterprise',
    label: 'SLA garantizado + soporte dedicado',
  },
  assisted_onboarding: {
    key: 'assisted_onboarding',
    kind: 'tier',
    minTier: 'elite',
    label: 'Onboarding asistido por el equipo',
  },
};

// ============================================================
// URLs públicas (landing pública vs admin app)
// ============================================================

/**
 * Construye el deep-link de la admin app hacia la landing /planes
 * preservando contexto del usuario.
 */
export function buildLandingPlansUrl(params: {
  schoolId?: string;
  currentPlan?: TierCode;
  upsellFeature?: FeatureKey | AddonKey;
  returnTo?: string;
}): string {
  const base =
    (import.meta as any).env?.VITE_LANDING_URL ?? 'https://www.sportmaps.co';
  const qs = new URLSearchParams();
  qs.set('role', 'escuela');
  if (params.schoolId) qs.set('school_id', params.schoolId);
  if (params.currentPlan) qs.set('current', params.currentPlan);
  if (params.upsellFeature) qs.set('upsell', params.upsellFeature);
  if (params.returnTo) qs.set('return', params.returnTo);
  return `${base}/planes?${qs.toString()}`;
}

// ============================================================
// Helpers de pricing display
// ============================================================

export function formatCop(cents: number): string {
  if (cents === -1) return 'A cotizar';
  if (cents === 0) return 'Gratis';
  const pesos = Math.round(cents / 100);
  return `$${pesos.toLocaleString('es-CO')}`;
}

export function formatLimit(value: number, unit: string): string {
  if (value === -1) return `${unit} ilimitados`;
  return `${value.toLocaleString('es-CO')} ${unit}`;
}
