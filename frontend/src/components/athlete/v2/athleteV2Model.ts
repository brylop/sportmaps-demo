/**
 * Deportista V2 (rol `athlete`) — lógica pura, sin React ni Supabase.
 *
 * Contrato: docs/specs/entrenador-deportista-v2.md §1 (decisiones 6–9).
 *
 * MAYOR vs MENOR (decisión 6). El rol es `athlete` en los dos casos:
 *   · Mayor  = `profiles.date_of_birth` con 18 años o más → paga lo suyo.
 *   · Menor  = menos de 18 años → NO paga: ni Pagos, ni botón «Pagar», ni se
 *     consultan cobros. Su acudiente paga.
 *   · Sin fecha de nacimiento → no se sabe: solo se le muestra Pagos si hay
 *     cobros donde ÉL figura como pagador (`payments.parent_id` = él). Un cobro
 *     con `user_id` = él no basta: el menor con cuenta también los tiene y los
 *     paga su acudiente.
 * Ante la duda, NUNCA se le muestra pagar (menor seguro por defecto).
 */
import { PAYABLE_STATES, type Transaction } from '@/components/parent/v2/pagosModel';
import { ageFrom, cameToTraining, formatLongDate, type AttendanceRecord } from '@/components/parent/v2/hijos/hijosUtils';
import { horaColombia } from '@/components/parent/v2/parentHomeLogic';
import { DOCUMENTOS_DEPORTISTA } from '@/lib/documentosDeportista';

// ── Mayor / menor ────────────────────────────────────────────────────────────

export const MAYORIA_DE_EDAD = 18;

/**
 * Alto del espacio al final de Pagos y Más para que el botón flotante de
 * Mapi/soporte (abajo a la derecha) no tape la última acción. Se llega a todo con scroll.
 */
export const ESPACIO_BOTON_FLOTANTE = 'h-24';

export type Edad = 'mayor' | 'menor' | 'desconocida';

export function edadDeportista(dateOfBirth: string | null | undefined, hoy = new Date()): Edad {
  const age = ageFrom(dateOfBirth ?? null, hoy);
  if (age === null) return 'desconocida';
  return age >= MAYORIA_DE_EDAD ? 'mayor' : 'menor';
}

/** Cobros mínimos para decidir si figura como pagador (sin fecha de nacimiento). */
export interface CobroPagador {
  parent_id: string | null;
  user_id: string | null;
  /** No nulo = cobro de un hijo suyo (él es acudiente): no es del deportista. */
  child_id?: string | null;
}

/**
 * ¿Se le muestra Pagos (y «Pagar» en Hoy)?
 * El menor NUNCA, tenga los cobros que tenga. Sin fecha de nacimiento, solo
 * si figura como pagador de un cobro SUYO: pagar los de sus hijos (acudiente)
 * no lo vuelve pagador de lo propio.
 */
export function puedePagar(edad: Edad, userId: string | null | undefined, cobros: CobroPagador[] | null | undefined): boolean {
  if (edad === 'menor') return false;
  if (edad === 'mayor') return true;
  if (!userId) return false;
  return (cobros ?? []).some((c) => c.parent_id === userId && !c.child_id);
}

/**
 * ¿Responde él la convocatoria? (decisión 8). Si es menor, la responde su
 * acudiente. Sin fecha de nacimiento se trata como mayor: la convocatoria no
 * mueve plata y el menor con fecha registrada sigue en solo lectura.
 */
export const respondeConvocatoria = (edad: Edad): boolean => edad !== 'menor';

/**
 * Un cobro es «suyo» (lo paga él) si figura como pagador, o si está a su
 * nombre y no tiene otro pagador. Un cobro a su nombre que paga otra persona
 * (`parent_id` de otro) no se le muestra. Un cobro con `child_id` es de un
 * hijo suyo (él es acudiente): eso va en la app del acudiente, no aquí.
 */
export function esCobroPropio(c: CobroPagador, userId: string): boolean {
  if (c.child_id) return false;
  if (c.parent_id === userId) return true;
  return c.user_id === userId && (c.parent_id === null || c.parent_id === undefined);
}

// ── Cobros → modelo de Pagos (pagosModel) ───────────────────────────────────

