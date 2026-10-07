/**
 * Débito automático (F3) — helpers puros de la UI (familia y escuela).
 * Sin React ni red: se prueban en debito-utils.test.ts.
 */
import type {
  CicloEstado, DeportistaDebito, MiDebito, SuspensionMotivo, SuscripcionEstado,
} from '@/lib/api/autopay';

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** 10 → "octubre". */
export function nombreMes(month: number): string {
  return MESES[month - 1] ?? '';
}

function partesFecha(value: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = value.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/** '2026-10-10' → "sáb 10 oct". Anclado al mediodía para no correr el día. */
export function fechaCorta(value: string): string {
  const p = partesFecha(value);
  if (!p) return '';
  const dia = new Date(p.y, p.m - 1, p.d, 12).getDay();
  return `${DIAS_CORTOS[dia]} ${p.d} ${MESES_CORTOS[p.m - 1]}`;
}

/** '2026-10-10' → "10 oct". */
export function diaMes(value: string): string {
  const p = partesFecha(value);
  return p ? `${p.d} ${MESES_CORTOS[p.m - 1]}` : '';
}

/** "$157.500" → 157500. Vacío o sin dígitos → null. */
export function parseMonto(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** Tope que se propone por defecto: el sugerido por el BFF, o el total vigente. */
export function topePorDefecto(a: Pick<DeportistaDebito, 'suggestedMax' | 'currentTotal'>): number | null {
  return a.suggestedMax ?? a.currentTotal ?? null;
}

/** null si el tope sirve; si no, el texto del error. */
export function validarTope(tope: number | null, currentTotal: number | null): string | null {
  if (tope === null || tope <= 0) return 'Escribe el tope máximo por mes.';
  if (currentTotal !== null && tope < currentTotal) {
    return 'El tope no puede ser menor que la mensualidad actual.';
  }
  return null;
}

/** Nequi: 10 dígitos que empiezan por 3. */
export function telefonoNequiValido(raw: string): boolean {
  return /^3\d{9}$/.test(raw.replace(/\D/g, ''));
}

/** "MM/AA" → { expMonth: '07', expYear: '28' } o null. */
export function parseVencimiento(raw: string): { expMonth: string; expYear: string } | null {
  const m = raw.replace(/\s/g, '').match(/^(\d{1,2})\/?(\d{2})$/);
  if (!m) return null;
  const mes = Number(m[1]);
  if (mes < 1 || mes > 12) return null;
  return { expMonth: String(mes).padStart(2, '0'), expYear: m[2] };
}

export function tarjetaValida(card: { number: string; exp: string; cvc: string; holder: string }): string | null {
  const num = card.number.replace(/\D/g, '');
  if (num.length < 13 || num.length > 19) return 'Revisa el número de la tarjeta.';
  if (!parseVencimiento(card.exp)) return 'Escribe la fecha de vencimiento como MM/AA.';
  if (!/^\d{3,4}$/.test(card.cvc.trim())) return 'El código de seguridad tiene 3 o 4 dígitos.';
  if (card.holder.trim().length < 3) return 'Escribe el nombre como aparece en la tarjeta.';
  return null;
}

/** "4242424242424242" → "4242 4242 4242 4242" mientras se escribe. */
export function formatearNumeroTarjeta(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Error por atleta que devuelve el alta (autopay_create_subscription). */
export function textoErrorAlta(code: string | undefined): string {
  switch (code) {
    case 'already_subscribed': return 'ya tenía débito';
    case 'max_amount_below_current': return 'el tope es menor que la mensualidad actual';
    case 'no_active_enrollment': return 'no tiene inscripción activa';
    case 'autopay_not_offered': return 'la escuela no lo ofrece';
    default: return 'no se pudo activar; intenta de nuevo más tarde';
  }
}

/** Qué tiene que hacer la familia para reactivar una suscripción suspendida. */
export function textoSuspension(reason: SuspensionMotivo | null): string {
  switch (reason) {
    case 'over_max_amount': return 'Supera tu tope: súbelo para reactivar';
    case 'token_not_available':
    case 'provider_declined': return 'Actualiza tu medio de pago para reactivar';
    case 'duplicate_charge': return 'Pausado por un pago doble; la escuela lo está revisando';
    default: return 'Está pausado';
  }
}

/** "Sofía", "Sofía y Juan", "Sofía, Juan y Ana". */
export function unirNombres(names: string[]): string {
  const n = names.filter(Boolean);
  if (n.length <= 1) return n[0] ?? '';
  return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Tiene una suscripción viva (activa o suspendida). */
export function tieneDebito(a: DeportistaDebito): boolean {
  return !!a.subscription && a.subscription.status !== 'cancelled';
}

/** Atletas que pueden activar, agrupados por escuela (solo escuelas que lo ofrecen). */
export function elegiblesPorEscuela(data: MiDebito): { schoolId: string; schoolName: string; athletes: DeportistaDebito[] }[] {
  return data.schools
    .filter((s) => s.offered)
    .map((s) => ({
      schoolId: s.schoolId,
      schoolName: s.schoolName,
      athletes: data.athletes.filter((a) => a.schoolId === s.schoolId && !tieneDebito(a)),
    }))
    .filter((g) => g.athletes.length > 0);
}

/** La sección de Mis Pagos se muestra si alguna escuela ofrece el débito o ya hay uno vivo. */
export function mostrarSeccionDebito(data: MiDebito | null): boolean {
  if (!data) return false;
  return data.schools.some((s) => s.offered) || data.athletes.some(tieneDebito);
}

// ── Escuela ────────────────────────────────────────────────────────────────

export type TonoEstado = 'ok' | 'info' | 'warn' | 'bad' | 'muted';

const SKIP_TEXTO: Record<string, string> = {
  parent_skip: 'La familia dice que ya pagó',
  paid_elsewhere: 'Pagó por otro medio',
  manual_checkout_open: 'Esperando un pago en línea',
  over_max_amount: 'Supera el tope',
  token_not_available: 'Medio de pago no disponible',
  merchant_mismatch: 'Cuenta Wompi cambiada',
  debits_paused: 'Débitos pausados',
  kill_switch: 'Débitos detenidos',
};

/** Estado legible de una fila del panel de la escuela. */
export function estadoFila(
  status: SuscripcionEstado,
  cycle: { state: CicloEstado; skipReason: string | null } | null,
): { label: string; tone: TonoEstado } {
  if (status === 'cancelled') return { label: 'Cancelado', tone: 'muted' };
  if (status === 'suspended') return { label: 'Suspendido', tone: 'bad' };
  if (!cycle) return { label: 'Sin cobro este mes', tone: 'muted' };
  switch (cycle.state) {
    case 'scheduled': return { label: 'Programado', tone: 'info' };
    case 'noticed': return { label: 'Avisado', tone: 'info' };
    case 'in_progress': return { label: 'Debitando', tone: 'warn' };
    case 'paid': return { label: 'Pagado', tone: 'ok' };
    case 'skipped': return { label: SKIP_TEXTO[cycle.skipReason ?? ''] ?? 'Sin débito este mes', tone: 'muted' };
    case 'exhausted': return { label: 'No se pudo debitar', tone: 'bad' };
    case 'cancelled': return { label: 'Cobro cancelado', tone: 'muted' };
    default: return { label: cycle.state, tone: 'muted' };
  }
}

/** Texto de invitación que la escuela copia para WhatsApp o correo. */
export const TEXTO_INVITACION =
  'Ya puedes pagar la mensualidad de forma automática con Nequi o tarjeta. ' +
  'Te avisamos 2 días antes de cada débito y lo cancelas cuando quieras. ' +
  'Actívalo en Mis Pagos: https://app.sportmaps.co/my-payments?autopay=activar';
