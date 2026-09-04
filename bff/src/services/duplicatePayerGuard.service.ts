/**
 * duplicatePayerGuard — excluye cobros de correos automáticos cuando el
 * MISMO atleta ya pagó ese período en OTRA ficha suya (identidad duplicada).
 *
 * Puerto directo de `frontend/src/lib/api/payment-reminders.ts`
 * (`generateReminders`): esa pantalla es manual (un admin revisa y puede
 * deseleccionar), pero los jobs de correo automático (`payment-lifecycle-emails.job.ts`)
 * no tienen a nadie revisando antes de enviar — sin este guard, el incidente
 * de Dynasty (ago-2026: recordatorios a familias que ya habían pagado bajo
 * una ficha gemela del mismo hijo) se repite, pero sin nadie mirando.
 *
 * Mantener esta lógica en sincronía con la del frontend si alguna cambia —
 * ambas resuelven el mismo problema de datos (nombres duplicados, no un ID
 * de documento confiable).
 */
import { supabase } from '../config/supabase';

interface PagoMinimo {
    id: string;
    child_id: string | null;
    unregistered_athlete_id: string | null;
    user_id: string | null;
    parent_id: string | null;
    amount: number;
    due_date: string | null;
    period_year: number | null;
    period_month: number | null;
    concept: string | null;
}

const periodoDe = (p: Pick<PagoMinimo, 'period_year' | 'period_month' | 'due_date'>): string =>
    p.period_year && p.period_month
        ? `${p.period_year}-${String(p.period_month).padStart(2, '0')}`
        : (p.due_date || '').slice(0, 7);

const sujetoDe = (p: Pick<PagoMinimo, 'child_id' | 'unregistered_athlete_id' | 'user_id'>): string =>
    p.child_id || p.unregistered_athlete_id || p.user_id || '';

// Tokens del nombre sin acentos — comparar la cadena completa no alcanza:
// "Gabriela Núñez" y "Gabriela nuñez osorio" son la misma niña con un
// apellido de más en una de las dos fichas. Se compara por SUBCONJUNTO.
const tokensNombre = (s: string): Set<string> => new Set(
    (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z\s]/g, ' ').trim()
        .split(/\s+/).filter(t => t.length >= 3),
);

// Mismo nombre, o el de uno contenido en el del otro, con 2+ tokens en
// común. Exigir 2 evita emparejar a cualquiera que comparta solo un apellido.
const mismoNombre = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size < 2 || b.size < 2) return false;
    const comunes = [...a].filter(t => b.has(t)).length;
    return comunes >= 2 && (comunes === a.size || comunes === b.size);
};

// Matrícula/uniforme/torneo no cancelan la mensualidad ni al revés.
// OJO: `payment_type` no sirve para esto — la mensualidad pagada puede venir
// como 'one_time' y la duplicada como 'subscription' (visto en Dynasty).
const esUnicaVez = (c?: string | null): boolean =>
    /matricul|inscripcion|uniforme|torneo|examen|carnet|kit|implement|multa|sancion/
        .test((c || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());

/**
 * Dado un conjunto de cobros candidatos (pendientes/vencidos) de una escuela,
 * devuelve el subconjunto de sus IDs que hay que EXCLUIR de un correo
 * automático porque el mismo atleta (sujeto exacto, o nombre-gemelo en otra
 * ficha) ya pagó ese período.
 */
export async function findDuplicatePaymentIds(
    schoolId: string,
    candidatos: PagoMinimo[],
): Promise<Set<string>> {
    if (candidatos.length === 0) return new Set();

    const { data: pagados } = await supabase
        .from('payments')
        .select('id, child_id, unregistered_athlete_id, user_id, amount, due_date, period_year, period_month, concept')
        .eq('school_id', schoolId)
        .in('status', ['paid', 'partial']);

    if (!pagados || pagados.length === 0) return new Set();

    const candidateChildIds = [...new Set(candidatos.map(c => c.child_id).filter(Boolean))] as string[];
    const candidateUnregIds = [...new Set(candidatos.map(c => c.unregistered_athlete_id).filter(Boolean))] as string[];

    const pagChildIds = [...new Set(pagados.map(q => q.child_id).filter(Boolean))]
        .filter(id => !candidateChildIds.includes(id as string)) as string[];
    const pagUnregIds = [...new Set(pagados.map(q => q.unregistered_athlete_id).filter(Boolean))]
        .filter(id => !candidateUnregIds.includes(id as string)) as string[];

    const [{ data: candChildren }, { data: candUnreg }, { data: pagChildren }, { data: pagUnreg }] = await Promise.all([
        candidateChildIds.length
            ? supabase.from('children').select('id, full_name').in('id', candidateChildIds)
            : Promise.resolve({ data: [] as any[] }),
        candidateUnregIds.length
            ? supabase.from('unregistered_athletes').select('id, full_name').in('id', candidateUnregIds)
            : Promise.resolve({ data: [] as any[] }),
        pagChildIds.length
            ? supabase.from('children').select('id, full_name').in('id', pagChildIds)
            : Promise.resolve({ data: [] as any[] }),
        pagUnregIds.length
            ? supabase.from('unregistered_athletes').select('id, full_name').in('id', pagUnregIds)
            : Promise.resolve({ data: [] as any[] }),
    ]);

    const nombrePorId = new Map<string, string>([
        ...(candChildren || []).map(c => [c.id, c.full_name] as [string, string]),
        ...(candUnreg || []).map(u => [u.id, u.full_name] as [string, string]),
        ...(pagChildren || []).map(c => [c.id, c.full_name] as [string, string]),
        ...(pagUnreg || []).map(u => [u.id, u.full_name] as [string, string]),
    ]);

    const pagadoPorSujeto = new Set<string>(); // sujeto|periodo
    const pagadoPorPeriodo = new Map<string, { sujeto: string; toks: Set<string> }[]>();
    for (const q of pagados) {
        if (esUnicaVez(q.concept)) continue;
        const per = periodoDe(q as any);
        if (!per) continue;
        const subj = sujetoDe(q as any);
        if (subj) pagadoPorSujeto.add(`${subj}|${per}`);
        const toks = tokensNombre(nombrePorId.get(subj) || '');
        if (toks.size >= 2) {
            if (!pagadoPorPeriodo.has(per)) pagadoPorPeriodo.set(per, []);
            pagadoPorPeriodo.get(per)!.push({ sujeto: subj, toks });
        }
    }

    const excluidos = new Set<string>();
    for (const c of candidatos) {
        const per = periodoDe(c);
        const subj = sujetoDe(c);

        // Certeza: el MISMO sujeto ya tiene ese período pagado.
        if (per && subj && pagadoPorSujeto.has(`${subj}|${per}`)) {
            excluidos.add(c.id);
            continue;
        }

        // Probable: nombre-gemelo en otro sujeto ya pagó ese período.
        if (per && !esUnicaVez(c.concept)) {
            const misToks = tokensNombre(nombrePorId.get(subj) || '');
            const gemelo = (pagadoPorPeriodo.get(per) || []).find(
                x => x.sujeto !== subj && mismoNombre(misToks, x.toks),
            );
            if (gemelo) excluidos.add(c.id);
        }
    }

    return excluidos;
}