export interface PaymentRow {
  id: string;
  amount: number | string | null;
  amount_paid?: number | string | null;
  status: string;
  concept?: string | null;
  school_id?: string | null;
  user_id?: string | null;
  parent_id?: string | null;
  child_id?: string | null;
  due_date?: string | null;
  payment_date?: string | null;
  created_at: string;
  receipt_url?: string | null;
  receipt_number?: string | null;
  period_year?: number | null;
  period_month?: number | null;
  payment_category?: string | null;
  payment_method?: string | null;
  payment_provider?: string | null;
  late_fee_amount?: number | string | null;
  last_failure_reason?: string | null;
  last_failure_at?: string | null;
  requires_review?: boolean | null;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Pasa una fila de `payments` al `Transaction` que pinta AcuPagosV2 (sin nombre de hijo: es él). */
export function aTransaction(p: PaymentRow, discount?: { amount: number; eligible: boolean; validUntil: string | null }): Transaction {
  const amount = Number(p.amount ?? 0);
  const paid = Number(p.amount_paid ?? 0);
  const partial = p.status === 'partial';
  return {
    id: p.id,
    amount,
    amount_paid: paid,
    balance_pending: partial ? Math.max(amount - paid, 0) : undefined,
    status: p.status === 'paid' ? 'approved' : p.status,
    reference: p.receipt_number || `SP-${p.id.slice(0, 8).toUpperCase()}`,
    transaction_date: p.payment_date || p.created_at,
    receipt_url: p.receipt_url ?? undefined,
    school_id: p.school_id ?? undefined,
    concept: p.concept ?? undefined,
    period_year: p.period_year ?? null,
    period_month: p.period_month ?? null,
    period_label: p.period_month && p.period_month >= 1 && p.period_month <= 12 ? `de ${MESES[p.period_month - 1]}` : null,
    due_date: p.due_date ?? null,
    pay_method: p.payment_method ?? null,
    pay_provider: p.payment_provider ?? null,
    late_fee_amount: p.late_fee_amount == null ? null : Number(p.late_fee_amount),
    discount_amount: discount?.amount ?? 0,
    discount_eligible: discount?.eligible ?? false,
    discount_valid_until: discount?.validUntil ?? null,
    payment_category: p.payment_category ?? null,
    last_failure_reason: p.last_failure_reason ?? null,
    last_failure_at: p.last_failure_at ?? null,
    requires_review: p.requires_review ?? null,
  };
}

export const cobrosPorPagar = (txs: Transaction[]) => txs.filter((t) => PAYABLE_STATES.includes(t.status));

/** «Falta tu mensualidad de octubre.» / «Falta tu cobro: Uniforme.» / «Tienes 2 cobros pendientes.» */
export function fraseDeuda(porPagar: Transaction[]): string {
  if (porPagar.length === 0) return 'Estás al día.';
  if (porPagar.length > 1) return `Tienes ${porPagar.length} cobros pendientes.`;
  const t = porPagar[0];
  const esMensualidad = t.payment_category === 'mensualidad' || /^mensualidad/i.test(t.concept ?? '');
  if (esMensualidad) {
    const mes = t.period_month && t.period_month >= 1 && t.period_month <= 12 ? MESES[t.period_month - 1] : null;
    return mes ? `Falta tu mensualidad de ${mes}.` : 'Falta tu mensualidad.';
  }
  return t.concept ? `Tienes un cobro pendiente: ${t.concept}.` : 'Tienes un cobro pendiente.';
}

/** El vencimiento más cercano (o el más viejo ya vencido) de lo que debe. */
export function vencimientoMasUrgente(porPagar: Transaction[]): string | null {
  const fechas = porPagar.map((t) => t.due_date).filter((d): d is string => !!d).sort();
  return fechas[0] ?? null;
}

// ── Racha y asistencia (decisión 7) ─────────────────────────────────────────

/**
 * Racha = entrenos ASISTIDOS seguidos (de `attendance_records`), del más
 * reciente hacia atrás. Llegar tarde cuenta como asistido. Una falta la corta.
 * Una excusa ni suma ni corta (faltar con permiso no castiga la racha).
 * Si el mismo día hay varios registros, cada uno es un entreno.
 */
export function rachaDeEntrenos(records: AttendanceRecord[] | null | undefined): number {
  const list = [...(records ?? [])].sort((a, b) => (a.attendance_date < b.attendance_date ? 1 : a.attendance_date > b.attendance_date ? -1 : 0));
  let n = 0;
  for (const r of list) {
    if (cameToTraining(r.status)) n += 1;
    else if (r.status === 'excused') continue;
    else break;
  }
  return n;
}

/** «7 de 8 entrenos en octubre» del mes en curso. Excusas no cuentan en el total. */
export function asistenciaDelMes(records: AttendanceRecord[] | null | undefined, hoy = new Date()): { vino: number; total: number; mes: string } {
  const key = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const delMes = (records ?? []).filter((r) => r.attendance_date.slice(0, 7) === key && r.status !== 'excused');
  return { vino: delMes.filter((r) => cameToTraining(r.status)).length, total: delMes.length, mes: MESES[hoy.getMonth()] };
}

// ── «¿Qué tan duro fue?» de un toque ────────────────────────────────────────

/**
 * Suave · Normal · Duro → escala de Borg 0–10 que guarda
 * `submit_post_training_self_eval` (`rpe_borg`, BORG_OPTIONS de
 * lib/postEntrenoAutoeval). Propuesta D3 del lienzo DepMapa: 3 · 5 · 8.
 *   3 = «Suave», 5 = «Duro» en la escala (esfuerzo medio), 8 = «Muy, muy duro».
 * El detalle 0 a 10 sigue en el formulario completo (/post-entreno/:sessionId).
 */
export const RPE_RAPIDO = [
  { label: 'Suave', value: 3 },
  { label: 'Normal', value: 5 },
  { label: 'Duro', value: 8 },
] as const;
export type RpeRapido = (typeof RPE_RAPIDO)[number]['label'];

export const valorRpe = (label: RpeRapido): number => RPE_RAPIDO.find((o) => o.label === label)!.value;

/** Preguntas del post-entreno distintas de rpe_borg. */
const OTRAS_OBLIGATORIAS = ['task_comprehension', 'self_effort_pct', 'satisfaction'];

/**
 * La RPC exige TODAS las métricas marcadas `required` del deporte. Si la escuela
 * pide otras además de rpe_borg, el toque solo no se puede guardar y se abre el
 * formulario completo (no se inventan respuestas).
 */
export function unToqueAlcanza(requeridas: string[] | null | undefined): boolean {
  return !(requeridas ?? []).some((k) => OTRAS_OBLIGATORIAS.includes(k));
}

/**
 * Texto (español, de «tú») para el toast cuando no se guarda el «¿Qué tan duro
 * fue?». Nunca el `message` crudo de PostgREST: ese va a consola.
 */
export function mensajeErrorRpe(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === '55000') return 'Ya no se puede responder este entreno.';
  if (code === '42501') return 'No tienes permiso para responder este entreno.';
  return 'Inténtalo de nuevo en un momento.';
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «el martes», «hoy», «ayer» para la pregunta «¿Qué tan duro fue …?». */
export function cuandoFue(sessionDate: string, hoy = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(sessionDate);
  if (!m) return 'el entreno';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.round((h.getTime() - d.getTime()) / 86_400_000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `el ${DIAS[d.getDay()]}`;
}

// ── Próximos entrenos (horario del equipo) ──────────────────────────────────

export interface EquipoConHorario {
  teamId: string;
  nombre: string;
  lugar: string | null;
  profe: string | null;
  franjas: { day: number; time: string; end?: string; place?: string }[];
}

export interface EntrenoProximo {
  key: string;
  fecha: Date;
  hora: string;
  fin: string | null;
  equipo: string;
  lugar: string | null;
  profe: string | null;
}

const aMin = (hhmm: string) => {
  const [h, m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
};

/**
 * Entrenos de los próximos `dias` días a partir del horario de sus equipos
 * (`teams.schedule`). Uno de hoy cuenta hasta que termina. No conoce festivos
 * ni cancelaciones: para eso está «Ver el mes completo» (Calendario).
 */
export function entrenosProximos(equipos: EquipoConHorario[], ahora: Date, dias = 10): EntrenoProximo[] {
  const out: EntrenoProximo[] = [];
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  for (let i = 0; i < dias; i += 1) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
    for (const t of equipos) {
      for (const f of t.franjas) {
        if (f.day !== fecha.getDay()) continue;
        if (i === 0 && aMin(f.end ?? f.time) <= ahoraMin) continue;
        out.push({
          key: `${t.teamId}-${fecha.toDateString()}-${f.time}`,
          fecha,
          hora: f.time,
          fin: f.end ?? null,
          equipo: t.nombre,
          lugar: f.place || t.lugar,
          profe: t.profe,
        });
      }
    }
  }
  return out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || aMin(a.hora) - aMin(b.hora));
}

/** «Hoy · jueves 8», «Mañana · viernes 9», «Sábado 10». */
export function etiquetaDia(fecha: Date, ahora: Date): string {
  const h = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  const d = Math.round((new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime() - h) / 86_400_000);
  const base = `${DIAS[fecha.getDay()]} ${fecha.getDate()}`;
  if (d === 0) return `Hoy · ${base}`;
  if (d === 1) return `Mañana · ${base}`;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ── Convocatorias (B2) ──────────────────────────────────────────────────────

export interface Convocatoria {
  lineupId: string;
  /** Sujeto con que se responde (respond_callup): él como adulto ('profile') o su ficha ('unregistered'). */
  subjectType: 'profile' | 'unregistered';
  subjectId: string;
  rival: string | null;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  nota: string | null;
  respuesta: 'va' | 'no_va' | null;
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** «10:30» (hora local) desde kickoff_at. */
function horaDe(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Las filas de `my_callups()` (B2, lib/api/v2Contratos → MiConvocatoria) que
 * son DE ÉL: como adulto (subject_type 'profile' = él) o de su ficha
 * vinculada ('unregistered'). Las de sus hijos (si también es acudiente) no.
 *
 * Verificado contra el cuerpo de la RPC (2026-10-25): 'child' sale SOLO de
 * `children.parent_id = auth.uid()` (sus hijos; `children` no tiene ningún
 * enlace a una cuenta, así que nunca es él), 'profile' solo con id = auth.uid()
 * y 'unregistered' solo de `unregistered_athletes.linked_profile_id = auth.uid()`.
 * Por eso descartar 'child' no pierde convocatorias propias.
 */
export function misConvocatorias(rows: unknown, userId: string): Convocatoria[] {
  if (!Array.isArray(rows)) return [];
  const out: Convocatoria[] = [];
  for (const raw of rows as Raw[]) {
    if (!raw || typeof raw !== 'object') continue;
    const tipo = str(raw.subject_type);
    const id = str(raw.subject_id);
    const lineupId = str(raw.lineup_id);
    if (!lineupId || !id) continue;
    if (tipo === 'profile' ? id !== userId : tipo !== 'unregistered') continue;
    const resp = str(raw.response);
    out.push({
      lineupId,
      subjectType: tipo as 'profile' | 'unregistered',
      subjectId: id,
      rival: str(raw.opponent),
      fecha: str(raw.match_date) ?? (str(raw.kickoff_at)?.slice(0, 10) ?? null),
      hora: horaDe(str(raw.kickoff_at)),
      lugar: str(raw.location),
      nota: str(raw.notes),
      respuesta: resp === 'va' || resp === 'no_va' ? resp : null,
    });
  }
  return out.sort((a, b) => String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')));
}

/** «Sábado 10 de octubre · 10:30 a. m. · Coliseo». */
export function textoPartido(c: Convocatoria): string {
  return [c.fecha ? formatLongDate(c.fecha) : null, c.hora ? horaColombia(c.hora) : null, c.lugar].filter(Boolean).join(' · ');
}

// ── Torneos abiertos ────────────────────────────────────────────────────────

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «sáb 21 nov» a partir de «2026-11-21» (sin corrimiento de zona). Si no se entiende, lo deja igual. */
export function fechaCorta(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso ?? '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

// ── Felicitaciones (B1) ─────────────────────────────────────────────────────

export interface Felicitacion {
  id: string;
  mensaje: string;
  profe: string | null;
  fecha: string;
}

export function aFelicitaciones(rows: unknown): Felicitacion[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Raw[])
    .filter((r) => r && str(r.id) && str(r.message))
    .map((r) => ({ id: str(r.id)!, mensaje: str(r.message)!, profe: str(r.coach_name), fecha: str(r.created_at) ?? '' }));
}

/** «Profe Andrés» a partir del nombre completo del entrenador. */
export function profeCorto(nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim().split(/\s+/)[0];
  return n ? `Profe ${n}` : 'Tu profe';
}

// ── Progreso: carga de las últimas semanas ──────────────────────────────────

/**
 * Promedio semanal de «¿Qué tan duro fue?» (rpe_borg, 0–10) de las últimas
 * `semanas`, de la más vieja a la actual. `valor` null = no respondió esa semana.
 */
export function cargaSemanal(
  entries: { metric_key: string; value: number | string; recorded_at: string }[] | null | undefined,
  ahora = new Date(),
  semanas = 4,
): { label: string; valor: number | null }[] {
  const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1).getTime();
  const out: { label: string; valor: number | null }[] = [];
  for (let i = semanas - 1; i >= 0; i -= 1) {
    const hasta = fin - i * 7 * 86_400_000;
    const desde = hasta - 7 * 86_400_000;
    const vals = (entries ?? [])
      .filter((e) => e.metric_key === 'rpe_borg')
      .filter((e) => {
        const t = new Date(e.recorded_at).getTime();
        return t >= desde && t < hasta;
      })
      .map((e) => Number(e.value))
      .filter(Number.isFinite);
    out.push({
      label: i === 0 ? 'Esta semana' : `Sem ${semanas - i}`,
      valor: vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null,
    });
  }
  return out;
}

// ── Documentos propios ──────────────────────────────────────────────────────

/** Documentos que puede tener el deportista: el catálogo sin los del acudiente. */
export const DOCUMENTOS_PROPIOS = DOCUMENTOS_DEPORTISTA.filter((d) => d.grupo !== 'acudiente' && !d.tipo.startsWith('guardian_'));
